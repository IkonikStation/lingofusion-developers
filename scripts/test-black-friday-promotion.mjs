import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLACK_FRIDAY_PROMOTION,
  TEXT_PRICE_POLICY,
  getModelPromotion,
  getPromotionState,
  isPromotionActive,
  resolveEffectivePolicy,
  textPricePolicy,
  priceTextUsage,
} from '../shared/textPricing.mjs';
import { prepareTextRequest, verifyAndPrice } from '../shared/textRequest.mjs';

const START_MS = Date.parse('2026-11-25T05:00:00Z');
const END_MS = Date.parse('2026-12-01T05:00:00Z');
const DURING_MS = Date.parse('2026-11-27T12:00:00Z');

test('promotion schedule is exactly 144 hours in UTC and flips cleanly at boundaries', () => {
  assert.equal(BLACK_FRIDAY_PROMOTION.startsAt, '2026-11-25T05:00:00Z');
  assert.equal(BLACK_FRIDAY_PROMOTION.endsAt, '2026-12-01T05:00:00Z');
  assert.equal(END_MS - START_MS, 144 * 60 * 60 * 1000);

  // 1ms before start -> upcoming, not active
  const before = getPromotionState(START_MS - 1);
  assert.equal(before.active, false);
  assert.equal(before.upcoming, true);
  assert.equal(before.expired, false);
  assert.equal(before.remainingMs, 1);

  // Exact start -> active
  const atStart = getPromotionState(START_MS);
  assert.equal(atStart.active, true);
  assert.equal(atStart.upcoming, false);
  assert.equal(atStart.expired, false);
  assert.equal(atStart.remainingMs, 144 * 60 * 60 * 1000);

  // 1ms before end -> still active
  assert.equal(isPromotionActive(END_MS - 1), true);

  // Exact end (countdown hits zero) -> expired, original prices automatically restored
  const atEnd = getPromotionState(END_MS);
  assert.equal(atEnd.active, false);
  assert.equal(atEnd.upcoming, false);
  assert.equal(atEnd.expired, true);
  assert.equal(atEnd.remainingMs, 0);
  assert.equal(atEnd.models.LingoFusion.inputUsd, 1.0);
  assert.equal(atEnd.models.LingoFusion.outputUsd, 5.0);
});

test('all 6 models have exact promotional rates and never sell below provider cost', () => {
  const expected = {
    'LingoFusion Spark': { discountPercent: 20, inputUsd: 0.04, outputUsd: 0.20, origIn: 0.05, origOut: 0.25 },
    'LingoFusion Lite': { discountPercent: 10, inputUsd: 0.45, outputUsd: 1.80, origIn: 0.50, origOut: 2.00 },
    LingoFusion: { discountPercent: 50, inputUsd: 0.50, outputUsd: 2.50, origIn: 1.00, origOut: 5.00 },
    'LingoFusion Pro': { discountPercent: 20, inputUsd: 2.80, outputUsd: 16.00, origIn: 3.50, origOut: 20.00 },
    'LingoFusion Ultra': { discountPercent: 25, inputUsd: 15.00, outputUsd: 90.00, origIn: 20.00, origOut: 120.00 },
    ExplainFusion: { discountPercent: 10, inputUsd: 1.80, outputUsd: 0.50, origIn: 2.00, origOut: 0.50 },
  };

  for (const [model, spec] of Object.entries(expected)) {
    const base = TEXT_PRICE_POLICY[model];
    const promo = getModelPromotion(model, { nowMs: DURING_MS, mode: 'default', longContext: false });
    assert.ok(promo, `Expected active promotion for ${model}`);
    assert.equal(promo.discountPercent, spec.discountPercent, model);
    assert.equal(promo.inputUsd, spec.inputUsd, `${model} inputUsd`);
    assert.equal(promo.outputUsd, spec.outputUsd, `${model} outputUsd`);
    assert.equal(promo.originalInputUsd, spec.origIn, `${model} origIn`);
    assert.equal(promo.originalOutputUsd, spec.origOut, `${model} origOut`);

    // Provider cost floor verification (including cold cache write cost on input)
    assert.ok(promo.ri >= Math.max(base.wi, base.write), `${model} input rate must cover cold write cost`);
    assert.ok(promo.ro >= base.wo, `${model} output rate must cover provider output cost`);

    // Exact 1M input + 1M output billing check
    const effective = resolveEffectivePolicy(textPricePolicy(model), { nowMs: DURING_MS, mode: 'default', longContext: false });
    const usage = priceTextUsage({
      policy: effective,
      userTokens: 1_000_000,
      outputTokens: 1_000_000,
      rawInputTokens: 1_000_000,
      cachedTokens: 0,
      cacheWriteTokens: 1_000_000,
      mode: 'default',
      longContext: false,
    });
    assert.equal(usage.cost_usd, Number((spec.inputUsd + spec.outputUsd).toFixed(6)), `${model} 1M+1M billing`);
    assert.ok(usage.gross_profit_lower_bound_usd >= 0, `${model} must never lose money on worst-case cold prompt`);
  }

  // Verify ExplainFusion specifically protects $0.50/1M output cost (input-only discount)
  const explainPromo = getModelPromotion('ExplainFusion', { nowMs: DURING_MS });
  assert.equal(explainPromo.inputOnly, true);
  assert.equal(explainPromo.inputDiscountPercent, 10);
  assert.equal(explainPromo.outputDiscountPercent, 0);
  assert.equal(explainPromo.ro, TEXT_PRICE_POLICY.ExplainFusion.wo);

  // Verify Ask LingoFusion is not discounted and base TEXT_PRICE_POLICY is preserved untouched
  assert.equal(getModelPromotion('Ask LingoFusion', { nowMs: DURING_MS }), null);
  assert.equal(TEXT_PRICE_POLICY.LingoFusion.ri, 1000);
  assert.equal(TEXT_PRICE_POLICY.LingoFusion.ro, 5000);
});

test('prevents discount stacking and excludes unprofitable modes and long context', () => {
  // Batch, fast, ultrafast never receive Black Friday discount
  for (const mode of ['batch', 'fast', 'ultrafast']) {
    for (const model of ['LingoFusion', 'LingoFusion Pro', 'LingoFusion Ultra', 'LingoFusion Lite']) {
      assert.equal(getModelPromotion(model, { nowMs: DURING_MS, mode, longContext: false }), null, `${model} ${mode}`);
    }
  }

  // Long context (>272k) never receives Black Friday discount
  assert.equal(getModelPromotion('LingoFusion Ultra', { nowMs: DURING_MS, mode: 'default', longContext: true }), null);
  assert.equal(getModelPromotion('LingoFusion Pro', { nowMs: DURING_MS, mode: 'default', longContext: true }), null);

  // Calling resolveEffectivePolicy twice never stacks discounts
  const once = resolveEffectivePolicy(textPricePolicy('LingoFusion'), { nowMs: DURING_MS, mode: 'default' });
  const twice = resolveEffectivePolicy(once, { nowMs: DURING_MS, mode: 'default' });
  assert.equal(once.ri, 500);
  assert.equal(twice.ri, 500);
  assert.equal(once.ro, 2500);
  assert.equal(twice.ro, 2500);

  // Pro Fast during the sale keeps base 1.5x retail ($5.25/$30) instead of unprofitable discounted Fast
  const proFast = prepareTextRequest({ model: 'LingoFusion Pro', pricing_mode: 'fast', messages: [{ role: 'user', content: 'Hello' }] }, DURING_MS);
  assert.equal(proFast.promotion, null);
  assert.equal(proFast.policy.ri, 3500);
  assert.equal(proFast.policy.ro, 20000);
});

test('locks promotional pricing at request acceptance even if settlement occurs after expiration', () => {
  // Accepted 500ms before promotion ends
  const acceptedBeforeEnd = prepareTextRequest(
    { model: 'LingoFusion', messages: [{ role: 'user', content: 'Hello world' }], max_completion_tokens: 100 },
    END_MS - 500,
  );
  assert.ok(acceptedBeforeEnd.promotion);
  assert.equal(acceptedBeforeEnd.policy.ri, 500);
  assert.equal(acceptedBeforeEnd.policy.ro, 2500);

  const evidence = {
    id: 'bf-boundary-1',
    model: 'gpt-6-luna',
    service_tier: 'default',
    usage: { prompt_tokens: 3200, completion_tokens: 100 },
  };
  const settledDuring = verifyAndPrice(acceptedBeforeEnd, evidence);
  // 3200 * 500n + 100 * 2500n = 1,600,000n + 250,000n = 1,850,000 nanodollars = $0.001850
  assert.equal(settledDuring.cost_usd, 0.00185);
  assert.ok(settledDuring.promotion);

  // Accepted at exact expiration timestamp -> automatically restored to original price ($1.00 / $5.00)
  const acceptedAtEnd = prepareTextRequest(
    { model: 'LingoFusion', messages: [{ role: 'user', content: 'Hello world' }], max_completion_tokens: 100 },
    END_MS,
  );
  assert.equal(acceptedAtEnd.promotion, null);
  assert.equal(acceptedAtEnd.policy.ri, 1000);
  assert.equal(acceptedAtEnd.policy.ro, 5000);

  const settledAfter = verifyAndPrice(acceptedAtEnd, { ...evidence, id: 'bf-boundary-2' });
  // 3200 * 1000n + 100 * 5000n = 3,700,000 nanodollars = $0.003700
  assert.equal(settledAfter.cost_usd, 0.0037);
  assert.equal(settledAfter.promotion, null);
});
