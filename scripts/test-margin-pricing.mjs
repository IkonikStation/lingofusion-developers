import test from 'node:test';
import assert from 'node:assert/strict';
import { quotePromptService } from '../shared/marginPricing.mjs';

test('Nano minimum counterexample and percentage margin across every token mix', () => {
  // $/million translates to 1000 nanodollars per token.
  const fixed = 3162n * 50n;
  assert.ok(fixed + 250n * (50n + 400n) > 250000n);
  for (const inputTokens of [0, 1, 14, 250, 500, 1000, 130000]) {
    for (const outputTokens of [0, 1, 14, 250, 500, 1000, 130000]) {
      const q = quotePromptService({ inputTokens, outputTokens,
        retailInput: 150, retailOutput: 850, providerInput: 50,
        providerOutput: 400, overheadCost: fixed });
      assert.ok(q.providerCostNanodollars * q.maximumCostRatioDenominator <=
        q.chargeNanodollars * q.maximumCostRatioNumerator);
    }
  }
});
test('Ultra protects 50% gross margin without assuming cache hits', () => {
  const q = quotePromptService({ inputTokens: 100, outputTokens: 100,
    retailInput: 20000, retailOutput: 120000, providerInput: 10000,
    providerOutput: 50000, overheadCost: 3555n * 10000n });
  assert.equal(q.serviceNanodollars, 71100000n);
  assert.ok(q.chargeNanodollars >= q.providerCostNanodollars * 2n);
});
test('fails closed for loss-making modes and malformed evidence', () => {
  const args = { inputTokens: 1, outputTokens: 1, retailInput: 1750,
    retailOutput: 10000, providerInput: 2000, providerOutput: 10000, overheadCost: 1 };
  assert.throws(() => quotePromptService(args), /nonnegative verified/);
  assert.throws(() => quotePromptService({ ...args, inputTokens: NaN }), /Invalid/);
});
