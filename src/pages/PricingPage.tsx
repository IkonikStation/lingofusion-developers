import {
  FileText,
  Image as ImageIcon,
  Mic,
  Music,
  Play,
  Video,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { formatCurrencyAmount } from "../data/currency";
import type { CurrencyCode } from "../data/currency";
import type { TranslationKey } from "../data/i18n";
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
    label: "Before & after",
    description: "Preserves headings, formatting, terminology, and tone across whole documents.",
    src: "",
  },
  {
    kind: "video",
    title: "Live conversation",
    label: "Real-time",
    description: "Interprets two-way speech with sub-500ms latency and natural turn-taking.",
    src: "",
  },
  {
    kind: "video",
    title: "Video dubbing",
    label: "Audio alignment",
    description: "Translates speech and synchronizes timing while maintaining original voice timbre.",
    src: "",
  },
  {
    kind: "image",
    title: "PDF localization",
    label: "Layout fidelity",
    description: "Extracts and translates complex multi-column PDFs without altering visual layout.",
    src: "",
  },
  {
    kind: "image",
    title: "Image translation",
    label: "In-image text",
    description: "Detects text embedded within images, translates it, and replaces it with matching typography.",
    src: "",
  },
  {
    kind: "video",
    title: "Music generation",
    label: "Text-to-audio",
    description: "Generates full audio compositions and stems from written creative direction.",
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
  const [textPricingMode, setTextPricingMode] = useState<TextPricingMode>(() => {
    const storedMode = window.localStorage.getItem("lingofusion-text-pricing-mode");
    return storedMode === "ultrafast" ? "ultrafast" : storedMode === "fast" ? "fast" : storedMode === "batch" ? "batch" : "instant";
  });

  const [selectedModel, setSelectedModel] = useState("LingoFusion");
  const [inputTokens, setInputTokens] = useState(1_000_000);
  const [outputTokens, setOutputTokens] = useState(1_000_000);

  const characterTtsModels = ttsModels.filter((model) => model.pricingUnit === "per_1k_characters");
  const [selectedTtsModel, setSelectedTtsModel] = useState(characterTtsModels[0]?.model ?? "");
  const [ttsCharacters, setTtsCharacters] = useState(1000);
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

  const activeCurrency: CurrencyCode = "USD";
  const activeRate = 1;
  const currencyPresentationKey = `${activeCurrency}-${activeRate}`;
  const displayCurrency = (usdAmount: number, precise = false) => formatCurrencyAmount(usdAmount, activeCurrency, activeRate, precise);
  const displayPrice = (usdAmount: number | null, unit?: string) => {
    if (usdAmount === null) return "TBD";
    const suffix = unit === "per_1k_characters" ? "" : unit === "per_minute" ? "/min" : unit === "per_generation" ? " / gen" : unit === "per_500_extractions" ? " / 500 ex." : "";
    return `${displayCurrency(usdAmount, true)}${suffix}`;
  };

  const visibleTextModels = textModelsByPricingMode[textPricingMode].filter((model) => !model.local);
  const calculatorTextModels = textModelsByPricingMode[textPricingMode].filter((model) => !model.local);
  const selectedTextModel = calculatorTextModels.find((model) => model.model === selectedModel) ?? calculatorTextModels[0];
  const selectedTts = characterTtsModels.find((model) => model.model === selectedTtsModel) ?? characterTtsModels[0];
  const selectedTranscription = transcriptionModels.find((model) => model.model === selectedTranscriptionModel) ?? transcriptionModels[0];
  const selectedDubbing = dubbingModels.find((model) => model.model === selectedDubbingModel) ?? dubbingModels[0];
  const selectedMusic = musicModels.find((model) => model.model === selectedMusicModel) ?? musicModels[0];
  const selectedImage = imageModels.find((model) => model.size === selectedImageSize) ?? imageModels[0];
  const selectedPdf = pdfModels.find((model) => model.model === selectedPdfModel) ?? pdfModels[0];

  const textPricingDescription = textPricingMode === "fast"
    ? "Fast mode is priced at 1.5× Default for supported models."
    : textPricingMode === "ultrafast"
    ? "Translate up to 6× faster without compromising quality, for 4× the standard price."
    : textPricingMode === "instant"
    ? "Real-time streaming processing with immediate results."
    : "Batch API offers 50% discount for asynchronous requests with 24-hour turnaround.";

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
    return !selectedTts || selectedTts.priceUsd === null ? null : (ttsCharacters / 1000) * selectedTts.priceUsd;
  }, [selectedTts, ttsCharacters]);

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
    <div className="mx-auto max-w-6xl pb-24">
      {/* Clean Hero */}
      <section className="border-b border-neutral-200 pb-12 dark:border-neutral-800">
        <h1 className="text-4xl font-normal tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-5xl lg:text-6xl">
          Pricing
        </h1>
        <p className="mt-4 max-w-3xl text-lg text-neutral-600 dark:text-neutral-400">
          Pay as you go for token usage across text, speech, audio, and multimodal translation models. Volume discounts and committed spend terms are available for enterprise customers.
        </p>

        {/* Currency & Quick Anchors */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-neutral-500">Jump to:</span>
            {[
              ["#text-models", "Text models"],
              ["#tts-models", "Text to speech"],
              ["#transcription-models", "Transcription"],
              ["#dubbing-models", "Dubbing"],
              ["#image-translation", "Images"],
              ["#billing-notes", "Billing rules"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded px-2 py-1 text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                {label}
              </a>
            ))}
          </div>

          <span className="font-sans text-xs font-medium text-neutral-500">
            All prices in USD ($)
          </span>
        </div>
      </section>

      {/* Main Content Stacks */}
      <div className="mt-12 space-y-12">
        {/* Text Models Section */}
        <div id="text-models">
          <SectionCalculator
            title="Text model cost estimate"
            estimateLabel="Estimate"
            estimate={selectedTextModel.local ? "Free" : textEstimate === null ? "TBD" : displayCurrency(textEstimate, true)}
          >
            <SelectField label="Model" value={selectedTextModel.model} onChange={setSelectedModel}>
              {calculatorTextModels.map((m) => (
                <option key={m.model} value={m.model}>{m.model}</option>
              ))}
            </SelectField>
            <NumberField
              label="Input tokens"
              min={0}
              max={Infinity}
              step={1000}
              value={inputTokens}
              onChange={setInputTokens}
            />
            <NumberField
              label="Output tokens"
              min={0}
              max={Infinity}
              step={1000}
              value={outputTokens}
              onChange={setOutputTokens}
            />
          </SectionCalculator>

          <PricingCard
            key={`text-${textPricingMode}-${currencyPresentationKey}`}
            title="Text models"
            unit="Prices per 1M tokens"
            kind="text"
            rows={displayedCloudTextModels}
            labels={pricingLabels}
            headerAction={
              <div
                role="group"
                aria-label="Text model pricing mode"
                className="flex items-center gap-1 rounded-lg border border-neutral-200 p-0.5 dark:border-neutral-800"
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
                      className={`rounded px-2.5 py-1 text-xs font-medium capitalize transition ${
                        selected
                          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                          : "text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
                      }`}
                    >
                      {mode === "instant" ? "Default" : mode}
                    </button>
                  );
                })}
              </div>
            }
            headerNote={textPricingDescription}
          />
        </div>

        {/* Web Search Grounding */}
        <section className="border-t border-neutral-200 pt-10 dark:border-neutral-800">
          <h2 className="text-xl font-normal text-neutral-900 dark:text-neutral-50">Web search grounding</h2>
          <p className="mt-1 text-xs text-neutral-500">Per-call pricing for live search engine grounding.</p>
          <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/50">
                <tr>
                  <th className="px-5 py-3 font-medium text-neutral-600 dark:text-neutral-400">Model</th>
                  <th className="px-5 py-3 font-medium text-neutral-600 dark:text-neutral-400">Price per call</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {webSearchPricing.map(({ model, priceUsd }) => (
                  <tr key={model} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30">
                    <td className="px-5 py-3.5 font-semibold text-neutral-900 dark:text-neutral-50">{model}</td>
                    <td className="px-5 py-3.5 font-sans tabular-nums text-neutral-700 dark:text-neutral-300">${priceUsd.toString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* TTS Models */}
        <div id="tts-models">
          <SectionCalculator
            title="Text to speech calculator"
            estimateLabel="Estimate"
            estimate={ttsEstimate === null ? "TBD" : displayCurrency(ttsEstimate, true)}
          >
            <SelectField label="Model" value={selectedTtsModel} onChange={setSelectedTtsModel}>
              {characterTtsModels.map((m) => (
                <option key={m.model} value={m.model}>{m.model}</option>
              ))}
            </SelectField>
            <NumberField
              label="Characters"
              min={0}
              max={Infinity}
              step={100}
              value={ttsCharacters}
              onChange={setTtsCharacters}
            />
          </SectionCalculator>

          <PricingCard
            key={`tts-${currencyPresentationKey}`}
            title="Text to speech models"
            unit="Voice: prices per 1K characters"
            kind="simple"
            rows={displayedTtsModels}
            labels={{ ...pricingLabels, price: "Price per 1K characters" }}
          />
        </div>

        {/* Transcription Models */}
        <div id="transcription-models">
          <SectionCalculator
            title="Speech transcription calculator"
            estimateLabel="Estimate"
            estimate={transcriptionEstimate === null ? "TBD" : displayCurrency(transcriptionEstimate, true)}
          >
            <SelectField
              label="Model"
              value={selectedTranscriptionModel}
              onChange={setSelectedTranscriptionModel}
            >
              {transcriptionModels.map((m) => (
                <option key={m.model} value={m.model}>{m.model}</option>
              ))}
            </SelectField>
            <NumberField
              label="Minutes"
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
            title="Transcription models"
            unit={t("pricesPerMinute")}
            kind="simple"
            rows={displayedTranscriptionModels}
            labels={pricingLabels}
          />
        </div>

        {/* Dubbing Models */}
        <div id="dubbing-models">
          <SectionCalculator
            title="Dubbing calculator"
            estimateLabel="Estimate"
            estimate={dubbingEstimate === null ? "TBD" : displayCurrency(dubbingEstimate, true)}
          >
            <SelectField label="Model" value={selectedDubbingModel} onChange={setSelectedDubbingModel}>
              {dubbingModels.map((m) => (
                <option key={m.model} value={m.model}>{m.model}</option>
              ))}
            </SelectField>
            <NumberField
              label="Minutes"
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
            title="Dubbing models"
            unit={t("pricesPerMinute")}
            kind="simple"
            rows={displayedDubbingModels}
            labels={pricingLabels}
          />
        </div>

        {/* Image Translation */}
        <div id="image-translation">
          <SectionCalculator
            title="Image translation calculator"
            estimateLabel="Estimate"
            estimate={displayCurrency(imageEstimate, true)}
          >
            <SelectField label="Image size" value={selectedImageSize} onChange={setSelectedImageSize}>
              {imageModels.map((m) => (
                <option key={m.size} value={m.size}>{m.size}</option>
              ))}
            </SelectField>
            <NumberField
              label="Input tokens"
              min={0}
              max={Infinity}
              step={1000}
              value={imageInputTokens}
              onChange={setImageInputTokens}
            />
            <NumberField
              label="Output tokens"
              min={0}
              max={Infinity}
              step={1000}
              value={imageOutputTokens}
              onChange={setImageOutputTokens}
            />
          </SectionCalculator>

          <PricingCard
            key={`images-${currencyPresentationKey}`}
            title="Image translation"
            unit={t("pricesPer1MTokens")}
            kind="image"
            rows={displayedImageModels}
            labels={pricingLabels}
          />
        </div>

        {/* PDF Extraction */}
        <div id="pdf-extraction-and-editing">
          <SectionCalculator
            title="PDF extraction calculator"
            estimateLabel="Estimate"
            estimate={pdfEstimate === null ? "TBD" : displayCurrency(pdfEstimate, true)}
          >
            <SelectField label="Workflow" value={selectedPdfModel} onChange={setSelectedPdfModel}>
              {pdfModels.map((m) => (
                <option key={m.model} value={m.model}>{m.model}</option>
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
            title="PDF extraction and editing"
            unit={t("pdfWorkflows")}
            kind="simple"
            rows={displayedPdfModels}
            labels={pricingLabels}
          />
        </div>

        {/* Music Models */}
        <div id="music-models">
          <SectionCalculator
            title="Music generation calculator"
            estimateLabel="Estimate"
            estimate={musicEstimate === null ? "TBD" : displayCurrency(musicEstimate, true)}
          >
            <SelectField label="Model" value={selectedMusicModel} onChange={setSelectedMusicModel}>
              {musicModels.map((m) => (
                <option key={m.model} value={m.model}>{m.model}</option>
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
            title="Music generation"
            unit="Price per generation"
            kind="simple"
            rows={displayedMusicModels}
            labels={pricingLabels}
          />
        </div>

        {/* Demos Showcase */}
        <MediaShowcase />
      </div>

      {/* Billing Notes */}
      <section id="billing-notes" className="mt-16 border-t border-neutral-200 pt-10 dark:border-neutral-800">
        <h2 className="text-xl font-normal text-neutral-900 dark:text-neutral-50">{t("billingNotes")}</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {billingNotes.map((note) => {
            const Icon = note.icon;
            return (
              <div
                key={note.key}
                className="flex items-start gap-3 rounded-lg border border-neutral-200 p-4 text-xs leading-5 text-neutral-600 dark:border-neutral-800 dark:text-neutral-400"
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                <span>{t(note.key)}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function MediaShowcase() {
  return (
    <section id="product-demos" className="scroll-mt-24 border-t border-neutral-200 pt-12 dark:border-neutral-800">
      <h2 className="text-xl font-normal text-neutral-900 dark:text-neutral-50">
        Multimodal product demos
      </h2>
      <p className="mt-1 text-xs text-neutral-500">
        Review real-time benchmarks across speech, audio, image, and document localization.
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {showcaseItems.map((item, index) => {
          const PlaceholderIcon = item.kind === "video" ? Play : ImageIcon;
          return (
            <div
              key={item.title}
              className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950"
            >
              <div className="relative aspect-video overflow-hidden border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
                {item.src ? (
                  item.kind === "video" ? (
                    <video className="h-full w-full object-cover" controls preload="metadata" src={item.src} />
                  ) : (
                    <img className="h-full w-full object-cover" src={item.src} alt={item.title} />
                  )
                ) : (
                  <div className="grid h-full w-full place-items-center text-center">
                    <div>
                      <PlaceholderIcon className="mx-auto h-6 w-6 text-neutral-400" />
                      <p className="mt-2 text-xs font-semibold text-neutral-900 dark:text-white">
                        {item.title}
                      </p>
                      <p className="text-[10px] text-neutral-400">Interactive demo</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">{item.title}</h3>
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                    {item.label}
                  </span>
                </div>
                <p className="mt-1 text-xs text-neutral-500">{item.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
