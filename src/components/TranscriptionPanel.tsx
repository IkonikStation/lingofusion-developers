import { useEffect, useRef, useState } from 'react';
import { Mic, Square, UploadCloud, Copy, Download, Loader2 } from 'lucide-react';
import { getCurrentUser } from '../data/auth';
import { DEFAULT_EDGE_GATEWAY_URL, recordBrowserTranscriptionUsage } from '../data/browserApi';
import { transcriptionModels } from '../data/pricing';
const RATE=24000, MAX_SECONDS=180;
function pcm(data:Float32Array, sourceRate:number) {
  const n=Math.floor(data.length*RATE/sourceRate),out=new Int16Array(n);
  for(let i=0;i<n;i++) out[i]=Math.round(Math.max(-1,Math.min(1,data[Math.min(data.length-1,Math.floor(i*sourceRate/RATE))]))*32767);
  return out;
}
function wav(samples:Int16Array) {
  const bytes=new ArrayBuffer(44+samples.length*2),v=new DataView(bytes);
  const text=(offset:number,s:string)=>[...s].forEach((c,i)=>v.setUint8(offset+i,c.charCodeAt(0)));
  text(0,'RIFF');v.setUint32(4,bytes.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,RATE,true);v.setUint32(28,RATE*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,samples.length*2,true);
  for(let i=0;i<samples.length;i++)v.setInt16(44+i*2,samples[i],true);
  return new Blob([bytes],{type:'audio/wav'});
}
type Receipt={model:string;text:string;duration_seconds:number;cost_usd:number;balance_usd:number;operation_id:string;recovery_status?:string;notice?:string};
export function TranscriptionPanel({onBalance,onSignIn,initialModel}:{onBalance:(n:number)=>void;onSignIn?:()=>void;initialModel?:string}) {
  const [ownerId]=useState(()=>getCurrentUser().id);
  const [model,setModel]=useState(initialModel==='LingoFusion Live Transcribe'?initialModel:'LingoFusion Transcribe');
  const [file,setFile]=useState<Blob|null>(null),[fileName,setFileName]=useState(''),[seconds,setSeconds]=useState(0);
  const [busy,setBusy]=useState(false),[recording,setRecording]=useState(false),[text,setText]=useState(''),[error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [receipt,setReceipt]=useState<Receipt|null>(null),[copied,setCopied]=useState(false);
  const [pending,setPending]=useState(()=>sessionStorage.getItem('lf-transcription-pending:'+getCurrentUser().id)||'');
  const connection=useRef<WebSocket|null>(null),context=useRef<AudioContext|null>(null),media=useRef<MediaStream|null>(null),processor=useRef<ScriptProcessorNode|null>(null);
  const live=model==='LingoFusion Live Transcribe';
  const stopCapture=()=>{processor.current?.disconnect();media.current?.getTracks().forEach(t=>t.stop());void context.current?.close();processor.current=null;context.current=null;media.current=null;setRecording(false);};
  useEffect(()=>()=>{processor.current?.disconnect();media.current?.getTracks().forEach(t=>t.stop());void context.current?.close();try{connection.current?.send(JSON.stringify({type:'finish'}));}catch{}connection.current?.close();},[]);
  const forget=()=>{setPending('');sessionStorage.removeItem('lf-transcription-pending:'+ownerId);};
  const remember=(id:string)=>{setPending(id);sessionStorage.setItem('lf-transcription-pending:'+ownerId,id);};
  const complete=(r:Receipt)=>{if(getCurrentUser().id!==ownerId){forget();return;}recordBrowserTranscriptionUsage(r);forget();setReceipt(r);setNotice(r.notice||'');if(r.recovery_status!=='released')setText(r.text);setCopied(false);onBalance(r.balance_usd);setBusy(false);};
  const auth=()=>{const u=getCurrentUser();if(!u.sessionToken){onSignIn?.();throw new Error('Sign in before transcribing.');}return {Authorization:`Bearer ${u.sessionToken}`};};
  const read=async(r:Response)=>{const d=await r.json();if(!r.ok){if([400,401,402].includes(r.status))forget();throw Object.assign(new Error(d.message||d.error||'Transcription unavailable'),{httpStatus:r.status});}return d;};
  async function prepareFile(selected?:File) {
    if(!selected)return;setBusy(true);setError('');setFile(null);setFileName('');setSeconds(0);setReceipt(null);
    let ctx:AudioContext|undefined;
    try{
      if(selected.size>25000000)throw new Error('Choose an audio file under 25 MB.');
      ctx=new AudioContext();const audio=await ctx.decodeAudioData(await selected.arrayBuffer());
      if(audio.duration<0.1||audio.duration>MAX_SECONDS)throw new Error('Choose a recording between 0.1 seconds and 3 minutes.');
      const mono=new Float32Array(audio.length);
      for(let c=0;c<audio.numberOfChannels;c++){const channel=audio.getChannelData(c);for(let i=0;i<mono.length;i++)mono[i]+=channel[i]/audio.numberOfChannels;}
      const samples=pcm(mono,audio.sampleRate);setFile(wav(samples));setSeconds(samples.length/RATE);setFileName(selected.name);
    }catch(e){setError((e as Error).message);}finally{await ctx?.close();setBusy(false);}
  }
  async function runFile(){
    if(!file)return;setBusy(true);setError('');setNotice('');let id='';
    try{const headers=auth();id=crypto.randomUUID();remember(id);const data=new FormData();data.set('model',model);data.set('file',file,'audio.wav');
      const r=await fetch(DEFAULT_EDGE_GATEWAY_URL+'/api/transcription/file',{method:'POST',headers:{...headers,'Idempotency-Key':id},body:data});
      const d=await read(r);complete(d);
    }catch(e){setBusy(false);setError((e as Error).message);}
  }
  async function startLive(){
    setError('');setNotice('');setReceipt(null);setText('');setBusy(true);
    try{
      const headers=auth();media.current=await navigator.mediaDevices.getUserMedia({audio:true});
      context.current=new AudioContext({sampleRate:RATE});await context.current.resume();
      const id=crypto.randomUUID();remember(id);
      const d=await read(await fetch(DEFAULT_EDGE_GATEWAY_URL+'/api/transcription/live',{method:'POST',headers:{...headers,'Content-Type':'application/json','Idempotency-Key':id},body:JSON.stringify({maximum_seconds:60})}));
      const socket=new WebSocket(d.websocket_url,['lingofusion-transcription',d.ticket]);connection.current=socket;
      const turns=new Map<string,string>();let settled=false;
      socket.onmessage=e=>{
        const event=JSON.parse(e.data);
        if(event.type==='ready'){
          const ctx=context.current;if(!ctx||!media.current)return;
          const source=ctx.createMediaStreamSource(media.current),proc=ctx.createScriptProcessor(4096,1,1),mute=ctx.createGain();mute.gain.value=0;processor.current=proc;
          proc.onaudioprocess=frame=>{if(socket.readyState!==WebSocket.OPEN)return;const samples=pcm(frame.inputBuffer.getChannelData(0),ctx.sampleRate);const bytes=new Uint8Array(samples.buffer);let s='';for(const b of bytes)s+=String.fromCharCode(b);if(socket.bufferedAmount>500000){stopCapture();socket.send(JSON.stringify({type:'finish'}));return;}socket.send(JSON.stringify({type:'input_audio_buffer.append',audio:btoa(s)}));};
          source.connect(proc);proc.connect(mute);mute.connect(ctx.destination);setRecording(true);
        }else if(event.type==='finishing'){stopCapture();}
        else if(event.type==='input_audio_buffer.committed'){if(!turns.has(event.item_id))turns.set(event.item_id,'');}
        else if(event.type==='conversation.item.input_audio_transcription.delta'){turns.set(event.item_id,(turns.get(event.item_id)||'')+event.delta);setText([...turns.values()].join('\n'));}
        else if(event.type==='conversation.item.input_audio_transcription.completed'){turns.set(event.item_id,event.transcript);setText([...turns.values()].join('\n'));}
        else if(event.type==='settled'){settled=true;stopCapture();complete(event);}
        else if(event.type==='error'){stopCapture();setBusy(false);setError(event.message||'Recover the session before retrying.');}
      };
      socket.onerror=()=>{stopCapture();setBusy(false);setError('Connection failed. Recover the session before retrying.');};
      socket.onclose=()=>{stopCapture();setBusy(false);if(!settled)setError('Session ended. Recover its status before starting another.');};
    }catch(e){stopCapture();setBusy(false);setError((e as Error).message);}
  }
  async function recover(){
    if(!pending)return;
    setError('');setBusy(true);
    try{
      const d=await read(await fetch(DEFAULT_EDGE_GATEWAY_URL+'/api/usage/'+encodeURIComponent(pending),{headers:auth()}));
      if(d.status==='settled')complete({...d.result,balance_usd:d.balance_usd});
      else {
        const recovered=await read(await fetch(DEFAULT_EDGE_GATEWAY_URL+'/api/transcription/recover',{method:'POST',headers:{...auth(),'Content-Type':'application/json'},body:JSON.stringify({operation_id:pending})}));
        if(recovered.pending)setNotice(`${recovered.message} Check again in ${recovered.retry_after_seconds} seconds.`);
        else complete({...recovered.result,balance_usd:recovered.balance_usd});
      }
    }catch(e){if((e as {httpStatus?:number}).httpStatus===404)forget();setError((e as Error).message);}
    finally{setBusy(false);}
  }
  // Recover an existing session on reload without dispatching new provider work.
  useEffect(()=>{if(pending)void recover();},[]);
  function download(){const u=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download='transcript.txt';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
  return <section className="mt-5 rounded-2xl border border-neutral-200 bg-white dark:border-white/10 dark:bg-neutral-900/70" aria-label="Transcription workspace">
    <div className="flex flex-wrap items-end gap-4 border-b border-neutral-200 p-5 dark:border-white/10">
      <label className="flex min-w-60 flex-col gap-2 text-xs text-neutral-600 dark:text-neutral-300">Model<select aria-label="Transcription model" value={model} disabled={busy||!!pending} onChange={e=>{setModel(e.target.value);setReceipt(null);setError('');}} className="h-10 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-950 dark:border-white/15 dark:bg-neutral-950 dark:text-white">{transcriptionModels.map(m=><option key={m.model}>{m.model}</option>)}</select></label>
      <span className="pb-3 text-xs text-neutral-500">${live?'0.03':'0.01'} / minute</span>
    </div>
    <div className="grid divide-y divide-neutral-200 dark:divide-white/10 md:grid-cols-2 md:divide-x md:divide-y-0">
      <div className="space-y-4 p-5">
        <h2 className="text-sm font-medium">{live?'Live audio':'Audio file'}</h2>
        {live?<p className="text-sm leading-6 text-neutral-500">Transcribe your microphone as you speak. Sessions support up to one minute of audio. Billing is based on audio sent; unused reserved credit is returned after settlement.</p>:<><label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-neutral-300 p-5 text-sm dark:border-white/20"><UploadCloud className="h-5 w-5"/><span>{fileName||'Choose an audio file'}</span><input aria-label="Audio file to transcribe" type="file" accept="audio/*" className="sr-only" disabled={busy||!!pending} onChange={e=>void prepareFile(e.target.files?.[0])}/></label><p className="text-xs leading-5 text-neutral-500">Up to 3 minutes and 25 MB. Audio is converted on your device before upload.</p>{file&&<p className="text-xs text-neutral-500">{seconds.toFixed(1)} seconds · ${(Math.ceil(seconds/60*10000)/1e6).toFixed(6)}</p>}</>}
        {recording?<button type="button" onClick={()=>{stopCapture();connection.current?.send(JSON.stringify({type:'finish'}));}} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm text-white"><Square className="h-4 w-4"/>Stop transcription</button>:<button type="button" disabled={busy||!!pending||(!live&&!file)} onClick={()=>void(live?startLive():runFile())} className="inline-flex items-center gap-2 rounded-lg bg-neutral-950 px-4 py-2.5 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-neutral-950">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Mic className="h-4 w-4"/>}{busy?'Processing…':live?'Start listening':'Transcribe'}</button>}
        {pending&&!busy&&<button type="button" onClick={()=>void recover()} className="block text-xs underline">Recover previous transcription</button>}
        {notice&&<p role="status" className="text-sm text-neutral-600 dark:text-neutral-300">{notice}</p>}
        {error&&<p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
      <div className="flex min-h-72 flex-col gap-4 p-5"><div className="flex items-center justify-between"><h2 className="text-sm font-medium">Transcript</h2>{text&&<div className="flex gap-3"><button type="button" aria-label="Copy transcript" onClick={()=>{void navigator.clipboard.writeText(text).then(()=>setCopied(true));}} className="text-xs text-neutral-500"><Copy className="mr-1 inline h-3.5 w-3.5"/>{copied?'Copied':'Copy'}</button><button type="button" onClick={download} className="text-xs text-neutral-500"><Download className="mr-1 inline h-3.5 w-3.5"/>Download</button></div>}</div><p className="flex-1 whitespace-pre-wrap break-words text-sm leading-7">{text||<span className="text-neutral-400">Your transcript will appear here.</span>}</p>{receipt&&<p className="text-xs tabular-nums text-neutral-500">{receipt.duration_seconds.toFixed(1)} seconds · Cost: ${receipt.cost_usd.toFixed(6)}</p>}</div>
    </div>
  </section>;
}
