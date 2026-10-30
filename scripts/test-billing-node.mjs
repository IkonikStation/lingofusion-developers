// Isolated temporary database; all Stripe calls are mocked and cannot reach the network.
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import Stripe from 'stripe';
process.env.LINGOFUSION_SKIP_LOCAL_ENV='true';
process.env.LINGOFUSION_DATA_DIR=await mkdtemp(join(tmpdir(),'lf-billing-node-'));
process.env.STRIPE_SECRET_KEY='sk_test_mock';
process.env.SESSION_SECRET='mock-session';
process.env.STRIPE_WEBHOOK_SECRET='whsec_mock';
const {createApiServer}=await import('../server.mjs');
const server=createApiServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`,realFetch=globalThis.fetch,sessions=new Map();let serial=0,failStripe=false;
const stripe=new Stripe('sk_test_mock');const sessionProto=Object.getPrototypeOf(stripe.checkout.sessions),chargeProto=Object.getPrototypeOf(stripe.charges);
const disputeProto=Object.getPrototypeOf(stripe.disputes);const originalDisputeRetrieve=disputeProto.retrieve;let disputeEvidence;disputeProto.retrieve=async()=>disputeEvidence;
const originalList=sessionProto.list;sessionProto.list=async params=>({data:[...sessions.values()].filter(s=>s.subscription?.id===params.subscription || s.payment_intent.id===params.payment_intent)});
const subscriptionProto=Object.getPrototypeOf(stripe.subscriptions),originalSubscriptionRetrieve=subscriptionProto.retrieve;subscriptionProto.retrieve=async id=>[...sessions.values()].find(s=>s.subscription?.id===id).subscription;
const originalCreate=sessionProto.create,originalChargeRetrieve=chargeProto.retrieve;
sessionProto.create=async function(params){if(failStripe)throw new Error('mock Stripe error');assert.equal(params.adaptive_pricing.enabled,false);assert.equal(params.line_items[0].price_data.currency,'usd');const id=`cs_test_node${++serial}`,amount=params.line_items.reduce((sum,li)=>sum+(li.price_data?.unit_amount||0)*(li.quantity||1),0);const pi={id:`pi_node${serial}`,status:'succeeded',currency:'usd',amount_received:amount,latest_charge:{id:`ch_node${serial}`,object:'charge',currency:'usd',amount,amount_refunded:0,paid:true,status:'succeeded'}};const s={id,currency:'usd',livemode:false,status:'complete',payment_status:'paid',mode:params.mode,metadata:params.metadata,amount_total:amount,payment_intent:pi,url:'https://checkout.stripe.com/mock'};if(s.mode==='subscription')s.subscription={status:'active',id:`sub_node${serial}`,latest_invoice:{id:`in_node${serial}`,currency:'usd',status:'paid',amount_paid:amount,payment_intent:pi}};sessions.set(id,s);return s;};
chargeProto.retrieve=async id=>[...sessions.values()].find(s=>s.payment_intent.latest_charge.id===id).payment_intent.latest_charge;
globalThis.fetch=async(url,options)=>{const path=new URL(url).pathname;
 if(String(url).startsWith(base))return realFetch(url,options);
 if(path.startsWith('/v1/checkout/sessions/'))return Response.json(sessions.get(path.split('/').pop()));
 if(path.startsWith('/v1/invoices/'))return Response.json([...sessions.values()].find(s=>s.subscription?.latest_invoice?.id===path.split('/').pop()).subscription.latest_invoice);
 if(path.startsWith('/v1/payment_intents/'))return Response.json([...sessions.values()].find(s=>s.payment_intent.id===path.split('/').pop()).payment_intent);
 throw new Error('External network blocked in Node regression tests');
};
function token(email){const body=Buffer.from(JSON.stringify({id:`user:${email}`,email,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');return `${body}.${createHmac('sha256',process.env.SESSION_SECRET).update(body).digest('base64url')}`;}
async function api(path,body,email='buyer@example.com',headers={}){return fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(email?{Authorization:`Bearer ${token(email)}`} : {}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});}
async function checkout(body={amount:5},path='/api/create-checkout-session'){const r=await api(path,body);assert.equal(r.status,200,JSON.stringify(await r.clone().json()));return sessions.get((await r.json()).sessionId);}
async function event(type,object,{signed=true,age=0}={}){const body={type,livemode:false,data:{object}},time=Math.floor(Date.now()/1000)-age;const sig=createHmac('sha256',process.env.STRIPE_WEBHOOK_SECRET||'wrong').update(`${time}.${JSON.stringify(body)}`).digest('hex');return api('/api/stripe-webhook',body,undefined,signed?{'stripe-signature':`t=${time},v1=${sig}`} : {});}
try {
 await api('/api/health');
 assert.equal((await api('/api/billing/recharge',{confirm:'ADD_LOCAL_TEST_BALANCE',amount:500})).status,403);
 assert.equal((await api('/api/auto-recharge',{enabled:true})).status,503);
 assert.equal((await api('/api/create-checkout-session',{amount:5},'')).status,401);
 assert.equal((await api('/api/create-checkout-session',{amount:5,currency:'cad'})).status,400);
 assert.equal((await api('/api/billing/subscription-checkout',{plan:'pro',currency:'cad'})).status,400);
 const s=await checkout({amount:5,userId:'victim'});assert.equal(s.metadata.userId,'user:buyer@example.com');
 assert.equal((await event('checkout.session.completed',s,{signed:false})).status,400);
 assert.equal((await event('checkout.session.completed',s,{age:301})).status,400);
 const secret=process.env.STRIPE_WEBHOOK_SECRET;delete process.env.STRIPE_WEBHOOK_SECRET;assert.equal((await event('checkout.session.completed',s,{signed:false})).status,400);process.env.STRIPE_WEBHOOK_SECRET=secret;
 const unpaid=await checkout();unpaid.payment_status='unpaid';assert.equal((await event('checkout.session.completed',unpaid)).status,200);assert.notEqual((await (await api('/api/verify-checkout-session',{sessionId:unpaid.id})).json()).verified,true);
 const owner=(await api('/api/verify-checkout-session',{sessionId:s.id},'wrong@example.com'));assert.equal(owner.status,409);
 const settlement=await Promise.all(Array.from({length:20},(_,i)=>i%2?event('checkout.session.completed',s):api('/api/verify-checkout-session',{sessionId:s.id})));assert(settlement.every(x=>x.status===200));assert.equal((await (await api('/api/verify-checkout-session',{sessionId:s.id})).json()).balance_usd,5);
 s.payment_intent.latest_charge.amount_refunded=321;for(let i=0;i<5;i++)assert.equal((await event('charge.refunded',s.payment_intent.latest_charge)).status,200);
 const refunded=await api('/api/verify-checkout-session',{sessionId:s.id});assert.equal(refunded.status,409);
 const other=await checkout();const otherResult=await (await api('/api/verify-checkout-session',{sessionId:other.id})).json();assert.equal(otherResult.balance_usd,7.5);
 const dispute=await checkout();await api('/api/verify-checkout-session',{sessionId:dispute.id});
 disputeEvidence={object:'dispute',id:'dp_node',charge:dispute.payment_intent.latest_charge.id,status:'needs_response'};
 await event('charge.dispute.created',disputeEvidence);
 disputeEvidence.status='won';
 await event('charge.dispute.closed',disputeEvidence);
 disputeEvidence.status='won';
 await event('charge.dispute.closed',disputeEvidence);
 const restored=await (await api('/api/verify-checkout-session',{sessionId:dispute.id})).json();assert.equal(restored.balance_usd,12.5);
 const sub=await checkout({plan:'pro-350k',monthly_price_usd:.01},'/api/billing/subscription-checkout');assert.equal(sub.amount_total,1999);assert.equal((await (await api('/api/verify-checkout-session',{sessionId:sub.id})).json()).mode,'subscription');
 assert.equal((await event('invoice.paid',{subscription:sub.subscription.id})).status,200);
 assert.equal((await event('invoice.payment_failed',{subscription:sub.subscription.id})).status,200);
 sub.subscription.status='canceled';assert.equal((await event('customer.subscription.deleted',sub.subscription)).status,200);
 sub.subscription.status='active';assert.equal((await api('/api/verify-checkout-session',{sessionId:sub.id})).status,409);
 const final=await (await api('/api/verify-checkout-session',{sessionId:other.id})).json();assert.equal(final.balance_usd,12.5);
 failStripe=true;assert.equal((await api('/api/billing/subscription-checkout',{plan:'pro'})).status,502);assert.equal((await api('/api/create-checkout-session',{amount:5})).status,502);
 console.log('Node billing regression checks passed: isolated database, USD/identity binding, unsigned/stale webhook rejection, failed payments, 20 concurrent deliveries, exactly-once credits/refund reconciliation, paid subscriptions, and fail-closed Stripe errors.');
}finally{globalThis.fetch=realFetch;sessionProto.create=originalCreate;sessionProto.list=originalList;chargeProto.retrieve=originalChargeRetrieve;disputeProto.retrieve=originalDisputeRetrieve;subscriptionProto.retrieve=originalSubscriptionRetrieve;await new Promise(resolve=>server.close(resolve));}
