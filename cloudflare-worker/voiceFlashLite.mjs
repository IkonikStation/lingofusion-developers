import { billing } from "./billing.mjs";
import {
  FlashLiteError, prepareFlashLiteSpeech, flashLiteProvider, synthesizeFlashLite,
  FLASH_LITE_RATE_LIMIT, flashLiteAudioHeaders, flashLiteAudioDataUrl,
} from "../shared/voiceFlashLite.mjs";

export async function voiceFlashLite(request, body, user, env, respond, cors) {
  const error = (code, message, status) => respond({ error: { code, message } }, status);
  try {
    const playground = new URL(request.url).pathname === "/api/playground/speech";
    const speech = prepareFlashLiteSpeech(body, request.headers.get("Accept") ?? "", playground);
    const provider = flashLiteProvider(env);
    const owner = { email: user.email, apiKeyId: user.apiKeyId ?? null, source: playground ? "playground" : "api" };
    const { admissionMonth } = await billing(env, { action: "flashLiteAdmit", ...owner, chars: speech.chars, format: speech.format });
    const audio = await synthesizeFlashLite(provider, speech);
    const operationId = `speech_${crypto.randomUUID()}`;
    const { result, balance_usd } = await billing(env, {
      action: "flashLiteCharge", ...owner, operationId, chars: speech.chars, voice: speech.voice, format: speech.format,
      admissionMonth, audioBytes: audio.length,
    });
    const receipt = { ...result, balance_usd };
    const headers = new Headers({ ...cors, ...flashLiteAudioHeaders(receipt, speech.format) });
    if (speech.json) {
      headers.set("Content-Type", "application/json");
      return new Response(JSON.stringify({ ...receipt, audio_url: flashLiteAudioDataUrl(audio, speech.format) }), { headers });
    }
    headers.set("Content-Length", String(audio.length));
    return new Response(audio, { headers });
  } catch (cause) {
    if (cause.status === 402) return error("insufficient_quota", "Insufficient balance. Please deposit credits.", 402);
    if (cause.code === "flash_lite_monthly_limit") {
      return error(cause.code, "Voice Flash Lite has reached its monthly hosting allowance.", 503);
    }
    if (cause.status === 429) {
      return new Response(JSON.stringify({ error: { code: "rate_limit_exceeded", message: `Flash Lite allows ${FLASH_LITE_RATE_LIMIT} requests per minute per account.` } }), {
        status: 429,
        headers: { ...cors, "Content-Type": "application/json", "Retry-After": "60", "Access-Control-Expose-Headers": "Retry-After" },
      });
    }
    if (cause instanceof FlashLiteError) return error(cause.code, cause.message, cause.status);
    return error("flash_lite_billing_unavailable", "Voice Flash Lite billing is temporarily unavailable.", 503);
  }
}
