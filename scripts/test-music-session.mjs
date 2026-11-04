import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './billing-test-harness.mjs';
test('signed-in music generation and polling use Treblo, with provider credentials only on the server',async()=>{
 const h=harness(),email='music@example.invalid';h.records.set('user_balance:'+email,'1');h.env.TREBLO_API_KEY='synthetic-treblo';const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,options)=>{calls++;assert.equal(options.headers.Authorization,'Bearer synthetic-treblo');
 if(options.method==='POST'){assert.equal(url,'https://api.treblo.com/v1/generations/v3');assert.equal(JSON.parse(options.body).prompt,'Synthetic music test');return Response.json({id:'synthetic-music-task'});}
 assert.equal(url,'https://api.treblo.com/v1/generations/synthetic-music-task');return Response.json({status:'SUCCESS',song_paths:['https://example.invalid/synthetic.mp3']});};
 try{
  const headers={'X-LingoFusion-Client-Token':'lf_play_secure_649f7'};
  assert.equal((await h.api('/api/playground/music',{prompt:'Synthetic music test'},'',headers)).status,401);assert.equal(calls,0);
  const start=await h.api('/api/playground/music',{prompt:'Synthetic music test'},email,headers);assert.equal(start.status,200,await start.clone().text());
  const poll=await h.api('/api/playground/music?id=synthetic-music-task',undefined,email,headers);assert.equal(poll.status,200);assert.equal((await poll.json()).status,'completed');assert.equal(calls,2);
 }finally{globalThis.fetch=original;}
});
