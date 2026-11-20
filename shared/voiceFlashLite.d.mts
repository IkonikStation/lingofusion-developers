export const VOICE_FLASH_LITE_MODEL: string;
export const VOICE_FLASH_LITE_NAME: string;
export const VOICE_FLASH_LITE_PRICE: number;
export const VOICE_FLASH_LITE_MAX_CHARS: number;
export const VOICE_FLASH_LITE_VOICES: ReadonlyArray<{ id: string; locale: string; label: string }>;
export function isVoiceFlashLite(model: unknown): boolean;
export const FLASH_LITE_AUDIO_TYPES: Record<"mp3" | "wav", string>;
