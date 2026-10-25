/**
 * LingoFusion Ultra Custom Subscription Builder Configuration & Pricing Engine
 *
 * Total Price = BASE_FEE
 *   + (Dubbing Minutes * DUB_RATE)
 *   + (Voice Credits * VOICE_RATE)
 *   + (Text Chars * TEXT_RATE)
 *   + (Transcribe Minutes * TRANSCRIBE_RATE)
 *   + (Images * IMAGE_RATE)
 */

export const ULTRA_BASE_FEE = 29.00; // Required monthly platform base fee

export const ULTRA_RATES = {
  dubbingPerMin: 3.50, // $210.00 / hr (ElevenLabs Dubbing v2 @ $2.20/min upstream)
  voicePerCredit: 0.00007, // $70.00 / 1,000,000 credits (1 credit = 1 char on v4 Turbo; 2 credits = 1 char on v4 Standard)
  textPerChar: 0.000006, // $6.00 / 1,000,000 characters (GPT-6 Luna, Sol, Astra)
  transcribePerMin: 0.017, // $1.02 / hr (GPT-4o-transcribe)
  imagePerItem: 0.12, // $6.00 / 50 images (GPT-image 2.5 Sunburst)
} as const;

export const ULTRA_ENTERPRISE_THRESHOLD = 5000.00; // >= $5,000 requires ACH Wire / Enterprise Invoice

export interface UltraResourceConfig {
  dubbingMins: number;
  voiceCredits: number;
  textChars: number;
  transcribeMins: number;
  imageCount: number;
}

export const ULTRA_DEFAULTS: UltraResourceConfig = {
  dubbingMins: 30, // 30 minutes
  voiceCredits: 1_200_000, // 1.2M credits
  textChars: 5_000_000, // 5M characters
  transcribeMins: 120, // 2 hours
  imageCount: 50, // 50 images
};

export const ULTRA_LIMITS = {
  dubbing: {
    min: 0,
    max: 60_000, // 1,000 hours
    default: 30,
    sliderStep: 15,
    inputStep: 1,
    unit: "mins",
    label: "Video Dubbing",
    upstreamNote: "ElevenLabs Dubbing v2",
  },
  voice: {
    min: 0,
    max: 10_000_000,
    default: 1_200_000,
    sliderStep: 100_000,
    inputStep: 1_000,
    unit: "credits",
    label: "Voice Synthesis",
    upstreamNote: "LingoFusion Voice v4 / Turbo",
  },
  text: {
    min: 0,
    max: 10_000_000,
    default: 5_000_000,
    sliderStep: 500_000,
    inputStep: 1_000,
    unit: "chars",
    label: "Text Translation",
    upstreamNote: "GPT-6 Luna, Sol, Astra",
  },
  transcribe: {
    min: 0,
    max: 6_000, // 100 hours
    default: 120,
    sliderStep: 30,
    inputStep: 1,
    unit: "mins",
    label: "Audio Transcription",
    upstreamNote: "GPT-4o-transcribe",
  },
  images: {
    min: 0,
    max: 1_000,
    default: 50,
    sliderStep: 25,
    inputStep: 1,
    unit: "images",
    label: "AI Images",
    upstreamNote: "GPT-image 2.5 Sunburst",
  },
} as const;

export interface UltraPriceBreakdown {
  baseFee: number;
  dubbingCost: number;
  voiceCost: number;
  textCost: number;
  transcribeCost: number;
  imagesCost: number;
  totalMonthlyPrice: number;
  isEnterpriseInvoice: boolean;
}

/**
 * Calculates exact itemized sub-totals and grand total for Ultra subscription.
 */
export function calculateUltraPrice(config: UltraResourceConfig): UltraPriceBreakdown {
  const dubbingMins = Math.max(0, Math.min(ULTRA_LIMITS.dubbing.max, Number(config.dubbingMins) || 0));
  const voiceCredits = Math.max(0, Math.min(ULTRA_LIMITS.voice.max, Number(config.voiceCredits) || 0));
  const textChars = Math.max(0, Math.min(ULTRA_LIMITS.text.max, Number(config.textChars) || 0));
  const transcribeMins = Math.max(0, Math.min(ULTRA_LIMITS.transcribe.max, Number(config.transcribeMins) || 0));
  const imageCount = Math.max(0, Math.min(ULTRA_LIMITS.images.max, Number(config.imageCount) || 0));

  const baseFee = ULTRA_BASE_FEE;
  const dubbingCost = Number((dubbingMins * ULTRA_RATES.dubbingPerMin).toFixed(2));
  const voiceCost = Number((voiceCredits * ULTRA_RATES.voicePerCredit).toFixed(2));
  const textCost = Number((textChars * ULTRA_RATES.textPerChar).toFixed(2));
  const transcribeCost = Number((transcribeMins * ULTRA_RATES.transcribePerMin).toFixed(2));
  const imagesCost = Number((imageCount * ULTRA_RATES.imagePerItem).toFixed(2));

  const total = Number((baseFee + dubbingCost + voiceCost + textCost + transcribeCost + imagesCost).toFixed(2));

  return {
    baseFee,
    dubbingCost,
    voiceCost,
    textCost,
    transcribeCost,
    imagesCost,
    totalMonthlyPrice: total,
    isEnterpriseInvoice: total >= ULTRA_ENTERPRISE_THRESHOLD,
  };
}

/**
 * Piecewise non-linear mapping for the Video Dubbing slider (0 to 60,000 mins):
 * - 0% – 50%  maps to 0 to 600 minutes (0 to 10 hrs) in 15-minute steps.
 * - 50% – 80% maps to 600 to 6,000 minutes (10 to 100 hrs) in 60-minute steps.
 * - 80% – 100% maps to 6,000 to 60,000 minutes (100 to 1,000 hrs) in 300-minute steps.
 */
export function sliderToDubbingMinutes(sliderPct: number): number {
  const t = Math.max(0, Math.min(100, Number(sliderPct) || 0)) / 100;

  if (t <= 0.5) {
    // 0 to 600 minutes, 15-min step
    const fraction = t / 0.5;
    const raw = fraction * 600;
    return Math.min(600, Math.round(raw / 15) * 15);
  } else if (t <= 0.8) {
    // 600 to 6,000 minutes, 60-min step
    const fraction = (t - 0.5) / 0.3;
    const raw = 600 + fraction * 5400;
    return Math.min(6000, Math.round((raw - 600) / 60) * 60 + 600);
  } else {
    // 6,000 to 60,000 minutes, 300-min step
    const fraction = (t - 0.8) / 0.2;
    const raw = 6000 + fraction * 54000;
    return Math.min(60000, Math.round((raw - 6000) / 300) * 300 + 6000);
  }
}

/**
 * Invert minutes (0 to 60,000) back to a slider percentage (0 to 100).
 */
export function dubbingMinutesToSlider(minutes: number): number {
  const m = Math.max(0, Math.min(60000, Number(minutes) || 0));

  if (m <= 600) {
    return (m / 600) * 50;
  } else if (m <= 6000) {
    return 50 + ((m - 600) / 5400) * 30;
  } else {
    return 80 + ((m - 6000) / 54000) * 20;
  }
}

/**
 * Clamp helper for direct user inputs
 */
export function clampResource(val: number, min: number, max: number): number {
  if (isNaN(val)) return min;
  return Math.max(min, Math.min(max, val));
}
