import {
  ArrowUpRight,
  Building2,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  Sparkles,
  Video,
  Volume2,
} from "lucide-react";
import { useId, useMemo, useState } from "react";
import type { BillingInterval } from "../data/subscriptions";
import {
  ULTRA_BASE_FEE,
  ULTRA_DEFAULTS,
  ULTRA_ENTERPRISE_THRESHOLD,
  ULTRA_LIMITS,
  ULTRA_RATES,
  calculateUltraPrice,
  clampResource,
  dubbingMinutesToSlider,
  sliderToDubbingMinutes,
} from "../data/ultraConfig";
import type { UltraPriceBreakdown, UltraResourceConfig } from "../data/ultraConfig";
import { formatUsd } from "../lib/utils";

export interface UltraSubscriptionBuilderProps {
  initialConfig?: Partial<UltraResourceConfig>;
  initialBilling?: BillingInterval;
  onSubscribe?: (config: UltraResourceConfig, breakdown: UltraPriceBreakdown, billing: BillingInterval) => void;
  onRequestInvoice?: (config: UltraResourceConfig, breakdown: UltraPriceBreakdown, billing: BillingInterval) => void;
  className?: string;
}

const PRESET_STUDIO_PRO: UltraResourceConfig = {
  dubbingMins: 120,
  voiceCredits: 3_000_000,
  textChars: 8_000_000,
  transcribeMins: 600,
  imageCount: 150,
};

const PRESET_ENTERPRISE: UltraResourceConfig = {
  dubbingMins: 1_200,
  voiceCredits: 10_000_000,
  textChars: 10_000_000,
  transcribeMins: 3_000,
  imageCount: 500,
};

export function UltraSubscriptionBuilder({
  initialConfig,
  initialBilling = "monthly",
  onSubscribe,
  onRequestInvoice,
  className = "",
}: UltraSubscriptionBuilderProps) {
  const [billing, setBilling] = useState<BillingInterval>(initialBilling);
  const [activePreset, setActivePreset] = useState<"default" | "studio" | "enterprise" | "custom">("default");

  const [config, setConfig] = useState<UltraResourceConfig>(() => ({
    dubbingMins: Number.isFinite(initialConfig?.dubbingMins)
      ? Number(initialConfig!.dubbingMins)
      : ULTRA_DEFAULTS.dubbingMins,
    voiceCredits: Number.isFinite(initialConfig?.voiceCredits)
      ? Number(initialConfig!.voiceCredits)
      : ULTRA_DEFAULTS.voiceCredits,
    textChars: Number.isFinite(initialConfig?.textChars)
      ? Number(initialConfig!.textChars)
      : ULTRA_DEFAULTS.textChars,
    transcribeMins: Number.isFinite(initialConfig?.transcribeMins)
      ? Number(initialConfig!.transcribeMins)
      : ULTRA_DEFAULTS.transcribeMins,
    imageCount: Number.isFinite(initialConfig?.imageCount)
      ? Number(initialConfig!.imageCount)
      : ULTRA_DEFAULTS.imageCount,
  }));

  const [dubbingInputStr, setDubbingInputStr] = useState<string>(() => String(config.dubbingMins ?? 30));
  const [voiceInputStr, setVoiceInputStr] = useState<string>(() => String(config.voiceCredits ?? 1200000));
  const [textInputStr, setTextInputStr] = useState<string>(() => String(config.textChars ?? 5000000));
  const [transcribeInputStr, setTranscribeInputStr] = useState<string>(() => String(config.transcribeMins ?? 120));
  const [imageInputStr, setImageInputStr] = useState<string>(() => String(config.imageCount ?? 50));

  const breakdown = useMemo(() => calculateUltraPrice(config), [config]);

  const dubbingSliderId = useId();
  const voiceSliderId = useId();
  const textSliderId = useId();
  const transcribeSliderId = useId();
  const imageSliderId = useId();

  // Handlers
  const handleDubbingSlider = (pct: number) => {
    const mins = sliderToDubbingMinutes(pct);
    setConfig((prev) => ({ ...prev, dubbingMins: mins }));
    setDubbingInputStr(String(mins));
    setActivePreset("custom");
  };

  const handleDubbingInput = (valueStr: string) => {
    setDubbingInputStr(valueStr);
    const num = parseInt(valueStr.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(num)) {
      const clamped = clampResource(num, ULTRA_LIMITS.dubbing.min, ULTRA_LIMITS.dubbing.max);
      setConfig((prev) => ({ ...prev, dubbingMins: clamped }));
      setActivePreset("custom");
    }
  };

  const handleDubbingBlur = () => {
    const num = parseInt(dubbingInputStr.replace(/[^0-9]/g, ""), 10);
    const clamped = clampResource(isNaN(num) ? ULTRA_LIMITS.dubbing.default : num, ULTRA_LIMITS.dubbing.min, ULTRA_LIMITS.dubbing.max);
    setConfig((prev) => ({ ...prev, dubbingMins: clamped }));
    setDubbingInputStr(String(clamped));
  };

  const handleVoiceSlider = (val: number) => {
    setConfig((prev) => ({ ...prev, voiceCredits: val }));
    setVoiceInputStr(String(val));
    setActivePreset("custom");
  };

  const handleVoiceInput = (valueStr: string) => {
    setVoiceInputStr(valueStr);
    const num = parseInt(valueStr.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(num)) {
      const clamped = clampResource(num, ULTRA_LIMITS.voice.min, ULTRA_LIMITS.voice.max);
      setConfig((prev) => ({ ...prev, voiceCredits: clamped }));
      setActivePreset("custom");
    }
  };

  const handleVoiceBlur = () => {
    const num = parseInt(voiceInputStr.replace(/[^0-9]/g, ""), 10);
    const clamped = clampResource(isNaN(num) ? ULTRA_LIMITS.voice.default : num, ULTRA_LIMITS.voice.min, ULTRA_LIMITS.voice.max);
    setConfig((prev) => ({ ...prev, voiceCredits: clamped }));
    setVoiceInputStr(String(clamped));
  };

  const handleTextSlider = (val: number) => {
    setConfig((prev) => ({ ...prev, textChars: val }));
    setTextInputStr(String(val));
    setActivePreset("custom");
  };

  const handleTextInput = (valueStr: string) => {
    setTextInputStr(valueStr);
    const num = parseInt(valueStr.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(num)) {
      const clamped = clampResource(num, ULTRA_LIMITS.text.min, ULTRA_LIMITS.text.max);
      setConfig((prev) => ({ ...prev, textChars: clamped }));
      setActivePreset("custom");
    }
  };

  const handleTextBlur = () => {
    const num = parseInt(textInputStr.replace(/[^0-9]/g, ""), 10);
    const clamped = clampResource(isNaN(num) ? ULTRA_LIMITS.text.default : num, ULTRA_LIMITS.text.min, ULTRA_LIMITS.text.max);
    setConfig((prev) => ({ ...prev, textChars: clamped }));
    setTextInputStr(String(clamped));
  };

  const handleTranscribeSlider = (val: number) => {
    setConfig((prev) => ({ ...prev, transcribeMins: val }));
    setTranscribeInputStr(String(val));
    setActivePreset("custom");
  };

  const handleTranscribeInput = (valueStr: string) => {
    setTranscribeInputStr(valueStr);
    const num = parseInt(valueStr.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(num)) {
      const clamped = clampResource(num, ULTRA_LIMITS.transcribe.min, ULTRA_LIMITS.transcribe.max);
      setConfig((prev) => ({ ...prev, transcribeMins: clamped }));
      setActivePreset("custom");
    }
  };

  const handleTranscribeBlur = () => {
    const num = parseInt(transcribeInputStr.replace(/[^0-9]/g, ""), 10);
    const clamped = clampResource(isNaN(num) ? ULTRA_LIMITS.transcribe.default : num, ULTRA_LIMITS.transcribe.min, ULTRA_LIMITS.transcribe.max);
    setConfig((prev) => ({ ...prev, transcribeMins: clamped }));
    setTranscribeInputStr(String(clamped));
  };

  const handleImageSlider = (val: number) => {
    setConfig((prev) => ({ ...prev, imageCount: val }));
    setImageInputStr(String(val));
    setActivePreset("custom");
  };

  const handleImageInput = (valueStr: string) => {
    setImageInputStr(valueStr);
    const num = parseInt(valueStr.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(num)) {
      const clamped = clampResource(num, ULTRA_LIMITS.images.min, ULTRA_LIMITS.images.max);
      setConfig((prev) => ({ ...prev, imageCount: clamped }));
      setActivePreset("custom");
    }
  };

  const handleImageBlur = () => {
    const num = parseInt(imageInputStr.replace(/[^0-9]/g, ""), 10);
    const clamped = clampResource(isNaN(num) ? ULTRA_LIMITS.images.default : num, ULTRA_LIMITS.images.min, ULTRA_LIMITS.images.max);
    setConfig((prev) => ({ ...prev, imageCount: clamped }));
    setImageInputStr(String(clamped));
  };

  const applyPreset = (preset: UltraResourceConfig, key: "default" | "studio" | "enterprise") => {
    setConfig(preset);
    setDubbingInputStr(String(preset.dubbingMins));
    setVoiceInputStr(String(preset.voiceCredits));
    setTextInputStr(String(preset.textChars));
    setTranscribeInputStr(String(preset.transcribeMins));
    setImageInputStr(String(preset.imageCount));
    setActivePreset(key);
  };

  const isYearly = billing === "yearly";
  const displayPrice = isYearly ? breakdown.effectiveMonthlyPriceYearly : breakdown.totalMonthlyPrice;

  return (
    <div className={`mx-auto max-w-6xl ${className}`}>
      {/* Top Header Row matching screenshot */}
      <div className="mb-8">
        {/* Badge & Note */}
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200/90 bg-neutral-100/70 px-2.5 py-0.5 text-xs font-semibold text-neutral-800 dark:border-white/10 dark:bg-white/[0.06] dark:text-neutral-200">
            <Sparkles className="h-3 w-3 text-neutral-600 dark:text-neutral-300" />
            Custom Quota Builder
          </span>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            Overage gracefully falls back to prepaid balance
          </span>
        </div>

        {/* Title and Segmented Billing Toggle */}
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">
            Configure your exact monthly Ultra quotas.
          </h1>

          {/* Minimal Pill Toggle */}
          <div className="inline-flex items-center rounded-full border border-neutral-200/90 bg-neutral-100/90 p-1 dark:border-white/10 dark:bg-neutral-800 self-start sm:self-auto shadow-2xs">
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={`rounded-full px-3.5 py-1 text-xs font-semibold transition ${
                !isYearly
                  ? "bg-white text-neutral-950 shadow-xs dark:bg-neutral-900 dark:text-white"
                  : "text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBilling("yearly")}
              className={`flex items-center gap-1 rounded-full px-3.5 py-1 text-xs font-semibold transition ${
                isYearly
                  ? "bg-white text-neutral-950 shadow-xs dark:bg-neutral-900 dark:text-white"
                  : "text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
              }`}
            >
              <span>Yearly</span>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                (Save 15%)
              </span>
            </button>
          </div>
        </div>

        {/* Presets Line */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
          <span>Presets:</span>
          <button
            type="button"
            onClick={() => applyPreset(ULTRA_DEFAULTS, "default")}
            className={`transition hover:text-neutral-950 dark:hover:text-white ${
              activePreset === "default"
                ? "font-semibold text-neutral-950 underline underline-offset-4 dark:text-white"
                : "text-neutral-700 dark:text-neutral-300"
            }`}
          >
            Default Bundle (${isYearly ? "217.63" : "256"}/mo)
          </button>
          <span className="text-neutral-300 dark:text-neutral-700">•</span>
          <button
            type="button"
            onClick={() => applyPreset(PRESET_STUDIO_PRO, "studio")}
            className={`transition hover:text-neutral-950 dark:hover:text-white ${
              activePreset === "studio"
                ? "font-semibold text-neutral-950 underline underline-offset-4 dark:text-white"
                : "text-neutral-700 dark:text-neutral-300"
            }`}
          >
            Studio Pro
          </button>
          <span className="text-neutral-300 dark:text-neutral-700">•</span>
          <button
            type="button"
            onClick={() => applyPreset(PRESET_ENTERPRISE, "enterprise")}
            className={`transition hover:text-neutral-950 dark:hover:text-white ${
              activePreset === "enterprise"
                ? "font-semibold text-neutral-950 underline underline-offset-4 dark:text-white"
                : "text-neutral-700 dark:text-neutral-300"
            }`}
          >
            Enterprise Scale
          </button>
        </div>
      </div>

      {/* Main Content: Left Sliders + Right Summary Card */}
      <div className="grid gap-10 lg:grid-cols-[1.55fr_1fr] items-start">
        {/* Left Column: 5 Resource Configuration Rows */}
        <div className="space-y-8">
          {/* 1. Dubbing */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200/90 bg-white text-neutral-700 shadow-2xs dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-300">
                  <Video className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
                    Dubbing
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    ${ULTRA_RATES.dubbingPerMin.toFixed(2)}/min • High-fidelity voice match & lip sync
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-sans tabular-nums text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  +${formatUsd(breakdown.dubbingCost)}/mo
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label="Dubbing minutes"
                    value={dubbingInputStr}
                    onChange={(e) => handleDubbingInput(e.target.value)}
                    onBlur={handleDubbingBlur}
                    className="h-8 w-16 rounded-lg border border-neutral-200/90 bg-white px-2 text-center font-sans tabular-nums text-xs font-semibold text-neutral-950 shadow-2xs outline-none focus:border-neutral-400 dark:border-white/15 dark:bg-neutral-900 dark:text-white"
                  />
                  <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    mins
                  </span>
                </div>
              </div>
            </div>

            <div>
              <input
                id={dubbingSliderId}
                type="range"
                min="0"
                max="100"
                step="0.1"
                aria-label="Dubbing minutes slider"
                value={dubbingMinutesToSlider(config.dubbingMins ?? 30)}
                onChange={(e) => handleDubbingSlider(parseFloat(e.target.value))}
                className="clean-range h-1.5 w-full cursor-pointer accent-neutral-950 dark:accent-white"
              />
              <div className="mt-1 flex justify-between text-[11px] text-neutral-400 dark:text-neutral-500">
                <span>0 mins</span>
                <span className="font-medium text-neutral-700 dark:text-neutral-300">
                  {(config.dubbingMins ?? 30).toLocaleString()} mins ({((config.dubbingMins ?? 30) / 60).toFixed(1)} hrs)
                </span>
                <span>60,000 mins</span>
              </div>
            </div>
          </div>

          {/* 2. Voice Synthesis */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200/90 bg-white text-neutral-700 shadow-2xs dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-300">
                  <Volume2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
                    Voice Synthesis
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    $70.00 / 1M credits • LingoFusion Voice V4 / Turbo
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-sans tabular-nums text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  +${formatUsd(breakdown.voiceCost)}/mo
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label="Voice synthesis credits"
                    value={voiceInputStr}
                    onChange={(e) => handleVoiceInput(e.target.value)}
                    onBlur={handleVoiceBlur}
                    className="h-8 w-24 rounded-lg border border-neutral-200/90 bg-white px-2 text-center font-sans tabular-nums text-xs font-semibold text-neutral-950 shadow-2xs outline-none focus:border-neutral-400 dark:border-white/15 dark:bg-neutral-900 dark:text-white"
                  />
                  <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    credits
                  </span>
                </div>
              </div>
            </div>

            <div>
              <input
                id={voiceSliderId}
                type="range"
                min={ULTRA_LIMITS.voice.min}
                max={ULTRA_LIMITS.voice.max}
                step={ULTRA_LIMITS.voice.sliderStep}
                aria-label="Voice synthesis credits slider"
                value={config.voiceCredits ?? 1200000}
                onChange={(e) => handleVoiceSlider(parseInt(e.target.value, 10))}
                className="clean-range h-1.5 w-full cursor-pointer accent-neutral-950 dark:accent-white"
              />
              <div className="mt-1 flex justify-between text-[11px] text-neutral-400 dark:text-neutral-500">
                <span>0 credits</span>
                <span className="font-medium text-neutral-700 dark:text-neutral-300">
                  {(config.voiceCredits ?? 1200000).toLocaleString()} credits ({((config.voiceCredits ?? 1200000) / 1_000_000).toFixed(2)}M)
                </span>
                <span>10,000,000</span>
              </div>
            </div>
          </div>

          {/* 3. Text Translation */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200/90 bg-white text-neutral-700 shadow-2xs dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-300">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
                    Text Translation
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    $6.00 / 1M chars • LingoFusion, Pro & Ultra models
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-sans tabular-nums text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  +${formatUsd(breakdown.textCost)}/mo
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label="Text translation characters"
                    value={textInputStr}
                    onChange={(e) => handleTextInput(e.target.value)}
                    onBlur={handleTextBlur}
                    className="h-8 w-24 rounded-lg border border-neutral-200/90 bg-white px-2 text-center font-sans tabular-nums text-xs font-semibold text-neutral-950 shadow-2xs outline-none focus:border-neutral-400 dark:border-white/15 dark:bg-neutral-900 dark:text-white"
                  />
                  <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    chars
                  </span>
                </div>
              </div>
            </div>

            <div>
              <input
                id={textSliderId}
                type="range"
                min={ULTRA_LIMITS.text.min}
                max={ULTRA_LIMITS.text.max}
                step={ULTRA_LIMITS.text.sliderStep}
                aria-label="Text translation characters slider"
                value={config.textChars ?? 5000000}
                onChange={(e) => handleTextSlider(parseInt(e.target.value, 10))}
                className="clean-range h-1.5 w-full cursor-pointer accent-neutral-950 dark:accent-white"
              />
              <div className="mt-1 flex justify-between text-[11px] text-neutral-400 dark:text-neutral-500">
                <span>0 chars</span>
                <span className="font-medium text-neutral-700 dark:text-neutral-300">
                  {(config.textChars ?? 5000000).toLocaleString()} chars ({((config.textChars ?? 5000000) / 1_000_000).toFixed(2)}M)
                </span>
                <span>10,000,000</span>
              </div>
            </div>
          </div>

          {/* 4. Audio Transcription */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200/90 bg-white text-neutral-700 shadow-2xs dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-300">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
                    Audio Transcription
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    $0.017/min ($1.02/hr) • Timestamped speech-to-text
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-sans tabular-nums text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  +${formatUsd(breakdown.transcribeCost)}/mo
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label="Audio transcription minutes"
                    value={transcribeInputStr}
                    onChange={(e) => handleTranscribeInput(e.target.value)}
                    onBlur={handleTranscribeBlur}
                    className="h-8 w-16 rounded-lg border border-neutral-200/90 bg-white px-2 text-center font-sans tabular-nums text-xs font-semibold text-neutral-950 shadow-2xs outline-none focus:border-neutral-400 dark:border-white/15 dark:bg-neutral-900 dark:text-white"
                  />
                  <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    mins
                  </span>
                </div>
              </div>
            </div>

            <div>
              <input
                id={transcribeSliderId}
                type="range"
                min={ULTRA_LIMITS.transcribe.min}
                max={ULTRA_LIMITS.transcribe.max}
                step={ULTRA_LIMITS.transcribe.sliderStep}
                aria-label="Audio transcription minutes slider"
                value={config.transcribeMins ?? 120}
                onChange={(e) => handleTranscribeSlider(parseInt(e.target.value, 10))}
                className="clean-range h-1.5 w-full cursor-pointer accent-neutral-950 dark:accent-white"
              />
              <div className="mt-1 flex justify-between text-[11px] text-neutral-400 dark:text-neutral-500">
                <span>0 mins</span>
                <span className="font-medium text-neutral-700 dark:text-neutral-300">
                  {(config.transcribeMins ?? 120).toLocaleString()} mins ({((config.transcribeMins ?? 120) / 60).toFixed(1)} hrs)
                </span>
                <span>6,000 mins</span>
              </div>
            </div>
          </div>

          {/* 5. Image Translations */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200/90 bg-white text-neutral-700 shadow-2xs dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-300">
                  <ImageIcon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
                    Image Translations
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    $0.12/image • High-res in-image translation
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-sans tabular-nums text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  +${formatUsd(breakdown.imagesCost)}/mo
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label="Image count"
                    value={imageInputStr}
                    onChange={(e) => handleImageInput(e.target.value)}
                    onBlur={handleImageBlur}
                    className="h-8 w-16 rounded-lg border border-neutral-200/90 bg-white px-2 text-center font-sans tabular-nums text-xs font-semibold text-neutral-950 shadow-2xs outline-none focus:border-neutral-400 dark:border-white/15 dark:bg-neutral-900 dark:text-white"
                  />
                  <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    imgs
                  </span>
                </div>
              </div>
            </div>

            <div>
              <input
                id={imageSliderId}
                type="range"
                min={ULTRA_LIMITS.images.min}
                max={ULTRA_LIMITS.images.max}
                step={ULTRA_LIMITS.images.sliderStep}
                aria-label="Image count slider"
                value={config.imageCount ?? 50}
                onChange={(e) => handleImageSlider(parseInt(e.target.value, 10))}
                className="clean-range h-1.5 w-full cursor-pointer accent-neutral-950 dark:accent-white"
              />
              <div className="mt-1 flex justify-between text-[11px] text-neutral-400 dark:text-neutral-500">
                <span>0 images</span>
                <span className="font-medium text-neutral-700 dark:text-neutral-300">
                  {(config.imageCount ?? 50).toLocaleString()} imgs
                </span>
                <span>1,000 images</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Clean Sticky Subscription Summary Card */}
        <div className="sticky top-20 rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-neutral-900/60">
          <p className="text-[11px] font-semibold tracking-wider uppercase text-neutral-400 dark:text-neutral-500">
            SUBSCRIPTION SUMMARY
          </p>

          {/* Hero Price */}
          <div className="mt-3 flex items-baseline">
            <span className="font-sans text-3xl sm:text-4xl font-bold tracking-tight text-neutral-950 dark:text-white">
              ${formatUsd(displayPrice)}
            </span>
            <span className="ml-1 text-base font-normal text-neutral-500 dark:text-neutral-400">
              /month
            </span>
          </div>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            {isYearly ? `Billed annually ($${formatUsd(breakdown.totalYearlyPrice)}/yr)` : "Monthly billing"}
          </p>

          {/* Line Items with leaders */}
          <div className="mt-5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-neutral-600 dark:text-neutral-300">Platform Base Fee</span>
              <div className="mx-2 flex-1 border-b border-dotted border-neutral-200 dark:border-white/10" />
              <span className="font-sans font-semibold text-neutral-950 dark:text-white">
                ${ULTRA_BASE_FEE.toFixed(2)}/mo
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-neutral-600 dark:text-neutral-300">
                Dubbing ({config.dubbingMins ?? 30}m)
              </span>
              <div className="mx-2 flex-1 border-b border-dotted border-neutral-200 dark:border-white/10" />
              <span className="font-sans font-medium text-neutral-900 dark:text-white">
                ${formatUsd(breakdown.dubbingCost)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-neutral-600 dark:text-neutral-300">
                Voice ({(((config.voiceCredits ?? 1200000)) / 1_000_000).toFixed(2)}M credits)
              </span>
              <div className="mx-2 flex-1 border-b border-dotted border-neutral-200 dark:border-white/10" />
              <span className="font-sans font-medium text-neutral-900 dark:text-white">
                ${formatUsd(breakdown.voiceCost)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-neutral-600 dark:text-neutral-300">
                Text ({(((config.textChars ?? 5000000)) / 1_000_000).toFixed(2)}M chars)
              </span>
              <div className="mx-2 flex-1 border-b border-dotted border-neutral-200 dark:border-white/10" />
              <span className="font-sans font-medium text-neutral-900 dark:text-white">
                ${formatUsd(breakdown.textCost)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-neutral-600 dark:text-neutral-300">
                Transcription ({config.transcribeMins ?? 120}m)
              </span>
              <div className="mx-2 flex-1 border-b border-dotted border-neutral-200 dark:border-white/10" />
              <span className="font-sans font-medium text-neutral-900 dark:text-white">
                ${formatUsd(breakdown.transcribeCost)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-neutral-600 dark:text-neutral-300">
                Image Translations ({config.imageCount ?? 50} imgs)
              </span>
              <div className="mx-2 flex-1 border-b border-dotted border-neutral-200 dark:border-white/10" />
              <span className="font-sans font-medium text-neutral-900 dark:text-white">
                ${formatUsd(breakdown.imagesCost)}
              </span>
            </div>
          </div>

          {/* Enterprise Wire / ACH Notice if >= $5,000/mo */}
          {breakdown.isEnterpriseInvoice && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
              <p className="font-semibold">Enterprise Wire Notice:</p>
              <p className="mt-0.5">
                Orders exceeding $5,000/month are processed via verified bank wire/ACH to prevent card processing delays and guarantee dedicated concurrency.
              </p>
            </div>
          )}

          {/* Primary Action Button matching image: "Continue to Checkout ↗" */}
          <div className="mt-5">
            {breakdown.isEnterpriseInvoice ? (
              <button
                type="button"
                onClick={() => onRequestInvoice?.(config, breakdown, billing)}
                className="pressable flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                <Building2 className="h-4 w-4" /> Request Enterprise Invoice / ACH Wire
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSubscribe?.(config, breakdown, billing)}
                className="pressable flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100"
              >
                <span>Continue to Checkout</span>
                <ArrowUpRight className="h-4 w-4" />
              </button>
            )}
          </div>

          <p className="mt-3 text-center text-xs text-neutral-400 dark:text-neutral-500">
            Instant activation • No hidden fees
          </p>
        </div>
      </div>
    </div>
  );
}
