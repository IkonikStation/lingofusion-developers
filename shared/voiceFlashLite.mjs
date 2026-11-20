import catalog from "./piper-voices.json" with { type: "json" };
import { cloudRunIdentity, cloudRunIdToken } from "./piperCloudRun.mjs";

export const VOICE_FLASH_LITE_MODEL = "lingofusion-voice-flash-lite";
export const VOICE_FLASH_LITE_NAME = "LingoFusion Voice Flash Lite";
export const VOICE_FLASH_LITE_PRICE = 0.02;
export const VOICE_FLASH_LITE_MAX_CHARS = 1500;
export const VOICE_FLASH_LITE_VOICES = catalog.voices.map(({ id, locale, label }) => ({ id, locale, label }));

export const isVoiceFlashLite = (model) =>
  [VOICE_FLASH_LITE_MODEL, VOICE_FLASH_LITE_NAME.toLowerCase()].includes(String(model ?? "").trim().toLowerCase());

export const flashLiteCostMicros = (chars) => chars * (VOICE_FLASH_LITE_PRICE * 1000);

export const FLASH_LITE_RATE_LIMIT = 12;
export const FLASH_LITE_WINDOW_MS = 60_000;
export const FLASH_LITE_AUDIO_TYPES = { mp3: "audio/mpeg", wav: "audio/wav" };
export const FLASH_LITE_AUDIO_LIMITS = { mp3: 1280 * 1024, wav: 8 * 1024 * 1024 };
export const FLASH_LITE_CLOUD_CALLS_PER_MONTH = 1000;
export const FLASH_LITE_CLOUD_BYTES_PER_MONTH = 384 * 1024 * 1024;

export class FlashLiteError extends Error {
  constructor(code, status, message) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function prepareFlashLiteSpeech(body, accept, playground) {
  const rawInput = body.input ?? body.text;
  const input = typeof rawInput === "string" ? rawInput.trim() : "";
  const chars = [...input].length;
  if (!chars || chars > VOICE_FLASH_LITE_MAX_CHARS || /[\u0000\uD800-\uDFFF]/u.test(input)) {
    throw new FlashLiteError("invalid_input", 400, `Supply 1–${VOICE_FLASH_LITE_MAX_CHARS} characters of valid text.`);
  }
  const responseFormat = String(body.response_format ?? "").toLowerCase();
  const format = responseFormat === "json" ? String(body.output_format ?? "mp3").toLowerCase()
    : responseFormat || String(body.output_format ?? "mp3").toLowerCase();
  if (format !== "mp3" && format !== "wav") {
    throw new FlashLiteError("unsupported_format", 400, "Flash Lite supports mp3 and wav.");
  }
  const locale = String(body.language ?? "").trim().toLowerCase().replace(/_/g, "-");
  const rawVoice = String(body.voice ?? body.voice_id ?? "").trim().toLowerCase();
  const voice = rawVoice
    ? VOICE_FLASH_LITE_VOICES.find((v) => v.id.toLowerCase() === rawVoice)
    : locale
      ? VOICE_FLASH_LITE_VOICES.find((v) => v.locale.toLowerCase() === locale || v.locale.split("-")[0] === locale)
      : VOICE_FLASH_LITE_VOICES[0];
  if (!voice || (locale && ![voice.locale.toLowerCase(), voice.locale.split("-")[0]].includes(locale))) {
    throw new FlashLiteError("unsupported_voice", 400, "Choose a supported Flash Lite voice or language.");
  }
  const json = responseFormat === "json" || accept.includes("application/json") ||
    (playground && !accept.includes(FLASH_LITE_AUDIO_TYPES[format]));
  return { input, chars, format, voice: voice.id, json };
}

export function flashLiteProvider(env, allowLocal = false) {
  const { PIPER_ORIGIN, PIPER_API_TOKEN } = env;
  try {
    const origin = new URL(PIPER_ORIGIN);
    const local = allowLocal && origin.protocol === "http:" && origin.hostname === "127.0.0.1";
    if (origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash ||
        !/^[a-f0-9]{64}$/.test(PIPER_API_TOKEN ?? "") ||
        (!local && (origin.protocol !== "https:" || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)?\.run\.app$/.test(origin.hostname) || origin.port))) {
      throw new Error("Invalid Piper origin.");
    }
    const identity = local ? null : cloudRunIdentity(env, origin.origin);
    return {
      url: new URL("/synthesize", origin),
      async headers() {
        return {
          Authorization: `Bearer ${PIPER_API_TOKEN}`,
          "Content-Type": "application/json",
          ...(identity && { "X-Serverless-Authorization": `Bearer ${await cloudRunIdToken(identity)}` }),
        };
      },
    };
  } catch {
    throw new FlashLiteError("flash_lite_unavailable", 503, "Voice Flash Lite is currently unavailable.");
  }
}

export async function synthesizeFlashLite(provider, { input, voice, format }) {
  const contentType = FLASH_LITE_AUDIO_TYPES[format];
  const maximumBytes = FLASH_LITE_AUDIO_LIMITS[format];
  const failed = () => new FlashLiteError("flash_lite_synthesis_failed", 502, "Voice Flash Lite could not generate audio.");
  try {
    const response = await fetch(provider.url, {
      method: "POST",
      redirect: "error",
      headers: { ...await provider.headers(), Accept: contentType, "Accept-Encoding": "identity" },
      signal: AbortSignal.timeout(50_000),
      body: JSON.stringify({ input, voice, format }),
    });
    if (response.status === 429 || response.status === 503) {
      await response.body?.cancel();
      throw new FlashLiteError("flash_lite_busy", 503, "Voice Flash Lite is busy. Try again shortly.");
    }
    if (response.status === 422) {
      await response.body?.cancel();
      throw new FlashLiteError("invalid_speech", 422, "The text could not be synthesized within the Flash Lite audio limit.");
    }
    const declaredLength = response.headers.get("Content-Length");
    const length = declaredLength === null ? null : Number(declaredLength);
    if (!response.ok || response.headers.get("Content-Type") !== contentType ||
        (length !== null && (!Number.isInteger(length) || length < 12 || length > maximumBytes)) || !response.body) {
      await response.body?.cancel();
      throw failed();
    }
    const reader = response.body.getReader();
    const chunks = [];
    let audio = length === null ? null : new Uint8Array(length);
    let offset = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (offset + value.length > (length ?? maximumBytes)) {
        await reader.cancel();
        throw failed();
      }
      if (audio) audio.set(value, offset);
      else chunks.push(value);
      offset += value.length;
    }
    if (offset < 12 || (length !== null && offset !== length)) throw failed();
    if (!audio) {
      audio = new Uint8Array(offset);
      let start = 0;
      for (const chunk of chunks) {
        audio.set(chunk, start);
        start += chunk.length;
      }
    }
    const valid = format === "mp3" ? hasMp3Frame(audio)
      : String.fromCharCode(...audio.subarray(0, 4)) === "RIFF" &&
        String.fromCharCode(...audio.subarray(8, 12)) === "WAVE" &&
        new DataView(audio.buffer).getUint32(4, true) === audio.length - 8;
    if (!valid) throw failed();
    return audio;
  } catch (error) {
    if (error instanceof FlashLiteError) throw error;
    throw failed();
  }
}

function hasMp3Frame(audio) {
  let start = 0;
  if (String.fromCharCode(...audio.subarray(0, 3)) === "ID3") {
    const size = audio.subarray(6, 10);
    if (size.some((byte) => byte >= 128)) return false;
    start = 10 + size.reduce((total, byte) => total * 128 + byte, 0);
  }
  return start + 4 <= audio.length && audio[start] === 255 && (audio[start + 1] & 224) === 224;
}

export function flashLiteAudioHeaders(receipt, format) {
  return {
    "Content-Type": FLASH_LITE_AUDIO_TYPES[format],
    "Cache-Control": "no-store, no-transform",
    "X-LingoFusion-Request-Id": receipt.id,
    "X-LingoFusion-Model": receipt.model,
    "X-LingoFusion-Chars": String(receipt.chars),
    "X-LingoFusion-Cost-Usd": String(receipt.cost_usd),
    "X-LingoFusion-Billed-Usd": String(receipt.billed_usd),
    "X-LingoFusion-Balance-Usd": String(receipt.balance_usd),
    "Access-Control-Expose-Headers": "X-LingoFusion-Request-Id, X-LingoFusion-Model, X-LingoFusion-Chars, X-LingoFusion-Cost-Usd, X-LingoFusion-Billed-Usd, X-LingoFusion-Balance-Usd",
  };
}

export function flashLiteAudioDataUrl(audio, format) {
  const chunks = [];
  // Multiples of three keep the base64 chunks independently aligned.
  const size = 0x6000;
  for (let i = 0; i < audio.length; i += size) {
    chunks.push(btoa(String.fromCharCode(...audio.subarray(i, i + size))));
  }
  return `data:${FLASH_LITE_AUDIO_TYPES[format]};base64,${chunks.join("")}`;
}
