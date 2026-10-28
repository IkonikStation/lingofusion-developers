// Verifies explicitly supplied, already-completed sandbox Checkout Sessions only.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Stripe from 'stripe';
import { harness } from './billing-test-harness.mjs';
import { billing } from '../cloudflare-worker/billing.mjs';
import { retrieveCheckout, assertCharge } from '../shared/billing.mjs';
const key=process.env.STRIPE_TEST_SECRET_KEY || (await readFile('.env.stripe-audit','utf8')).match(/^STRIPE_TEST_SECRET_KEY=(.+)$/m)?.[1].trim();
if(!/^(sk|rk)_test_/.test(key||''))throw new Error('Live keys are refused.');
const ids=process.argv.slice(2);if(!ids.length||ids.some(id=>!/^cs_test_/.test(id)))throw new Error('Explicit sandbox Checkout IDs are required.');
const stripe=new Stripe(key),h=harness();h.env.STRIPE_SECRET_KEY=key;
for(const id of ids){
 const session=await retrieveCheckout(id,key);assert.equal(session.livemode,false);assert.equal(session.mode,'payment');assert.equal(session.status,'complete');assert.equal(session.payment_status,'paid');assert.equal(session.amount_total,546);assert.equal(session.currency,'usd');
 const charge=assertCharge(session),email=session.metadata.userEmail;
 await billing(h.env,{action:'order',order:{id,policy:'usd-v1',mode:'payment',email,amountCents:546,netCents:500,isGift:false}});
 const first=await h.api('/api/verify-checkout-session',{sessionId:id},email);assert.equal(first.status,200,JSON.stringify(await first.clone().json()));assert.equal((await first.json()).balance_usd,5);
 const repeat=await h.webhook('checkout.session.completed',session);assert.equal(repeat.status,200,JSON.stringify(await repeat.clone().json()));assert.equal((await billing(h.env,{action:'balance',email})).balance_usd,5);
 console.log(JSON.stringify({hostedCheckout:id,status:session.status,cardCountry:charge.payment_method_details.card.country,currency:charge.currency,amount:charge.amount,localFulfillmentBalance:5,duplicateCredit:false}));
}
console.log('Completed real sandbox Checkouts verified through the patched local Worker and isolated ledger. Production was not modified.');
