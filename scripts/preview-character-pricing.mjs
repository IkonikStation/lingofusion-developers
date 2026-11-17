// Local review tool only. This rate card is not imported by the application.
// Run: node scripts/preview-character-pricing.mjs
import { writeFileSync } from 'node:fs';
import { Tiktoken } from 'js-tiktoken/lite';
import ranks from 'js-tiktoken/ranks/o200k_base';
import { TEXT_PRICE_POLICY } from '../shared/textPricing.mjs';
import { buildPromptMessages } from '../shared/promptMessages.mjs';

const proposedUsdPerMillion = {
  'LingoFusion Nano': 0.35,
  'LingoFusion Lite': 0.85,
  LingoFusion: 2,
  'LingoFusion Pro': 8,
  'LingoFusion Pro Reasoning': 8,
  'LingoFusion Ultra': 47,
  ExplainFusion: 0.85,
};
const encoder = new Tiktoken(ranks);
const ceilDivide = (n, d) => (n + d - 1n) / d;
const money = value => `$${value.toFixed(2)}`;
const rows = Object.entries(proposedUsdPerMillion).map(([model, retail]) => {
  const policy = TEXT_PRICE_POLICY[model];
  const prompt = buildPromptMessages({
    modelName: model === 'LingoFusion Pro Reasoning' ? 'LingoFusion Pro' : model,
    fromLanguage: 'English', toLanguage: 'Spanish', tone: 'Natural (Default)',
  }, policy.upstream !== 'gpt-5-nano');
  const systemTokens = encoder.encode(prompt.text, [], []).length;
  // Integer nanodollars: multiply per-character contribution by four to
  // represent the assumed four source characters per customer input token.
  const contributionTimesFour = BigInt(Math.round(retail * 1000)) * 4n
    - BigInt(policy.wi + policy.wo);
  if (contributionTimesFour <= 0n) throw new Error(`No finite break-even: ${model}`);
  const threshold = rate => {
    const overheadTimesFour = BigInt(systemTokens) * BigInt(rate) * 4n;
    const characters = ceilDivide(overheadTimesFour, contributionTimesFour);
    // Check that this is the first whole-character length covering the cost.
    if (characters * contributionTimesFour < overheadTimesFour ||
        (characters - 1n) * contributionTimesFour >= overheadTimesFour) {
      throw new Error(`Incorrect threshold: ${model}`);
    }
    return Number(characters);
  };
  return { model, retail, systemTokens, ordinary: threshold(policy.wi),
    cached: threshold(policy.cached), write: threshold(policy.write) };
});

const table = rows.map(r => `| ${r.model} | ${money(r.retail)} | $${(r.retail / 1000).toFixed(5)} |`).join('\n');
const exposure = rows.map(r => `| ${r.model} | ${r.systemTokens.toLocaleString('en-US')} | ${r.ordinary} | ${r.cached} | ${r.write} |`).join('\n');
const doc = `# Character pricing — superseded review draft

Status: superseded by the November 4 owner instruction to keep existing token prices and bill the full system prompt. See [current token billing](token-billing.md). These character rates and minimums must not be applied.

Prepared November 4, 2026. These are proposed prices, not owner-selected or deployed rates. No application pricing, customer balance, payment, or production configuration is changed by this file or its generator.

## Proposed customer rate card

Charge per **1,000,000 customer source characters**, with translation output included. Absorb built-in system instructions in the displayed total. The owner's latest requirement is **zero money loss**; consequently the earlier no-minimum proposal is superseded. The character rates below are only the variable component of a proposed minimum-plus-character policy. Model minimums and a verified provider-cost admission check are required before implementation can meet even the narrower no-provider-loss objective. No minimum amount has yet been established or applied.

| Model | USD / 1M source characters | Variable component for 1,000 source characters, before any minimum |
|---|---:|---:|
${table}

These rates start from the earlier token-equivalent scenarios, apply the 4/3 increase discussed when considering a 750K-character denominator, and round upward to simple prices. This is a review starting point, not a claim that the rates guarantee a positive margin on every request. ExplainFusion and Pro Reasoning require separate output-ratio analysis despite their shared headline prices with other rows.

Suggested public copy:

> Text translation is priced per million source characters, with a minimum charge per request. Output is included within the displayed output limit. Your full price is shown before translation, including any minimum.

## What can be absorbed at these rates

The table below shows estimated **provider-token-cost break-even lengths**, not minimum billable lengths. It uses the current local prompt builders with English → Spanish and Natural (Default), four source characters per customer input token, and one billable output token per customer input token. It excludes message framing, reference context, prior conversation, retries, tools, payment fees, hosting, and taxes. Output includes billable reasoning, which can materially increase costs. Cached-read and 30-minute-write columns assume the full internal prompt receives that treatment; this is not a cache-hit guarantee. Actual prompts vary with settings and release versions.

| Model | Local prompt tokens | Ordinary prompt: source chars | Full cache read: source chars | 30m write: source chars |
|---|---:|---:|---:|---:|
${exposure}

All thresholds round upward to a whole character. The generator checks that the preceding whole-character count fails to cover the modeled provider cost. Normal provider prices come from the existing local policy; the November 3 audit explains its invoice reconciliation and scope. Regular Luna and Ultra Astra standard prices were checked again against official provider documentation November 4. Complimentary-token enrollment is deliberately excluded from these thresholds.

The risk remains explicit: a positive fixed prompt cost plus no minimum means sufficiently small requests can lose money. A single source-character rate also cannot cover unrestricted output expansion. These character rates alone therefore fail the owner's latest zero-loss requirement and must not be deployed as a zero-loss policy.

## Latest constraint: zero money loss

For each accepted request, use a disclosed quote: **max(model minimum, source-character charge)**. A minimum replaces the smaller character charge; it is not a hidden fee added to it. The minimum and output limit must be visible before submission. Minimum amounts remain unselected until worst-case budgets are established.

Before any provider dispatch, independently establish a conservative provider-cost upper bound that includes the full current internal prompt, all customer/reference/history input, framing and other provider overhead, the enforced maximum billable output including reasoning, cache-write premiums, processing tier and context premiums, and any enabled tools. Do not assume a cache hit, complimentary tokens, an average language token ratio, or an average output length. Reject unsupported or unbounded costs before dispatch. A local tokenizer estimate and an arbitrary framing allowance alone do not prove a hard provider billing bound.

Accept only when the quoted customer charge covers that independently verified bound plus the selected attributable non-provider costs and margin. If it does not, reduce the output limit only when the remaining budget can support a useful complete translation, offer an explicitly priced alternative, or decline the request without calling the provider. Never silently truncate a translation to claim a profitable successful result. A universal request-length minimum alone does not solve token-dense input or output expansion.

Reserve credit atomically before dispatch; enforce balance and concurrency limits; bind quote, model, input, output cap and price version to idempotency. Settle once from verified evidence. Do not automatically retry provider work or refund an ambiguous already-dispatched request; reconcile it without a second provider call. Failure and cancellation policies must disclose any retained charge and budget already-spent provider costs. These rules remain requirements, not verified implementation in this draft.

This can target **nonnegative contribution against bounded attributable request costs**. Absolute zero business loss is not something this draft can guarantee: provider-price changes, incorrect cost bounds, infrastructure expenses, payment fees, refunds, chargebacks and operational failures must also be funded and controlled. Until those scopes and controls are verified, no public or owner-facing promise of zero loss is justified.

## Character counting contract for implementation

- Count Unicode code points in the submitted source string, including spaces and line breaks. Do not use UTF-16 string length, byte count, token estimates, or normalization that changes the submitted text. Combining marks count separately, so this is not a grapheme-cluster count.
- Exclude built-in instructions and generated output from the customer character count. Explicitly define treatment of customer reference/context and conversation history before exposing a general chat endpoint under this translation tariff.
- Compute one charge from the authoritative server count and a versioned rate card. Preserve sub-microdollar remainders or disclose rounding; do not create an undeclared per-request floor by always rounding each tiny charge upward.
- The quote, reservation, settlement, usage receipt, export, and calculator must use the same character count, disclosed minimum, output cap and price version. Provider token/cache usage remains private cost evidence and must never be relabeled as customer characters.
- Reserve customer credit before provider dispatch. Retain owner-bound idempotency and verified recovery; an ambiguous provider outcome must not cause a second provider dispatch or a duplicate charge.

## Current implementation findings

The current local code still contains the superseded service-fee draft. Changing only a pricing label would leave inconsistent actual charges. These surfaces must migrate together after selecting the final prices:

| Surface | Required change |
|---|---|
| shared/textPricing.mjs and shared/textRequest.mjs | Versioned character rate and disclosed minimum; authoritative source count; full customer quote; independently verified provider-cost bound and admission check. Keep provider cost accounting separate. |
| cloudflare-worker/meteredText.mjs and cloudflare-worker/billing.mjs | Reserve and settle the character quote; retain billing evidence and character usage metadata. |
| nodeTextMetered.mjs and server.mjs | Apply the same policy to Node chat/translation aliases and durable receipts. |
| src/data/pricing.ts and src/components/PricingCard.tsx | One source-character price column; output included; remove service-fee copy. |
| src/pages/PricingPage.tsx | One source-character calculator; remove the output-token price input and token-unit labels. |
| src/pages/PlaygroundPage.tsx and src/data/browserApi.ts | Show character count and exact quote; consume server receipts; remove service-fee breakdowns and token-price model hints. |
| src/pages/DocsPage.tsx, locale catalog, model pages, exports and API metadata | Match the counting contract, pricing unit and version; retain tokens only as explicitly labeled technical usage. |

Fast, Ultrafast, Batch, long-context, arbitrary chat and tool traffic need separate treatment. Existing token-mode multipliers must not automatically be copied to a character tariff; synchronous processing must not advertise an unearned Batch discount. This proposal is Standard text translation only. Image, audio, dubbing, music, PDF and local-model pricing remain outside this change.

Historical source-character counts matched to settled customer charges are still unavailable. Therefore neither realized profitability nor sustainable aggregate profitability is certified. The saved audit and sensitivity analysis describe the missing evidence. Production remains unchanged, consistent with the owner's earlier instruction to keep changes local for review.

## Reproduce and sources

Run \`node scripts/preview-character-pricing.mjs\` to regenerate this document using current local prompt builders and provider policy. This performs no network/provider requests.

- [OpenAI pricing](https://developers.openai.com/api/docs/pricing)
- [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna)
- [GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra)
- Local policy: shared/textPricing.mjs; prompt assembly: shared/promptMessages.mjs.
`;
writeFileSync(new URL('../docs/character-pricing-proposal.md', import.meta.url), doc);
console.table(rows);
console.log('Wrote docs/character-pricing-proposal.md. No application rate changed.');
