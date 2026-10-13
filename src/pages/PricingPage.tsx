import {
  ArrowRight,
  BadgeDollarSign,
  Calculator,
  ChevronRight,
  Cpu,
  FileText,
  Image as ImageIcon,
  Mic,
  Music,
  Play,
  Sparkles,
  Video,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { currencies, defaultCurrencyRates, formatCurrencyAmount } from "../data/currency";
import type { CurrencyCode } from "../data/currency";
import type { TranslationKey } from "../data/i18n";
import { nativeLocalModels } from "../data/nativeLocal";
import {
  dubbingModels,
  imageModels,
  modelDetails,
  musicModels,
  pdfModels,
  textModelPresentations,
  textModelsByPricingMode,
  transcriptionModels,
  ttsModels,
  webSearchPricing,
} from "../data/pricing";
import type { TextModel, TextPricingMode } from "../data/pricing";
import { PricingCard } from "../components/PricingCard";
import type { PricingLabels } from "../components/PricingCard";
import {
  ModelIcon,
  NumberField,
  ReadOnlyField,
  SectionCalculator,
  SelectField,
} from "../components/shared/FormFields";
import { minuteNotationToMinutes } from "../lib/utils";

const billingNotes = [
  { icon: FileText, key: "billingText" },
  { icon: Mic, key: "billingTts" },
  { icon: FileText, key: "billingTranscription" },
  { icon: Video, key: "billingDubbing" },
  { icon: Music, key: "billingMusic" },
  { icon: ImageIcon, key: "billingImage" },
  { icon: FileText, key: "billingPdf" },
] as const;

const showcaseItems = [
  {
    kind: "image",
    title: "Document translation",
    label: "Before and after",
    description: "Demonstrates LingoFusion translating a full document while preserving headings, lists, terminology, and tone.",
    src: "",
  },
  {
    kind: "video",
    title: "Live conversation",
    label: "Real-time demo",
    description: "Demonstrates LingoFusion Live Translate interpreting a conversation with low latency and natural turn-taking.",
    src: "",
  },
  {
    kind: "video",
    title: "Video dubbing",
    label: "Dubbing demo",
    description: "Demonstrates translated speech aligned to the original video with consistent voices and timing.",
    src: "",
  },
  {
    kind: "image",
    title: "PDF localization",
    label: "Layout preservation",
    description: "Demonstrates extracting and translating PDF content without losing the document's visual structure.",
    src: "",
  },
  {
    kind: "image",
    title: "Image translation",
    label: "Visual text replacement",
    description: "Demonstrates detecting text inside an image, translating it, and placing the result back into the design.",
    src: "",
  },
  {
    kind: "video",
    title: "LingoFusion Music generation",
    label: "Prompt to music",
    description: "Demonstrates LingoFusion Music turning a written creative direction into a complete, production-ready music sample.",
    src: "",
  },
] as const;

export function PricingPage({
  t,
  onDashboard,
  onOpenModel,
}: {
  t: (key: TranslationKey) => string;
  onDashboard: () => void;
  onOpenModel: (model: string) => void;
}) {
  const [currency, setCurrency] = useState<CurrencyCode>(() => {
    const storedCurrency = window.localStorage.getItem("lingofusion-pricing-currency");
    return currencies.some((item) => item.code === storedCurrency) ? (storedCurrency as CurrencyCode) : "USD";
  });
  const [currencyRates, setCurrencyRates] = useState(defaultCurrencyRates);
  const [ratesUnavailable, setRatesUnavailable] = useState(false);
  const [textPricingMode, setTextPricingMode] = useState<TextPricingMode>(() => {
    const storedMode = window.localStorage.getItem("lingofusion-text-pricing-mode");
    return storedMode === "ultrafast" ? "ultrafast" : storedMode === "fast" ? "fast" : storedMode === "batch" ? "batch" : "instant";
  });

  const [selectedModel, setSelectedModel] = useState("LingoFusion");
  const [inputTokens, setInputTokens] = useState(1_000_000);
  const [outputTokens, setOutputTokens] = useState(1_000_000);

  const ttsWordModels = ttsModels.filter((model) => model.pricingUnit === "per_word");
  const liveTranslateModel = ttsModels.find((model) => model.model === "LingoFusion Live Translate");
  const [selectedTtsModel, setSelectedTtsModel] = useState(ttsWordModels[0]?.model ?? "");
  const [ttsWords, setTtsWords] = useState(1000);
  const [liveTranslateMinutes, setLiveTranslateMinutes] = useState(1);
  const [selectedTranscriptionModel, setSelectedTranscriptionModel] = useState(transcriptionModels[0].model);
  const [transcriptionMinutes, setTranscriptionMinutes] = useState(1);
  const [selectedDubbingModel, setSelectedDubbingModel] = useState(dubbingModels[0].model);
  const [dubbingMinutes, setDubbingMinutes] = useState(1);
  const [selectedMusicModel, setSelectedMusicModel] = useState(musicModels[0].model);
  const [musicGenerations, setMusicGenerations] = useState(1);
  const [selectedImageSize, setSelectedImageSize] = useState(imageModels[0].size);
  const [imageInputTokens, setImageInputTokens] = useState(1_000_000);
  const [imageOutputTokens, setImageOutputTokens] = useState(1_000_000);
  const [selectedPdfModel, setSelectedPdfModel] = useState(pdfModels[0].model);
  const [pdfCount, setPdfCount] = useState(500);

  useEffect(() => {
    let cancelled = false;

    fetch("https://open.er-api.com/v6/latest/USD")
      .then((response) => {
        if (!response.ok) throw new Error("exchange_rates_unavailable");
        return response.json() as Promise<{ rates?: Record<string, number> }>;
      })
      .then((data) => {
        if (cancelled || !data.rates) return;
        const liveRates = data.rates;
        const nextRates = { ...defaultCurrencyRates };
        currencies.forEach((item) => {
          if (item.code !== "USD" && Number.isFinite(liveRates[item.code])) nextRates[item.code] = liveRates[item.code];
        });
        setCurrencyRates(nextRates);
        setRatesUnavailable(false);
      })
      .catch(() => {
        if (cancelled) return;
        setRatesUnavailable(true);
        setCurrency("USD");
        window.localStorage.setItem("lingofusion-pricing-currency", "USD");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const activeCurrency = currencyRates[currency] ? currency : "USD";
  const activeRate = currencyRates[activeCurrency];
  const currencyPresentationKey = `${activeCurrency}-${activeRate}`;
  const displayCurrency = (usdAmount: number, precise = false) => formatCurrencyAmount(usdAmount, activeCurrency, activeRate, precise);
  const displayPrice = (usdAmount: number | null, unit?: string) => {
    if (usdAmount === null) return "TBD";
    const suffix = unit === "per_word" ? "/word" : unit === "per_minute" ? "/min" : unit === "per_generation" ? " / gen" : unit === "per_500_extractions" ? " / 500 ex." : "";
    return `${displayCurrency(usdAmount, true)}${suffix}`;
  };

  const visibleTextModels = textModelsByPricingMode[textPricingMode].filter((model) => !model.local);
  const calculatorTextModels = textModelsByPricingMode[textPricingMode].filter((model) => !model.local);
  const selectedTextModel = calculatorTextModels.find((model) => model.model === selectedModel) ?? calculatorTextModels[0];
  const selectedTts = ttsWordModels.find((model) => model.model === selectedTtsModel) ?? ttsWordModels[0];
  const selectedTranscription = transcriptionModels.find((model) => model.model === selectedTranscriptionModel) ?? transcriptionModels[0];
  const selectedDubbing = dubbingModels.find((model) => model.model === selectedDubbingModel) ?? dubbingModels[0];
  const selectedMusic = musicModels.find((model) => model.model === selectedMusicModel) ?? musicModels[0];
  const selectedImage = imageModels.find((model) => model.size === selectedImageSize) ?? imageModels[0];
  const selectedPdf = pdfModels.find((model) => model.model === selectedPdfModel) ?? pdfModels[0];

  const textPricingDescription = textPricingMode === "fast"
    ? "Fast mode is priced at 1.5× Default for supported LingoFusion models."
    : textPricingMode === "ultrafast"
    ? "Ultrafast mode uses non-thinking processing for Pro and Ultra at 4× Default."
    : textPricingMode === "instant"
    ? "Real-time streaming processing with immediate results."
    : "Lower-cost asynchronous processing for bulk jobs up to 24h turnaround.";

  const pricingLabels: PricingLabels = {
    model: t("tableModel"),
    input: t("tableInput"),
    output: t("tableOutput"),
    price: t("tablePrice"),
    imageSize: t("tableImageSize"),
    recommended: t("recommended"),
  };

  const displayedTextModels = visibleTextModels.map((model) => ({
    ...model,
    input: model.local ? "Free" : displayCurrency(model.inputUsd, true),
    output: model.local ? "Free" : displayCurrency(model.outputUsd, true),
  }));
  const displayedCloudTextModels = displayedTextModels.filter((model) => !model.local);
  const displayedTtsModels = ttsModels.map((model) => ({ ...model, price: displayPrice(model.priceUsd, model.pricingUnit) }));
  const displayedTranscriptionModels = transcriptionModels.map((model) => ({ ...model, price: displayPrice(model.priceUsd, model.pricingUnit) }));
  const displayedDubbingModels = dubbingModels.map((model) => ({ ...model, price: displayPrice(model.priceUsd, model.pricingUnit) }));
  const displayedMusicModels = musicModels.map((model) => ({ ...model, price: displayPrice(model.priceUsd, model.pricingUnit) }));
  const displayedImageModels = imageModels.map((model) => ({
    ...model,
    input: displayCurrency(model.inputUsd, true),
    output: displayCurrency(model.outputUsd, true),
  }));
  const displayedPdfModels = pdfModels.map((model) => ({ ...model, price: displayPrice(model.priceUsd, model.pricingUnit) }));

  // Estimates
  const textEstimate = useMemo(() => {
    return (inputTokens / 1_000_000) * selectedTextModel.inputUsd + (outputTokens / 1_000_000) * selectedTextModel.outputUsd;
  }, [inputTokens, outputTokens, selectedTextModel]);

  const ttsEstimate = useMemo(() => {
    return !selectedTts || selectedTts.priceUsd === null ? null : ttsWords * selectedTts.priceUsd;
  }, [selectedTts, ttsWords]);

  const liveTranslateEstimate = useMemo(() => {
    return !liveTranslateModel || liveTranslateModel.priceUsd === null
      ? null
      : minuteNotationToMinutes(liveTranslateMinutes) * liveTranslateModel.priceUsd;
  }, [liveTranslateModel, liveTranslateMinutes]);

  const transcriptionEstimate = useMemo(() => {
    return selectedTranscription.priceUsd === null ? null : minuteNotationToMinutes(transcriptionMinutes) * selectedTranscription.priceUsd;
  }, [selectedTranscription, transcriptionMinutes]);

  const dubbingEstimate = useMemo(() => {
    return selectedDubbing.priceUsd === null ? null : minuteNotationToMinutes(dubbingMinutes) * selectedDubbing.priceUsd;
  }, [selectedDubbing, dubbingMinutes]);

  const musicEstimate = useMemo(() => {
    return selectedMusic.priceUsd === null ? null : musicGenerations * selectedMusic.priceUsd;
  }, [selectedMusic, musicGenerations]);

  const imageEstimate = useMemo(() => {
    return (imageInputTokens / 1_000_000) * selectedImage.inputUsd + (imageOutputTokens / 1_000_000) * selectedImage.outputUsd;
  }, [selectedImage, imageInputTokens, imageOutputTokens]);

  const pdfEstimate = useMemo(() => {
    if (selectedPdf.model === "PDF text extraction" && selectedPdf.priceUsd !== null) {
      return Math.ceil(pdfCount / 500) * selectedPdf.priceUsd;
    }
    return null;
  }, [selectedPdf, pdfCount]);

  return (
    <>
      {/* Hero Section */}
      <section className="site-reveal section-enter max-w-4xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200/80 bg-neutral-100/80 px-3 py-1 text-xs font-semibold text-neutral-800 shadow-xs dark:border-white/10 dark:bg-white/[0.06] dark:text-neutral-200">
          <BadgeDollarSign className="h-3.5 w-3.5 text-blue-500" />
          {t("lingoFusionApi")}
        </div>

        <h1 className="mt-4 text-4xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-6xl">
          {t("pricing")}
        </h1>
        <p className="mt-4 text-base leading-7 text-neutral-600 dark:text-neutral-300 sm:text-lg sm:leading-8">
          {t("pricingHero")}
        </p>

        {/* Currency and CTA controls */}
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">
            <span>Currency:</span>
            <select
              value={currency}
              onChange={(event) => {
                const nextCurrency = event.target.value as CurrencyCode;
                setCurrency(nextCurrency);
                window.localStorage.setItem("lingofusion-pricing-currency", nextCurrency);
              }}
              className="clean-select h-9 rounded-lg border border-neutral-300/80 bg-white px-2.5 text-xs font-medium text-neutral-900 outline-none transition focus:border-neutral-900 dark:border-white/15 dark:bg-white/5 dark:text-neutral-100"
              aria-label="Pricing display currency"
            >
              {currencies.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.flag} {item.code}
                </option>
              ))}
            </select>
          </label>

          {ratesUnavailable && (
            <span className="text-xs text-neutral-500" role="status">
              Live exchange rates temporarily cached in USD.
            </span>
          )}
        </div>

        <div className="mt-7 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onDashboard}
            className="pressable inline-flex min-h-11 items-center justify-center rounded-xl bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
          >
            {t("openDashboard")}
          </button>
          <a
            href="#text-models"
            className="pressable inline-flex min-h-11 items-center justify-center rounded-xl border border-neutral-200/90 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-800 shadow-xs transition hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
          >
            {t("comparePricing")}
          </a>
          <a
            href="#product-demos"
            className="pressable inline-flex min-h-11 items-center justify-center rounded-xl border border-neutral-200/90 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-800 shadow-xs transition hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
          >
            View Product Demos
          </a>
        </div>
      </section>

      {/* Main Content Stacks */}
      <div className="mt-12 space-y-12">
        <MediaShowcase />

        {/* Text Models */}
        <div id="text-models" className="site-reveal section-enter [--section-index:1]">
          <TextModelGallery
            models={visibleTextModels}
            pricingMode={textPricingMode}
            displayPrice={displayCurrency}
            onOpenModel={onOpenModel}
          />

          <SectionCalculator
            title={t("textCalculator")}
            estimateLabel={t("estimate")}
            estimate={selectedTextModel.local ? "Free - runs locally" : textEstimate === null ? "TBD" : displayCurrency(textEstimate, true)}
          >
            <SelectField label={t("model")} value={selectedTextModel.model} onChange={setSelectedModel}>
              {calculatorTextModels.map((model) => (
                <option key={model.model}>{model.model}</option>
              ))}
            </SelectField>
            <NumberField
              label={t("inputTokens")}
              min={0}
              max={Infinity}
              step={1000}
              value={inputTokens}
              onChange={setInputTokens}
            />
            <NumberField
              label={t("outputTokens")}
              min={0}
              max={Infinity}
              step={1000}
              value={outputTokens}
              onChange={setOutputTokens}
            />
          </SectionCalculator>

          <PricingCard
            key={`text-${textPricingMode}-${currencyPresentationKey}`}
            title={t("textModels")}
            unit={t("pricesPer1MTokens")}
            kind="text"
            rows={displayedCloudTextModels}
            labels={pricingLabels}
            headerAction={
              <div
                role="group"
                aria-label="Text model pricing mode"
                className="inline-flex rounded-xl border border-neutral-200/80 bg-neutral-100/60 p-1 dark:border-white/10 dark:bg-white/[0.05]"
              >
                {(["instant", "batch", "fast", "ultrafast"] as const).map((mode) => {
                  const selected = textPricingMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setTextPricingMode(mode);
                        if (mode === "fast") setSelectedModel("LingoFusion");
                        window.localStorage.setItem("lingofusion-text-pricing-mode", mode);
                      }}
                      className={`pressable rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        selected
                          ? "bg-white text-neutral-950 shadow-xs dark:bg-neutral-800 dark:text-white"
                          : "text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
                      }`}
                    >
                      {mode === "instant" ? "Default" : mode === "batch" ? "Batch" : mode === "fast" ? "Fast" : "Ultrafast"}
                    </button>
                  );
                })}
              </div>
            }
            headerNote={textPricingDescription}
          />
        </div>

        {/* Web Search Pricing */}
        <section className="site-reveal border-t border-neutral-200/80 pt-8 dark:border-white/[0.08]">
          <div className="mb-4">
            <h2 className="text-xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">Web Search Grounding</h2>
            <p className="mt-1 text-xs text-neutral-500">Per-request rates for verified live citation indexing.</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-xs dark:border-white/[0.08] dark:bg-neutral-900/60">
            <table className="mobile-record-table w-full text-left text-xs">
              <thead className="border-b border-neutral-200/80 bg-neutral-50/70 uppercase tracking-wider text-neutral-500 dark:border-white/[0.08] dark:bg-white/[0.02]">
                <tr><th className="px-5 py-3 font-semibold">Model</th><th className="px-5 py-3 font-semibold">Price per call</th></tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/80 dark:divide-white/[0.08]">
                {webSearchPricing.map(({ model, priceUsd }) => (
                  <tr key={model} className="hover:bg-neutral-50/60 dark:hover:bg-white/[0.02]">
                    <td className="px-5 py-3.5 font-semibold text-neutral-950 dark:text-neutral-50">{model}</td>
                    <td className="px-5 py-3.5 font-mono text-neutral-700 dark:text-neutral-300">${priceUsd.toString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* TTS Models */}
        <div id="tts-models" className="site-reveal section-enter [--section-index:2]">
          <SectionCalculator
            title={t("ttsCalculator")}
            estimateLabel={t("estimate")}
            estimate={ttsEstimate === null ? "TBD" : displayCurrency(ttsEstimate, true)}
          >
            <SelectField label={t("model")} value={selectedTtsModel} onChange={setSelectedTtsModel}>
              {ttsWordModels.map((model) => (
                <option key={model.model}>{model.model}</option>
              ))}
            </SelectField>
            <NumberField
              label={t("words")}
              min={0}
              max={Infinity}
              step={100}
              value={ttsWords}
              onChange={setTtsWords}
            />
          </SectionCalculator>

          {liveTranslateModel && (
            <SectionCalculator
              title={t("liveTranslateCalculator")}
              estimateLabel={t("estimate")}
              estimate={liveTranslateEstimate === null ? "TBD" : displayCurrency(liveTranslateEstimate, true)}
            >
              <ReadOnlyField label={t("model")} value={liveTranslateModel.model} />
              <NumberField
                label={t("minutes")}
                min={0}
                max={Infinity}
                step={0.01}
                value={liveTranslateMinutes}
                onChange={setLiveTranslateMinutes}
                minuteNotation
                minuteHelp={t("minuteHelp")}
              />
            </SectionCalculator>
          )}

          <PricingCard
            key={`tts-${currencyPresentationKey}`}
            title={t("ttsModels")}
            unit={t("pricesPerWordAndMinute")}
            kind="simple"
            rows={displayedTtsModels}
            labels={pricingLabels}
          />
        </div>

        {/* Transcription Models */}
        <div id="transcription-models" className="site-reveal section-enter [--section-index:3]">
          <SectionCalculator
            title={t("transcriptionCalculator")}
            estimateLabel={t("estimate")}
            estimate={transcriptionEstimate === null ? "TBD" : displayCurrency(transcriptionEstimate, true)}
          >
            <SelectField
              label={t("model")}
              value={selectedTranscriptionModel}
              onChange={setSelectedTranscriptionModel}
            >
              {transcriptionModels.map((model) => (
                <option key={model.model}>{model.model}</option>
              ))}
            </SelectField>
            <NumberField
              label={t("minutes")}
              min={0}
              max={Infinity}
              step={0.01}
              value={transcriptionMinutes}
              onChange={setTranscriptionMinutes}
              minuteNotation
              minuteHelp={t("minuteHelp")}
            />
          </SectionCalculator>

          <PricingCard
            key={`transcription-${currencyPresentationKey}`}
            title={t("transcriptionModels")}
            unit={t("pricesPerMinute")}
            kind="simple"
            rows={displayedTranscriptionModels}
            labels={pricingLabels}
          />
        </div>

        {/* Dubbing Models */}
        <div id="dubbing-models" className="site-reveal section-enter [--section-index:4]">
          <SectionCalculator
            title={t("dubbingCalculator")}
            estimateLabel={t("estimate")}
            estimate={dubbingEstimate === null ? "TBD" : displayCurrency(dubbingEstimate, true)}
          >
            <SelectField label={t("model")} value={selectedDubbingModel} onChange={setSelectedDubbingModel}>
              {dubbingModels.map((model) => (
                <option key={model.model}>{model.model}</option>
              ))}
            </SelectField>
            <NumberField
              label={t("minutes")}
              min={0}
              max={Infinity}
              step={0.01}
              value={dubbingMinutes}
              onChange={setDubbingMinutes}
              minuteNotation
              minuteHelp={t("minuteHelp")}
            />
          </SectionCalculator>

          <PricingCard
            key={`dubbing-${currencyPresentationKey}`}
            title={t("dubbingModels")}
            unit={t("pricesPerMinute")}
            kind="simple"
            rows={displayedDubbingModels}
            labels={pricingLabels}
          />
        </div>

        {/* Image Translation */}
        <div id="image-translation" className="site-reveal section-enter [--section-index:5]">
          <SectionCalculator
            title={t("imageCalculator")}
            estimateLabel={t("estimate")}
            estimate={displayCurrency(imageEstimate, true)}
          >
            <SelectField label={t("tableImageSize")} value={selectedImageSize} onChange={setSelectedImageSize}>
              {imageModels.map((model) => (
                <option key={model.size}>{model.size}</option>
              ))}
            </SelectField>
            <NumberField
              label={t("inputTokens")}
              min={0}
              max={Infinity}
              step={1000}
              value={imageInputTokens}
              onChange={setImageInputTokens}
            />
            <NumberField
              label={t("outputTokens")}
              min={0}
              max={Infinity}
              step={1000}
              value={imageOutputTokens}
              onChange={setImageOutputTokens}
            />
          </SectionCalculator>

          <PricingCard
            key={`images-${currencyPresentationKey}`}
            title={t("imageTranslation")}
            unit={t("pricesPer1MTokens")}
            kind="image"
            rows={displayedImageModels}
            labels={pricingLabels}
          />
        </div>

        {/* PDF Extraction */}
        <div id="pdf-extraction-and-editing" className="site-reveal section-enter [--section-index:6]">
          <SectionCalculator
            title={t("pdfCalculator")}
            estimateLabel={t("estimate")}
            estimate={pdfEstimate === null ? "TBD" : displayCurrency(pdfEstimate, true)}
          >
            <SelectField label={t("workflow")} value={selectedPdfModel} onChange={setSelectedPdfModel}>
              {pdfModels.map((model) => (
                <option key={model.model}>{model.model}</option>
              ))}
            </SelectField>
            <NumberField
              label={selectedPdf.model === "PDF text extraction" ? t("extractions") : t("documents")}
              min={0}
              max={Infinity}
              step={1}
              value={pdfCount}
              onChange={setPdfCount}
            />
          </SectionCalculator>

          <PricingCard
            key={`pdf-${currencyPresentationKey}`}
            title={t("pdfExtractionEditing")}
            unit={t("pdfWorkflows")}
            kind="simple"
            rows={displayedPdfModels}
            labels={pricingLabels}
          />
        </div>

        {/* Music Models */}
        <div id="music-models" className="site-reveal section-enter [--section-index:7]">
          <SectionCalculator
            title={t("musicCalculator")}
            estimateLabel={t("estimate")}
            estimate={musicEstimate === null ? "TBD" : displayCurrency(musicEstimate, true)}
          >
            <SelectField label={t("model")} value={selectedMusicModel} onChange={setSelectedMusicModel}>
              {musicModels.map((model) => (
                <option key={model.model}>{model.model}</option>
              ))}
            </SelectField>
            <NumberField
              label="Generations"
              min={0}
              max={Infinity}
              step={1}
              value={musicGenerations}
              onChange={setMusicGenerations}
            />
          </SectionCalculator>

          <PricingCard
            key={`music-${currencyPresentationKey}`}
            title={t("musicModels")}
            unit="Price per generation"
            kind="simple"
            rows={displayedMusicModels}
            labels={pricingLabels}
          />
        </div>
      </div>

      {/* Billing Notes */}
      <section id="billing-notes" className="site-reveal section-enter mt-16 border-t border-neutral-200/80 pt-10 dark:border-white/[0.08] [--section-index:8]">
        <h2 className="text-xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">{t("billingNotes")}</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {billingNotes.map((note) => {
            const Icon = note.icon;
            return (
              <div
                key={note.key}
                className="surface-lift flex items-start gap-3 rounded-xl border border-neutral-200/80 bg-white p-4 text-xs leading-5 text-neutral-600 shadow-xs dark:border-white/[0.08] dark:bg-neutral-900/60 dark:text-neutral-400"
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
                <span>{t(note.key)}</span>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

function TextModelGallery({
  models,
  pricingMode,
  displayPrice,
  onOpenModel,
}: {
  models: TextModel[];
  pricingMode: TextPricingMode;
  displayPrice: (usdAmount: number) => string;
  onOpenModel: (model: string) => void;
}) {
  const openSourceModels = models.filter((model) => model.local);
  const cloudModels = models.filter((model) => !model.local);

  return (
    <section className="mb-10" aria-labelledby="pricing-model-gallery-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h2 id="pricing-model-gallery-heading" className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">
            Model Highlights
          </h2>
          <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
            Quick overview of flagship models and self-hosted local engines.
          </p>
        </div>
        <span className="text-xs font-semibold text-neutral-500">
          Mode: <span className="capitalize">{pricingMode}</span>
        </span>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
          Native Local (Free)
        </h3>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {openSourceModels.map((model) => {
            const presentation = textModelPresentations[model.model];
            return (
              <div
                key={model.model}
                onClick={() => onOpenModel(model.model)}
                className="surface-lift group flex cursor-pointer items-start gap-4 rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-xs transition hover:border-neutral-400 dark:border-white/[0.08] dark:bg-neutral-900/60 dark:hover:border-white/20"
              >
                <ModelIcon presentation={presentation} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-neutral-950 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                      {model.model}
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                      Free Local
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-neutral-600 dark:text-neutral-400">
                    {presentation?.capability ?? modelDetails[model.model]}
                  </p>
                  <p className="mt-2 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Runs on device · Zero cloud quota
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-8 border-t border-neutral-200/80 pt-6 dark:border-white/[0.08]">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
          Cloud API Models
        </h3>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {cloudModels.map((model) => {
            const presentation = textModelPresentations[model.model];
            return (
              <div
                key={model.model}
                onClick={() => onOpenModel(model.model)}
                className="surface-lift group flex cursor-pointer items-start gap-4 rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-xs transition hover:border-neutral-400 dark:border-white/[0.08] dark:bg-neutral-900/60 dark:hover:border-white/20"
              >
                <ModelIcon presentation={presentation} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-neutral-950 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                      {model.model}
                    </span>
                    {model.recommended && (
                      <span className="rounded-full bg-neutral-950 px-2 py-0.5 text-[10px] font-semibold text-white dark:bg-white dark:text-neutral-950">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-neutral-600 dark:text-neutral-400">
                    {presentation?.capability ?? modelDetails[model.model]}
                  </p>
                  <div className="mt-2 flex gap-3 text-[11px] text-neutral-500">
                    <span>In: <strong className="text-neutral-900 dark:text-neutral-200">{displayPrice(model.inputUsd)}</strong></span>
                    <span>Out: <strong className="text-neutral-900 dark:text-neutral-200">{displayPrice(model.outputUsd)}</strong></span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MediaShowcase() {
  return (
    <section id="product-demos" className="site-reveal scroll-mt-24 border-y border-neutral-200/80 py-10 dark:border-white/[0.08]" aria-labelledby="media-showcase-heading">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Multimodal Capabilities</p>
        <h2 id="media-showcase-heading" className="mt-1.5 text-2xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-3xl">
          Experience LingoFusion in Action
        </h2>
        <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
          High-fidelity benchmarks across document localization, audio dubbing, speech synthesis, and vision translation.
        </p>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {showcaseItems.map((item, index) => {
          const PlaceholderIcon = item.kind === "video" ? Play : ImageIcon;
          return (
            <figure
              key={item.title}
              className="media-showcase-card group overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-xs dark:border-white/[0.08] dark:bg-neutral-900/60"
              style={{ "--media-index": index } as CSSProperties}
            >
              <div className="media-showcase-frame relative aspect-video overflow-hidden border-b border-neutral-200/80 bg-neutral-100/70 dark:border-white/[0.08] dark:bg-black/30">
                {item.src ? (
                  item.kind === "video" ? (
                    <video className="h-full w-full object-cover" controls preload="metadata" src={item.src} />
                  ) : (
                    <img className="h-full w-full object-cover" src={item.src} alt={item.title} />
                  )
                ) : (
                  <div
                    role="img"
                    aria-label={`${item.title} placeholder`}
                    className="media-placeholder grid h-full w-full place-items-center"
                  >
                    <span className="media-placeholder-number">
                      Demo {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="text-center">
                      <span className="media-placeholder-icon mx-auto grid h-10 w-10 place-items-center text-neutral-600 dark:text-neutral-300">
                        <PlaceholderIcon className="h-7 w-7 stroke-[1.5]" />
                      </span>
                      <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-neutral-100">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                        16:9 • Interactive preview
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <figcaption className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-neutral-950 dark:text-neutral-50">{item.title}</h3>
                  <span className="shrink-0 rounded-full border border-neutral-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:border-white/10 dark:text-neutral-400">
                    {item.label}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-5 text-neutral-600 dark:text-neutral-400">{item.description}</p>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
