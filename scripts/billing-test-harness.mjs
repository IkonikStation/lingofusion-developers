import { createHmac } from 'node:crypto';
import worker from '../cloudflare-worker/worker.mjs';
import { BillingLedger } from '../cloudflare-worker/billing.mjs';
import { GiftClaims } from '../cloudflare-worker/gifts.mjs';
export function harness() {
  const records = new Map();
  const objects = new Map();
  let failProjection = false;
  const env = { SESSION_SECRET: 'local-test-session', STRIPE_SECRET_KEY: 'sk_test_mock', STRIPE_WEBHOOK_SECRET: 'whsec_mock', STRIPE_GIFT_WEBHOOK_SECRET: 'whsec_gift', APP_URL: 'https://ikonikstation.github.io/lingofusion-developers/playground', GIFTS: {
    async get(key) { return records.get(key) ?? null; },
    async put(key, value) { if (failProjection && key.startsWith('user_balance:')) throw new Error('mock KV outage'); records.set(key, value); },
    async delete(key) { records.delete(key); },
  } };
  function namespace(Class, label) {
    return { idFromName(name) { return name; }, get(name) {
      const id = `${label}:${name}`;
      if (!objects.has(id)) {
        const data = new Map(); let queue = Promise.resolve();
        const storage = { async get(key) { return structuredClone(data.get(key)); }, async put(key,value) { data.set(key,structuredClone(value)); }, async delete(key) { data.delete(key); }, async setAlarm() {}, async deleteAlarm() {}, async transaction(fn) { const before = new Map(data); try { return await fn(storage); } catch(e) { data.clear(); for(const x of before) data.set(...x); throw e; } } };
        const state = { storage, blockConcurrencyWhile(fn) { const result = queue.then(fn); queue = result.catch(()=>{}); return result; } };
        const object = new Class(state,env);
        objects.set(id,{fetch(url, options) { return object.fetch(new Request(url,options)); }, data});
      }
      return objects.get(id);
    } };
  }
  env.BILLING = namespace(BillingLedger,'billing'); env.GIFT_CLAIMS = namespace(GiftClaims,'gift');
  function auth(email) { const body = Buffer.from(JSON.stringify({ email, id:`user:${email}`, provider:'google', exp:Math.floor(Date.now()/1000)+3600 })).toString('base64url'); return `${body}.${createHmac('sha256',env.SESSION_SECRET).update(body).digest('base64url')}`; }
  function api(path, body, email, extra = {}) { return worker.fetch(new Request(`https://gateway.test${path}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(email?{Authorization:`Bearer ${auth(email)}`} : {}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})}),env); }
  function webhook(type, object, {secret=env.STRIPE_WEBHOOK_SECRET, age=0, mode=false, path='/api/stripe-webhook'}={}) { const raw=JSON.stringify({id:'evt_mock',livemode:mode,type,data:{object}}); const time=Math.floor(Date.now()/1000)-age; const hash=createHmac('sha256',secret).update(`${time}.${raw}`).digest('hex'); return api(path, JSON.parse(raw),undefined,{'stripe-signature':`t=${time},v1=${hash}`}); }
  return {env,records,objects,api,webhook,setProjectionFailure(value){failProjection=value;}};
}
