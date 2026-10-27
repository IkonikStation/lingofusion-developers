export type TextModel = {
  model: string;
  inputUsd: number;
  outputUsd: number;
  local?: boolean;
  recommended?: boolean;
};

export type TextModelPresentation = {
  image: string;
  imageScale?: number;
  imageFit?: "cover" | "contain";
  capability: string;
  bestFor: string;
  features: string[];
};

export type TextPricingMode = "instant" | "batch" | "fast" | "ultrafast";

export type SimpleModel = {
  model: string;
  priceUsd: number | null;
  pricingUnit?: "per_1k_characters" | "per_minute" | "per_song" | "per_generation" | "per_500_extractions";
};

export type ImageResolution = "standard" | "4k";
export type ImageQuality = "high" | "max";

export type ImageModel = {
  size: string;
  model: string;
  label: string;
  upstreamModel: string;
  resolution: ImageResolution;
  quality: ImageQuality;
  inputUsd: number;
  outputUsd: number;
};

export const textModels: TextModel[] = [
  { model: "LingoFusion Native-1.7B", inputUsd: 0, outputUsd: 0, local: true },
  { model: "LingoFusion Native-9B", inputUsd: 0, outputUsd: 0, local: true, recommended: true },
  { model: "LingoFusion Native-35B", inputUsd: 0, outputUsd: 0, local: true },
  { model: "LingoFusion Nano", inputUsd: 0.05, outputUsd: 0.10 },
  { model: "LingoFusion Lite", inputUsd: 0.50, outputUsd: 2.00 },
  {
    model: "LingoFusion",
    inputUsd: 1.00,
    outputUsd: 5.00,
    recommended: true,
  },
  { model: "LingoFusion Pro", inputUsd: 3.50, outputUsd: 20.00 },
  { model: "ExplainFusion", inputUsd: 2.00, outputUsd: 0.50 },
  { model: "LingoFusion Ultra", inputUsd: 20.00, outputUsd: 120.00 },
];

export const textModelsByPricingMode: Record<TextPricingMode, TextModel[]> = {
  instant: textModels,
  batch: textModels.map((model) => ({
      ...model,
      inputUsd: model.inputUsd / 2,
      outputUsd: model.outputUsd / 2,
    })),
  fast: textModels
    .filter((model) => ["LingoFusion Nano", "LingoFusion Lite", "LingoFusion", "LingoFusion Pro", "LingoFusion Ultra"].includes(model.model))
    .map((model) => ({
      ...model,
      inputUsd: model.inputUsd * 1.5,
      outputUsd: model.outputUsd * 1.5,
    })),
  ultrafast: textModels
    .filter((model) => model.model === "LingoFusion Pro" || model.model === "LingoFusion Ultra")
    .map((model) => ({
      ...model,
      inputUsd: model.inputUsd * 4,
      outputUsd: model.outputUsd * 4,
    })),
};

export const webSearchPricing = [
  { model: "LingoFusion", priceUsd: 0.015 },
  { model: "LingoFusion Pro", priceUsd: 0.04 },
  { model: "LingoFusion Ultra", priceUsd: 0.15 },
] as const;

export const textModelPresentations: Record<string, TextModelPresentation> = {
  "LingoFusion Native-1.7B": {
    image: "/assets/models/lingofusion-native-1-7b.png",
    imageScale: 1.10,
    capability: "Free local translation for everyday language tasks on most modern computers.",
    bestFor: "Everyday translation, fast local inference, and lower-memory devices.",
    features: ["1.7B parameters", "32K context", "8 GB RAM minimum", "~1.3 GB download", "Free · Runs locally"],
  },
  "LingoFusion Native-9B": {
    image: "/assets/models/lingofusion-native-9b.png",
    imageScale: 1.08,
    capability: "Capable local translation for most users, designed around mainstream 16 GB-class computers.",
    bestFor: "Everyday professional translation with a practical quality, speed, and hardware balance.",
    features: ["9B parameters", "Recommended for most users", "Free · Runs locally", "Build-specific local requirements"],
  },
  "LingoFusion Native-35B": {
    image: "/assets/models/lingofusion-native-35b.png",
    imageScale: 2.30,
    capability: "High-quality local translation for difficult multilingual work, powered entirely by your own hardware.",
    bestFor: "Difficult translations and powerful local computers.",
    features: ["35B total · ~3B active parameters", "MoE architecture", "128K context · 32K max output", "24 GB memory minimum", "~15 GB download", "Free · Runs locally"],
  },
  "LingoFusion Nano": {
    image: "/assets/models/lingofusion-nano.png",
    imageScale: 1.73,
    capability: "Fast, efficient translation for high-volume utility tasks and latency-sensitive workflows.",
    bestFor: "Simple, high-volume language tasks where speed and cost matter most.",
    features: ["Fast multilingual translation", "Text classification", "Structured extraction", "Low-latency responses"],
  },
  "LingoFusion Lite": {
    image: "/assets/models/lingofusion-lite.png",
    imageScale: 1.71,
    capability: "Low-cost translation, extraction, and classification for lightweight production work.",
    bestFor: "Lightweight production translation, extraction, and content processing.",
    features: ["Multilingual translation", "Summarization", "Entity extraction", "Structured outputs"],
  },
  LingoFusion: {
    image: "/assets/models/lingofusion-v4.png",
    imageScale: 1.24,
    capability: "The recommended default for dependable everyday translation and text generation.",
    bestFor: "Most everyday translation, localization, and multilingual generation workloads.",
    features: ["High-quality translation", "Context preservation", "Text generation", "Streaming responses"],
  },
  "LingoFusion Pro": {
    image: "/assets/models/lingofusion-pro-v4.png",
    imageScale: 1.24,
    capability: "Advanced translation with stronger context, tone, and terminology handling.",
    bestFor: "Professional localization and complex content requiring stronger reasoning.",
    features: ["Advanced context handling", "Terminology consistency", "Tone preservation", "Long-form translation"],
  },
  ExplainFusion: {
    image: "/assets/models/explainfusion.png",
    imageScale: 1.71,
    capability: "Explanation-focused translation, rewriting, and educational localization workflows.",
    bestFor: "Translations that need clear explanations, teaching context, or detailed rewrites.",
    features: ["Explanation generation", "Educational localization", "Step-by-step rewrites", "Contextual annotations"],
  },
  "LingoFusion Ultra": {
    image: "/assets/models/lingofusion-ultra-v4.png",
    imageScale: 1.23,
    capability: "Highest-accuracy multilingual reasoning and long-form translation for demanding work.",
    bestFor: "The hardest multilingual work, specialist terminology, and document-scale review.",
    features: ["Maximum translation accuracy", "Specialist terminology", "Document consistency review", "Deep multilingual reasoning"],
  },
};

export const ttsModels: SimpleModel[] = [
  { model: "LingoFusion Voice", priceUsd: 0.15, pricingUnit: "per_1k_characters" },
  { model: "LingoFusion Voice Flash", priceUsd: 0.08, pricingUnit: "per_1k_characters" },
];

export const transcriptionModels: SimpleModel[] = [
  { model: "LingoFusion Transcribe", priceUsd: 0.017, pricingUnit: "per_minute" },
  { model: "LingoFusion Transcribe Mini", priceUsd: 0.008, pricingUnit: "per_minute" },
  { model: "LingoFusion Transcribe Live", priceUsd: 0.04, pricingUnit: "per_minute" },
];

export const dubbingModels: SimpleModel[] = [
  { model: "LingoFusion Dubbing", priceUsd: 3.50, pricingUnit: "per_minute" },
];

export const musicModels: SimpleModel[] = [
  { model: "LingoFusion Music", priceUsd: 0.10, pricingUnit: "per_song" },
];

// In-image translation is served as LingoFusion Image Translate (upstream
// gpt-image-2.5-sunburst). The standard and 4K tiers share the same upstream
// model ID and differ only in the requested output resolution.
export const imageModels: ImageModel[] = [
  {
    size: "Standard",
    model: "LingoFusion Image Translate",
    label: "LingoFusion Image Translate",
    upstreamModel: "gpt-image-2.5-sunburst",
    resolution: "standard",
    quality: "high",
    inputUsd: 12.00,
    outputUsd: 45.00,
  },
  {
    size: "4K",
    model: "LingoFusion Image Translate",
    label: "LingoFusion Image Translate 4K",
    upstreamModel: "gpt-image-2.5-sunburst",
    resolution: "4k",
    quality: "max",
    inputUsd: 15.00,
    outputUsd: 50.00,
  },
];

export function resolveImageModel(
  modelName?: string,
  resolution?: string,
): ImageModel {
  const res = String(resolution || "").trim().toLowerCase();
  if (res === "standard" || res === "4k") {
    const byResolution = imageModels.find((model) => model.resolution === res);
    if (byResolution) return byResolution;
  }
  const name = String(modelName || "").trim().toLowerCase();
  const byName = imageModels.find(
    (model) =>
      model.label.toLowerCase() === name ||
      model.model.toLowerCase() === name ||
      model.size.toLowerCase() === name,
  );
  return byName ?? imageModels[0];
}

export const pdfModels: SimpleModel[] = [
  { model: "PDF text extraction", priceUsd: 0.02, pricingUnit: "per_500_extractions" },
  { model: "PDF editing and translation", priceUsd: null },
];

export const latestModels = [
  "LingoFusion Ultra",
  "LingoFusion Pro",
  "ExplainFusion",
  "LingoFusion",
  "LingoFusion Lite",
  "LingoFusion Native-1.7B",
  "LingoFusion Native-9B",
  "LingoFusion Native-35B",
  "LingoFusion Nano",
  "LingoFusion Voice",
  "LingoFusion Voice Flash",
  "LingoFusion Transcribe",
  "LingoFusion Transcribe Mini",
  "LingoFusion Transcribe Live",
  "LingoFusion Dubbing",
  "LingoFusion Music",
  "PDF text extraction",
  "PDF editing and translation",
  "Image Translate",
];

export const sidebarSections = [
  {
    title: "Get started",
    items: ["Overview", "Quickstart"],
  },
  {
    title: "API",
    items: ["Models", "API Prices", "Subscription Prices"],
  },
  {
    title: "Core concepts",
    items: [
      "Text generation",
      "Speech generation",
      "Image translation",
      "Dubbing",
      "SDKs and libraries",
      "Error codes",
    ],
  },
  {
    title: "Resources",
    items: ["Changelog", "Support", "Status"],
  },
];

export const navMenus = {
  API: ["Overview", "Quickstart", "Models", "API Prices", "Subscription Prices"],
  Models: [
    "LingoFusion Ultra",
    "LingoFusion Pro",
    "ExplainFusion",
    "LingoFusion",
    "LingoFusion Lite",
    "LingoFusion Native-1.7B",
    "LingoFusion Native-9B",
    "LingoFusion Native-35B",
    "LingoFusion Nano",
    "LingoFusion Transcribe",
    "LingoFusion Transcribe Mini",
    "LingoFusion Transcribe Live",
    "PDF text extraction",
    "PDF editing and translation",
  ],
  Docs: ["Text generation", "Speech generation", "Image translation", "Dubbing"],
  Resources: ["Changelog", "Support", "Status"],
};

export const pageSummaries: Record<string, string> = {
  Overview:
    "Build translation, text, speech, image, and dubbing workflows with one developer platform.",
  Quickstart:
    "Create an API key, install an SDK, and make your first LingoFusion request in minutes.",
  Models:
    "Compare every LingoFusion model by modality, latency profile, and recommended use case.",
  Pricing:
    "Simple, pay-as-you-go pricing for text, speech, image, and dubbing models.",
  "Text generation":
    "Generate, improve, summarize, and translate text with token-based text models.",
  "Speech generation":
    "Synthesize natural, expressive speech with LingoFusion Voice and LingoFusion Voice Flash.",
  "Image translation":
    "Translate text inside images while preserving visual structure and image quality.",
  Dubbing:
    "Localize audio and video into new languages with minute-based dubbing models.",
  "SDKs and libraries":
    "Use official JavaScript, Python, Swift, and REST clients for production integrations.",
  "Error codes":
    "Understand API errors, retry behavior, rate limits, and validation responses.",
  Changelog:
    "Track model launches, API improvements, SDK releases, and billing updates.",
  Support:
    "Get help from documentation, support tickets, and developer success channels.",
  Status:
    "Review current service health, latency, and uptime across LingoFusion APIs.",
};

export const modelDetails: Record<string, string> = {
  "LingoFusion Ultra":
    "Highest-quality multilingual reasoning and long-form translation for enterprise workflows.",
  "LingoFusion Pro":
    "Professional model for product-grade translation, writing, and localization tasks.",
  ExplainFusion:
    "Premium model for explanation-heavy translation, rewriting, and educational localization workflows.",
  LingoFusion:
    "Recommended default model for most text generation and translation workloads.",
  "LingoFusion Lite":
    "Low-cost, fast model for simple translation, extraction, and classification.",
  "LingoFusion Nano":
    "Ultra-efficient model for high-volume utility tasks and latency-sensitive flows.",
  "LingoFusion Native-1.7B":
    "Lightweight free local translation for everyday tasks on ordinary computers.",
  "LingoFusion Native-9B":
    "Capable free local translation for everyday professional work on mainstream computers.",
  "LingoFusion Native-35B":
    "Higher-quality free local translation for difficult multilingual work on powerful computers.",
  "LingoFusion Voice":
    "Expressive multilingual speech generation with strong pronunciation control.",
  "LingoFusion Voice Flash":
    "Fast, lower-cost multilingual speech generation.",
  "LingoFusion Transcribe":
    "Production transcription model for accurate speech-to-text workflows.",
  "LingoFusion Transcribe Mini":
    "Lower-latency transcription model for lightweight speech-to-text tasks.",
  "LingoFusion Transcribe Live":
    "Real-time transcription model for streaming audio and live captioning.",
  "PDF text extraction":
    "Extract text from PDF files for translation, search, and document workflows.",
  "PDF editing and translation":
    "Edit and translate PDF documents while preserving document structure.",
  "LingoFusion Dubbing":
    "Studio dubbing for localized speech and media with timing-aware output.",
  "Image Translate":
    "Image localization pipeline for screenshots, product images, and documents.",
};
