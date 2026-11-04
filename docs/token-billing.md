# Full-input token billing

Owner decision, November 4, 2026: keep current token prices and charge for the
system prompt. This supersedes the prompt-service-fee and character-pricing drafts.
Status: implementation validated locally; owner authorized production rollout on
November 4. Consult the GitHub Pages workflow and Cloudflare deployment history
for the current rollout status. No paid provider calls or real customer
balance/payment changes were made during validation.

## Customer prices

USD per 1 million tokens, Standard processing:

| Model | Full input | Output |
|---|---:|---:|
| Nano | $0.15 | $0.85 |
| Lite | $0.50 | $2.00 |
| LingoFusion | $1.00 | $5.00 |
| Pro / Pro Reasoning | $3.50 | $20.00 |
| Ultra | $20.00 | $120.00 |
| ExplainFusion | $2.00 | $0.50 |

The input count is the complete provider-reported input, including built-in
instructions, customer text and request overhead. Output includes billable
reasoning. Cached input is charged at the same published retail input price;
provider cache savings are a cost optimization, not a promised customer discount.
There is no additional service fee, character charge or starting minimum.
Compatibility receipt fields `service_fee_usd` and `maximum_service_fee_usd`
remain present as zero, so existing integrations do not need to interpret a
missing field as an unknown fee. The combined token charge rounds upward once
to six decimal USD places, matching existing prepaid balance precision.

For example: Nano with 3,200 full input tokens and 2 output tokens costs
$0.0004817 before rounding, or $0.000482 settled. Ultra with 3,555 full input
tokens and no output costs $0.071100. These are examples; actual charges use
provider usage, not a hardcoded prompt token count.

## Quote and settlement

The authenticated quote contains a conservative full-input bound, separate
customer-input and instruction estimates, output limit, maximum charge and
`pricing_version: full-input-tokens-v1`. The local tokenizer and framing bound
are estimates, not invoice evidence. Actual provider input/output must fit the
reservation; otherwise the request requires reconciliation and is not blindly
re-priced or dispatched again. This does not prove a provider can never report
unexpected usage above the bound.

Node and Worker routes reserve credit before dispatch and settle once from
provider usage. Usage receipts, ledgers and request logs record full input,
not just customer text. Provider cache and provenance evidence remain available
for private cost analysis. The pricing version is bound into request fingerprints
so an old-policy reservation cannot silently settle under a new tariff. Old
receipts remain recoverable through existing authenticated status/replay paths;
no historical charges are rewritten.

The browser accepts authoritative settled counts and balances. It does not
replace the full input count with a customer-text estimate or deduct again.
Pricing tables, the calculator, model pages, docs and Playground explicitly
state that input includes built-in instructions. Playground shows the maximum
price before submission and the final cost after settlement. Input/output token
counts remain available in API receipts and usage records. The editor boxes
do not show live character or token counters; a footer button opens a
blurred-background explanation of extra billed input, with a Got it button.

## Processing limits and profitability scope

Existing supported-mode retail multipliers remain unchanged. Standard is 1x,
Fast 1.5x and Ultrafast 4x. The adapter independently checks provider input,
cache-write and output premiums against those retail rates before dispatch.
A mode/context combination that cannot cover those conservative component
rates is rejected rather than silently adding a fee or raising the unit price.

In particular, synchronous Batch is rejected because this route does not earn
an asynchronous Batch discount. Pro Ultrafast is rejected because its possible
cache-write input cost exceeds the preserved retail input rate. Some long-context
combinations are also rejected. Ultra Ultrafast remains supported within the
verified short-context route. Unpriced tools remain rejected.

For admitted requests within verified cost and usage bounds, all currently
configured Standard text rates cover the conservative provider component rates.
That is not an absolute zero-business-loss guarantee: provider changes,
unexpected usage, refunds, chargebacks, taxes and infrastructure are outside
that narrow margin check. No arbitrary average cache-hit assumption or
complimentary-token allowance is required for the component comparison.

Image, speech, dubbing, music, PDF and local-model pricing are unchanged.
The separately documented character-based subscription quotas are not API
per-character billing and are outside this change.

## Local validation

- Shared pricing, gateway quote/JSON/SSE settlement, cancellations, owner-bound
  reservations, uncertain outcomes and Node ledger tests use synthetic usage.
- Node route integration intercepts every external provider fetch and uses an
  isolated temporary SQLite database. It exercises Chat and Responses, JSON
  and SSE, translation, zero-balance replay and unfunded rejection.
- Existing platform and billing/gift regressions use isolated or mocked data.
- TypeScript/Vite build and local rendered pricing/Playground checks are used
  to verify customer-facing disclosure and authoritative token counts.

Verified November 4 locally: 23 text-pricing/ledger/helper tests passed; Node
provider-route integration passed with all provider calls intercepted; the
platform suite and 16 billing tests plus gift and Node payment regressions
passed; localization checks passed; TypeScript/Vite build and Worker deployment
dry-run passed. Localization checks cover the catalog and existing integration;
they do not certify translations of newly added English billing copy.

Rendered synthetic Playground verification showed 3,331 full input tokens and
2 output tokens, charged $0.003341 at regular rates, with the input-includes-
instructions notice visible. The local fixture recorded two synthetic provider
calls for two deliberate tests and zero client balance-delta requests. Pricing
rendered the unchanged Nano $0.15/$0.85, Pro $3.50/$20 and Ultra $20/$120 rates
alongside the full-input disclosure. No real provider or payment call was made.

The owner explicitly authorized publishing this policy to the site on November 4,
superseding the earlier instruction to keep the draft local. This authorizes
the coordinated site/gateway rollout, not paid provider testing, payment changes,
or rewriting historical customer balances.
