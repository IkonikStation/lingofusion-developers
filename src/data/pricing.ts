export type TextModel = {
  model: string;
  inputUsd: number;
  outputUsd: number;
  recommended?: boolean;
};

export type TextModelPresentation = {
  image: string;
  imageScale?: number;
  capability: string;
  bestFor: string;
  features: string[];
};

export type TextPricingMode = "instant" | "batch";

export type SimpleModel = {
  model: string;
  priceUsd: number | null;
  pricingUnit?: "per_1k_characters" | "per_minute" | "per_500_extractions";
};

export type ImageModel = {
  size: string;
  priceUsd: number;
};

export const textModels: TextModel[] = [
  { model: "LingoFusion Nano", inputUsd: 0.15, outputUsd: 0.70 },
  { model: "LingoFusion Lite", inputUsd: 0.75, outputUsd: 3.00 },
  {
    model: "LingoFusion",
    inputUsd: 3.50,
    outputUsd: 20.00,
    recommended: true,
  },
  { model: "LingoFusion Pro", inputUsd: 4.00, outputUsd: 25.00 },
  { model: "ExplainFusion", inputUsd: 2.00, outputUsd: 10.00 },
  { model: "LingoFusion Ultra", inputUsd: 25.00, outputUsd: 150.00 },
];

export const textModelsByPricingMode: Record<TextPricingMode, TextModel[]> = {
  instant: textModels,
  batch: textModels.map((model) => ({
    ...model,
    inputUsd: model.inputUsd / 2,
    outputUsd: model.outputUsd / 2,
  })),
};

export const textModelPresentations: Record<string, TextModelPresentation> = {
  "LingoFusion Nano": {
    image: "/assets/models/lingofusion-nano.png",
    imageScale: 1.72,
    capability: "Fast, efficient translation for high-volume utility tasks and latency-sensitive workflows.",
    bestFor: "Simple, high-volume language tasks where speed and cost matter most.",
    features: ["Fast multilingual translation", "Text classification", "Structured extraction", "Low-latency responses"],
  },
  "LingoFusion Lite": {
    image: "/assets/models/lingofusion-lite.png",
    imageScale: 1.72,
    capability: "Low-cost translation, extraction, and classification for lightweight production work.",
    bestFor: "Lightweight production translation, extraction, and content processing.",
    features: ["Multilingual translation", "Summarization", "Entity extraction", "Structured outputs"],
  },
  LingoFusion: {
    image: "/assets/models/lingofusion.png",
    imageScale: 1,
    capability: "The recommended default for dependable everyday translation and text generation.",
    bestFor: "Most everyday translation, localization, and multilingual generation workloads.",
    features: ["High-quality translation", "Context preservation", "Text generation", "Streaming responses"],
  },
  "LingoFusion Pro": {
    image: "/assets/models/lingofusion-pro.png",
    imageScale: 1.72,
    capability: "Advanced translation with stronger context, tone, and terminology handling.",
    bestFor: "Professional localization and complex content requiring stronger reasoning.",
    features: ["Advanced context handling", "Terminology consistency", "Tone preservation", "Long-form translation"],
  },
  ExplainFusion: {
    image: "/assets/models/explainfusion.png",
    imageScale: 1.72,
    capability: "Explanation-focused translation, rewriting, and educational localization workflows.",
    bestFor: "Translations that need clear explanations, teaching context, or detailed rewrites.",
    features: ["Explanation generation", "Educational localization", "Step-by-step rewrites", "Contextual annotations"],
  },
  "LingoFusion Ultra": {
    image: "/assets/models/lingofusion-ultra.png",
    imageScale: 1.72,
    capability: "Highest-accuracy multilingual reasoning and long-form translation for demanding work.",
    bestFor: "The hardest multilingual work, specialist terminology, and document-scale review.",
    features: ["Maximum translation accuracy", "Specialist terminology", "Document consistency review", "Deep multilingual reasoning"],
  },
};

export const ttsModels: SimpleModel[] = [
  { model: "LingoFusion TTS Basic", priceUsd: 0.12, pricingUnit: "per_1k_characters" },
  { model: "LingoFusion TTS Advanced", priceUsd: 0.25, pricingUnit: "per_1k_characters" },
  { model: "LingoFusion Live Translate", priceUsd: 0.10, pricingUnit: "per_minute" },
];

export const transcriptionModels: SimpleModel[] = [
  { model: "LingoFusion Transcribe", priceUsd: 0.03, pricingUnit: "per_minute" },
  { model: "LingoFusion Transcribe Mini", priceUsd: 0.02, pricingUnit: "per_minute" },
  { model: "LingoFusion Transcribe Live", priceUsd: 0.07, pricingUnit: "per_minute" },
];

export const dubbingModels: SimpleModel[] = [
  { model: "LingoFusion Audio Dubbing", priceUsd: 4.99, pricingUnit: "per_minute" },
  { model: "LingoFusion Video Dub (Basic)", priceUsd: 4.99, pricingUnit: "per_minute" },
  { model: "LingoFusion Video Dub (Advanced)", priceUsd: 7.99, pricingUnit: "per_minute" },
];

export const musicModels: SimpleModel[] = [
  { model: "Aurora Music V1", priceUsd: 0.60, pricingUnit: "per_minute" },
  { model: "Aurora Music V2", priceUsd: 0.99, pricingUnit: "per_minute" },
];

export const imageModels: ImageModel[] = [
  { size: "Standard", priceUsd: 0.50 },
  { size: "4K", priceUsd: 1.00 },
  { size: "8K", priceUsd: 2.50 },
];

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
  "LingoFusion Nano",
  "LingoFusion TTS Advanced",
  "LingoFusion Live Translate",
  "LingoFusion Transcribe",
  "LingoFusion Transcribe Mini",
  "LingoFusion Transcribe Live",
  "LingoFusion Audio Dubbing",
  "LingoFusion Video Dub (Basic)",
  "LingoFusion Video Dub (Advanced)",
  "Aurora Music V1",
  "Aurora Music V2",
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
    "LingoFusion Nano",
    "LingoFusion Live Translate",
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
    "Generate, improve, summarize, and translate text with token-based language models.",
  "Speech generation":
    "Create natural voice output with Basic and Advanced text-to-speech models.",
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
    "Balanced premium model for product-grade translation, writing, and localization tasks.",
  ExplainFusion:
    "Premium model for explanation-heavy translation, rewriting, and educational localization workflows.",
  LingoFusion:
    "Recommended default model for most text generation and translation workloads.",
  "LingoFusion Lite":
    "Low-cost, fast model for simple translation, extraction, and classification.",
  "LingoFusion Nano":
    "Ultra-efficient model for high-volume utility tasks and latency-sensitive flows.",
  "LingoFusion TTS Advanced":
    "Expressive multilingual speech generation with strong pronunciation control.",
  "LingoFusion Live Translate":
    "Live translation model for real-time spoken language workflows.",
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
  "LingoFusion Audio Dubbing":
    "Production audio dubbing for localized speech with timing-aware output.",
  "LingoFusion Video Dub (Basic)":
    "Cost-effective video dubbing for standard localization workflows.",
  "LingoFusion Video Dub (Advanced)":
    "Premium video dubbing with enhanced timing, voice, and localization quality.",
  "Image Translate":
    "Image localization pipeline for screenshots, product images, and documents.",
};
