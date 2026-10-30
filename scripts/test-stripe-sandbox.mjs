// Explicit opt-in; refuses every live key. Never reads the application's live .env.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import Stripe from 'stripe';
import { harness } from './billing-test-harness.mjs';
import { assertCharge, depositQuote } from '../shared/billing.mjs';
const key=process.env.STRIPE_TEST_SECRET_KEY || (await readFile('.env.stripe-audit','utf8')).match(/^STRIPE_TEST_SECRET_KEY=(.+)$/m)?.[1].trim();
if(!/^(sk|rk)_test_/.test(key||''))throw new Error('A Stripe test key is required; live keys are refused.');
const stripe=new Stripe(key), h=harness();h.env.STRIPE_SECRET_KEY=key;
const results=[], run=`lf-audit-${Date.now()}`, sessions=[];
for(const [country,method] of [['CA','pm_card_ca'],['US','pm_card_visa'],['FR','pm_card_fr'],['GB','pm_card_gb'],['AU','pm_card_au']]){
 const email=`${run}+location_${country}@example.com`;
 const response=await h.api('/api/create-checkout-session',{amount:5,currency:'usd'},email);
 assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
 const session=await stripe.checkout.sessions.retrieve((await response.json()).sessionId,{expand:['line_items.data.price']});
 assert.equal(session.currency,'usd');assert.equal(session.amount_total,643);assert.equal(session.adaptive_pricing.enabled,false);assert.equal(session.line_items.data[0].price.currency,'usd');assert.equal(session.livemode,false);
 const pi=await stripe.paymentIntents.create({amount:643,currency:'usd',payment_method:method,automatic_payment_methods:{enabled:true,allow_redirects:'never'},confirm:true,metadata:{auditRun:run},expand:['latest_charge']});
 assert.equal(pi.status,'succeeded');assert.equal(pi.currency,'usd');assert.equal(pi.latest_charge.currency,'usd');assert.equal(pi.latest_charge.livemode,false);
 assertCharge({mode:'payment',amount_total:643,payment_intent:pi});
 results.push({scenario:'USD checkout plus independent card charge',requestedCountry:country,cardCountry:pi.latest_charge.payment_method_details.card.country,session:session.id,paymentIntent:pi.id,charge:pi.latest_charge.id,amount:643,currency:pi.latest_charge.currency,adaptivePricing:session.adaptive_pricing.enabled});
 sessions.push({country,url:session.url,id:session.id,email:email.toLowerCase()});
 if(country==='CA'){
   const refund=await stripe.refunds.create({payment_intent:pi.id,amount:321,metadata:{auditRun:run}});assert.equal(refund.status,'succeeded');
   const refunded=await stripe.paymentIntents.retrieve(pi.id,{expand:['latest_charge']});assert.equal(refunded.latest_charge.amount_refunded,321);results.push({scenario:'test partial refund',currency:refund.currency,amount:refund.amount,status:refund.status});
 }
}
try {await stripe.paymentIntents.create({amount:643,currency:'usd',payment_method:'pm_card_visa_chargeDeclined',automatic_payment_methods:{enabled:true,allow_redirects:'never'},confirm:true,metadata:{auditRun:run}});throw new Error('Decline unexpectedly succeeded');} catch(e){assert.equal(e.code,'card_declined');assert.notEqual(e.payment_intent?.status,'succeeded');results.push({scenario:'declined card',status:e.payment_intent?.status,currency:e.payment_intent?.currency});}
const subResponse=await h.api('/api/billing/subscription-checkout',{plan:'pro',billing:'monthly',currency:'usd'},`${run}-subscription@example.com`);assert.equal(subResponse.status,200,JSON.stringify(await subResponse.clone().json()));
const subSession=await stripe.checkout.sessions.retrieve((await subResponse.json()).sessionId,{expand:['line_items.data.price']});assert.equal(subSession.currency,'usd');assert.equal(subSession.line_items.data[0].price.currency,'usd');assert.equal(subSession.amount_total,1999);assert.equal(subSession.adaptive_pricing.enabled,false);
sessions.push({country:'subscription',url:subSession.url,id:subSession.id,email:`${run}-subscription@example.com`});results.push({scenario:'subscription checkout',session:subSession.id,currency:subSession.currency,amount:subSession.amount_total,adaptivePricing:subSession.adaptive_pricing.enabled});
// Create a genuine sandbox recurring invoice without a hosted Checkout completion.
const customer=await stripe.customers.create({email:`${run}-recurring@example.com`,payment_method:'pm_card_ca',invoice_settings:{default_payment_method:'pm_card_ca'},metadata:{auditRun:run}});
const sub=await stripe.subscriptions.create({customer:customer.id,items:[{price_data:{currency:'usd',unit_amount:1999,recurring:{interval:'month'},product:(await stripe.products.create({name:'LingoFusion billing audit (TEST ONLY)',metadata:{auditRun:run}})).id}}],payment_behavior:'error_if_incomplete',expand:['latest_invoice'],metadata:{auditRun:run}});
assert.equal(sub.currency,'usd');assert.equal(sub.latest_invoice.currency,'usd');assert.equal(sub.latest_invoice.status,'paid');assert.equal(sub.latest_invoice.amount_paid,1999);results.push({scenario:'real sandbox subscription and paid invoice',subscription:sub.id,invoice:sub.latest_invoice.id,currency:sub.latest_invoice.currency,status:sub.latest_invoice.status});
// Test agreement is isolated from all live subscriptions.
await stripe.subscriptions.cancel(sub.id);
await writeFile('/tmp/lingofusion-sandbox-sessions.json',JSON.stringify(sessions),{mode:0o600});
console.log(JSON.stringify({run,results,hostedCheckoutCompletion:'pending browser completion; Checkout creation and independent charges tested separately'},null,2));
