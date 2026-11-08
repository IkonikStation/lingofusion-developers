import { billing } from './billing.mjs';
import { AUDIO_RATE, MAX_AUDIO_SECONDS, audioCharge, wavSamples } from '../shared/transcription.mjs';
const hash = async b => [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))].map(x => x.toString(16).padStart(2,'0')).join('');
const bytes = s => new TextEncoder().encode(s);
const identity = (email, operationId, fingerprint) => ({ email, operationId, fingerprint });
async function reserve(env, who, maximumMicros) { return billing(env, { action: 'usageReserve', ...who, maximumMicros }); }
async function uncertain(env, who) { await billing(env, { action: 'usageUncertain', ...who }).catch(() => {}); }
export async function transcriptionRequest(request, env, auth, respond, providerFetch = fetch) {
  if (!env.OPENAI_API_KEY || !env.BILLING || !env.GIFTS) return respond({error:'transcription_unavailable'},503);
  const operationId = request.headers.get('Idempotency-Key');
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(operationId || '')) return respond({error:'A valid Idempotency-Key is required'},400);
  let form, file, samples;
  try {
    if (Number(request.headers.get('Content-Length')) > 9000000) throw new Error('Audio upload too large');
    const reader=request.body?.getReader();
    if(!reader)throw new Error('Audio upload required');
    const chunks=[];let length=0;
    while(true){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>9100000){await reader.cancel();throw new Error('Audio upload too large');}chunks.push(part.value);}
    form = await new Response(new Blob(chunks),{headers:{'Content-Type':request.headers.get('Content-Type')||''}}).formData(); file = form.get('file');
    if (!file || typeof file.arrayBuffer !== 'function' || file.size > 9000000) throw new Error('A supported audio file is required');
    if (form.get('model') !== 'LingoFusion Transcribe') throw new Error('File transcription requires LingoFusion Transcribe');
    samples = wavSamples(await file.arrayBuffer());
  } catch(e) { return respond({error:'invalid_audio',message:e.message},400); }
  const fingerprint = await hash(await file.arrayBuffer());
  const who = identity(auth.email, operationId, 'transcribe-v1:'+fingerprint);
  const micros = audioCharge(samples, 10000);
  let held;
  try { held = await reserve(env, who, micros); }
  catch(e) { return respond({error:e.message}, /Insufficient/.test(e.message)?402:409); }
  if (held.replay) return held.status === 'settled' ? respond({...held.result,balance_usd:held.balance_usd,replay:true}) : respond({error:'request_pending_reconciliation',operation_id:operationId},409);
  try {
    const payload = new FormData(); payload.set('file',file,'audio.wav'); payload.set('model','gpt-transcribe');
    const r = await providerFetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`},body:payload,signal:AbortSignal.timeout(120000)});
    if (!r.ok) throw new Error('Transcription provider request requires reconciliation');
    const data = await r.json();
    if (typeof data.text !== 'string') throw new Error('Provider transcript missing');
    const result = {model:'LingoFusion Transcribe',text:data.text,duration_seconds:samples/AUDIO_RATE,cost_usd:micros/1e6,operation_id:operationId};
    const settled = await billing(env,{action:'usageFinish',...who,actualMicros:micros,result,evidence:{providerRequestId:r.headers.get('x-request-id') || 'transcribe-'+crypto.randomUUID(),upstreamModel:'gpt-transcribe',samples,providerUsage:data.usage}});
    return respond({...result,balance_usd:settled.balance_usd});
  } catch(e) { await uncertain(env,who); return respond({error:'transcription_requires_reconciliation',message:e.message,operation_id:operationId},502); }
}
export async function createLiveTranscription(request, env, auth, respond) {
  if (!env.OPENAI_API_KEY || !env.BILLING || !env.GIFTS) return respond({error:'transcription_unavailable'},503);
  const body = await request.json().catch(()=>null);
  const maxSeconds = body?.maximum_seconds ?? 60;
  const operationId = request.headers.get('Idempotency-Key');
  if (!Number.isInteger(maxSeconds) || maxSeconds < 1 || maxSeconds > MAX_AUDIO_SECONDS || !/^[A-Za-z0-9_-]{1,100}$/.test(operationId||'')) return respond({error:'Invalid session bounds or Idempotency-Key'},400);
  const who = identity(auth.email,operationId,'live-transcribe-v1:'+maxSeconds);
  let held;
  try { held = await reserve(env,who,audioCharge(maxSeconds*AUDIO_RATE,30000)); }
  catch(e) { return respond({error:e.message},/Insufficient/.test(e.message)?402:409); }
  if (held.replay) return respond({error:'Recover the existing session instead of starting another',operation_id:operationId},409);
  const ticket = crypto.randomUUID().replaceAll('-','');
  try {
    await env.GIFTS.put('transcriptionTicket:'+ticket,JSON.stringify({...who,maxSeconds}),{expirationTtl:120});
  } catch {
    // No provider can claim a session after this atomic cancellation.
    await billing(env,{action:'usageCancelUnclaimedLive',email:auth.email,operationId});
    return respond({error:'Session could not be created; reserved credit returned'},503);
  }
  return respond({operation_id:operationId,ticket,websocket_url:new URL('/api/transcription/socket',request.url).href.replace(/^http/,'ws'),maximum_seconds:maxSeconds,maximum_cost_usd:audioCharge(maxSeconds*AUDIO_RATE,30000)/1e6});
}
export async function connectLiveTranscription(request,env,respond,context,providerFetch=fetch) {
  if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return respond({error:'WebSocket required'},426);
  const protocols=(request.headers.get('Sec-WebSocket-Protocol')||'').split(',').map(x=>x.trim());
  const ticket=protocols.find(x=>/^[a-f0-9]{32}$/.test(x));
  const raw=ticket && await env.GIFTS.get('transcriptionTicket:'+ticket);
  if(!raw) return respond({error:'Session ticket expired or invalid'},401);
  const who=JSON.parse(raw);
  try { await billing(env,{action:'usageClaimLive',...who}); }
  catch { return respond({error:'Session already used'},409); }
  let upstream,providerReceiptId='realtime-'+crypto.randomUUID();
  try {
    await env.GIFTS.delete('transcriptionTicket:'+ticket);
    const r=await providerFetch('https://api.openai.com/v1/realtime?intent=transcription',{headers:{Upgrade:'websocket',Authorization:`Bearer ${env.OPENAI_API_KEY}`},signal:AbortSignal.timeout(15000)});
    upstream=r.webSocket;
    if(!upstream) throw new Error('Realtime provider connection unavailable');
    providerReceiptId=r.headers?.get('x-request-id') || providerReceiptId;
    upstream.accept();
  } catch {
    try { upstream?.close(); } catch {}
    // The browser cannot send audio before this connection is returned.
    try {
      await billing(env,{action:'usageReleaseUnsentLive',email:who.email,operationId:who.operationId});
      return respond({error:'live_connection_failed',message:'Live transcription could not connect. Reserved credit returned. Please try again.',operation_id:who.operationId},503);
    } catch {
      await uncertain(env,who);
      return respond({error:'live_session_requires_reconciliation',message:'Live transcription could not connect. Recover the session to release its reserved credit.',operation_id:who.operationId},502);
    }
  }
  const pair=new WebSocketPair(),client=pair[0],server=pair[1]; server.accept();
  let sampleCount=0,bufferSamples=0,pending=0,finishing=false,closed=false,ready=false,queue=Promise.resolve();
  const turns=new Map(); let timer,grace;
  const send=x=>{try{server.send(JSON.stringify(x));}catch{}};
  const close=()=>{closed=true;clearTimeout(timer);clearTimeout(grace);try{upstream.close();}catch{} try{server.close(1000,'Finished');}catch{}};
  const background=promise=>{context?.waitUntil?.(promise);return promise;};
  const fail=async message=>{
    if(closed)return;
    closed=true; // Freeze audio forwarding before deciding whether any audio was sent.
    if(sampleCount===0){
      try{
        const released=await billing(env,{action:'usageReleaseUnsentLive',email:who.email,operationId:who.operationId});
        send({type:'settled',...released.result,balance_usd:released.balance_usd});close();return;
      }catch{}
    }
    await uncertain(env,who);send({type:'error',message,operation_id:who.operationId});close();
  };
  const finish=async()=>{
    if(closed||!finishing||pending)return;
    try{
      const micros=audioCharge(sampleCount,30000);
      const result={model:'LingoFusion Live Transcribe',text:[...turns.values()].join('\n'),duration_seconds:sampleCount/AUDIO_RATE,cost_usd:micros/1e6,operation_id:who.operationId};
      const settled=await billing(env,{action:'usageFinish',...who,actualMicros:micros,result,evidence:{providerRequestId:providerReceiptId,upstreamModel:'gpt-live-transcribe',samples:sampleCount}});
      send({type:'settled',...result,balance_usd:settled.balance_usd});close();
    }catch{await fail('Live usage requires reconciliation');}
  };
  const commit=()=>{if(bufferSamples>=2400){pending++;upstream.send(JSON.stringify({type:'input_audio_buffer.commit'}));bufferSamples=0;}};
  const stop=()=>{if(finishing||closed)return;finishing=true;send({type:'finishing'});try{commit();grace=setTimeout(()=>background(fail('Final transcript did not arrive. Recover this session to release reserved credit after it expires.')),20000);background(finish());}catch{background(fail('Provider disconnected while finishing. Recover this session before starting another.'));}};
  upstream.addEventListener('message',event=>{
    queue=queue.then(async()=>{
      if(closed)return;
      const data=JSON.parse(event.data);
      if(data.type==='session.updated'){ready=true;send({type:'ready'});}
      else if(data.type==='input_audio_buffer.committed'){if(!turns.has(data.item_id))turns.set(data.item_id,'');send(data);}
      else if(data.type==='conversation.item.input_audio_transcription.delta'){
        turns.set(data.item_id,(turns.get(data.item_id)||'')+data.delta);
        await billing(env,{action:'usageLiveCheckpoint',...who,liveCheckpoint:{samples:sampleCount,text:[...turns.values()].join('\n'),providerRequestId:providerReceiptId}});
        if(!closed)send(data);
      }
      else if(data.type==='conversation.item.input_audio_transcription.completed'){
        if(!completed.has(data.item_id)){
          turns.set(data.item_id,data.transcript);pending=Math.max(0,pending-1);
          // Duplicate completion IDs are tracked separately without polluting transcript order.
          completed.add(data.item_id);
        }
        await billing(env,{action:'usageLiveCheckpoint',...who,liveCheckpoint:{samples:sampleCount,text:[...turns.values()].join('\n'),providerRequestId:providerReceiptId}});
        if(!closed)send(data);await finish();
      }else if(data.type==='error'||data.type==='conversation.item.input_audio_transcription.failed')await fail('Live transcription failed; recover this session before retrying');
    }).catch(()=>fail('Live transcription was interrupted. Recover this session before starting another.'));
    background(queue);
  });
  const completed=new Set();
  upstream.addEventListener('close',()=>{if(!closed)background(fail('Provider disconnected. Recover this session before starting another.'));});
  upstream.addEventListener('error',()=>background(fail('Provider connection failed. Recover this session before starting another.')));
  server.addEventListener('message',event=>{
    if(closed)return;
    try{
      if(typeof event.data!=='string'||event.data.length>70000)throw new Error('Invalid audio message');
      const data=JSON.parse(event.data);
      if(data.type==='finish'){stop();return;}
      // Frames already in transit after the duration cap must not invalidate a finished session.
      if(finishing)return;
      if(!ready)throw new Error('Session not accepting audio');
      if(data.type==='input_audio_buffer.append'){
        const pcm=atob(data.audio);if(!pcm.length||pcm.length%2||pcm.length>48000)throw new Error('Invalid PCM frame');
        if(sampleCount+pcm.length/2>who.maxSeconds*AUDIO_RATE){stop();return;}
        sampleCount+=pcm.length/2;bufferSamples+=pcm.length/2;
        upstream.send(JSON.stringify({type:data.type,audio:data.audio}));
        if(bufferSamples>=5*AUDIO_RATE)commit();
        if(sampleCount>=who.maxSeconds*AUDIO_RATE)stop();
      }else throw new Error('Unsupported live event');
    }catch{background(fail('Invalid live audio request. Recover this session before starting another.'));}
  });
  server.addEventListener('close',()=>{if(!closed)stop();});
  server.addEventListener('error',()=>{if(!closed)stop();});
  timer=setTimeout(stop,(who.maxSeconds+20)*1000);
  try { upstream.send(JSON.stringify({type:'session.update',session:{type:'transcription',audio:{input:{format:{type:'audio/pcm',rate:AUDIO_RATE},transcription:{model:'gpt-live-transcribe'},turn_detection:null}}}})); }
  catch { await fail('Provider session could not be configured.'); }
  return new Response(null,{status:101,webSocket:client,headers:{'Sec-WebSocket-Protocol':'lingofusion-transcription'}});
}
