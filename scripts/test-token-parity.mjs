// No provider traffic: every fetch is intercepted, including during import.
// Optional argument: an authenticated read-only download of our deployed Worker.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { harness } from './billing-test-harness.mjs';
import { prepareTextRequest } from '../shared/textRequest.mjs';

const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error('External network forbidden'); };
try {
  const deployed = process.argv[2] ? await import(pathToFileURL(process.argv[2]).href) : null;
  const routes = [
    ['LingoFusion Nano', 100, 800], ['LingoFusion Lite', 500, 2000],
    ['LingoFusion', 1000, 5000], ['LingoFusion Pro', 3500, 20000],
    ['LingoFusion Pro', 3500, 20000, true], ['LingoFusion Ultra', 20000, 120000],
    ['ExplainFusion', 2000, 500],
  ];
  let cases = 0, dispatches = 0, reasoningCases = 0;
  const examples = [];
  for (const [model, inputRate, outputRate, reasoning] of routes) {
    const modes = ['default', ...(!reasoning && model !== 'ExplainFusion' ? ['fast'] : []), ...(model === 'LingoFusion Ultra' ? ['ultrafast'] : [])];
    for (const mode of modes) for (const stream of [false, true]) for (const output of [0, 1, 355, 585]) {
      const h = harness(deployed ? { workerOverride: deployed.default, ledgerOverride: deployed.BillingLedger, giftsOverride: deployed.GiftClaims } : {});
      const email = 'parity@example.invalid';
      h.records.set(`user_balance:${email}`, '100'); h.env.OPENAI_API_KEY = 'synthetic-only';
      const body = { model, reasoning_enabled: !!reasoning, pricing_mode: mode, stream,
        messages: [{ role: 'user', content: 'Hello' }], max_completion_tokens: 1024 };
      const prepared = prepareTextRequest(body);
      const input = prepared.rawMaximum - 16;
      const read = output === 1 ? 1024 : output === 585 ? Math.floor(input / 2) : 0;
      const write = output === 355 ? input : output === 585 ? input - read : 0;
      const thinking = reasoning || model === 'LingoFusion Ultra' ? Math.floor(output / 2) : 0;
      const usage = { prompt_tokens: input, completion_tokens: output, total_tokens: input + output,
        prompt_tokens_details: { cached_tokens: read, cache_write_tokens: write },
        completion_tokens_details: { reasoning_tokens: thinking } };
      const id = `parity-${++cases}`;
      const tier = mode === 'fast' ? 'priority' : mode;
      let calls = 0;
      globalThis.fetch = async (url, options) => {
        assert.ok(['https://api.openai.com/v1/chat/completions', 'https://api.openai.com/v1/responses'].includes(String(url)), 'Unexpected network blocked');
        assert.equal(JSON.parse(options.body).model, prepared.policy.upstream);
        calls++; dispatches++;
        if (String(url).endsWith('/responses')) {
          const response = { id, model: prepared.policy.upstream, status: 'completed', service_tier: tier,
            output: [{ type: 'message', content: [{ type: 'output_text', text: output ? 'Bonjour' : '' }] }],
            usage: { input_tokens: input, output_tokens: output, total_tokens: input + output,
              input_tokens_details: usage.prompt_tokens_details, output_tokens_details: usage.completion_tokens_details } };
          return stream ? new Response(`data: ${JSON.stringify({ type: 'response.completed', response })}\n\n`) : Response.json(response);
        }
        const response = { id, model: prepared.policy.upstream, service_tier: tier,
          usage, choices: [{ message: { content: output ? 'Bonjour' : '' } }] };
        return stream ? new Response(`data: ${JSON.stringify({ ...response, choices: [] })}\n\ndata: [DONE]\n\n`) : Response.json(response);
      };
      const headers = { 'Idempotency-Key': id, 'X-LingoFusion-Client-Token': 'lf_play_secure_649f7' };
      const result = await h.api('/api/playground/chat', body, email, headers);
      const raw = await result.text();
      assert.equal(result.status, 200, raw);
      const receipt = stream ? raw.split('\n').filter(x => x.startsWith('data: {')).map(x => JSON.parse(x.slice(6))).find(x => x.usage) : JSON.parse(raw);
      assert.equal(receipt.usage.prompt_tokens, input, `${model}/${mode}: input mismatch`);
      assert.equal(receipt.usage.completion_tokens, output, `${model}/${mode}: output mismatch`);
      assert.equal(receipt.usage.total_tokens, input + output, 'Reasoning must not be added twice');
      const multiplier = mode === 'fast' ? 1.5 : mode === 'ultrafast' ? 4 : 1;
      const nanos = BigInt(input) * BigInt(Math.ceil(inputRate * multiplier)) + BigInt(output) * BigInt(Math.ceil(outputRate * multiplier));
      assert.equal(receipt.cost_usd, Number((nanos + 999n) / 1000n) / 1e6);
      const stored = h.objects.get('billing:ledger-v1').data.get(`meteredUsage:${email}:${id}`);
      assert.deepEqual(stored.evidence.rawUsage, usage);
      assert.equal(stored.result.usage.prompt_tokens, input);
      assert.equal(stored.result.usage.completion_tokens, output);
      assert.equal(stored.actualMicros, Number((nanos + 999n) / 1000n));
      const replay = await h.api('/api/playground/chat', body, email, headers);
      assert.equal(replay.status, 200); await replay.text(); assert.equal(calls, 1, 'Replay must not redispatch');
      if (thinking) reasoningCases++;
      if (model === 'LingoFusion' && mode === 'default' && !stream) examples.push({ provider_input: input, billed_input: receipt.usage.prompt_tokens, provider_output: output, billed_output: receipt.usage.completion_tokens });
    }
  }
  console.log(JSON.stringify({ target: deployed ? 'downloaded deployed Worker' : 'local Worker', cases, dispatches, reasoningCases, mismatches: 0, examples }, null, 2));
} finally { globalThis.fetch = originalFetch; }
