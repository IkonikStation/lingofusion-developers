export const TRANSCRIPTION_MODELS = Object.freeze({
  'LingoFusion Transcribe': { upstream: 'gpt-transcribe', microsPerMinute: 10000 },
  'LingoFusion Live Transcribe': { upstream: 'gpt-live-transcribe', microsPerMinute: 30000 },
});
export const AUDIO_RATE = 24000;
export const MAX_AUDIO_SECONDS = 180;
export function audioCharge(samples, rate) {
  if (!Number.isSafeInteger(samples) || samples < 0) throw new Error('Invalid audio sample count');
  return Number((BigInt(samples) * BigInt(rate) + 1439999n) / 1440000n);
}
// Canonical mono PCM16 WAV: duration comes from validated bytes, never a client field.
export function wavSamples(buffer) {
  const b = new Uint8Array(buffer), v = new DataView(buffer);
  const tag = n => String.fromCharCode(...b.slice(n, n + 4));
  if (b.length < 44 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE' || tag(12) !== 'fmt ' ||
      v.getUint32(16, true) !== 16 || v.getUint16(20, true) !== 1 || v.getUint16(22, true) !== 1 ||
      v.getUint32(24, true) !== AUDIO_RATE || v.getUint32(28, true) !== 48000 ||
      v.getUint16(32, true) !== 2 || v.getUint16(34, true) !== 16 || tag(36) !== 'data' ||
      v.getUint32(4, true) !== b.length - 8 || v.getUint32(40, true) !== b.length - 44 || (b.length - 44) % 2) {
    throw new Error('Upload a mono PCM16 WAV at 24 kHz; Playground converts supported audio automatically');
  }
  const samples = (b.length - 44) / 2;
  if (samples < 2400 || samples > AUDIO_RATE * MAX_AUDIO_SECONDS) throw new Error('Audio must be between 0.1 seconds and 3 minutes');
  return samples;
}
