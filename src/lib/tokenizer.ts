import { getEncoding } from "js-tiktoken";

let encoderInstance: ReturnType<typeof getEncoding> | null = null;

export function getOpenAITokenizer() {
  if (!encoderInstance) {
    try {
      encoderInstance = getEncoding("o200k_base");
    } catch {
      encoderInstance = null;
    }
  }
  return encoderInstance;
}

export function countTokens(text: unknown): number {
  const str = typeof text === "string" ? text : String(text || "");
  if (!str) return 0;
  try {
    const enc = getOpenAITokenizer();
    if (enc) {
      return enc.encode(str).length;
    }
  } catch {}
  return Math.max(1, Math.ceil(str.length / 4));
}

export function tokenizeText(text: unknown): { tokenIds: number[]; tokens: string[]; count: number } {
  const str = typeof text === "string" ? text : String(text || "");
  if (!str) return { tokenIds: [], tokens: [], count: 0 };
  try {
    const enc = getOpenAITokenizer();
    if (enc) {
      const ids = enc.encode(str);
      const pieces = ids.map((id) => enc.decode([id]));
      return { tokenIds: Array.from(ids), tokens: pieces, count: ids.length };
    }
  } catch {}
  const fallbackCount = Math.max(1, Math.ceil(str.length / 4));
  return { tokenIds: [], tokens: [str], count: fallbackCount };
}
