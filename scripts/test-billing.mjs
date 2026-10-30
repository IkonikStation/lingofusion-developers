import assert from 'node:assert/strict';
import test from 'node:test';
import { harness } from './billing-test-harness.mjs';
import { billing } from '../cloudflare-worker/billing.mjs';
import { depositQuote, subscriptionQuote, assertSession, assertCharge } from '../shared/billing.mjs';
const realFetch=globalThis.fetch;
const h=harness(), sessions=new Map(), calls=[];
let serial=0, stripeFailure=false, disputeEvidence;
globalThis.fetch=async (url,options={})=>{
  const target=String(url); calls.push({target,options});
  if(target==='https://api.stripe.com/v1/checkout/sessions') {
    if(stripeFailure) return Response.json({error:{message:'mock declined configuration'}},{status:400});
    const p=new URLSearchParams(options.body), id=`cs_test_${++serial}`;
    const metadata=Object.fromEntries([...p].filter(([k])=>/^metadata\[/.test(k)).map(([k,v])=>[k.slice(9,-1),v]));
    const amount=Array.from(p.entries()).filter(([k])=>/^line_items\[\d+\]\[price_data\]\[unit_amount\]$/.test(k)).reduce((sum,[,v])=>sum+Number(v),0);
    const charge={id:`ch_${serial}`,status:'succeeded',paid:true,currency:'usd',amount,amount_refunded:0};
    const pi={id:`pi_${serial}`,status:'succeeded',currency:'usd',amount_received:amount,latest_charge:charge};
    const s={id,metadata,amount_total:amount,currency:p.get('line_items[0][price_data][currency]'),mode:p.get('mode'),payment_status:'paid',status:'complete',livemode:false,payment_intent:pi,url:'https://checkout.stripe.com/test/mock'};
    if(s.mode==='subscription') s.subscription={status:'active',id:`sub_${serial}`,latest_invoice:{id:`in_${serial}`,status:'paid',currency:'usd',amount_paid:amount,payment_intent:pi}};
    sessions.set(id,s); return Response.json({...s,status:'open',payment_status:'unpaid'});
  }
  if(target.startsWith('https://api.stripe.com/v1/checkout/sessions?')) return Response.json({data:[...sessions.values()].filter(s=>s.subscription?.id===new URL(target).searchParams.get('subscription'))});
  if(target.startsWith('https://api.stripe.com/v1/checkout/sessions/')) return Response.json(sessions.get(new URL(target).pathname.split('/').pop())||{error:'missing'});
  if(target.startsWith('https://api.stripe.com/v1/subscriptions/')) return Response.json([...sessions.values()].find(s=>s.subscription?.id===new URL(target).pathname.split('/').pop()).subscription);
  if(target.startsWith('https://api.stripe.com/v1/invoices/')) {const s=[...sessions.values()].find(x=>new URL(target).pathname.endsWith('/'+x.subscription?.latest_invoice?.id));return Response.json(s.subscription.latest_invoice);}
  if(target.startsWith('https://api.stripe.com/v1/payment_intents/')) {const s=[...sessions.values()].find(x=>new URL(target).pathname.endsWith('/'+x.payment_intent?.id));return Response.json(s.payment_intent);}
  if(target.startsWith('https://api.stripe.com/v1/disputes/')) return Response.json(disputeEvidence);
  if(target.startsWith('https://api.stripe.com/v1/charges/')) {const s=[...sessions.values()].find(x=>new URL(target).pathname.endsWith('/'+x.payment_intent?.latest_charge?.id));return Response.json(s.payment_intent.latest_charge);}
  if(target==='https://gmail.googleapis.com/gmail/v1/users/me/messages/send') return Response.json({id:'mock-message'});
  if(target==='https://oauth2.googleapis.com/token') return Response.json({access_token:'mock'});
  throw new Error(`Unmocked network blocked: ${target}`);
};
const email='buyer@example.com';
async function create(body={amount:5},owner=email,path='/api/create-checkout-session') {const r=await h.api(path,body,owner);assert.equal(r.status,200,JSON.stringify(await r.clone().json()));return sessions.get((await r.json()).sessionId);}
async function verify(s,owner=email){return h.api('/api/verify-checkout-session',{sessionId:s.id},owner);}
try {
await test('fee policy and server subscription formula preserved; invalid inputs rejected',()=>{assert.equal(depositQuote(5).grossAmountCents,643);assert.equal(subscriptionQuote({plan:'ultra-custom',monthly_price_usd:29}).monthly,256.04);assert.equal(subscriptionQuote({plan:'pro'}).monthly,19.99);for(const n of [NaN,Infinity,-1,0,50001,1.001])assert.throws(()=>depositQuote(n));});
await test('no anonymous, foreign-currency, simulator or automatic credit creation',async()=>{
  assert.equal((await h.api('/api/user/balance',{email,delta_usd:5000})).status,401);
  assert.equal((await h.api('/api/user/balance',{balance_usd:5000},email)).status,403);
  assert.equal((await h.api('/api/user/balance',{delta_usd:5000},email)).status,403);
  for(const path of ['/api/auto-recharge','/api/billing/recharge','/api/billing/reset-local-data'])assert.equal((await h.api(path,{enabled:true,amount:100},email)).status,503);
  for(const path of ['/api/create-checkout-session','/api/billing/deposit','/api/billing/subscription-checkout'])assert.equal((await h.api(path,{amount:5,currency:'cad'},email)).status,400);
  assert.equal(h.records.has(`user_balance:${email}`),false);
});
await test('manual checkout retains USD and fee total; spoofed identity cannot change owner',async()=>{
 const s=await create({amount:5,currency:'USD',userEmail:'victim@example.com'});assert.equal(s.currency,'usd');assert.equal(s.amount_total,643);assert.equal(s.metadata.userEmail,email);
 const p=new URLSearchParams(calls.find(x=>x.target.endsWith('/checkout/sessions')).options.body);assert.equal(p.get('adaptive_pricing[enabled]'),'false');assert.equal((await verify(s,'victim@example.com')).status,403);
});
await test('failed, incomplete, unpaid, wrong-currency, wrong-amount and missing charge cannot fulfill',async()=>{
 for(const mutate of [s=>s.payment_status='unpaid',s=>s.status='open',s=>s.currency='cad',s=>s.amount_total=1,s=>s.payment_intent.status='requires_payment_method',s=>s.payment_intent.latest_charge.currency='cad',s=>s.payment_intent.latest_charge=null]){
  const s=await create();mutate(s);const r=await verify(s);const data=await r.json();assert.notEqual(data.verified,true);
 }assert.equal((await billing(h.env,{action:'balance',email})).balance_usd,0);
});
await test('signature, missing secret, stale replay and wrong-mode events rejected',async()=>{
 const s=await create();assert.equal((await h.webhook('checkout.session.completed',s,{secret:'wrong'})).status,400);assert.equal((await h.webhook('checkout.session.completed',s,{age:301})).status,400);assert.equal((await h.webhook('checkout.session.completed',s,{mode:true})).status,400);
 const secret=h.env.STRIPE_WEBHOOK_SECRET;delete h.env.STRIPE_WEBHOOK_SECRET;assert.equal((await h.api('/api/stripe-webhook',{type:'checkout.session.completed',data:{object:s}})).status,400);h.env.STRIPE_WEBHOOK_SECRET=secret;
});
await test('webhooks and redirect concurrently credit exactly once and preserve starting balance',async()=>{
 const owner='concurrent@example.com';h.records.set(`user_balance:${owner}`,'12.34');const s=await create({amount:5},owner);
 const responses=await Promise.all(Array.from({length:30},(_,i)=>i%2?verify(s,owner):h.webhook('checkout.session.completed',s)));assert(responses.every(x=>x.status===200));assert.equal((await billing(h.env,{action:'balance',email:owner})).balance_usd,17.34);
});
await test('KV projection failure cannot duplicate a committed payment',async()=>{
 const owner='outage@example.com';const s=await create({amount:5},owner);h.setProjectionFailure(true);assert.equal((await verify(s,owner)).status,200);h.setProjectionFailure(false);assert.equal((await verify(s,owner)).status,200);assert.equal((await billing(h.env,{action:'balance',email:owner})).balance_usd,5);
});
await test('refund before settlement grants no credits; refund delivery after settlement reverses once',async()=>{
 const owner='refund@example.com';const before=await create({amount:5},owner);before.payment_intent.latest_charge.amount_refunded=643;assert.equal((await verify(before,owner)).status,500);assert.equal((await billing(h.env,{action:'balance',email:owner})).balance_usd,0);
 const s=await create({amount:5},owner);assert.equal((await verify(s,owner)).status,200);s.payment_intent.latest_charge.amount_refunded=321;
 for(let i=0;i<5;i++){const r=await h.webhook('charge.refunded',s.payment_intent.latest_charge);assert.equal(r.status,200,JSON.stringify(await r.json()));}
 assert.equal((await billing(h.env,{action:'balance',email:owner})).balance_usd,2.5);
 await verify(s,owner);assert.equal((await billing(h.env,{action:'balance',email:owner})).balance_usd,2.5);
 s.payment_intent.latest_charge.amount_refunded=643;await h.webhook('charge.refunded',s.payment_intent.latest_charge);assert.equal((await billing(h.env,{action:'balance',email:owner})).balance_usd,0);
});
await test('subscriptions cannot become prepaid credits or activate before paid invoice',async()=>{
 const owner='subscriber@example.com';const s=await create({plan:'pro',currency:'usd'},owner,'/api/billing/subscription-checkout');assert.equal(s.amount_total,1999);
 s.subscription.latest_invoice.status='open';assert.notEqual((await verify(s,owner)).status,200);s.subscription.latest_invoice.status='paid';assert.equal((await verify(s,owner)).status,200);
 const data=await billing(h.env,{action:'balance',email:owner});assert.equal(data.balance_usd,0);assert.equal(data.subscription.monthly,19.99);
});
await test('paid discounted renewal invoices validate their own actual charge amount',async()=>{
 const owner='renewal@example.com';const s=await create({plan:'pro'},owner,'/api/billing/subscription-checkout');await verify(s,owner);
 s.subscription.latest_invoice.id='in_renewal';s.subscription.latest_invoice.amount_paid=1000;s.payment_intent.amount_received=1000;s.payment_intent.latest_charge.amount=1000;
 assert.equal((await h.webhook('invoice.paid',{subscription:s.subscription.id})).status,200);
 assert.equal((await h.webhook('invoice.payment_succeeded',{parent:{subscription_details:{subscription:s.subscription.id}}})).status,200);
 assert.equal((await verify(s,owner)).status,200);const data=await billing(h.env,{action:'balance',email:owner});assert.equal(data.balance_usd,0);assert.equal(data.subscription.invoiceId,'in_renewal');
});
await test('canceled subscriptions cannot reactivate from a paid return or replay',async()=>{
 const owner='canceled@example.com';const s=await create({plan:'pro'},owner,'/api/billing/subscription-checkout');await verify(s,owner);
 const stale=structuredClone(s);
 s.subscription.status='canceled';assert.equal((await h.webhook('customer.subscription.deleted',s.subscription)).status,200);
 assert.notEqual((await verify(s,owner)).status,200);assert.notEqual((await h.webhook('checkout.session.completed',s)).status,200);
 await assert.rejects(billing(h.env,{action:'settle',session:stale}));
 const state=await billing(h.env,{action:'balance',email:owner});assert.equal(state.subscription.status,'canceled');assert.equal(state.balance_usd,0);
});
await test('disputed credits are held and restored exactly once after a win',async()=>{
 const owner='dispute@example.com',s=await create({amount:5},owner);await verify(s,owner);
 disputeEvidence={id:'dp_mock',charge:s.payment_intent.latest_charge.id,status:'needs_response'};
 await h.webhook('charge.dispute.created',disputeEvidence);
 assert.equal((await billing(h.env,{action:'balance',email:owner})).balance_usd,0);
 disputeEvidence.status='won';
 await h.webhook('charge.dispute.closed',disputeEvidence);
 disputeEvidence.status='won';
 await h.webhook('charge.dispute.closed',disputeEvidence);
 await h.webhook('charge.dispute.created',{...disputeEvidence,status:'needs_response'});
 assert.equal((await billing(h.env,{action:'balance',email:owner})).balance_usd,5);
});
await test('localized presentment and stale refund snapshots cannot recredit money',async()=>{
 const owner='stale@example.com',s=await create({amount:5},owner);await verify(s,owner);const old=structuredClone(s);
 s.payment_intent.latest_charge.amount_refunded=321;await h.webhook('charge.refunded',s.payment_intent.latest_charge);
 await assert.rejects(billing(h.env,{action:'settle',session:old}));
 const localized=await create({amount:5},owner);localized.payment_intent.presentment_details={presentment_currency:'cad'};assert.notEqual((await verify(localized,owner)).status,200);
 assert.equal((await billing(h.env,{action:'balance',email:owner})).balance_usd,2.5);
});
await test('deductions are owner-bound, reject absolute writes and retry once',async()=>{
 const owner='concurrent@example.com';const before=(await billing(h.env,{action:'balance',email:owner})).balance_usd;
 await Promise.all(Array.from({length:8},()=>h.api('/api/user/balance',{delta_usd:-.1},owner,{'idempotency-key':'usage-1'})));assert.equal((await billing(h.env,{action:'balance',email:owner})).balance_usd,Number((before-.1).toFixed(6)));
});
await test('Stripe checkout creation failures never become simulated payment success',async()=>{stripeFailure=true;assert.equal((await h.api('/api/create-checkout-session',{amount:5},email)).status,400);assert.equal((await h.api('/api/billing/subscription-checkout',{plan:'pro'},email)).status,400);stripeFailure=false;});
} finally {globalThis.fetch=realFetch;}
