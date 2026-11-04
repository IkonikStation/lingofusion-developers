// Local workerd-only fixture. Never use this file as a deployment entry point.
import { meteredText, prepareTextRequest } from '../../cloudflare-worker/meteredText.mjs';
import { billing } from '../../cloudflare-worker/billing.mjs';
export { BillingLedger } from '../../cloudflare-worker/billing.mjs';
const email = 'margin-runtime@example.invalid';
let calls = 0;
let clientDeltaRequests = 0;
export default { async fetch(request, env, context) {
  if (env.MARGIN_RUNTIME_FIXTURE !== 'local-only' || env.OPENAI_API_KEY !== 'synthetic-only') return new Response('Fixture disabled', { status: 503 });
  const path = new URL(request.url).pathname;
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key, X-LingoFusion-Client-Token, X-LingoFusion-Billing-Version',
    'Access-Control-Expose-Headers': 'X-LingoFusion-Operation-Id' };
  const respond = (data, status = 200) => Response.json(data, { status, headers });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (path === '/api/auth/config') return respond({ googleClientId: '', appleClientId: '' });
  if (path === '/api/keys') return respond({ apiKeys: [] });
  if (path === '/api/user/balance' && request.method === 'GET') return respond(await billing(env, { action: 'balance', email }));
  if (path === '/api/user/balance' && request.method === 'POST') { clientDeltaRequests++; return respond({ error: 'client_delta_rejected' }, 403); }
  if (path === '/fixture/metrics') return respond({ providerCalls: calls, clientDeltaRequests });
  if (path === '/api/pricing/text') return meteredText(request, env, { email }, respond, true, context);
  if (path.startsWith('/api/usage/')) return respond(await billing(env, { action: 'usageStatus', email, operationId: path.split('/').pop() }));
  if (path === '/fixture/bootstrap' && request.method === 'POST') {
    await env.GIFTS.put(`user_balance:${email}`, '1');
    return Response.json({ synthetic: true });
  }
  if (path === '/fixture/balance') return Response.json(await billing(env, { action: 'balance', email }));
  if (path === '/fixture/status') return Response.json(await billing(env, { action: 'usageStatus', email, operationId: 'runtime-one' }));
  if (['/fixture/run', '/api/playground/chat'].includes(path) && request.method === 'POST') {
    const body = await request.clone().json(), prepared = prepareTextRequest(body);
    const mock = async (url, options) => {
      if (url !== 'https://api.openai.com/v1/chat/completions') throw new Error('Unexpected fixture transport');
      const payload = JSON.parse(options.body);
      calls++;
      const result = { id: `fixture-provider-${crypto.randomUUID()}`, model: payload.model,
        choices: [{ message: { role: 'assistant', content: 'Bonjour' } }],
        usage: { prompt_tokens: prepared.rawMaximum - 100, completion_tokens: 2,
          prompt_tokens_details: { cached_tokens: Math.min(3000, prepared.rawMaximum - 100), cache_write_tokens: 0 } } };
      if (!payload.stream) return Response.json(result);
      return new Response(`data: ${JSON.stringify({ ...result, usage: undefined, choices: [{ delta: { content: 'Bonjour' } }] })}\n\n` +
        `data: ${JSON.stringify({ ...result, choices: [] })}\n\ndata: [DONE]\n\n`);
    };
    const response = await meteredText(request, env, { email }, respond, false, context, mock);
    response.headers.set('X-Fixture-Provider-Calls', String(calls));
    return response;
  }
  return new Response('Fixture route not found', { status: 404 });
} };
