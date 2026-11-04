import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './billing-test-harness.mjs';
import { prepareTextRequest, meteredText } from '../cloudflare-worker/meteredText.mjs';
import { billing } from '../cloudflare-worker/billing.mjs';
import { TEXT_PRICE_POLICY, priceTextUsage } from '../shared/textPricing.mjs';
import { buildPromptMessages } from '../shared/promptMessages.mjs';
import { verifyAndPrice } from '../shared/textRequest.mjs';
import { fetchTextProvider } from '../shared/textProvider.mjs';

test('speed tiers use explicit provider settings, verified actual tier and the Responses Ultrafast contract', async () => {
  const body = { model: 'LingoFusion Pro', messages: [{ role: 'user', content: 'Hello' }] };
  const standard = prepareTextRequest(body);
  assert.equal(standard.payload.service_tier, 'default');
  const fast = prepareTextRequest({ ...body, pricing_mode: 'fast' });
  const evidence = { id: 'tier-test', model: fast.policy.upstream, service_tier: 'default',
    usage: { prompt_tokens: 3200, completion_tokens: 2 } };
  assert.ok(verifyAndPrice(fast, evidence).cost_usd < verifyAndPrice(fast, { ...evidence, service_tier: 'priority' }).cost_usd);
  assert.throws(() => verifyAndPrice(standard, { ...evidence, service_tier: 'ultrafast' }));
  assert.throws(() => verifyAndPrice(fast, { ...evidence, service_tier: undefined }));
  assert.throws(() => prepareTextRequest({ ...body, pricing_mode: 'ultrafast' }), /published token rates/);
  const ultra = prepareTextRequest({ ...body, model: 'LingoFusion Ultra', pricing_mode: 'ultrafast' });
  assert.equal(ultra.payload.model, 'gpt-6-astra');
  let calls = 0;
  const response = await fetchTextProvider(ultra, { method: 'POST' }, async (url, options) => {
    calls++; assert.equal(url, 'https://api.openai.com/v1/responses');
    const payload = JSON.parse(options.body);
    assert.equal(payload.service_tier, 'ultrafast'); assert.equal(payload.input[0].content[0].type, 'input_text');
    assert.equal(payload.prompt_cache_options.ttl, '30m'); assert.equal(payload.max_output_tokens, 512);
    return Response.json({ id: 'real-ultra-id', model: 'gpt-6-astra', status: 'completed', service_tier: 'ultrafast',
      output: [{ type: 'message', content: [{ type: 'output_text', text: 'Bonjour' }] }],
      usage: { input_tokens: 3600, output_tokens: 2, total_tokens: 3602, input_tokens_details: { cached_tokens: 3000 } } });
  });
  const data = await response.json(); assert.equal(calls, 1); assert.equal(data.id, 'real-ultra-id');
  assert.equal(data.choices[0].message.content, 'Bonjour');
  assert.ok(verifyAndPrice(ultra, data).cost_usd <= ultra.maximum.cost_usd);
});

test('Ultrafast streaming keeps actual provider identity and final usage; truncated streams fail', async () => {
  const prepared = prepareTextRequest({ model: 'LingoFusion Ultra', stream: true, pricing_mode: 'ultrafast', messages: [{ role: 'user', content: 'Hello' }] });
  const final = { id: 'resp-stream-real', model: 'gpt-6-astra', status: 'completed', service_tier: 'ultrafast',
    output: [], usage: { input_tokens: 3600, output_tokens: 2 } };
  const events = [{ type: 'response.created', response: final }, { type: 'response.output_text.delta', delta: 'Bonjour' },
    { type: 'response.completed', response: final }];
  const mock = frames => async () => new Response(frames.map(event => `event: ${event.type}\r\ndata: ${JSON.stringify(event)}\r\n\r\n`).join(''));
  const response = await fetchTextProvider(prepared, {}, mock(events));
  const stream = await response.text();
  assert.match(stream, /resp-stream-real/); assert.match(stream, /Bonjour/); assert.match(stream, /prompt_tokens/);
  const truncated = await fetchTextProvider(prepared, {}, mock(events.slice(0, 2)));
  await assert.rejects(() => truncated.text(), /without final usage/);
});

test('reusable instruction prefix is identical across languages and tone, without caching source text', () => {
  for (const modelName of ['LingoFusion', 'LingoFusion Lite', 'LingoFusion Pro', 'LingoFusion Ultra', 'ExplainFusion']) {
    const a = buildPromptMessages({ modelName, fromLanguage: 'English', toLanguage: 'French', tone: 'Formal' });
    const b = buildPromptMessages({ modelName, fromLanguage: 'German', toLanguage: 'Italian', tone: 'Casual' });
    assert.deepEqual(a.messages[0], b.messages[0]);
    assert.notDeepEqual(a.messages[1], b.messages[1]);
    assert.equal(a.cacheOptions.mode, 'explicit');
    assert.equal(a.cacheOptions.ttl, '30m');
  }
});

test('full input is billed at existing retail rates across modes and cache states; there is no service fee', () => {
  for (const policy of Object.values(TEXT_PRICE_POLICY)) {
    for (const mode of ['default', 'fast', 'ultrafast']) {
      const multiplier = mode === 'fast' ? 1.5 : mode === 'ultrafast' ? 4 : 1;
      for (const input of [0, 1, 250, 300000]) for (const output of [0, 1, 8192]) {
        const cold = priceTextUsage({ policy, userTokens: input, outputTokens: output,
          rawInputTokens: input + 4000, cachedTokens: 0, mode });
        const warm = priceTextUsage({ policy, userTokens: input, outputTokens: output,
          rawInputTokens: input + 4000, cachedTokens: 3000, mode });
        assert.equal(cold.prompt_tokens, input + 4000);
        assert.equal(cold.customer_input_tokens, input);
        assert.equal(cold.service_fee_usd, 0);
        assert.equal(warm.cost_usd, cold.cost_usd, 'cached tokens use the published input rate');
        const nanos = BigInt(input + 4000) * BigInt(Math.ceil(policy.ri * multiplier)) + BigInt(output) * BigInt(Math.ceil(policy.ro * multiplier));
        assert.equal(cold.chargeMicros, Number((nanos + 999n) / 1000n));
      }
    }
  }
});

test('existing Standard rates cover cold prompt writes for every configured text model', () => {
  for (const model of Object.keys(TEXT_PRICE_POLICY)) {
    const prepared = prepareTextRequest({ model, messages: [{ role: 'user', content: 'Hello' }] });
    assert.ok(prepared.maximum.gross_profit_lower_bound_usd >= 0, model);
  }
  assert.throws(() => prepareTextRequest({ model: 'LingoFusion Pro', pricing_mode: 'batch', messages: [{ role: 'user', content: 'Hello' }] }), /asynchronous Batch/);
  assert.throws(() => prepareTextRequest({ model: 'LingoFusion Pro', messages: [{ role: 'user', content: 'a '.repeat(280000) }] }), /unavailable at the published token rates/);
});

test('gateway quote makes no paid request; settlement/replay bills full input and does not add fees', async () => {
  const h = harness(), email = 'text@example.com';
  h.records.set(`user_balance:${email}`, '1'); h.env.OPENAI_API_KEY = 'synthetic-only';
  const body = { model: 'LingoFusion Nano', messages: [{ role: 'user', content: 'Hello' }], max_completion_tokens: 100 };
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), 'https://api.openai.com/v1/chat/completions'); calls++;
    const payload = JSON.parse(options.body);
    assert.equal(payload.model, 'gpt-5-nano');
    return Response.json({ id: 'provider-test', model: 'gpt-5-nano', choices: [{ message: { content: 'Bonjour' } }],
      usage: { prompt_tokens: 3200, completion_tokens: 2, prompt_tokens_details: { cached_tokens: 3000 } } });
  };
  try {
    const quote = await h.api('/api/pricing/text', body, email);
    assert.equal(quote.status, 200); assert.equal(calls, 0);
    const headers = { 'Idempotency-Key': 'same-request', 'X-LingoFusion-Client-Token': 'lf_play_secure_649f7' };
    const first = await h.api('/api/playground/chat', body, email, headers);
    assert.equal(first.status, 200, await first.clone().text());
    const data = await first.json();
    assert.equal(data.usage.prompt_tokens, 3200);
    assert.equal(data.cost_usd, 0.000482);
    assert.ok(data.instruction_and_overhead_tokens > 3000);
    assert.equal(data.service_fee_usd, 0);
    assert.equal(data.balance_usd, 1 - data.cost_usd);
    const replay = await h.api('/api/playground/chat', body, email, headers);
    assert.equal(replay.status, 200); assert.equal(calls, 1);
    assert.equal((await replay.json()).cost_usd, data.cost_usd);
  } finally { globalThis.fetch = original; }
});

test('rejects unsupported routing, multimodal content and unpriced tools before provider dispatch', () => {
  for (const body of [
    { model: 'gpt-other', messages: [{ role: 'user', content: 'a' }] },
    { model: 'LingoFusion', messages: [{ role: 'user', content: [{ type: 'image_url' }] }] },
    { model: 'LingoFusion', tools: [], messages: [{ role: 'user', content: 'a' }] },
  ]) assert.throws(() => prepareTextRequest(body));
});

test('stream final usage settles once and replay preserves SSE without redispatch', async () => {
  const h = harness(), email = 'stream@example.com';
  h.records.set(`user_balance:${email}`, '1'); h.env.OPENAI_API_KEY = 'synthetic-only';
  const body = { model: 'LingoFusion Nano', messages: [{ role: 'user', content: 'Hello' }], stream: true };
  const headers = { 'Idempotency-Key': 'stream-one', 'X-LingoFusion-Client-Token': 'lf_play_secure_649f7' };
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    const frames = [ { id: 'stream-provider', model: 'gpt-5-nano', choices: [{ delta: { content: 'Bonjour' } }] },
      { id: 'stream-provider', model: 'gpt-5-nano', choices: [], usage: { prompt_tokens: 3200, completion_tokens: 2 } } ];
    return new Response(frames.map(f => `data: ${JSON.stringify(f)}\n\n`).join('') + 'data: [DONE]\n\n');
  };
  try {
    const first = await h.api('/api/playground/chat', body, email, headers);
    const data = await first.text();
    assert.match(data, /Bonjour/); assert.match(data, /service_fee_usd/); assert.match(data, /balance_usd/);
    const second = await h.api('/api/playground/chat', body, email, headers);
    assert.match(second.headers.get('Content-Type'), /event-stream/);
    assert.match(await second.text(), /Bonjour/); assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test('unknown provider outcome retains funds and cannot be retried into another provider call', async () => {
  const h = harness(), email = 'timeout@example.com';
  h.records.set(`user_balance:${email}`, '1'); h.env.OPENAI_API_KEY = 'synthetic-only';
  const body = { model: 'LingoFusion Nano', messages: [{ role: 'user', content: 'Hello' }] };
  const headers = { 'Idempotency-Key': 'timeout', 'X-LingoFusion-Client-Token': 'lf_play_secure_649f7' };
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('simulated disconnect'); };
  try {
    assert.equal((await h.api('/api/playground/chat', body, email, headers)).status, 502);
    assert.equal((await h.api('/api/playground/chat', body, email, headers)).status, 409);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test('client cancellation drains final provider usage and settles without a second charge', async () => {
  const h = harness(), email = 'cancel@example.com';
  h.records.set(`user_balance:${email}`, '1'); h.env.OPENAI_API_KEY = 'synthetic-only';
  const body = { model: 'LingoFusion Nano', messages: [{ role: 'user', content: 'Hello' }], stream: true };
  const original = globalThis.fetch, waits = []; let providerController;
  const encode = data => new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
  globalThis.fetch = async () => new Response(new ReadableStream({ start(controller) {
    providerController = controller;
    controller.enqueue(encode({ id: 'cancel-provider', model: 'gpt-5-nano', choices: [{ delta: { content: 'Bonjour' } }] }));
  } }));
  try {
    const response = await meteredText(new Request('https://gateway.test/api/playground/chat', {
      method: 'POST', headers: { 'Idempotency-Key': 'cancel-one' }, body: JSON.stringify(body),
    }), h.env, { email }, (data, status = 200) => Response.json(data, { status }), false, { waitUntil(p) { waits.push(p); } });
    const reader = response.body.getReader();
    assert.match(new TextDecoder().decode((await reader.read()).value), /Bonjour/);
    await reader.cancel();
    providerController.enqueue(encode({ id: 'cancel-provider', model: 'gpt-5-nano', choices: [], usage: { prompt_tokens: 3200, completion_tokens: 2 } }));
    providerController.close();
    await Promise.all(waits);
    const status = await billing(h.env, { action: 'usageStatus', email, operationId: 'cancel-one' });
    assert.equal(status.status, 'settled'); assert.equal(status.held_usd, 0);
    assert.equal(status.result.usage.prompt_tokens, 3200);
    assert.equal(status.balance_usd, 1 - status.cost_usd);
  } finally { globalThis.fetch = original; }
});
