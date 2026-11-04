import { SEARCH_FEES, SEARCH_CONTEXT_BOUND, LOOKUP_POLICY } from './webTranslation.mjs';
import { buildPromptMessages } from './promptMessages.mjs';
import { TEXT_PRICING_VERSION, textPricePolicy, priceTextUsage } from './textPricing.mjs';

// UTF-8 bytes bound byte-level token counts without constructing a tokenizer.
const bytes = new TextEncoder();
const byteBound = text => bytes.encode(text).length;

export function prepareTextRequest(body, count = byteBound, exact = false) {
  const reasoning = Boolean(body.reasoning || body.reasoning_enabled || ['medium', 'high', 'max', 'xhigh'].includes(body.reasoning_effort));
  const mode = String(body.pricing_mode || 'default');
  const policy = textPricePolicy(body.model || 'LingoFusion', reasoning || mode === 'ultrafast');
  if (!['default', 'instant', 'batch', 'fast', 'ultrafast'].includes(mode)) throw new Error('Unsupported pricing mode');
  if (mode === 'batch') throw new Error('Batch pricing requires asynchronous Batch processing; it is unavailable on this synchronous route');
  if (mode === 'ultrafast' && !['LingoFusion Pro', 'LingoFusion Ultra'].includes(policy.model)) throw new Error('Ultrafast is only available for Pro and Ultra');
  if (body.tools || body.tool_choice) throw new Error('Client-defined tools are unavailable');
  const webSearch = Boolean(body.allow_web_search || body.web_search);
  if (webSearch && (!SEARCH_FEES[policy.model] || mode !== 'default')) throw new Error('Optional terminology lookup is available on LingoFusion, Pro and Ultra at Standard speed');
  if (body.n !== undefined && body.n !== 1) throw new Error('One completion per request is supported');
  const messages = (Array.isArray(body.messages) ? body.messages : []).filter(m => !['system', 'developer'].includes(m?.role));
  if (!messages.length || messages.some(m => !['user', 'assistant'].includes(m?.role) || typeof m.content !== 'string')) throw new Error('Text user/assistant messages are required');
  if (messages.reduce((n, m) => n + m.content.length, 0) > 1000000) throw new Error('Text request too large');
  const settings = { modelName: policy.model,
    fromLanguage: String(body.from_language || body.fromLanguage || body.source_lang || body.source_language || 'English'),
    toLanguage: String(body.to_language || body.toLanguage || body.target_lang || body.target_language || 'Spanish'),
    tone: String(body.tone || 'Natural (Default)') };
  if ([settings.fromLanguage, settings.toLanguage, settings.tone].some(x => x.length > 100 || /[\r\n]/.test(x))) throw new Error('Invalid language or tone');
  const prompt = buildPromptMessages(settings, policy.upstream !== 'gpt-5-nano');
  const system = prompt.text + (webSearch ? "\n\n" + LOOKUP_POLICY : "");
  if (webSearch) prompt.messages.push({role: "system", content: LOOKUP_POLICY});
  const userTokenUpperBound = messages.reduce((n, m) => n + count(m.content), 0);
  const userTokens = exact ? userTokenUpperBound : 0;
  const systemTokens = count(system);
  // Bound framing/hidden provider overhead, and verify the reported count later.
  const rawMaximum = userTokenUpperBound + systemTokens + messages.length * 8 + 256 + (webSearch ? SEARCH_CONTEXT_BOUND : 0);
  const maxOutput = body.max_completion_tokens ?? body.max_tokens ?? 512;
  if (!Number.isSafeInteger(maxOutput) || maxOutput < 1 || maxOutput > 128000) throw new Error('max_completion_tokens must be between 1 and 128000');
  const longContext = policy.upstream !== 'gpt-5-nano' && rawMaximum > 272000;
  const maximum = priceTextUsage({ policy, userTokens, outputTokens: maxOutput, rawInputTokens: rawMaximum, mode, longContext });
  if (webSearch) { maximum.chargeMicros += SEARCH_FEES[policy.model]; maximum.cost_usd = maximum.chargeMicros / 1e6; }
  // Do not silently add a fee or change a published price to cover a mode
  // whose input/output rates cannot cover the conservative provider rates.
  const retailMultiplier = mode === 'fast' ? 1.5 : mode === 'ultrafast' ? 4 : 1;
  const providerMultiplier = mode === 'fast' ? 2 : mode === 'ultrafast' ? 6 : 1;
  if (Math.ceil(policy.ri * retailMultiplier) < Math.max(policy.wi, policy.write) * providerMultiplier * (longContext ? 2 : 1) ||
      Math.ceil(policy.ro * retailMultiplier) < policy.wo * providerMultiplier * (longContext ? 1.5 : 1)) {
    throw new Error('This processing mode or context length is unavailable at the published token rates');
  }
  if (body.max_cost_usd !== undefined && (!Number.isFinite(body.max_cost_usd) || body.max_cost_usd < maximum.cost_usd)) throw new Error('The full price exceeds your approved spending cap. Refresh the quote.');
  const payload = { model: policy.upstream, messages: [...prompt.messages, ...messages],
    ...(prompt.cacheOptions ? { prompt_cache_options: prompt.cacheOptions } : {}),
    stream: Boolean(body.stream), max_completion_tokens: maxOutput,
    ...(body.stream ? { stream_options: { include_usage: true } } : {}),
    service_tier: mode === 'fast' || mode === 'ultrafast' ? mode : 'default',
    ...(policy.model === 'LingoFusion Ultra' ? { reasoning_effort: body.max || body.max_reasoning || body.reasoning_effort === 'max' ? 'max' : 'high' } :
      policy.key === 'LingoFusion Pro Reasoning' ? { reasoning_effort: 'medium' } :
      { reasoning_effort: policy.model === 'LingoFusion Nano' ? 'minimal' : 'none' }) };
  if (body.temperature !== undefined && ['LingoFusion', 'LingoFusion Lite'].includes(policy.model)) {
    if (!Number.isFinite(body.temperature) || body.temperature < 0 || body.temperature > 2) throw new Error('Temperature must be between 0 and 2');
    payload.temperature = body.temperature;
  }
  return { webSearch, searchFeeMicros: webSearch ? SEARCH_FEES[policy.model] : 0, exactInputCount: exact, userTokenUpperBound, policy, mode, pricingVersion: TEXT_PRICING_VERSION, userTokens, systemTokens, system, rawMaximum, maxOutput, longContext, maximum, payload, settings };
}

export function verifyAndPrice(prepared, data) {
  const { policy, mode, userTokens, rawMaximum, maxOutput, longContext } = prepared;
  const usage = data?.usage;
  if (!data?.id || typeof data.id !== 'string' || typeof data.model !== 'string' ||
      !(data.model === policy.upstream || data.model.startsWith(`${policy.upstream}-`)) || !usage) throw new Error('Missing provider provenance');
  if (!Number.isSafeInteger(usage.prompt_tokens) || usage.prompt_tokens < userTokens || usage.prompt_tokens > rawMaximum ||
      !Number.isSafeInteger(usage.completion_tokens) || usage.completion_tokens < 0 || usage.completion_tokens > maxOutput) throw new Error('Provider usage outside reservation');
  const actualTier = data.service_tier;
  const actualMode = actualTier === 'default' || actualTier === 'flex' ? 'default' : actualTier === 'priority' || actualTier === 'fast' ? 'fast' : actualTier === 'ultrafast' ? 'ultrafast' : actualTier == null && !['fast', 'ultrafast'].includes(mode) ? mode : null;
  if (!actualMode || ({ default: 1, instant: 1, batch: 1, fast: 2, ultrafast: 6 }[actualMode] > { default: 1, instant: 1, batch: 1, fast: 2, ultrafast: 6 }[mode])) throw new Error('Unverified provider service tier');
  if ((usage.prompt_tokens_details?.cache_write_tokens_12h ?? 0) > 0) throw new Error('Unexpected 12-hour cache write');
  const price = priceTextUsage({ policy, mode: actualTier === 'default' && mode === 'batch' ? mode : actualMode, userTokens, outputTokens: usage.completion_tokens,
    rawInputTokens: usage.prompt_tokens, cachedTokens: usage.prompt_tokens_details?.cached_tokens ?? 0,
    cacheWriteTokens: usage.prompt_tokens_details?.cache_write_tokens ?? 0,
    longContext: policy.upstream !== 'gpt-5-nano' && usage.prompt_tokens > 272000 });
  if (prepared.webSearch) {
    if (data.web_search_call_count !== 0 && data.web_search_call_count !== 1) throw new Error('Search call limit exceeded');
    if (!Number.isInteger(data.web_search_calls) || data.web_search_calls < 0 || data.web_search_calls > 1) throw new Error('Unverified search usage');
    const fee = data.web_search_calls * prepared.searchFeeMicros;
    price.chargeMicros += fee; price.cost_usd = price.chargeMicros / 1e6; price.web_search_cost_usd = fee / 1e6;
    price.provider_cost_upper_bound_usd += data.web_search_calls * 0.01;
    price.gross_profit_lower_bound_usd = price.cost_usd - price.provider_cost_upper_bound_usd;
  }
  return price;
}
