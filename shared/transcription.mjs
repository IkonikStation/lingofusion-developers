export const TRANSCRIPTION_MODELS = Object.freeze({
  'LingoFusion Transcribe': { upstream: 'gpt-transcribe', microsPerMinute: 10000 },
  'LingoFusion Live Transcribe': { upstream: 'gpt-live-transcribe', microsPerMinute: 30000 },
});
export const AUDIO_RATE = 24000;
export const FILE_AUDIO_RATE = 16000;
export const MAX_LIVE_AUDIO_SECONDS = 180;
export const MAX_FILE_AUDIO_SECONDS = 600;
export const MAX_AUDIO_FILE_BYTES = 25000000;

export function audioCharge(samples, rate, sampleRate = AUDIO_RATE) {
  if (!Number.isSafeInteger(samples) || samples < 0) throw new Error('Invalid audio sample count');
  const samplesPerMinute = BigInt(sampleRate) * 60n;
  return Number((BigInt(samples) * BigInt(rate) + samplesPerMinute - 1n) / samplesPerMinute);
}

// Canonical mono PCM16 WAV: duration comes from validated bytes, never a client field.
export function readTranscriptionWav(buffer) {
  const bytes = new Uint8Array(buffer), header = new DataView(buffer);
  const tag = offset => String.fromCharCode(...bytes.slice(offset, offset + 4));
  if (bytes.length < 44) throw new Error('Invalid WAV header');
  const sampleRate = header.getUint32(24, true);
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE' || tag(12) !== 'fmt ' ||
      header.getUint32(16, true) !== 16 || header.getUint16(20, true) !== 1 || header.getUint16(22, true) !== 1 ||
      (sampleRate !== AUDIO_RATE && sampleRate !== FILE_AUDIO_RATE) || header.getUint32(28, true) !== sampleRate * 2 ||
      header.getUint16(32, true) !== 2 || header.getUint16(34, true) !== 16 || tag(36) !== 'data' ||
      header.getUint32(4, true) !== bytes.length - 8 || header.getUint32(40, true) !== bytes.length - 44 || (bytes.length - 44) % 2) {
    throw new Error('Upload a mono PCM16 WAV at 16 or 24 kHz. The Playground converts supported audio automatically.');
  }
  const samples = (bytes.length - 44) / 2;
  if (samples < sampleRate / 10 || samples > sampleRate * MAX_FILE_AUDIO_SECONDS) {
    throw new Error('Audio must be between 0.1 seconds and 10 minutes');
  }
  return { samples, sampleRate };
}
