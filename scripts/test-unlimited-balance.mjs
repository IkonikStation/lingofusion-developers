import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { harness } from './billing-test-harness.mjs';
import { billing } from '../cloudflare-worker/billing.mjs';
import { prepareTextRequest } from '../cloudflare-worker/meteredText.mjs';
const owner='owner@example.invalid',other='customer@example.invalid';
const ownerHash=createHash('sha256').update(owner).digest('hex');
const setup=()=>{const h=harness();h.env.UNLIMITED_OWNER_EMAIL_SHA256=ownerHash;h.records.set(`user_balance:${owner}`,'0');h.records.set(`user_balance:${other}`,'1');return h;};
const status=(h,email=owner)=>billing(h.env,{action:'balance',email});
const identity=(id,email=owner)=>({email,operationId:id,fingerprint:'test:'+id});

test('only the server-configured identity has unlimited balance; invalid config fails closed',async()=>{
 const h=setup();assert.equal((await status(h)).unlimited_balance,true);assert.equal((await status(h,other)).unlimited_balance,false);
 assert.equal((await status(h)).balance_usd,0);
 h.env.UNLIMITED_OWNER_EMAIL_SHA256='';assert.equal((await status(h)).unlimited_balance,false);
 h.env.UNLIMITED_OWNER_EMAIL_SHA256='not-a-hash';assert.equal((await status(h)).unlimited_balance,false);
});
test('concurrent complimentary reservations and replay retain usage without spending or minting credits',async()=>{
 const h=setup();
 const run=async n=>{const who=identity('owner-'+n);await billing(h.env,{action:'usageReserve',...who,maximumMicros:2200000000});
 const pending=await billing(h.env,{action:'usageStatus',email:owner,operationId:who.operationId});assert.equal(pending.held_usd,0);
 const finish={action:'usageFinish',...who,actualMicros:500000,result:{text:'synthetic'},evidence:{providerRequestId:'synthetic-'+n}};
 assert.equal((await billing(h.env,finish)).balance_usd,0);assert.equal((await billing(h.env,finish)).balance_usd,0);
 const receipt=await billing(h.env,{action:'usageStatus',email:owner,operationId:who.operationId});assert.equal(receipt.cost_usd,0.5);assert.equal(receipt.billed_usd,0);assert.equal(receipt.complimentary,true);
 };
 await Promise.all(Array.from({length:30},(_,i)=>run(i)));
 assert.equal((await status(h)).balance_usd,0);assert.equal((await status(h,other)).balance_usd,1);
 assert.equal(h.objects.get('billing:ledger-v1').data.get(`meteredUsage:${owner}:owner-1`).billedMicros,0);
});
test('normal customer reservations still deduct and refund at the published cost',async()=>{
 const h=setup(),who=identity('customer-one',other);
 await billing(h.env,{action:'usageReserve',...who,maximumMicros:100000});assert.equal((await status(h,other)).balance_usd,0.9);
 await billing(h.env,{action:'usageFinish',...who,actualMicros:40000,result:{},evidence:{providerRequestId:'customer-receipt'}});
 assert.equal((await status(h,other)).balance_usd,0.96);
 await assert.rejects(()=>billing(h.env,{action:'usageReserve',...identity('forged',other),maximumMicros:1000000,unlimited:true,unlimited_balance:true}),/Insufficient/);
});
test('revocation preserves reservation accounting and cannot refund complimentary holds into cash',async()=>{
 const h=setup();const who={email:owner,operationId:'live-cancel',fingerprint:'live-transcribe-v1:60'};
 await billing(h.env,{action:'usageReserve',...who,maximumMicros:30000});
 await billing(h.env,{action:'usageCancelUnclaimedLive',email:owner,operationId:'live-cancel'});
 await billing(h.env,{action:'usageCancelUnclaimedLive',email:owner,operationId:'live-cancel'});assert.equal((await status(h)).balance_usd,0);
 const active=identity('active');await billing(h.env,{action:'usageReserve',...active,maximumMicros:10000});
 delete h.env.UNLIMITED_OWNER_EMAIL_SHA256;
 await billing(h.env,{action:'usageFinish',...active,actualMicros:2000,result:{},evidence:{providerRequestId:'revoked-receipt'}});
 assert.equal((await status(h)).balance_usd,0);
 await assert.rejects(()=>billing(h.env,{action:'usageReserve',...identity('after-revoke'),maximumMicros:1}),/Insufficient/);
 const normal=setup();delete normal.env.UNLIMITED_OWNER_EMAIL_SHA256;normal.records.set(`user_balance:${owner}`,'1');
 await billing(normal.env,{action:'usageReserve',...identity('paid-before-enable'),maximumMicros:100000});normal.env.UNLIMITED_OWNER_EMAIL_SHA256=ownerHash;
 await billing(normal.env,{action:'usageFinish',...identity('paid-before-enable'),actualMicros:40000,result:{},evidence:{providerRequestId:'paid-before-enable'}});
 assert.equal((await status(normal)).balance_usd,0.96);
});
test('legacy media deductions are owner-bound and cannot enable unlimited access from a request body',async()=>{
 const h=setup();
 const data={email:owner,delta_usd:-0.25,unlimited_balance:true};
 assert.equal((await h.api('/api/user/balance',data,other,{'Idempotency-Key':'other-deduct'})).status,200);
 assert.equal((await status(h,other)).balance_usd,0.75);
 for(let i=0;i<2;i++)assert.equal((await h.api('/api/user/balance',{...data,email:other,delta_usd:-2200},owner,{'Idempotency-Key':'owner-deduct'})).status,200);
 assert.equal((await status(h)).balance_usd,0);assert.equal((await status(h,other)).balance_usd,0.75);
});
test('authenticated owner text works with zero credit; spoofed customer and unauthenticated requests cannot dispatch',async()=>{
 const h=setup(),original=globalThis.fetch;h.env.OPENAI_API_KEY='synthetic-only';h.records.set(`user_balance:${other}`,'0');let calls=0;
 const body={model:'LingoFusion',messages:[{role:'user',content:'Hello'}],unlimited_balance:true,email:owner};const prepared=prepareTextRequest(body);
 globalThis.fetch=async(url,opts)=>{calls++;assert.equal(opts.headers.Authorization,'Bearer synthetic-only');return Response.json({id:'owner-provider-test',model:prepared.policy.upstream,service_tier:'default',choices:[{message:{role:'assistant',content:'Bonjour'},finish_reason:'stop'}],usage:{prompt_tokens:prepared.rawMaximum,completion_tokens:1}});};
 try{
  assert.equal((await h.api('/v1/chat/completions',body,other,{'Idempotency-Key':'customer-forged','X-Unlimited-Balance':'true'})).status,402);
  assert.equal((await h.api('/v1/chat/completions',body,'',{'Idempotency-Key':'unsigned'})).status,401);assert.equal(calls,0);
  const r=await h.api('/v1/chat/completions',body,owner);assert.equal(r.status,200,await r.clone().text());assert.equal(calls,1);
  assert.equal((await status(h)).balance_usd,0);
 }finally{globalThis.fetch=original;}
});
