// Integer nanodollars throughout. Provider usage and rates must be verified by
// the server; never accept a provider cost or a settlement amount from clients.
export const MARGIN_PRICING_VERSION = 'prompt-service-v1';

function amount(value, name) {
  if (typeof value === 'bigint' && value >= 0n) return value;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid ${name}`);
  return BigInt(value);
}
function ceilDiv(n, d) { return (n + d - 1n) / d; }

// A minimum alone cannot preserve the original percentage margin at every
// input/output mix. An included service allowance plus ordinary token charges
// does: fixed provider overhead is marked up by the weakest variable margin.
export function quotePromptService({ inputTokens, outputTokens, retailInput, retailOutput,
  providerInput, providerOutput, overheadCost, actualProviderCost }) {
  const i = amount(inputTokens, 'input tokens');
  const o = amount(outputTokens, 'output tokens');
  const ri = amount(retailInput, 'retail input rate');
  const ro = amount(retailOutput, 'retail output rate');
  const wi = amount(providerInput, 'provider input rate');
  const wo = amount(providerOutput, 'provider output rate');
  const fixed = amount(overheadCost, 'overhead cost');
  if (!ri || !ro || !wi || !wo || wi > ri || wo > ro) {
    throw new Error('Pricing requires nonnegative verified variable margins');
  }
  // q is the largest provider/retail ratio (the weakest gross margin).
  const [qn, qd] = wi * ro >= wo * ri ? [wi, ri] : [wo, ro];
  const tokens = i * ri + o * ro;
  const provider = actualProviderCost === undefined ? fixed + i * wi + o * wo : amount(actualProviderCost, 'actual provider cost');
  const baseService = ceilDiv(fixed * qd, qn);
  // Provider modes, long context and cache-write premiums may require more
  // than the base fee. A server quote must disclose that amount before dispatch.
  const required = ceilDiv(provider * qd, qn);
  const service = required > tokens + baseService ? required - tokens : baseService;
  const charge = service + tokens;
  return { version: MARGIN_PRICING_VERSION, serviceNanodollars: service,
    tokenNanodollars: tokens, chargeNanodollars: charge,
    providerCostNanodollars: provider, grossProfitNanodollars: charge - provider,
    maximumCostRatioNumerator: qn, maximumCostRatioDenominator: qd };
}
