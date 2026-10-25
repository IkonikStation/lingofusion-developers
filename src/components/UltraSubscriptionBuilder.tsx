import {
  Building2,
  Check,
  CreditCard,
  FileAudio,
  Film,
  HelpCircle,
  ImageIcon,
  MessageSquare,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Volume2,
  Zap,
} from "lucide-react";
import { useId, useMemo, useState } from "react";
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

interface UltraSubscriptionBuilderProps {
  initialConfig?: Partial<UltraResourceConfig>;
  onSubscribe?: (config: UltraResourceConfig, breakdown: UltraPriceBreakdown) => void;
  onRequestInvoice?: (config: UltraResourceConfig, breakdown: UltraPriceBreakdown) => void;
  className?: string;
}

export function UltraSubscriptionBuilder({
  initialConfig,
  onSubscribe,
  onRequestInvoice,
  className = "",
}: UltraSubscriptionBuilderProps) {
  const [config, setConfig] = useState<UltraResourceConfig>(() => ({
    ...ULTRA_DEFAULTS,
    ...initialConfig,
  }));

  // String buffers for numeric text inputs to support smooth natural typing
  const [dubbingInputStr, setDubbingInputStr] = useState<string>(String(config.dubbingMins));
  const [voiceInputStr, setVoiceInputStr] = useState<string>(String(config.voiceCredits));
  const [textInputStr, setTextInputStr] = useState<string>(String(config.textChars));
  const [transcribeInputStr, setTranscribeInputStr] = useState<string>(String(config.transcribeMins));
  const [imageInputStr, setImageInputStr] = useState<string>(String(config.imageCount));

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

  // Handlers for Voice Credits
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

  // Handlers for Text Chars
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

  // Reset to default configuration
  const handleReset = () => {
    setConfig(ULTRA_DEFAULTS);
    setDubbingInputStr(String(ULTRA_DEFAULTS.dubbingMins));
    setVoiceInputStr(String(ULTRA_DEFAULTS.voiceCredits));
    setTextInputStr(String(ULTRA_DEFAULTS.textChars));
    setTranscribeInputStr(String(ULTRA_DEFAULTS.transcribeMins));
    setImageInputStr(String(ULTRA_DEFAULTS.imageCount));
  };

  // Presets for fast exploration
  const applyPreset = (preset: UltraResourceConfig) => {
    setConfig(preset);
    setDubbingInputStr(String(preset.dubbingMins));
    setVoiceInputStr(String(preset.voiceCredits));
    setTextInputStr(String(preset.textChars));
    setTranscribeInputStr(String(preset.transcribeMins));
    setImageInputStr(String(preset.imageCount));
  };

  return (
    <div className={`overflow-hidden rounded-3xl border border-neutral-200/90 bg-white shadow-xl dark:border-white/10 dark:bg-neutral-900 ${className}`}>
      {/* Header Banner */}
      <div className="border-b border-neutral-200/80 bg-linear-to-r from-neutral-50 via-white to-blue-50/40 px-6 py-6 dark:border-white/10 dark:from-neutral-900 dark:via-neutral-900 dark:to-blue-950/20 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-blue-50/80 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
              <Sparkles className="h-3.5 w-3.5" /> Custom Ultra Tier Builder
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">
              Configure your exact monthly Ultra quotas.
            </h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              Scale each resource dynamically with synchronized controls. Automatic overage falls back to your prepaid wallet.
            </p>
          </div>

          {/* Quick Presets Pill Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Presets:</span>
            <button
              type="button"
              onClick={() => applyPreset(ULTRA_DEFAULTS)}
              className="pressable rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 shadow-2xs hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
            >
              Default ($256/mo)
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
              className="pressable rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 shadow-2xs hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
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
              className="pressable rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 shadow-2xs hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
            >
              Enterprise Scale
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Controls Left + Sticky Live Counter Card Right */}
      <div className="grid gap-8 p-6 lg:grid-cols-[1.5fr_1fr] sm:p-8">
        {/* Left Column: 5 Resource Configuration Rows */}
        <div className="space-y-6">
          {/* 1. Video Dubbing */}
          <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/40 p-4 transition-colors hover:border-neutral-300 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300">
                  <Film className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-950 dark:text-white">
                    {ULTRA_LIMITS.dubbing.label}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    ${ULTRA_RATES.dubbingPerMin.toFixed(2)} / min ($210.00 / hr) • {ULTRA_LIMITS.dubbing.capabilityNote}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-sans tabular-nums text-xs font-bold text-purple-700 dark:text-purple-300">
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
                  <span className="text-xs font-semibold text-neutral-400">mins</span>
                </div>
              </div>
            </div>

            <div className="mt-4">
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
              <div className="mt-1.5 flex justify-between text-[11px] font-medium text-neutral-400">
                <span>0 mins</span>
                <span className="font-semibold text-neutral-600 dark:text-neutral-300">
                  {config.dubbingMins.toLocaleString()} mins ({(config.dubbingMins / 60).toFixed(1)} hrs)
                </span>
                <span>60,000 mins (1,000 hrs)</span>
              </div>
            </div>
          </div>

          {/* 2. Voice Synthesis */}
          <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/40 p-4 transition-colors hover:border-neutral-300 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                  <Volume2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-950 dark:text-white">
                    {ULTRA_LIMITS.voice.label}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    $70.00 / 1M credits • 1 char = 1 credit on Turbo, 2 on Standard
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-sans tabular-nums text-xs font-bold text-blue-700 dark:text-blue-300">
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
                  <span className="text-xs font-semibold text-neutral-400">credits</span>
                </div>
              </div>
            </div>

            <div className="mt-4">
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
              <div className="mt-1.5 flex justify-between text-[11px] font-medium text-neutral-400">
                <span>0 credits</span>
                <span className="font-semibold text-neutral-600 dark:text-neutral-300">
                  {config.voiceCredits.toLocaleString()} credits ({(config.voiceCredits / 1_000_000).toFixed(2)}M)
                </span>
                <span>10,000,000 credits</span>
              </div>
            </div>
          </div>

          {/* 3. Text Translation */}
          <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/40 p-4 transition-colors hover:border-neutral-300 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-950 dark:text-white">
                    {ULTRA_LIMITS.text.label}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    $6.00 / 1M characters • {ULTRA_LIMITS.text.capabilityNote}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-sans tabular-nums text-xs font-bold text-emerald-700 dark:text-emerald-300">
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
                  <span className="text-xs font-semibold text-neutral-400">chars</span>
                </div>
              </div>
            </div>

            <div className="mt-4">
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
              <div className="mt-1.5 flex justify-between text-[11px] font-medium text-neutral-400">
                <span>0 chars</span>
                <span className="font-semibold text-neutral-600 dark:text-neutral-300">
                  {config.textChars.toLocaleString()} chars ({(config.textChars / 1_000_000).toFixed(2)}M)
                </span>
                <span>10,000,000 chars</span>
              </div>
            </div>
          </div>

          {/* 4. Audio Transcription */}
          <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/40 p-4 transition-colors hover:border-neutral-300 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                  <FileAudio className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-950 dark:text-white">
                    {ULTRA_LIMITS.transcribe.label}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    $0.017 / min ($1.02 / hr) • {ULTRA_LIMITS.transcribe.capabilityNote}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-sans tabular-nums text-xs font-bold text-amber-700 dark:text-amber-300">
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
                  <span className="text-xs font-semibold text-neutral-400">mins</span>
                </div>
              </div>
            </div>

            <div className="mt-4">
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
              <div className="mt-1.5 flex justify-between text-[11px] font-medium text-neutral-400">
                <span>0 mins</span>
                <span className="font-semibold text-neutral-600 dark:text-neutral-300">
                  {config.transcribeMins.toLocaleString()} mins ({(config.transcribeMins / 60).toFixed(1)} hrs)
                </span>
                <span>6,000 mins (100 hrs)</span>
              </div>
            </div>
          </div>

          {/* 5. AI Images */}
          <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/40 p-4 transition-colors hover:border-neutral-300 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300">
                  <ImageIcon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-950 dark:text-white">
                    {ULTRA_LIMITS.images.label}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    $0.12 / image ($6.00 / 50 images) • {ULTRA_LIMITS.images.capabilityNote}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-sans tabular-nums text-xs font-bold text-pink-700 dark:text-pink-300">
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
                  <span className="text-xs font-semibold text-neutral-400">imgs</span>
                </div>
              </div>
            </div>

            <div className="mt-4">
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
              <div className="mt-1.5 flex justify-between text-[11px] font-medium text-neutral-400">
                <span>0 images</span>
                <span className="font-semibold text-neutral-600 dark:text-neutral-300">
                  {config.imageCount.toLocaleString()} images
                </span>
                <span>1,000 images</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Sticky Live Counter Card */}
        <div>
          <div className="sticky top-6 rounded-2xl border border-neutral-200/90 bg-neutral-50/80 p-6 shadow-lg backdrop-blur-md dark:border-white/15 dark:bg-neutral-900/90">
            <div className="flex items-center justify-between border-b border-neutral-200/80 pb-4 dark:border-white/10">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Ultra Plan Summary
              </span>
              <button
                type="button"
                onClick={handleReset}
                title="Reset to default Ultra values"
                className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            </div>

            {/* Line Items */}
            <div className="mt-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-300">
                <span className="flex items-center gap-1.5 font-medium">
                  <Zap className="h-3.5 w-3.5 text-blue-500" /> Platform Base Fee
                </span>
                <span className="font-sans tabular-nums font-semibold text-neutral-950 dark:text-white">
                  ${ULTRA_BASE_FEE.toFixed(2)} USD
                </span>
              </div>
              <p className="-mt-1 pl-5 text-[10px] text-neutral-400">
                Platform sync, priority queue, full LingoFusion Ultra engine access
              </p>

              <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-300">
                <span>Video Dubbing ({config.dubbingMins.toLocaleString()} mins)</span>
                <span className="font-sans tabular-nums font-medium text-neutral-900 dark:text-white">
                  ${formatUsd(breakdown.dubbingCost)}
                </span>
              </div>

              <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-300">
                <span>Voice ({config.voiceCredits.toLocaleString()} credits)</span>
                <span className="font-sans tabular-nums font-medium text-neutral-900 dark:text-white">
                  ${formatUsd(breakdown.voiceCost)}
                </span>
              </div>

              <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-300">
                <span>Text ({config.textChars.toLocaleString()} chars)</span>
                <span className="font-sans tabular-nums font-medium text-neutral-900 dark:text-white">
                  ${formatUsd(breakdown.textCost)}
                </span>
              </div>

              <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-300">
                <span>Transcription ({config.transcribeMins.toLocaleString()} mins)</span>
                <span className="font-sans tabular-nums font-medium text-neutral-900 dark:text-white">
                  ${formatUsd(breakdown.transcribeCost)}
                </span>
              </div>

              <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-300">
                <span>AI Images ({config.imageCount.toLocaleString()} imgs)</span>
                <span className="font-sans tabular-nums font-medium text-neutral-900 dark:text-white">
                  ${formatUsd(breakdown.imagesCost)}
                </span>
              </div>
            </div>

            {/* Total Price Display */}
            <div className="mt-6 border-t border-neutral-200/90 pt-4 dark:border-white/10">
              <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                Total Monthly Subscription
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-sans text-3xl font-extrabold tracking-tight text-neutral-950 transition-all duration-200 dark:text-white sm:text-4xl">
                  ${formatUsd(breakdown.totalMonthlyPrice)}
                </span>
                <span className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">
                  USD / month
                </span>
              </div>
            </div>

            {/* Dynamic CTA ($5,000 Rule) */}
            <div className="mt-6">
              {breakdown.isEnterpriseInvoice ? (
                <div>
                  <button
                    type="button"
                    onClick={() => onRequestInvoice?.(config, breakdown)}
                    className="pressable inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-bold text-white shadow-md transition hover:bg-blue-700"
                  >
                    <Building2 className="h-4 w-4" />
                    Request Enterprise Invoice / ACH Wire
                  </button>
                  <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-[11px] leading-relaxed text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                    <span className="font-semibold">Notice:</span> Orders exceeding $5,000/month are processed via verified bank wire/ACH to prevent card processing delays and guarantee dedicated concurrency.
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onSubscribe?.(config, breakdown)}
                  className="pressable inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-6 text-sm font-bold text-white shadow-md transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                >
                  <CreditCard className="h-4 w-4" />
                  Subscribe with Card / Apple Pay
                </button>
              )}
            </div>

            {/* Guarantees */}
            <div className="mt-5 space-y-2 border-t border-neutral-200/80 pt-4 text-[11px] text-neutral-500 dark:border-white/10 dark:text-neutral-400">
              <div className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Automatic rollover overage via Pay-As-You-Go wallet</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Cancel, pause, or adjust quotas anytime</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-neutral-400" />
                <span>Encrypted 256-bit checkout powered by Stripe</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
