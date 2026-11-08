import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { harness } from './billing-test-harness.mjs';
import worker from '../cloudflare-worker/worker.mjs';
import { billing } from '../cloudflare-worker/billing.mjs';
import { audioCharge,wavSamples } from '../shared/transcription.mjs';
import { connectLiveTranscription } from '../cloudflare-worker/transcription.mjs';
function wav(seconds=1) {
  const b=new ArrayBuffer(44+seconds*48000),v=new DataView(b),a=new Uint8Array(b);
  const str=(n,t)=>[...t].forEach((c,i)=>a[n+i]=c.charCodeAt(0));
  str(0,'RIFF');str(8,'WAVE');str(12,'fmt ');str(36,'data');
  v.setUint32(4,b.byteLength-8,true);v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,24000,true);v.setUint32(28,48000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);v.setUint32(40,b.byteLength-44,true);return b;
}
const email='transcription@example.invalid';
const setup=()=>{const h=harness();h.records.set(`user_balance:${email}`,'1');h.env.OPENAI_API_KEY='synthetic-only';return h;};
const request=(h,op='file-one',model='LingoFusion Transcribe')=>{const f=new FormData();f.set('file',new Blob([wav()],{type:'audio/wav'}),'one.wav');f.set('model',model);f.set('duration','0.0001');return new Request('https://gateway.test/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${h.auth(email)}`,'Idempotency-Key':op},body:f});};

test('duration and rates are computed from validated PCM, with one monetary rounding',()=>{
 assert.equal(wavSamples(wav()),24000);assert.equal(audioCharge(24000,10000),167);assert.equal(audioCharge(24000*60,10000),10000);assert.equal(audioCharge(24000*60,30000),30000);
 const b=wav();new DataView(b).setUint32(24,48000,true);assert.throws(()=>wavSamples(b));assert.throws(()=>wavSamples(wav(181)));
});
test('file route reserves first, maps GPT-Transcribe, meters real audio bytes, and replays without dispatch',async()=>{
 const h=setup(),original=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,opts)=>{assert.equal(url,'https://api.openai.com/v1/audio/transcriptions');assert.equal(opts.body.get('model'),'gpt-transcribe');assert.equal(opts.headers.Authorization,'Bearer synthetic-only');
 const hold=h.objects.get('billing:ledger-v1').data.get(`meteredUsage:${email}:file-one`);assert.equal(hold.status,'dispatched');assert.equal(hold.maximumMicros,167);calls++;return Response.json({text:'Hello world',usage:{type:'duration',seconds:1}},{headers:{'x-request-id':'synthetic-file-receipt'}});};
 try{
  const response=await worker.fetch(request(h),h.env);assert.equal(response.status,200,await response.clone().text());const d=await response.json();assert.equal(d.duration_seconds,1);assert.equal(d.cost_usd,0.000167);assert.equal(d.balance_usd,0.999833);assert.equal(d.text,'Hello world');
  const replay=await worker.fetch(request(h),h.env);assert.equal(replay.status,200);assert.equal((await replay.json()).replay,true);assert.equal(calls,1);
 }finally{globalThis.fetch=original;}
});
test('unauthenticated, retired Mini, and unfunded requests cannot dispatch; ambiguous outcomes retain reservation',async()=>{
 const h=setup(),original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('synthetic unknown provider outcome');};
 try{
  assert.equal((await h.api('/api/transcription/file',{},'')).status,401);
  assert.equal((await worker.fetch(request(h,'mini','LingoFusion Transcribe Mini'),h.env)).status,400);
  h.records.set(`user_balance:${email}`,'0');assert.equal((await worker.fetch(request(h),h.env)).status,402);assert.equal(calls,0);
  const funded=setup();assert.equal((await worker.fetch(request(funded),funded.env)).status,502);assert.equal(calls,1);
  assert.equal((await worker.fetch(request(funded),funded.env)).status,409);assert.equal(calls,1);
  const status=await billing(funded.env,{action:'usageStatus',email,operationId:'file-one'});assert.equal(status.status,'uncertain');assert.equal(status.held_usd,0.000167);
 }finally{globalThis.fetch=original;}
});
test('live tickets reserve credit and cancellation before provider claim returns it exactly once',async()=>{
 const h=setup();const response=await h.api('/api/transcription/live',{maximum_seconds:60},email,{'Idempotency-Key':'live-unclaimed'});assert.equal(response.status,200);const d=await response.json();assert.ok(d.ticket);assert.equal(d.maximum_cost_usd,0.03);
 const cancel=()=>h.api('/api/transcription/cancel',{operation_id:'live-unclaimed'},email);
 assert.equal((await (await cancel()).json()).balance_usd,1);assert.equal((await (await cancel()).json()).balance_usd,1);
 await assert.rejects(()=>billing(h.env,{action:'usageClaimLive',email,operationId:'live-unclaimed',fingerprint:'live-transcribe-v1:60'}));
});
class Socket {
 constructor(){this.handlers={};this.received=[];this.closed=false;}
 accept(){}
 addEventListener(type,fn){(this.handlers[type]??=[]).push(fn);}
 emit(type,data){for(const fn of this.handlers[type]||[])fn({data});}
 send(data){this.peer.received.push(JSON.parse(data));this.peer.emit('message',data);}
 close(){if(this.closed)return;this.closed=true;this.emit('close');if(this.peer&&!this.peer.closed){this.peer.closed=true;this.peer.emit('close');}}
}
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,1));}throw Error('Synthetic socket operation did not complete');}

test('live socket uses GPT-Live-Transcribe, meters PCM, releases unused hold and rejects ticket reuse',async()=>{
 const h=setup(),nativeResponse=globalThis.Response,nativePair=globalThis.WebSocketPair;
 const r=await h.api('/api/transcription/live',{maximum_seconds:1},email,{'Idempotency-Key':'live-test'});const session=await r.json();
 globalThis.WebSocketPair=class{constructor(){this[0]=new Socket();this[1]=new Socket();this[0].peer=this[1];this[1].peer=this[0];}};
 globalThis.Response=class extends nativeResponse{constructor(body,init={}){super(body,{...init,status:init.status===101?200:init.status});if(init.status===101){Object.defineProperty(this,'status',{value:101});this.webSocket=init.webSocket;}}};
 const upstream=new Socket();let appended=0,configured=false;
 upstream.send=raw=>{const d=JSON.parse(raw);if(d.type==='session.update'){
  assert.equal(d.session.type,'transcription');assert.equal(d.session.audio.input.transcription.model,'gpt-live-transcribe');assert.equal(d.session.audio.input.format.rate,24000);assert.equal(d.session.audio.input.turn_detection,null);configured=true;queueMicrotask(()=>upstream.emit('message',JSON.stringify({type:'session.updated'})));
 }else if(d.type==='input_audio_buffer.append'){appended+=atob(d.audio).length;}
 else if(d.type==='input_audio_buffer.commit'){queueMicrotask(()=>{upstream.emit('message',JSON.stringify({type:'input_audio_buffer.committed',item_id:'turn-1'}));upstream.emit('message',JSON.stringify({type:'conversation.item.input_audio_transcription.delta',item_id:'turn-1',delta:'Live text'}));upstream.emit('message',JSON.stringify({type:'conversation.item.input_audio_transcription.completed',item_id:'turn-1',transcript:'Live text'}));});}};
 const req=()=>new Request('https://gateway.test/api/transcription/socket',{headers:{Upgrade:'websocket','Sec-WebSocket-Protocol':'lingofusion-transcription,'+session.ticket}});
 try{
  const response=await connectLiveTranscription(req(),h.env,(d,s=200)=>nativeResponse.json(d,{status:s}),{},async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/realtime?intent=transcription');assert.equal(options.headers.Authorization,'Bearer synthetic-only');return {webSocket:upstream};});
  assert.equal(response.status,101);const client=response.webSocket;
  await until(()=>client.received.some(x=>x.type==='ready'));assert.ok(configured);
  client.send(JSON.stringify({type:'input_audio_buffer.append',audio:btoa(String.fromCharCode(...new Uint8Array(48000)))}));client.send(JSON.stringify({type:'input_audio_buffer.append',audio:btoa(String.fromCharCode(...new Uint8Array(48000)))}));client.send(JSON.stringify({type:'finish'}));
  await until(()=>client.received.some(x=>x.type==='settled'));const settled=client.received.find(x=>x.type==='settled');
  assert.equal(appended,48000);assert.equal(settled.duration_seconds,1);assert.equal(settled.cost_usd,0.0005);assert.equal(settled.balance_usd,0.9995);assert.equal(settled.text,'Live text');
  assert.equal((await connectLiveTranscription(req(),h.env,(d,s=200)=>nativeResponse.json(d,{status:s}),{})).status,401);
 }finally{globalThis.Response=nativeResponse;globalThis.WebSocketPair=nativePair;}
});

test('ticket storage failure refunds the undispatched session; claimed sessions cannot be cancelled',async()=>{
 const h=setup(),put=h.env.GIFTS.put;
 h.env.GIFTS.put=async(key,value)=>{if(key.startsWith('transcriptionTicket:'))throw Error('synthetic ticket outage');return put(key,value);};
 assert.equal((await h.api('/api/transcription/live',{},email,{'Idempotency-Key':'ticket-outage'})).status,503);
 assert.equal((await billing(h.env,{action:'usageStatus',email,operationId:'ticket-outage'})).balance_usd,1);
 h.env.GIFTS.put=put;
 await h.api('/api/transcription/live',{},email,{'Idempotency-Key':'claimed'});
 await billing(h.env,{action:'usageClaimLive',email,operationId:'claimed',fingerprint:'live-transcribe-v1:60'});
 assert.equal((await h.api('/api/transcription/cancel',{operation_id:'claimed'},email)).status,409);
 assert.equal((await h.api('/api/transcription/cancel',{operation_id:'claimed'},'other@example.invalid')).status,409);
 assert.equal((await billing(h.env,{action:'usageStatus',email,operationId:'claimed'})).held_usd,0.03);
 await assert.rejects(()=>billing(h.env,{action:'usageClaimLive',email,operationId:'claimed',fingerprint:'live-transcribe-v1:60'}));
});

function expireLive(h, operationId, legacy=false) {
 const data=h.objects.get('billing:ledger-v1').data,key=`meteredUsage:${email}:${operationId}`;
 const record=data.get(key);record.createdAt=Date.now()-600000;
 if(legacy)delete record.liveClaimedAt;else record.liveClaimedAt=Date.now()-600000;
 data.set(key,record);
}
test('live recovery waits for active claims and atomically releases expired legacy holds once',async()=>{
 const h=setup(),op='recover-legacy';
 await h.api('/api/transcription/live',{},email,{'Idempotency-Key':op});
 await billing(h.env,{action:'usageClaimLive',email,operationId:op,fingerprint:'live-transcribe-v1:60'});
 const recover=()=>h.api('/api/transcription/recover',{operation_id:op,createdAt:0,maximum_seconds:0},email);
 const waiting=await (await recover()).json();assert.equal(waiting.pending,true);assert.ok(waiting.retry_after_seconds>0);assert.equal(waiting.held_usd,0.03);
 assert.equal((await billing(h.env,{action:'usageStatus',email,operationId:op})).balance_usd,0.97);
 assert.equal((await h.api('/api/transcription/recover',{operation_id:op},'other@example.invalid')).status,409);
 assert.equal((await h.api('/api/transcription/recover',{operation_id:op},'')).status,401);
 expireLive(h,op,true);
 const results=await Promise.all(Array.from({length:12},recover));
 for(const r of results){assert.equal(r.status,200);const d=await r.json();assert.equal(d.balance_usd,1);assert.equal(d.result.cost_usd,0);assert.equal(d.result.recovery_status,'released');}
 const record=h.objects.get('billing:ledger-v1').data.get(`meteredUsage:${email}:${op}`);
 assert.equal(record.evidence.providerCostUnknown,true);assert.equal(record.evidence.merchantAbsorbsUnverifiedUsage,true);assert.equal(record.evidence.confirmedNoDispatch,undefined);
 assert.equal((await billing(h.env,{action:'usageStatus',email,operationId:op})).held_usd,0);
 await assert.rejects(()=>billing(h.env,{action:'usageClaimLive',email,operationId:op,fingerprint:'live-transcribe-v1:60'}));
 await assert.rejects(()=>billing(h.env,{action:'usageFinish',email,operationId:op,fingerprint:'live-transcribe-v1:60',actualMicros:500,result:{},evidence:{providerRequestId:'late'}}),/Conflicting settlement/);
});
test('recovery does not refund file requests or overwrite settled paid live sessions',async()=>{
 const h=setup();
 await billing(h.env,{action:'usageReserve',email,operationId:'file-hold',fingerprint:'transcribe-v1:file-hash',maximumMicros:1000});
 assert.equal((await h.api('/api/transcription/recover',{operation_id:'file-hold'},email)).status,409);
 const op='settled-live';await h.api('/api/transcription/live',{},email,{'Idempotency-Key':op});
 await billing(h.env,{action:'usageClaimLive',email,operationId:op,fingerprint:'live-transcribe-v1:60'});
 const result={model:'LingoFusion Live Transcribe',text:'Saved transcript',duration_seconds:1,cost_usd:0.0005,operation_id:op};
 await billing(h.env,{action:'usageFinish',email,operationId:op,fingerprint:'live-transcribe-v1:60',actualMicros:500,result,evidence:{providerRequestId:'saved-live'}});
 const recovered=await (await h.api('/api/transcription/recover',{operation_id:op},email)).json();
 assert.deepEqual(recovered.result,result);assert.equal(recovered.balance_usd,0.9985);
});
test('provider upgrade failure releases the claimed hold without sending audio or retrying provider work',async()=>{
 const h=setup(),op='upgrade-failure';
 const session=await (await h.api('/api/transcription/live',{},email,{'Idempotency-Key':op})).json();let calls=0;
 const req=()=>new Request('https://gateway.test/api/transcription/socket',{headers:{Upgrade:'websocket','Sec-WebSocket-Protocol':'lingofusion-transcription,'+session.ticket}});
 const respond=(d,s=200)=>Response.json(d,{status:s});
 const failure=async()=>{calls++;throw Error('synthetic provider upgrade failure');};
 const r=await connectLiveTranscription(req(),h.env,respond,{},failure);assert.equal(r.status,503);assert.match((await r.json()).message,/credit returned/);
 const status=await billing(h.env,{action:'usageStatus',email,operationId:op});assert.equal(status.status,'settled');assert.equal(status.held_usd,0);assert.equal(status.balance_usd,1);
 assert.equal((await connectLiveTranscription(req(),h.env,respond,{},failure)).status,401);assert.equal(calls,1);
});
test('expired recovery preserves complimentary balances and survives projection failures',async()=>{
 const h=setup(),op='recover-projection';
 await h.api('/api/transcription/live',{},email,{'Idempotency-Key':op});
 await billing(h.env,{action:'usageClaimLive',email,operationId:op,fingerprint:'live-transcribe-v1:60'});expireLive(h,op);
 h.setProjectionFailure(true);
 const released=await (await h.api('/api/transcription/recover',{operation_id:op},email)).json();assert.equal(released.balance_usd,1);
 h.setProjectionFailure(false);
 const replay=await (await h.api('/api/transcription/recover',{operation_id:op},email)).json();assert.equal(replay.balance_usd,1);
 const unlimited=setup();unlimited.env.UNLIMITED_OWNER_EMAIL_SHA256=createHash('sha256').update(email).digest('hex');
 await unlimited.api('/api/transcription/live',{},email,{'Idempotency-Key':op});
 await billing(unlimited.env,{action:'usageClaimLive',email,operationId:op,fingerprint:'live-transcribe-v1:60'});
 assert.equal((await billing(unlimited.env,{action:'usageStatus',email,operationId:op})).complimentary,true);expireLive(unlimited,op);
 const r=await (await unlimited.api('/api/transcription/recover',{operation_id:op},email)).json();assert.equal(r.balance_usd,1);
});

test('socket configuration and zero-audio errors release credit; interrupted audio remains held until expired recovery',async()=>{
 const nativeResponse=globalThis.Response,nativePair=globalThis.WebSocketPair;
 globalThis.WebSocketPair=class{constructor(){this[0]=new Socket();this[1]=new Socket();this[0].peer=this[1];this[1].peer=this[0];}};
 globalThis.Response=class extends nativeResponse{constructor(body,init={}){super(body,{...init,status:init.status===101?200:init.status});if(init.status===101){Object.defineProperty(this,'status',{value:101});this.webSocket=init.webSocket;}}};
 try {
  for(const scenario of ['setup-failure','zero-audio-error','audio-disconnect']){
   const h=setup(),op=scenario,waits=[];
   const session=await (await h.api('/api/transcription/live',{},email,{'Idempotency-Key':op})).json();
   const upstream=new Socket();upstream.send=raw=>{const d=JSON.parse(raw);if(d.type==='session.update'){
    if(scenario==='setup-failure')throw Error('synthetic configuration failure');
    queueMicrotask(()=>upstream.emit('message',JSON.stringify({type:'session.updated'})));
   }};
   const req=new Request('https://gateway.test/api/transcription/socket',{headers:{Upgrade:'websocket','Sec-WebSocket-Protocol':'lingofusion-transcription,'+session.ticket}});
   const r=await connectLiveTranscription(req,h.env,(d,s=200)=>nativeResponse.json(d,{status:s}),{waitUntil:p=>waits.push(p)},async()=>({webSocket:upstream}));
   const client=r.webSocket;
   if(scenario!=='setup-failure')await until(()=>client.received.some(x=>x.type==='ready'));
   if(scenario==='audio-disconnect')client.send(JSON.stringify({type:'input_audio_buffer.append',audio:btoa(String.fromCharCode(...new Uint8Array(48000)))}));
   if(scenario==='zero-audio-error')upstream.emit('message',JSON.stringify({type:'error',error:{message:'synthetic provider configuration rejection'}}));
   if(scenario==='audio-disconnect')upstream.close();
   await until(()=>client.received.some(x=>x.type===(scenario==='audio-disconnect'?'error':'settled')));
   await Promise.all(waits);
   let status=await billing(h.env,{action:'usageStatus',email,operationId:op});
   if(scenario==='audio-disconnect'){
    assert.equal(status.status,'uncertain');assert.equal(status.balance_usd,0.97);
    assert.equal((await (await h.api('/api/transcription/recover',{operation_id:op},email)).json()).pending,true);
    expireLive(h,op);await h.api('/api/transcription/recover',{operation_id:op},email);
    status=await billing(h.env,{action:'usageStatus',email,operationId:op});
   }
   assert.equal(status.status,'settled');assert.equal(status.cost_usd,0);assert.equal(status.balance_usd,1);
  }
 }finally{globalThis.Response=nativeResponse;globalThis.WebSocketPair=nativePair;}
});

test('recovery retains durable partial transcript and charges recorded audio once',async()=>{
 const h=setup(),op='partial-checkpoint',who={email,operationId:op,fingerprint:'live-transcribe-v1:60'};
 await h.api('/api/transcription/live',{},email,{'Idempotency-Key':op});await billing(h.env,{action:'usageClaimLive',...who});
 const liveCheckpoint={samples:24000,text:'Recovered partial transcript',providerRequestId:'partial-provider'};
 await billing(h.env,{action:'usageLiveCheckpoint',...who,liveCheckpoint});
 await assert.rejects(()=>billing(h.env,{action:'usageLiveCheckpoint',...who,liveCheckpoint:{...liveCheckpoint,samples:1}}));
 await assert.rejects(()=>billing(h.env,{action:'usageReleaseUnsentLive',email,operationId:op}),/already sent/);
 expireLive(h,op);
 for(let i=0;i<3;i++){
  const recovered=await (await h.api('/api/transcription/recover',{operation_id:op},email)).json();
  assert.equal(recovered.result.text,liveCheckpoint.text);assert.equal(recovered.result.cost_usd,0.0005);
  assert.equal(recovered.result.recovery_status,'partial');assert.equal(recovered.balance_usd,0.9995);
 }
});
