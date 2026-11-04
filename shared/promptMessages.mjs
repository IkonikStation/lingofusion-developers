import { buildModelSystemPrompt } from './systemPrompts.mjs';

// GPT-5.6+ supports exact cache breakpoints. Keep application instructions
// before the breakpoint and every per-request setting after it. No customer
// source content is included in the reusable prefix or a cache prewarm call.
export function buildPromptMessages(settings, explicit = true) {
  let text = buildModelSystemPrompt(settings);
  if (!explicit) return { text, messages: [{ role: 'system', content: text }] };
  if (['ExplainFusion', 'LingoFusion Explain'].includes(settings.modelName)) {
    text = buildModelSystemPrompt({ ...settings, toLanguage: 'the selected target language' }) +
      `\n\nSELECTED LANGUAGES\nExplain in ${settings.toLanguage || 'the selected target language'}.`;
  }
  const boundary = text.lastIndexOf('\n\nSELECTED LANGUAGES\n');
  if (boundary < 0) throw new Error('Reusable prompt boundary missing');
  return { text, cacheOptions: { mode: 'explicit', ttl: '30m' }, messages: [
    { role: 'system', content: [{ type: 'text', text: text.slice(0, boundary),
      prompt_cache_breakpoint: { mode: 'explicit' } }] },
    { role: 'system', content: text.slice(boundary) },
  ] };
}
