import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './billing-test-harness.mjs';
test('asynchronous text adapter failures retain CORS and a readable JSON error',async()=>{
 const h=harness();Object.defineProperty(h.env,'OPENAI_API_KEY',{get(){throw Error('synthetic adapter failure');}});
 const r=await h.api('/api/playground/chat',{model:'LingoFusion',messages:[{role:'user',content:'Hello'}]},'synthetic@example.invalid',{'Origin':'https://ikonikstation.github.io','Idempotency-Key':'synthetic-cors','X-LingoFusion-Billing-Version':'full-input-tokens-v2'});
 assert.equal(r.status,500);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://ikonikstation.github.io');assert.equal((await r.json()).message,'synthetic adapter failure');
});
