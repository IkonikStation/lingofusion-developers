export const TEXT_PRICING_VERSION = 'full-input-tokens-v2';

// Reviewed 2026-11-02 against https://developers.openai.com/api/docs/models/<id>.
// Nanodollars/token. No cache-hit assumptions; usage comes from the provider.
// Original base pricing configuration is preserved untouched; time-bounded
// promotions are layered on top via resolveEffectivePolicy().
export const TEXT_PRICE_POLICY = Object.freeze({
  'LingoFusion Spark': { upstream: 'qwen/qwen3.7-flash', provider: 'openrouter', ri: 50, ro: 250, wi: 30, wo: 130, cached: 6, write: 38 },
  'LingoFusion Lite': { upstream: 'gpt-5.6-luna', ri: 500, ro: 2000, wi: 200, wo: 1200, cached: 20, write: 250 },
  LingoFusion: { upstream: 'gpt-6-luna', ri: 1000, ro: 5000, wi: 100, wo: 500, cached: 10, write: 125 },
  'LingoFusion Pro': { upstream: 'gpt-6-sol', ri: 3500, ro: 20000, wi: 2000, wo: 10000, cached: 200, write: 2500 },
  'LingoFusion Pro Reasoning': { upstream: 'gpt-6.1-sol', ri: 3500, ro: 20000, wi: 2000, wo: 10000, cached: 100, write: 2500 },
  'LingoFusion Ultra': { upstream: 'gpt-6.2-astra', ri: 20000, ro: 120000, wi: 8000, wo: 40000, cached: 400, write: 10000 },
  'Ask LingoFusion': { conversationInputOnly: true, upstream: 'gpt-6-sol', ri: 5000, ro: 20000, wi: 2000, wo: 10000, cached: 200, write: 2500 },
  ExplainFusion: { upstream: 'gpt-6-luna', ri: 2000, ro: 500, wi: 100, wo: 500, cached: 10, write: 125 },
});

// Six-day Black Friday & Cyber Monday sale (144 hours, UTC).
// Eligible only on standard synchronous processing (default / instant) and
// standard context length (<= 272K tokens) to prevent discount stacking and
// exclude unprofitable processing modes or long-context surcharges.
export const BLACK_FRIDAY_PROMOTION = Object.freeze({
  id: 'black-friday-cyber-monday-2026',
  name: 'Black Friday & Cyber Monday',
  headline: 'Up to 50% OFF',
  startsAt: '2026-11-25T05:00:00Z',
  endsAt: '2026-12-01T05:00:00Z',
  startMs: Date.parse('2026-11-25T05:00:00Z'),
  endMs: Date.parse('2026-12-01T05:00:00Z'),
  durationHours: 144,
  maxDiscountPercent: 50,
  eligibleModes: Object.freeze(['default', 'instant']),
  discounts: Object.freeze({
    'LingoFusion Spark': Object.freeze({ discountPercent: 20, inputDiscountPercent: 20, outputDiscountPercent: 20, ri: 40, ro: 200, inputOnly: false }),
    'LingoFusion Lite': Object.freeze({ discountPercent: 10, inputDiscountPercent: 10, outputDiscountPercent: 10, ri: 450, ro: 1800, inputOnly: false }),
    LingoFusion: Object.freeze({ discountPercent: 50, inputDiscountPercent: 50, outputDiscountPercent: 50, ri: 500, ro: 2500, inputOnly: false }),
    'LingoFusion Pro': Object.freeze({ discountPercent: 20, inputDiscountPercent: 20, outputDiscountPercent: 20, ri: 2800, ro: 16000, inputOnly: false }),
    'LingoFusion Pro Reasoning': Object.freeze({ discountPercent: 20, inputDiscountPercent: 20, outputDiscountPercent: 20, ri: 2800, ro: 16000, inputOnly: false }),
    'LingoFusion Ultra': Object.freeze({ discountPercent: 25, inputDiscountPercent: 25, outputDiscountPercent: 25, ri: 15000, ro: 90000, inputOnly: false }),
    // ExplainFusion provider output cost (gpt-6-luna) is $0.50/1M (wo: 500), equal to base output retail.
    // Discount input only by 10% ($2.00 -> $1.80) and keep output at $0.50 to avoid selling below cost.
    ExplainFusion: Object.freeze({ discountPercent: 10, inputDiscountPercent: 10, outputDiscountPercent: 0, ri: 1800, ro: 500, inputOnly: true }),
  }),
});

export function isPromotionActive(nowMs = Date.now()) {
  return Number.isFinite(nowMs) && nowMs >= BLACK_FRIDAY_PROMOTION.startMs && nowMs < BLACK_FRIDAY_PROMOTION.endMs;
}

export function isPromotionUpcoming(nowMs = Date.now()) {
  return Number.isFinite(nowMs) && nowMs < BLACK_FRIDAY_PROMOTION.startMs;
}

export function getModelPromotion(modelName, { nowMs = Date.now(), mode = 'default', longContext = false } = {}) {
  if (!isPromotionActive(nowMs)) return null;
  if (!BLACK_FRIDAY_PROMOTION.eligibleModes.includes(mode)) return null;
  if (longContext) return null;
  let key = modelName;
  if (!BLACK_FRIDAY_PROMOTION.discounts[key]) {
    try {
      const resolved = textPricePolicy(modelName);
      key = resolved.key;
    } catch {
      return null;
    }
  }
  const discount = BLACK_FRIDAY_PROMOTION.discounts[key];
  const base = TEXT_PRICE_POLICY[key];
  if (!discount || !base) return null;
  // Never allow a promotional rate below conservative provider cost floor.
  if (discount.ri < Math.max(base.wi, base.write) || discount.ro < base.wo) return null;
  return {
    id: BLACK_FRIDAY_PROMOTION.id,
    model: key === 'LingoFusion Pro Reasoning' ? 'LingoFusion Pro' : key,
    discountPercent: discount.discountPercent,
    inputDiscountPercent: discount.inputDiscountPercent,
    outputDiscountPercent: discount.outputDiscountPercent,
    inputOnly: Boolean(discount.inputOnly),
    originalRi: base.ri,
    originalRo: base.ro,
    ri: discount.ri,
    ro: discount.ro,
    originalInputUsd: base.ri / 1000,
    originalOutputUsd: base.ro / 1000,
    inputUsd: discount.ri / 1000,
    outputUsd: discount.ro / 1000,
  };
}

export function resolveEffectivePolicy(policy, { nowMs = Date.now(), mode = 'default', longContext = false } = {}) {
  const base = (policy?.key && TEXT_PRICE_POLICY[policy.key]) || policy;
  const promo = getModelPromotion(policy?.key || policy?.model, { nowMs, mode, longContext });
  if (!promo) {
    return {
      ...policy,
      ri: base.ri,
      ro: base.ro,
      originalRi: base.ri,
      originalRo: base.ro,
      promotion: null,
    };
  }
  return {
    ...policy,
    ri: promo.ri,
    ro: promo.ro,
    originalRi: base.ri,
    originalRo: base.ro,
    promotion: promo,
  };
}

export function getPromotionState(nowMs = Date.now()) {
  const active = isPromotionActive(nowMs);
  const upcoming = isPromotionUpcoming(nowMs);
  const expired = Number.isFinite(nowMs) && nowMs >= BLACK_FRIDAY_PROMOTION.endMs;
  const remainingMs = active
    ? Math.max(0, BLACK_FRIDAY_PROMOTION.endMs - nowMs)
    : upcoming
      ? Math.max(0, BLACK_FRIDAY_PROMOTION.startMs - nowMs)
      : 0;
  const models = {};
  for (const [key, discount] of Object.entries(BLACK_FRIDAY_PROMOTION.discounts)) {
    if (key === 'LingoFusion Pro Reasoning') continue;
    const base = TEXT_PRICE_POLICY[key];
    if (!base) continue;
    models[key] = {
      discountPercent: discount.discountPercent,
      inputDiscountPercent: discount.inputDiscountPercent,
      outputDiscountPercent: discount.outputDiscountPercent,
      inputOnly: Boolean(discount.inputOnly),
      originalInputUsd: base.ri / 1000,
      originalOutputUsd: base.ro / 1000,
      inputUsd: active ? discount.ri / 1000 : base.ri / 1000,
      outputUsd: active ? discount.ro / 1000 : base.ro / 1000,
    };
  }
  return {
    id: BLACK_FRIDAY_PROMOTION.id,
    name: BLACK_FRIDAY_PROMOTION.name,
    headline: BLACK_FRIDAY_PROMOTION.headline,
    startsAt: BLACK_FRIDAY_PROMOTION.startsAt,
    endsAt: BLACK_FRIDAY_PROMOTION.endsAt,
    startMs: BLACK_FRIDAY_PROMOTION.startMs,
    endMs: BLACK_FRIDAY_PROMOTION.endMs,
    durationHours: BLACK_FRIDAY_PROMOTION.durationHours,
    maxDiscountPercent: BLACK_FRIDAY_PROMOTION.maxDiscountPercent,
    eligibleModes: BLACK_FRIDAY_PROMOTION.eligibleModes,
    active,
    upcoming,
    expired,
    remainingMs,
    serverTimeMs: nowMs,
    serverTimeUtc: new Date(nowMs).toISOString(),
    models,
  };
}

export function textPricePolicy(model, reasoning = false) {
  const raw = String(model).trim().toLowerCase();
  let requested = raw;
  if (raw === 'lingofusion explain') requested = 'explainfusion';
  if (raw === 'lingofusion nano' || raw === 'lingofusion-nano') requested = 'lingofusion spark';
  if (raw === 'gpt-6-astra') requested = 'lingofusion ultra';
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
  const retailMultiplier = { default: 1, instant: 1, batch: 0.5, fast: 1.5, ultrafast: 6 }[mode];
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
  // Ask LingoFusion absorbs the built-in prompt and framing. Other models
  // bill the full provider input. Cache evidence only affects provider cost.
  const billedInputTokens = policy.conversationInputOnly ? userTokens : rawInputTokens;
  const tokenCost = BigInt(billedInputTokens) * BigInt(Math.ceil(policy.ri * retailMultiplier)) +
    BigInt(outputTokens) * BigInt(Math.ceil(policy.ro * retailMultiplier));
  // Existing prepaid balances settle to six decimal USD places. Only the
  // combined token total is rounded, once, upward to the next microdollar.
  const chargeMicros = Number((tokenCost + 999n) / 1000n);
  return { chargeMicros, cost_usd: chargeMicros / 1e6,
    pricing_version: TEXT_PRICING_VERSION,
    service_fee_usd: 0, token_cost_usd: Number(tokenCost) / 1e9,
    provider_cost_upper_bound_usd: Number(provider) / 1e9,
    gross_profit_lower_bound_usd: chargeMicros / 1e6 - Number(provider) / 1e9,
    billed_input_tokens: billedInputTokens,
    prompt_tokens: rawInputTokens, completion_tokens: outputTokens,
    customer_input_tokens: userTokens,
    instruction_and_overhead_tokens: rawInputTokens - userTokens,
    cached_tokens: cachedTokens, cache_write_tokens: cacheWriteTokens };
}
