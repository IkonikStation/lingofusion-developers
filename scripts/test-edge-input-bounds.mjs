import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareTextRequest as exact,verifyAndPrice} from '../shared/textRequest.mjs';
import {prepareTextRequest as bounded} from '../shared/textRequestCore.mjs';
test('cheap edge bounds cover exact inputs while provider token settlement stays identical',()=>{
 for(const model of ['LingoFusion Nano','LingoFusion Lite','LingoFusion','LingoFusion Pro','LingoFusion Ultra','ExplainFusion']){
  for(const text of ['Hello','你好世界','👨‍👩‍👧‍👦 café مرحبا','a'.repeat(3000),'hello\n'.repeat(100)]){
   const body={model,messages:[{role:'user',content:text}],max_completion_tokens:512};
   const a=exact(body),b=bounded(body);assert.ok(b.rawMaximum>=a.rawMaximum);assert.equal(b.exactInputCount,false);
   const reply={id:'synthetic-bounds',model:a.policy.upstream,service_tier:'default',usage:{prompt_tokens:a.rawMaximum,completion_tokens:100}};
   assert.equal(verifyAndPrice(a,reply).chargeMicros,verifyAndPrice(b,reply).chargeMicros);
   assert.ok(verifyAndPrice(b,reply).chargeMicros<=b.maximum.chargeMicros);
  }
 }
});
