export const TEXT_PRICING_VERSION = 'full-input-tokens-v2';

// Reviewed 2026-11-02 against https://developers.openai.com/api/docs/models/<id>.
// Nanodollars/token. No cache-hit assumptions; usage comes from the provider.
export const TEXT_PRICE_POLICY = Object.freeze({
  'LingoFusion Nano': { upstream: 'gpt-5-nano', ri: 100, ro: 800, wi: 50, wo: 400, cached: 5, write: 50 },
  'LingoFusion Lite': { upstream: 'gpt-5.6-luna', ri: 500, ro: 2000, wi: 200, wo: 1200, cached: 20, write: 250 },
  LingoFusion: { upstream: 'gpt-6-luna', ri: 1000, ro: 5000, wi: 100, wo: 500, cached: 10, write: 125 },
  'LingoFusion Pro': { upstream: 'gpt-6-sol', ri: 3500, ro: 20000, wi: 2000, wo: 10000, cached: 200, write: 2500 },
  'LingoFusion Pro Reasoning': { upstream: 'gpt-6.1-sol', ri: 3500, ro: 20000, wi: 2000, wo: 10000, cached: 100, write: 2500 },
  'LingoFusion Ultra': { upstream: 'gpt-6-astra', ri: 20000, ro: 120000, wi: 10000, wo: 50000, cached: 1000, write: 12500 },
  ExplainFusion: { upstream: 'gpt-6-luna', ri: 2000, ro: 500, wi: 100, wo: 500, cached: 10, write: 125 },
});

export function textPricePolicy(model, reasoning = false) {
  const raw = String(model).trim().toLowerCase();
  const requested = raw === 'lingofusion explain' ? 'explainfusion' : raw;
  const name = Object.keys(TEXT_PRICE_POLICY).find(k => k.toLowerCase() === requested || k.toLowerCase().replaceAll(' ', '-') === requested)
    || Object.keys(TEXT_PRICE_POLICY).find(k => TEXT_PRICE_POLICY[k].upstream === requested);
  const key = name === 'LingoFusion Pro' && reasoning ? 'LingoFusion Pro Reasoning' : name;
  if (!key) throw new Error('Unsupported text model');
  return { ...TEXT_PRICE_POLICY[key], key, model: name };
}

export function priceTextUsage({ policy, userTokens, outputTokens, rawInputTokens,
  cachedTokens = 0, cacheWriteTokens = rawInputTokens - cachedTokens, mode = 'default', longContext = false }) {
  for (const n of [userTokens, outputTokens, rawInputTokens, cachedTokens, cacheWriteTokens]) {
    if (!Number.isSafeInteger(n) || n < 0) throw new Error('Invalid provider usage');
  }
  if (cachedTokens + cacheWriteTokens > rawInputTokens || userTokens > rawInputTokens) throw new Error('Inconsistent provider usage');
  const retailMultiplier = { default: 1, instant: 1, batch: 0.5, fast: 1.5, ultrafast: 4 }[mode];
  if (!retailMultiplier) throw new Error('Unsupported pricing mode');
  // Current chat route uses standard synchronous processing. Discount labels
  // must never imply an unearned upstream Batch discount or faster execution.
  // Processing premiums are supplied only by a verified provider adapter.
  const speed = mode === 'fast' ? 2 : mode === 'ultrafast' ? 6 : 1;
  const inputMultiplier = (longContext ? 2 : 1) * speed;
  const outputMultiplier = (longContext ? 1.5 : 1) * speed;
  const ordinary = rawInputTokens - cachedTokens - cacheWriteTokens;
  const provider = BigInt(ordinary) * BigInt(policy.wi * inputMultiplier) +
    BigInt(cacheWriteTokens) * BigInt(policy.write * inputMultiplier) +
    BigInt(cachedTokens) * BigInt(policy.cached * inputMultiplier) +
    BigInt(outputTokens) * BigInt(policy.wo * outputMultiplier);
  // Customer input includes the complete provider input, including built-in
  // instructions and framing. Cache evidence changes our cost, not the
  // published retail input rate. There is no additional service fee.
  const tokenCost = BigInt(rawInputTokens) * BigInt(Math.ceil(policy.ri * retailMultiplier)) +
    BigInt(outputTokens) * BigInt(Math.ceil(policy.ro * retailMultiplier));
  // Existing prepaid balances settle to six decimal USD places. Only the
  // combined token total is rounded, once, upward to the next microdollar.
  const chargeMicros = Number((tokenCost + 999n) / 1000n);
  return { chargeMicros, cost_usd: chargeMicros / 1e6,
    pricing_version: TEXT_PRICING_VERSION,
    service_fee_usd: 0, token_cost_usd: Number(tokenCost) / 1e9,
    provider_cost_upper_bound_usd: Number(provider) / 1e9,
    gross_profit_lower_bound_usd: chargeMicros / 1e6 - Number(provider) / 1e9,
    prompt_tokens: rawInputTokens, completion_tokens: outputTokens,
    customer_input_tokens: userTokens,
    instruction_and_overhead_tokens: rawInputTokens - userTokens,
    cached_tokens: cachedTokens, cache_write_tokens: cacheWriteTokens };
}
