// Real server routes, isolated funds, synthetic provider. Every external fetch
// is intercepted; this test cannot call an AI provider or use the local .env.
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
process.env.LINGOFUSION_SKIP_LOCAL_ENV = 'true';
process.env.LINGOFUSION_DATA_DIR = await mkdtemp(join(tmpdir(), 'lf-text-routes-'));
process.env.LINGOFUSION_REAL_MODELS = 'true';
process.env.LINGOFUSION_UPSTREAM_URL = 'https://api.openai.com/v1/chat/completions';
process.env.LINGOFUSION_UPSTREAM_API_KEY = 'synthetic-only';
const originalFetch = globalThis.fetch;
let calls = 0, base, sql;
globalThis.fetch = async (url, options) => {
  if (base && String(url).startsWith(base)) return originalFetch(url, options);
  assert.ok(['https://api.openai.com/v1/chat/completions', 'https://api.openai.com/v1/responses'].includes(String(url)), 'External network blocked');
  const payload = JSON.parse(options.body);
  assert.equal(options.headers.authorization || options.headers.Authorization, 'Bearer synthetic-only');
  const reservation = sql.prepare("SELECT * FROM text_usage_reservations WHERE status = 'reserved' ORDER BY rowid DESC LIMIT 1").get();
  assert.ok(reservation, 'funds must be reserved before dispatch');
  calls++;
  const responseId = `synthetic-provider-${calls}`;
  const tier = payload.service_tier === 'fast' ? 'priority' : payload.service_tier;
  const usage = { prompt_tokens: 3200, completion_tokens: 2, prompt_tokens_details: { cached_tokens: 3000 } };
  const data = { id: responseId, model: payload.model, service_tier: tier,
    choices: [{ message: { role: 'assistant', content: 'Bonjour' }, finish_reason: 'stop' }], usage };
  if (String(url).endsWith('/responses')) {
    const response = { id: responseId, model: payload.model, service_tier: tier, status: 'completed',
      output: [{ type: 'message', content: [{ type: 'output_text', text: 'Bonjour' }] }],
      usage: { input_tokens: 3600, output_tokens: 2, input_tokens_details: { cached_tokens: 3000 } } };
    if (!payload.stream) return Response.json(response);
    return new Response([{ type: 'response.created', response }, { type: 'response.output_text.delta', delta: 'Bonjour' },
      { type: 'response.completed', response }].map(event => `data: ${JSON.stringify(event)}\n\n`).join(''));
  }
  if (!payload.stream) return Response.json(data);
  return new Response(`data: ${JSON.stringify({ ...data, usage: undefined, choices: [{ delta: { content: 'Bonjour' } }] })}\r\n\r\n` +
    `data: ${JSON.stringify({ ...data, choices: [] })}\r\n\r\ndata: [DONE]\r\n\r\n`);
};
const { createApiServer } = await import('../server.mjs');
const server = createApiServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
base = `http://127.0.0.1:${server.address().port}`;
sql = new DatabaseSync(join(process.env.LINGOFUSION_DATA_DIR, 'platform.sqlite'));
const api = (path, body, key, operation) => fetch(base + path, { method: 'POST', headers: {
  'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}),
  ...(operation ? { 'Idempotency-Key': operation } : {}) }, body: JSON.stringify(body) });
try {
  const keyResponse = await api('/api/keys', { name: 'Synthetic route test' });
  const keyData = await keyResponse.json();
  const secret = keyData.secret || keyData.apiKey || keyData.key;
  assert.equal(typeof secret, 'string', JSON.stringify(keyData));
  sql.prepare('UPDATE users SET balance_usd = 2').run();
  const body = { model: 'LingoFusion Pro', messages: [{ role: 'user', content: 'Hello' }], pricing_mode: 'fast', max_completion_tokens: 32 };
  for (const stream of [false, true]) {
    const operation = `route-${stream}`;
    const first = await api('/v1/chat/completions', { ...body, stream }, secret, operation);
    assert.equal(first.status, 200, await first.clone().text());
    const text = await first.text(); assert.match(text, /Bonjour/); assert.match(text, /service_fee_usd/);
    const record = sql.prepare('SELECT status, result FROM text_usage_reservations WHERE operation_id = ?').get(operation);
    assert.equal(record.status, 'settled');
    const receipt = JSON.parse(record.result);
    assert.equal(receipt.usage.prompt_tokens, 3200);
    assert.equal(receipt.usage.total_tokens, 3202);
    assert.equal(receipt.usage.service_fee_usd, 0);
    assert.equal(receipt.cost_usd, 0.01686); // 3200 @ $5.25/M + 2 @ $30/M
    assert.equal(receipt.pricing_version, 'full-input-tokens-v1');
    const count = calls;
    const replay = await api('/v1/chat/completions', { ...body, stream }, secret, operation);
    assert.equal(replay.status, 200); await replay.text(); assert.equal(calls, count);
  }
  for (const stream of [false, true]) {
    const response = await api('/v1/chat/completions', { ...body, model: 'LingoFusion Ultra', pricing_mode: 'ultrafast', stream }, secret, `ultra-${stream}`);
    assert.equal(response.status, 200); assert.match(await response.text(), /service_fee_usd/);
    assert.equal(sql.prepare('SELECT status FROM text_usage_reservations WHERE operation_id = ?').get(`ultra-${stream}`).status, 'settled');
  }
  const translation = await api('/v1/translate', { model: 'LingoFusion Pro', input: 'Hello', from_language: 'English', to_language: 'French', stream: true }, secret, 'translate-one');
  assert.equal(translation.status, 200, await translation.clone().text());
  const translated = await translation.json();
  assert.equal(translated.output_text, 'Bonjour');
  assert.equal(translated.usage.input_tokens, 3200);
  assert.equal(translated.usage.total_tokens, 3202);
  assert.equal(translated.cost_usd, 0.01124);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM usage_ledger WHERE prompt_tokens < 3000').get().n, 0);
  const count = calls;
  for (const pricing_mode of ['batch', 'ultrafast']) {
    const unavailable = await api('/v1/chat/completions', { ...body, pricing_mode }, secret, `blocked-${pricing_mode}`);
    assert.equal(unavailable.status, 400);
    assert.equal(calls, count, 'unsupported/loss-making modes cannot dispatch provider work');
  }
  sql.prepare('UPDATE users SET balance_usd = 0').run();
  const replay = await api('/v1/chat/completions', { ...body, stream: false }, secret, 'route-false');
  assert.equal(replay.status, 200); assert.equal(calls, count);
  const blocked = await api('/v1/chat/completions', body, secret, 'unfunded');
  assert.equal(blocked.status, 402); assert.equal(calls, count);
  console.log('Node provider route checks passed: prepaid dispatch, Chat/Responses JSON and SSE, provenance, translation, zero-balance replay and insufficient-funds rejection. No provider network calls.');
} finally {
  globalThis.fetch = originalFetch; sql.close();
  await new Promise(resolve => server.close(resolve));
}
