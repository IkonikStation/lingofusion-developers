import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './billing-test-harness.mjs';
import {prepareTextRequest,verifyAndPrice} from '../shared/textRequestCore.mjs';
import {fetchTextProvider} from '../shared/textProvider.mjs';
import {billing} from '../cloudflare-worker/billing.mjs';
const source='What does floccinaucinihilipilification mean?';
const body=model=>({model,allow_web_search:true,messages:[{role:'user',content:source}]});
function reply(model,searched){return {id:'synthetic-'+model+'-'+searched,model,status:'completed',service_tier:'default',output:[...(searched?[{type:'web_search_call',id:'ws-synthetic',status:'completed',action:{type:'search',queries:['floccinaucinihilipilification French meaning']}}]:[]),{type:'message',content:[{type:'output_text',text:'Que signifie floccinaucinihilipilification ?',annotations:searched?[{type:'url_citation',url:'https://example.invalid/term',title:'Synthetic dictionary'}]:[]}]}],usage:{input_tokens:4000,output_tokens:10}};}
test('lookup keeps each supported selected model, is optional and bounded, and preserves translation-only instructions',async()=>{
 for(const model of ['LingoFusion','LingoFusion Pro','LingoFusion Ultra']){
  const prepared=prepareTextRequest(body(model));let calls=0;
  const result=await fetchTextProvider(prepared,{},async(url,options)=>{
   calls++;assert.equal(url,'https://api.openai.com/v1/responses');const p=JSON.parse(options.body);
   assert.equal(p.model,prepared.policy.upstream);assert.notEqual(p.model,'gpt-5-search-api');assert.equal(p.tool_choice,'auto');assert.equal(p.max_tool_calls,1);assert.equal(p.tools[0].type,'web_search');
   assert.equal(p.input.at(-1).content,source);assert.ok(p.input.some(x=>typeof x.content==='string'&&x.content.includes('never answering it')));
   return Response.json(reply(p.model,false));
  });
  const data=await result.json();assert.equal(calls,1);assert.equal(data.web_search_calls,0);assert.equal(verifyAndPrice(prepared,data).web_search_cost_usd,0);
 }
 for(const model of ['LingoFusion Nano','LingoFusion Lite','ExplainFusion'])assert.throws(()=>prepareTextRequest(body(model)),/Standard speed/);
 assert.throws(()=>prepareTextRequest({...body('LingoFusion'),tools:[{type:'web_search'}]}),/Client-defined/);
});
test('search usage is metered once, records sources, and replay never triggers another lookup',async()=>{
 const h=harness(),email='lookup@example.invalid';h.records.set('user_balance:'+email,'10');h.env.OPENAI_API_KEY='synthetic-only';const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,opts)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');return Response.json(reply(JSON.parse(opts.body).model,true));};
 try{
  const headers={'Idempotency-Key':'lookup-one','X-LingoFusion-Client-Token':'lf_play_secure_649f7'};const r=await h.api('/api/playground/chat',body('LingoFusion'),email,headers);assert.equal(r.status,200,await r.clone().text());const data=await r.json();
  assert.equal(data.model,'LingoFusion');assert.equal(data.usage.web_search_cost_usd,0.015);assert.equal(data.cost_usd,0.01905);assert.equal(data.balance_usd,9.98095);assert.equal(data.web_search_sources[0].title,'Synthetic dictionary');
  assert.equal((await h.api('/api/playground/chat',body('LingoFusion'),email,headers)).status,200);assert.equal(calls,1);
  assert.equal((await billing(h.env,{action:'usageStatus',email,operationId:'lookup-one'})).cost_usd,0.01905);
 }finally{globalThis.fetch=original;}
});
test('streamed lookup metadata and final usage survive normalization; excessive tool calls fail verification',async()=>{
 const prepared=prepareTextRequest({...body('LingoFusion Pro'),stream:true}),final=reply(preparedModel(),true);
 function preparedModel(){return 'gpt-6-sol';}
 const events=[{type:'response.created',response:final},{type:'response.output_item.done',item:final.output[0]},{type:'response.output_text.delta',delta:'Que signifie ce terme ?'},{type:'response.completed',response:final}];
 const r=await fetchTextProvider(prepared,{},async()=>new Response(events.map(x=>'data: '+JSON.stringify(x)+'\n\n').join('')));
 const frames=(await r.text()).split('\n\n').filter(x=>x.startsWith('data: {')).map(x=>JSON.parse(x.slice(6)));
 assert.equal(frames[0].web_search_calls,1);const data=frames.find(x=>x.usage);assert.equal(data.web_search_sources.length,1);assert.equal(verifyAndPrice(prepared,data).web_search_cost_usd,0.04);
 assert.throws(()=>verifyAndPrice(prepared,{...data,web_search_call_count:2,web_search_calls:2}),/limit/);
 assert.throws(()=>verifyAndPrice(prepared,{...data,web_search_calls:undefined}),/Unverified/);
});
