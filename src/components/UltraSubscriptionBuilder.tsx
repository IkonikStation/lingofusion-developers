import {
  Building2,
  Check,
  CreditCard,
  FileAudio,
  Film,
  ImageIcon,
  MessageSquare,
  RotateCcw,
  Sparkles,
  Volume2,
  Zap,
} from "lucide-react";
import { useId, useMemo, useState } from "react";
import type { BillingInterval } from "../data/subscriptions";
import {
  ULTRA_BASE_FEE,
  ULTRA_DEFAULTS,
  ULTRA_ENTERPRISE_THRESHOLD,
  ULTRA_LIMITS,
  ULTRA_RATES,
  ULTRA_YEARLY_DISCOUNT_PERCENT,
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
  isStandalone?: boolean;
}

export function UltraSubscriptionBuilder({
  initialConfig,
  initialBilling = "monthly",
  onSubscribe,
  onRequestInvoice,
  className = "",
  isStandalone = false,
}: UltraSubscriptionBuilderProps) {
  const [billing, setBilling] = useState<BillingInterval>(initialBilling);
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

  // String buffers for numeric text inputs to support smooth natural typing
  const [dubbingInputStr, setDubbingInputStr] = useState<string>(() => String(config.dubbingMins ?? ULTRA_DEFAULTS.dubbingMins));
  const [voiceInputStr, setVoiceInputStr] = useState<string>(() => String(config.voiceCredits ?? ULTRA_DEFAULTS.voiceCredits));
  const [textInputStr, setTextInputStr] = useState<string>(() => String(config.textChars ?? ULTRA_DEFAULTS.textChars));
  const [transcribeInputStr, setTranscribeInputStr] = useState<string>(() => String(config.transcribeMins ?? ULTRA_DEFAULTS.transcribeMins));
  const [imageInputStr, setImageInputStr] = useState<string>(() => String(config.imageCount ?? ULTRA_DEFAULTS.imageCount));

  const breakdown = useMemo(() => calculateUltraPrice(config), [config]);

  // Unique IDs for accessibility
  const dubbingSliderId = useId();
  const voiceSliderId = useId();
  const textSliderId = useId();
  const transcribeSliderId = useId();
  const imageSliderId = useId();

  // Handlers for Dubbing (Piecewise Non-linear Slider)
  const handleDubbingSlider = (pct: number) => {
    const mins = sliderToDubbingMinutes(pct);
    setConfig((prev) => ({ ...prev, dubbingMins: mins }));
    setDubbingInputStr(String(mins));
  };

  const handleDubbingInput = (valueStr: string) => {
    setDubbingInputStr(valueStr);
    const num = parseInt(valueStr.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(num)) {
      const clamped = clampResource(num, ULTRA_LIMITS.dubbing.min, ULTRA_LIMITS.dubbing.max);
      setConfig((prev) => ({ ...prev, dubbingMins: clamped }));
    }
  };

  const handleDubbingBlur = () => {
    const num = parseInt(dubbingInputStr.replace(/[^0-9]/g, ""), 10);
    const clamped = clampResource(isNaN(num) ? ULTRA_LIMITS.dubbing.default : num, ULTRA_LIMITS.dubbing.min, ULTRA_LIMITS.dubbing.max);
    setConfig((prev) => ({ ...prev, dubbingMins: clamped }));
    setDubbingInputStr(String(clamped));
  };

  // Handlers for Voice Synthesis
  const handleVoiceSlider = (val: number) => {
    setConfig((prev) => ({ ...prev, voiceCredits: val }));
    setVoiceInputStr(String(val));
  };

  const handleVoiceInput = (valueStr: string) => {
    setVoiceInputStr(valueStr);
    const num = parseInt(valueStr.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(num)) {
      const clamped = clampResource(num, ULTRA_LIMITS.voice.min, ULTRA_LIMITS.voice.max);
      setConfig((prev) => ({ ...prev, voiceCredits: clamped }));
    }
  };

  const handleVoiceBlur = () => {
    const num = parseInt(voiceInputStr.replace(/[^0-9]/g, ""), 10);
    const clamped = clampResource(isNaN(num) ? ULTRA_LIMITS.voice.default : num, ULTRA_LIMITS.voice.min, ULTRA_LIMITS.voice.max);
    setConfig((prev) => ({ ...prev, voiceCredits: clamped }));
    setVoiceInputStr(String(clamped));
  };

  // Handlers for Text Translation
  const handleTextSlider = (val: number) => {
    setConfig((prev) => ({ ...prev, textChars: val }));
    setTextInputStr(String(val));
  };

  const handleTextInput = (valueStr: string) => {
    setTextInputStr(valueStr);
    const num = parseInt(valueStr.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(num)) {
      const clamped = clampResource(num, ULTRA_LIMITS.text.min, ULTRA_LIMITS.text.max);
      setConfig((prev) => ({ ...prev, textChars: clamped }));
    }
  };

  const handleTextBlur = () => {
    const num = parseInt(textInputStr.replace(/[^0-9]/g, ""), 10);
    const clamped = clampResource(isNaN(num) ? ULTRA_LIMITS.text.default : num, ULTRA_LIMITS.text.min, ULTRA_LIMITS.text.max);
    setConfig((prev) => ({ ...prev, textChars: clamped }));
    setTextInputStr(String(clamped));
  };

  // Handlers for Audio Transcription
  const handleTranscribeSlider = (val: number) => {
    setConfig((prev) => ({ ...prev, transcribeMins: val }));
    setTranscribeInputStr(String(val));
  };

  const handleTranscribeInput = (valueStr: string) => {
    setTranscribeInputStr(valueStr);
    const num = parseInt(valueStr.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(num)) {
      const clamped = clampResource(num, ULTRA_LIMITS.transcribe.min, ULTRA_LIMITS.transcribe.max);
      setConfig((prev) => ({ ...prev, transcribeMins: clamped }));
    }
  };

  const handleTranscribeBlur = () => {
    const num = parseInt(transcribeInputStr.replace(/[^0-9]/g, ""), 10);
    const clamped = clampResource(isNaN(num) ? ULTRA_LIMITS.transcribe.default : num, ULTRA_LIMITS.transcribe.min, ULTRA_LIMITS.transcribe.max);
    setConfig((prev) => ({ ...prev, transcribeMins: clamped }));
    setTranscribeInputStr(String(clamped));
  };

  // Handlers for AI Images
  const handleImageSlider = (val: number) => {
    setConfig((prev) => ({ ...prev, imageCount: val }));
    setImageInputStr(String(val));
  };

  const handleImageInput = (valueStr: string) => {
    setImageInputStr(valueStr);
    const num = parseInt(valueStr.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(num)) {
      const clamped = clampResource(num, ULTRA_LIMITS.images.min, ULTRA_LIMITS.images.max);
      setConfig((prev) => ({ ...prev, imageCount: clamped }));
    }
  };

  const handleImageBlur = () => {
    const num = parseInt(imageInputStr.replace(/[^0-9]/g, ""), 10);
    const clamped = clampResource(isNaN(num) ? ULTRA_LIMITS.images.default : num, ULTRA_LIMITS.images.min, ULTRA_LIMITS.images.max);
    setConfig((prev) => ({ ...prev, imageCount: clamped }));
    setImageInputStr(String(clamped));
  };

  // Presets
  const applyPreset = (preset: UltraResourceConfig) => {
    setConfig(preset);
    setDubbingInputStr(String(preset.dubbingMins));
    setVoiceInputStr(String(preset.voiceCredits));
    setTextInputStr(String(preset.textChars));
    setTranscribeInputStr(String(preset.transcribeMins));
    setImageInputStr(String(preset.imageCount));
  };

  const isYearly = billing === "yearly";
  const displayPrice = isYearly ? breakdown.effectiveMonthlyPriceYearly : breakdown.totalMonthlyPrice;

  return (
    <div className={`overflow-hidden rounded-3xl border border-neutral-200/90 bg-white shadow-xl dark:border-white/10 dark:bg-neutral-900 ${className}`}>
      {/* Header Bar: Minimal, Clean, with Segmented Billing Toggle */}
      <div className="border-b border-neutral-200/80 bg-neutral-50/50 px-6 py-5 dark:border-white/10 dark:bg-neutral-900/60 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
                <Sparkles className="h-3 w-3" /> Custom Quota Builder
              </span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Overages gracefully fall back to prepaid balance
              </span>
            </div>
            <h2 className="mt-1.5 text-xl font-bold tracking-tight text-neutral-950 dark:text-white sm:text-2xl">
              Configure your exact monthly Ultra quotas.
            </h2>
          </div>

          {/* Billing Interval Toggle: Monthly vs Yearly (Save 15%) */}
          <div className="flex items-center self-start rounded-xl border border-neutral-200 bg-neutral-100/80 p-1 dark:border-white/10 dark:bg-neutral-800/80 sm:self-auto">
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
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
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                isYearly
                  ? "bg-white text-neutral-950 shadow-xs dark:bg-neutral-900 dark:text-white"
                  : "text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
              }`}
            >
              <span>Yearly</span>
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                Save 15%
              </span>
            </button>
          </div>
        </div>

        {/* Quick Presets Bar */}
        <div className="mt-4 flex flex-wrap items-center gap-2 pt-2 border-t border-neutral-200/50 dark:border-white/5">
          <span className="text-xs font-medium text-neutral-400">Presets:</span>
          <button
            type="button"
            onClick={() => applyPreset(ULTRA_DEFAULTS)}
            className="pressable rounded-lg border border-neutral-200/80 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
          >
            Default Bundle (${isYearly ? "217.63" : "256"}/mo)
          </button>
          <button
            type="button"
            onClick={() =>
              applyPreset({
                dubbingMins: 120,
                voiceCredits: 3_000_000,
                textChars: 8_000_000,
                transcribeMins: 600,
                imageCount: 150,
              })
            }
            className="pressable rounded-lg border border-neutral-200/80 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
          >
            Studio Pro
          </button>
          <button
            type="button"
            onClick={() =>
              applyPreset({
                dubbingMins: 1_200,
                voiceCredits: 10_000_000,
                textChars: 10_000_000,
                transcribeMins: 3_000,
                imageCount: 500,
              })
            }
            className="pressable rounded-lg border border-neutral-200/80 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
          >
            Enterprise Scale
          </button>
        </div>
      </div>

      {/* Main Grid: Clean Controls Left + Sticky Live Counter Right */}
      <div className="grid gap-6 p-6 lg:grid-cols-[1.55fr_1fr] sm:p-8">
        {/* Left Column: 5 Super Simple Resource Cards */}
        <div className="space-y-4">
          {/* 1. Video Dubbing */}
          <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/40 p-4 transition hover:border-neutral-300 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300">
                  <Film className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
                    {ULTRA_LIMITS.dubbing.label}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    ${ULTRA_RATES.dubbingPerMin.toFixed(2)}/min • {ULTRA_LIMITS.dubbing.capabilityNote}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-sans tabular-nums text-xs font-semibold text-purple-700 dark:text-purple-300">
                  +${formatUsd(breakdown.dubbingCost)}/mo
                </span>
                <div className="flex items-center rounded-xl border border-neutral-200 bg-white px-2.5 py-1 shadow-2xs dark:border-white/15 dark:bg-neutral-900">
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label="Video dubbing minutes"
                    value={dubbingInputStr}
                    onChange={(e) => handleDubbingInput(e.target.value)}
                    onBlur={handleDubbingBlur}
                    className="w-16 border-none bg-transparent font-sans tabular-nums text-sm font-bold text-neutral-950 outline-none dark:text-white"
                  />
                  <span className="text-xs text-neutral-400">mins</span>
                </div>
              </div>
            </div>

            <div className="mt-3.5">
              <input
                id={dubbingSliderId}
                type="range"
                min="0"
                max="100"
                step="0.1"
                aria-label="Video dubbing minutes slider"
                value={dubbingMinutesToSlider(config.dubbingMins)}
                onChange={(e) => handleDubbingSlider(parseFloat(e.target.value))}
                className="clean-range h-2 w-full cursor-pointer accent-neutral-950 dark:accent-white"
              />
              <div className="mt-1 flex justify-between text-[11px] text-neutral-400">
                <span>0 mins</span>
                <span className="font-semibold text-neutral-700 dark:text-neutral-200">
                  {config.dubbingMins.toLocaleString()} mins ({(config.dubbingMins / 60).toFixed(1)} hrs)
                </span>
                <span>60,000 mins</span>
              </div>
            </div>
          </div>

          {/* 2. Voice Synthesis */}
          <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/40 p-4 transition hover:border-neutral-300 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                  <Volume2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
                    {ULTRA_LIMITS.voice.label}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    $70.00 / 1M credits • {ULTRA_LIMITS.voice.capabilityNote}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-sans tabular-nums text-xs font-semibold text-blue-700 dark:text-blue-300">
                  +${formatUsd(breakdown.voiceCost)}/mo
                </span>
                <div className="flex items-center rounded-xl border border-neutral-200 bg-white px-2.5 py-1 shadow-2xs dark:border-white/15 dark:bg-neutral-900">
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label="Voice synthesis credits"
                    value={voiceInputStr}
                    onChange={(e) => handleVoiceInput(e.target.value)}
                    onBlur={handleVoiceBlur}
                    className="w-24 border-none bg-transparent font-sans tabular-nums text-sm font-bold text-neutral-950 outline-none dark:text-white"
                  />
                  <span className="text-xs text-neutral-400">credits</span>
                </div>
              </div>
            </div>

            <div className="mt-3.5">
              <input
                id={voiceSliderId}
                type="range"
                min={ULTRA_LIMITS.voice.min}
                max={ULTRA_LIMITS.voice.max}
                step={ULTRA_LIMITS.voice.sliderStep}
                aria-label="Voice synthesis credits slider"
                value={config.voiceCredits}
                onChange={(e) => handleVoiceSlider(parseInt(e.target.value, 10))}
                className="clean-range h-2 w-full cursor-pointer accent-neutral-950 dark:accent-white"
              />
              <div className="mt-1 flex justify-between text-[11px] text-neutral-400">
                <span>0 credits</span>
                <span className="font-semibold text-neutral-700 dark:text-neutral-200">
                  {config.voiceCredits.toLocaleString()} credits ({(config.voiceCredits / 1_000_000).toFixed(2)}M)
                </span>
                <span>10,000,000</span>
              </div>
            </div>
          </div>

          {/* 3. Text Translation */}
          <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/40 p-4 transition hover:border-neutral-300 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
                    {ULTRA_LIMITS.text.label}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    $6.00 / 1M chars • {ULTRA_LIMITS.text.capabilityNote}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-sans tabular-nums text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  +${formatUsd(breakdown.textCost)}/mo
                </span>
                <div className="flex items-center rounded-xl border border-neutral-200 bg-white px-2.5 py-1 shadow-2xs dark:border-white/15 dark:bg-neutral-900">
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label="Text translation characters"
                    value={textInputStr}
                    onChange={(e) => handleTextInput(e.target.value)}
                    onBlur={handleTextBlur}
                    className="w-24 border-none bg-transparent font-sans tabular-nums text-sm font-bold text-neutral-950 outline-none dark:text-white"
                  />
                  <span className="text-xs text-neutral-400">chars</span>
                </div>
              </div>
            </div>

            <div className="mt-3.5">
              <input
                id={textSliderId}
                type="range"
                min={ULTRA_LIMITS.text.min}
                max={ULTRA_LIMITS.text.max}
                step={ULTRA_LIMITS.text.sliderStep}
                aria-label="Text translation characters slider"
                value={config.textChars}
                onChange={(e) => handleTextSlider(parseInt(e.target.value, 10))}
                className="clean-range h-2 w-full cursor-pointer accent-neutral-950 dark:accent-white"
              />
              <div className="mt-1 flex justify-between text-[11px] text-neutral-400">
                <span>0 chars</span>
                <span className="font-semibold text-neutral-700 dark:text-neutral-200">
                  {config.textChars.toLocaleString()} chars ({(config.textChars / 1_000_000).toFixed(2)}M)
                </span>
                <span>10,000,000</span>
              </div>
            </div>
          </div>

          {/* 4. Audio Transcription */}
          <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/40 p-4 transition hover:border-neutral-300 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                  <FileAudio className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
                    {ULTRA_LIMITS.transcribe.label}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    $0.017/min ($1.02/hr) • {ULTRA_LIMITS.transcribe.capabilityNote}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-sans tabular-nums text-xs font-semibold text-amber-700 dark:text-amber-300">
                  +${formatUsd(breakdown.transcribeCost)}/mo
                </span>
                <div className="flex items-center rounded-xl border border-neutral-200 bg-white px-2.5 py-1 shadow-2xs dark:border-white/15 dark:bg-neutral-900">
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label="Audio transcription minutes"
                    value={transcribeInputStr}
                    onChange={(e) => handleTranscribeInput(e.target.value)}
                    onBlur={handleTranscribeBlur}
                    className="w-16 border-none bg-transparent font-sans tabular-nums text-sm font-bold text-neutral-950 outline-none dark:text-white"
                  />
                  <span className="text-xs text-neutral-400">mins</span>
                </div>
              </div>
            </div>

            <div className="mt-3.5">
              <input
                id={transcribeSliderId}
                type="range"
                min={ULTRA_LIMITS.transcribe.min}
                max={ULTRA_LIMITS.transcribe.max}
                step={ULTRA_LIMITS.transcribe.sliderStep}
                aria-label="Audio transcription minutes slider"
                value={config.transcribeMins}
                onChange={(e) => handleTranscribeSlider(parseInt(e.target.value, 10))}
                className="clean-range h-2 w-full cursor-pointer accent-neutral-950 dark:accent-white"
              />
              <div className="mt-1 flex justify-between text-[11px] text-neutral-400">
                <span>0 mins</span>
                <span className="font-semibold text-neutral-700 dark:text-neutral-200">
                  {config.transcribeMins.toLocaleString()} mins ({(config.transcribeMins / 60).toFixed(1)} hrs)
                </span>
                <span>6,000 mins</span>
              </div>
            </div>
          </div>

          {/* 5. AI Images */}
          <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/40 p-4 transition hover:border-neutral-300 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300">
                  <ImageIcon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
                    {ULTRA_LIMITS.images.label}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    $0.12/image • {ULTRA_LIMITS.images.capabilityNote}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-sans tabular-nums text-xs font-semibold text-pink-700 dark:text-pink-300">
                  +${formatUsd(breakdown.imagesCost)}/mo
                </span>
                <div className="flex items-center rounded-xl border border-neutral-200 bg-white px-2.5 py-1 shadow-2xs dark:border-white/15 dark:bg-neutral-900">
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label="AI image count"
                    value={imageInputStr}
                    onChange={(e) => handleImageInput(e.target.value)}
                    onBlur={handleImageBlur}
                    className="w-16 border-none bg-transparent font-sans tabular-nums text-sm font-bold text-neutral-950 outline-none dark:text-white"
                  />
                  <span className="text-xs text-neutral-400">imgs</span>
                </div>
              </div>
            </div>

            <div className="mt-3.5">
              <input
                id={imageSliderId}
                type="range"
                min={ULTRA_LIMITS.images.min}
                max={ULTRA_LIMITS.images.max}
                step={ULTRA_LIMITS.images.sliderStep}
                aria-label="AI images slider"
                value={config.imageCount}
                onChange={(e) => handleImageSlider(parseInt(e.target.value, 10))}
                className="clean-range h-2 w-full cursor-pointer accent-neutral-950 dark:accent-white"
              />
              <div className="mt-1 flex justify-between text-[11px] text-neutral-400">
                <span>0 images</span>
                <span className="font-semibold text-neutral-700 dark:text-neutral-200">
                  {config.imageCount.toLocaleString()} images
                </span>
                <span>1,000 images</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Minimal Sticky Live Price Card */}
        <div className="lg:pl-2">
          <div className="sticky top-24 overflow-hidden rounded-2xl border border-neutral-200/90 bg-neutral-50/70 p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Subscription Summary
              </span>
              <button
                type="button"
                onClick={() => applyPreset(ULTRA_DEFAULTS)}
                className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
            </div>

            {/* Price Hero */}
            <div className="mt-4">
              <div className="flex items-baseline gap-1.5">
                <span className="font-sans text-4xl font-extrabold tracking-tight text-neutral-950 dark:text-white">
                  ${formatUsd(displayPrice)}
                </span>
                <span className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">
                  / month
                </span>
              </div>

              {isYearly ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    Billed annually (${formatUsd(breakdown.totalYearlyPrice)}/yr)
                  </span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                    Save ${formatUsd(breakdown.yearlySavings)}/yr
                  </span>
                </div>
              ) : (
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  Monthly billing • Switch to yearly to save 15%
                </p>
              )}
            </div>

            {/* Streamlined Line Items */}
            <div className="mt-6 space-y-2 border-t border-neutral-200/80 pt-4 text-xs dark:border-white/10">
              <div className="flex justify-between text-neutral-600 dark:text-neutral-300">
                <span className="flex items-center gap-1.5 font-medium">
                  <Zap className="h-3.5 w-3.5 text-blue-500" /> Platform Base Fee
                </span>
                <span className="font-sans tabular-nums font-semibold text-neutral-950 dark:text-white">
                  ${ULTRA_BASE_FEE.toFixed(2)}/mo
                </span>
              </div>
              <div className="flex justify-between text-neutral-600 dark:text-neutral-300">
                <span>Video Dubbing ({config.dubbingMins.toLocaleString()}m)</span>
                <span className="font-sans tabular-nums text-neutral-900 dark:text-white">
                  ${formatUsd(breakdown.dubbingCost)}
                </span>
              </div>
              <div className="flex justify-between text-neutral-600 dark:text-neutral-300">
                <span>Voice ({(config.voiceCredits / 1_000_000).toFixed(2)}M credits)</span>
                <span className="font-sans tabular-nums text-neutral-900 dark:text-white">
                  ${formatUsd(breakdown.voiceCost)}
                </span>
              </div>
              <div className="flex justify-between text-neutral-600 dark:text-neutral-300">
                <span>Text ({(config.textChars / 1_000_000).toFixed(2)}M chars)</span>
                <span className="font-sans tabular-nums text-neutral-900 dark:text-white">
                  ${formatUsd(breakdown.textCost)}
                </span>
              </div>
              <div className="flex justify-between text-neutral-600 dark:text-neutral-300">
                <span>Transcription ({config.transcribeMins.toLocaleString()}m)</span>
                <span className="font-sans tabular-nums text-neutral-900 dark:text-white">
                  ${formatUsd(breakdown.transcribeCost)}
                </span>
              </div>
              <div className="flex justify-between text-neutral-600 dark:text-neutral-300">
                <span>AI Images ({config.imageCount} imgs)</span>
                <span className="font-sans tabular-nums text-neutral-900 dark:text-white">
                  ${formatUsd(breakdown.imagesCost)}
                </span>
              </div>
            </div>

            {/* Enterprise Wire / ACH Notice if >= $5,000/mo */}
            {breakdown.isEnterpriseInvoice && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                <p className="font-semibold">Enterprise Wire Notice:</p>
                <p className="mt-1">
                  Orders exceeding $5,000/month are processed via verified bank wire/ACH to prevent card processing delays and guarantee dedicated concurrency.
                </p>
              </div>
            )}

            {/* Primary Action Button ($5,000 Rule) */}
            <div className="mt-6">
              {breakdown.isEnterpriseInvoice ? (
                <button
                  type="button"
                  onClick={() => onRequestInvoice?.(config, breakdown, billing)}
                  className="pressable inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                  <Building2 className="h-4 w-4" /> Request Enterprise Invoice / ACH Wire
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onSubscribe?.(config, breakdown, billing)}
                  className="pressable inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100"
                >
                  <CreditCard className="h-4 w-4" /> Subscribe with Card / Apple Pay
                </button>
              )}
            </div>

            <p className="mt-3 text-center text-[11px] text-neutral-400">
              Instant activation • No hidden fees • Modify anytime
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
