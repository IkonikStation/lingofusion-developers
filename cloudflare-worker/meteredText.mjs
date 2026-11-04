import { prepareTextRequest, verifyAndPrice } from '../shared/textRequestCore.mjs';
import { fetchTextProvider } from '../shared/textProvider.mjs';
import { TEXT_PRICING_VERSION } from '../shared/textPricing.mjs';
import { billing } from './billing.mjs';
export { prepareTextRequest } from '../shared/textRequestCore.mjs';

const hash = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(x => x.toString(16).padStart(2, '0')).join('');

// CORS/status formatting stays in the worker. This adapter owns dispatch and
// settlement; callers cannot choose provider IDs, prices or a balance delta.
export async function meteredText(request, env, auth, respond, quoteOnly = false, context, providerFetch = fetch) {
  let prepared;
  try { prepared = prepareTextRequest(await request.json()); }
  catch (e) { return respond({ error: 'invalid_text_request', message: e.message }, 400); }
  const { maximum, policy, payload, userTokens } = prepared;
  if (quoteOnly) return respond({ model: policy.model, pricing_version: TEXT_PRICING_VERSION,
    maximum_cost_usd: maximum.cost_usd, maximum_service_fee_usd: 0,
    input_tokens: prepared.rawMaximum, customer_input_tokens: prepared.exactInputCount ? userTokens : null, input_count_is_upper_bound: !prepared.exactInputCount, instruction_tokens_estimate: prepared.systemTokens, max_completion_tokens: prepared.maxOutput,
    notice: 'Total input is billed at the published input rate. Output includes reasoning. No additional service fee. Final token charges round up once to six decimal USD places.' });
  if (!env.BILLING || !env.GIFTS || !env.OPENAI_API_KEY) return respond({ error: 'metered_text_not_configured' }, 503);
  const operationId = request.headers.get('Idempotency-Key') || crypto.randomUUID();
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(operationId)) return respond({ error: 'invalid_idempotency_key' }, 400);
  const fingerprint = await hash(JSON.stringify({ pricingVersion: TEXT_PRICING_VERSION, payload, mode: prepared.mode,
    format: new URL(request.url).pathname === '/v1/translate' ? 'translate' : 'chat' }));
  const identity = { email: auth.email, operationId, fingerprint };
  let held;
  try { held = await billing(env, { action: 'usageReserve', ...identity, maximumMicros: maximum.chargeMicros }); }
  catch (e) { return respond({ error: 'reservation_failed', message: e.message }, /Insufficient/.test(e.message) ? 402 : 409); }
  if (held.replay) {
    if (held.status !== 'settled') return respond({ error: 'request_pending_reconciliation', operation_id: operationId }, 409);
    const result = { ...held.result, balance_usd: held.balance_usd,
      usage: { ...held.result.usage, balance_usd: held.balance_usd }, replay: true };
    if (!payload.stream) return respond(result);
    const first = { ...result, usage: undefined, choices: [{ index: 0, delta: { content: result.choices?.[0]?.message?.content || '' } }] };
    return new Response(`data: ${JSON.stringify(first)}\n\ndata: ${JSON.stringify({ ...result, choices: [] })}\n\ndata: [DONE]\n\n`, {
      headers: { ...Object.fromEntries(respond({}).headers), 'Content-Type': 'text/event-stream' } });
  }
  const uncertain = () => billing(env, { action: 'usageUncertain', ...identity }).catch(() => {});
  const finish = async data => {
    const price = verifyAndPrice(prepared, data);
    const rawUsage = structuredClone(data.usage);
    const result = { ...data, model: policy.model,
      from_language: prepared.settings.fromLanguage, to_language: prepared.settings.toLanguage,
      ...(new URL(request.url).pathname === '/v1/translate' ? { output_text: data.choices?.[0]?.message?.content || '' } : {}),
      usage: { ...data.usage, prompt_tokens: price.prompt_tokens, total_tokens: price.prompt_tokens + data.usage.completion_tokens,
        customer_input_tokens: prepared.exactInputCount ? userTokens : null, instruction_and_overhead_tokens: prepared.exactInputCount ? price.instruction_and_overhead_tokens : null,
        prompt_tokens_details: undefined, cost_usd: price.cost_usd, service_fee_usd: price.service_fee_usd,
        token_cost_usd: price.token_cost_usd, web_search_cost_usd: price.web_search_cost_usd ?? 0 },
      cost_usd: price.cost_usd, service_fee_usd: price.service_fee_usd, token_cost_usd: price.token_cost_usd,
      pricing_version: TEXT_PRICING_VERSION, instruction_and_overhead_tokens: prepared.exactInputCount ? price.instruction_and_overhead_tokens : null, operation_id: operationId };
    const settled = await billing(env, { action: 'usageFinish', ...identity, actualMicros: price.chargeMicros, result,
      evidence: { providerRequestId: data.id, upstreamModel: data.model, rawUsage, ...price } });
    return { ...result, usage: { ...result.usage, balance_usd: settled.balance_usd }, balance_usd: settled.balance_usd };
  };
  let upstream;
  try {
    upstream = await fetchTextProvider(prepared, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      signal: AbortSignal.timeout(120000) }, providerFetch);
  } catch { await uncertain(); return respond({ error: 'provider_outcome_unknown', operation_id: operationId,
    message: `Funds remain reserved while request ${operationId} is reconciled. Retry with the same request ID; do not submit it as new work.` }, 502); }
  // A failed HTTP response does not establish that provider work was free.
  if (!upstream.ok) { await uncertain(); return respond({ error: 'provider_request_failed', operation_id: operationId,
    message: `Request ${operationId} needs reconciliation. Its funds remain reserved; retry with the same request ID.` }, 502); }
  if (!payload.stream) {
    try { return respond(await finish(await upstream.json())); }
    catch (e) { await uncertain(); return respond({ error: 'usage_requires_reconciliation', message: e.message, operation_id: operationId }, 502); }
  }
  // Drain provider usage even when a client disconnects. Settlement does not
  // depend on the client receiving the last chunk or sending a second request.
  let cancelled = false;
  const encoder = new TextEncoder();
  let completeDrain;
  const drained = new Promise(resolve => { completeDrain = resolve; });
  context?.waitUntil(drained);
  const stream = new ReadableStream({
    async start(controller) {
      const emit = value => { if (!cancelled) controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`)); };
      let buffer = '', text = '', evidence = null, chunks = 0, finishReason = 'stop', providerId = null, providerModel = null;
      try {
        const reader = upstream.body.getReader(), decoder = new TextDecoder();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          buffer = buffer.replace(/\r\n/g, '\n');
          if (buffer.length > 1000000) throw new Error('Provider stream frame too large');
          let boundary;
          while ((boundary = buffer.indexOf('\n\n')) !== -1) {
            const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
            for (const line of frame.split('\n')) {
              if (!line.startsWith('data: ') || line.slice(6).trim() === '[DONE]') continue;
              const part = JSON.parse(line.slice(6));
              if (part.error) throw new Error('Provider stream failed');
              if (part.id && providerId && part.id !== providerId || part.model && providerModel && part.model !== providerModel) throw new Error('Provider stream identity changed');
              providerId ||= part.id; providerModel ||= part.model;
              if (++chunks > 100000) throw new Error('Provider stream too large');
              text += part.choices?.[0]?.delta?.content || '';
              if (part.choices?.[0]?.finish_reason) finishReason = part.choices[0].finish_reason;
              if (text.length > 1000000) throw new Error('Provider output too large');
              if (part.usage) evidence = part;
              else emit({ ...part, model: policy.model });
            }
          }
        }
        if (!evidence || buffer.trim()) throw new Error('Provider final usage missing or truncated');
        const result = await finish({ ...evidence, choices: [{ message: { role: 'assistant', content: text }, finish_reason: finishReason, index: 0 }] });
        emit({ ...result, choices: [] });
        if (!cancelled) { controller.enqueue(encoder.encode('data: [DONE]\n\n')); controller.close(); }
      } catch (e) { await uncertain(); if (!cancelled) { emit({ error: 'usage_requires_reconciliation', operation_id: operationId }); controller.close(); } }
      finally { completeDrain(); }
    },
    cancel() { cancelled = true; },
  });
  return new Response(stream, { headers: { ...Object.fromEntries(respond({}).headers), 'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache', 'X-LingoFusion-Operation-Id': operationId, 'Access-Control-Expose-Headers': 'X-LingoFusion-Operation-Id' } });
}
