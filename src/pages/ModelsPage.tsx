import {
  ArrowRight,
  AudioWaveform,
  Check,
  CheckCircle2,
  ChevronRight,
  Code2,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Globe2,
  Layers,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
  Video,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { nativeLocalModels } from "../data/nativeLocal";
import { textModelPresentations, textModelsByPricingMode, webSearchPricing } from "../data/pricing";
import type { TextModel, TextPricingMode } from "../data/pricing";
import { SelectField } from "../components/shared/FormFields";

type CategoryFilter = "all" | "flagship" | "highspeed" | "multimodal";

type CloudFlagshipModel = {
  id: string;
  name: string;
  badge?: string;
  tagline: string;
  description: string;
  category: "flagship" | "highspeed";
  context: string;
  maxOutput: string;
  speed: string;
  ttft: string;
  inputPrice: number;
  outputPrice: number;
  languages: string;
  highlights: string[];
};

const flagshipCloudModels: CloudFlagshipModel[] = [
  {
    id: "lingofusion-pro",
    name: "LingoFusion Pro",
    badge: "Most Popular",
    tagline: "Frontier Multilingual & Cultural Localization",
    description:
      "Enterprise-grade foundation model engineered for high-fidelity cross-lingual translation, cultural nuance preservation, terminology consistency, and brand voice adaptation.",
    category: "flagship",
    context: "1,000,000 tokens",
    maxOutput: "384,000 tokens",
    speed: "~180 tok/sec",
    ttft: "180ms",
    inputPrice: 3.5,
    outputPrice: 18.0,
    languages: "100+ languages",
    highlights: [
      "Dynamic terminology & brand glossary adherence",
      "Context-aware formal / informal register switching",
      "Native Markdown, JSON, and HTML schema preservation",
      "Ultra-low hallucination rate on low-resource language pairs",
    ],
  },
  {
    id: "lingofusion-ultra",
    name: "LingoFusion Ultra",
    badge: "Frontier Reasoning",
    tagline: "Deep Cross-Lingual Reasoning & Complex Synthesis",
    description:
      "Specialized for multi-document synthesis, cross-lingual legal discovery, patent translation, clinical trial documentation, and high-stakes technical literature.",
    category: "flagship",
    context: "1,000,000 tokens",
    maxOutput: "384,000 tokens",
    speed: "~85 tok/sec",
    ttft: "320ms",
    inputPrice: 20.0,
    outputPrice: 120.0,
    languages: "100+ languages",
    highlights: [
      "Multi-step chain-of-thought verification for legal & regulatory text",
      "Long-context cross-document consistency guarantees",
      "Patent claim & clause-by-clause structured alignment",
      "Verified citation grounding with live web verification",
    ],
  },
  {
    id: "lingofusion-standard",
    name: "LingoFusion",
    badge: "High Throughput",
    tagline: "The Production Workhorse for Scaled APIs",
    description:
      "The default high-throughput model offering human-level fluency at exceptional speed. Perfect for real-time customer support, community platforms, and high-volume data ingestion.",
    category: "highspeed",
    context: "1,000,000 tokens",
    maxOutput: "384,000 tokens",
    speed: "Up to 400 tok/sec",
    ttft: "95ms",
    inputPrice: 1.0,
    outputPrice: 5.0,
    languages: "100+ languages",
    highlights: [
      "Industry-leading 400 tokens/second generation throughput",
      "Sub-100ms first-token latency for instant interactive experiences",
      "Automatic source-language auto-detection with dialect isolation",
      "High concurrency support with dedicated enterprise tiers",
    ],
  },
  {
    id: "lingofusion-lite",
    name: "LingoFusion Lite",
    badge: "Cost-Efficient",
    tagline: "Ultra-Fast Lightweight Model for Interactive Apps",
    description:
      "Engineered for latency-critical and cost-sensitive applications like conversational live chat, UI micro-copy localization, and search query translation.",
    category: "highspeed",
    context: "1,000,000 tokens",
    maxOutput: "128,000 tokens",
    speed: "450+ tok/sec",
    ttft: "65ms",
    inputPrice: 0.5,
    outputPrice: 2.0,
    languages: "85+ languages",
    highlights: [
      "Sub-70ms time-to-first-token for ultra-responsive web & mobile apps",
      "Optimized for short snippets, UI localization, and push notifications",
      "50% lower token cost than standard foundation models",
      "High burst-rate tolerance for multi-tenant SaaS workloads",
    ],
  },
  {
    id: "lingofusion-explain",
    name: "LingoFusion Explain",
    badge: "Linguistic Diagnostics",
    tagline: "Granular Linguistic Commentary & QA Verification",
    description:
      "Returns full translations alongside grammatical explanations, register commentary, alternate translations, and cultural context for human translators.",
    category: "flagship",
    context: "1,000,000 tokens",
    maxOutput: "128,000 tokens",
    speed: "~220 tok/sec",
    ttft: "140ms",
    inputPrice: 3.0,
    outputPrice: 2.0,
    languages: "90+ languages",
    highlights: [
      "Line-by-line morphological breakdown and syntactic rationales",
      "Side-by-side alternative translations with nuance score",
      "Linguistic confidence scores for automated quality assurance",
      "Ideal for post-editing translation environments & language learning",
    ],
  },
  {
    id: "lingofusion-nano",
    name: "LingoFusion Nano",
    badge: "Sub-10ms Edge",
    tagline: "Micro-Latency Streaming Subtitles & Autocomplete",
    description:
      "Ultra-compact model designed for live streaming video subtitles, in-game voice chat translation, and real-time predictive text.",
    category: "highspeed",
    context: "1,000,000 tokens",
    maxOutput: "64,000 tokens",
    speed: "500+ tok/sec",
    ttft: "25ms",
    inputPrice: 0.05,
    outputPrice: 0.5,
    languages: "60+ languages",
    highlights: [
      "Near-instantaneous inference suitable for live broadcast captions",
      "Extremely affordable at just $0.05 per million input tokens",
      "Minimal memory overhead with deterministic streaming chunks",
      "Available for offline WASM execution in web browsers",
    ],
  },
];

const multimodalOfferings = [
  {
    id: "speech",
    icon: AudioWaveform,
    title: "LingoFusion Speech & TTS",
    subtitle: "Neural Speech Synthesis & Voice Cloning",
    pricing: "From $0.015 / 1k characters",
    latency: "120ms first-audio chunk",
    description:
      "Generate studio-grade spoken audio in 85+ languages with nuanced emotional inflection, realistic breath pauses, and custom voice cloning from 3-second reference audio.",
    features: [
      "85+ native accents and regional dialects",
      "Zero-shot voice cloning with speaker timbre matching",
      "Streaming audio output via WebSockets & HTTP chunks",
      "Full SSML and prosody pitch/rate manipulation",
    ],
    demo: 'client.audio.speech.create({ model: "lingofusion-tts-v2", voice: "aurora-french", input: "Bienvenue à bord." })',
  },
  {
    id: "dubbing",
    icon: Video,
    title: "LingoFusion Studio Dubbing",
    subtitle: "End-to-End Multilingual Video Localization",
    pricing: "From $0.10 / minute",
    latency: "Synchronous or batch render",
    description:
      "Automated video dubbing pipeline that extracts original dialogue, translates scripts to target length constraints, clones speaker voices, and synchronizes video lip motion.",
    features: [
      "Time-aligned translation preserving video syllable timing",
      "Automatic background music and Foley track preservation",
      "Multi-speaker separation and individual speaker diarization",
      "Broadcast-quality MP4, MOV, and SRT/VTT subtitle outputs",
    ],
    demo: 'client.dubbing.create({ videoUrl: "https://...", targetLanguages: ["es", "ja", "de"], lipSync: true })',
  },
  {
    id: "vision",
    icon: Eye,
    title: "LingoFusion Vision & Document OCR",
    subtitle: "Layout-Preserving PDF, Image & UI Translation",
    pricing: "From $0.02 / page or image",
    latency: "Sub-second OCR & inpainting",
    description:
      "Translate complex multi-column PDFs, technical diagrams, infographics, and UI screenshots while retaining fonts, vectors, bounding boxes, and styling perfectly.",
    features: [
      "Pixel-level font size and styling replication for translated text",
      "Complex multi-column PDF and table structure preservation",
      "Diagram and flow chart label inpainting and localization",
      "Exports directly to editable PDF, SVG, DOCX, or Figma formats",
    ],
    demo: 'client.vision.translateDocument({ file: contractPdf, targetLang: "de", outputFormat: "pdf_layout_preserved" })',
  },
];

const openWeightModels = [
  {
    name: "LingoFusion Native-1.7B",
    parameters: "1.7 Billion",
    quantization: "Q4_K_M / Q8_0 / BF16",
    ramMin: "8 GB RAM",
    vramMin: "4 GB VRAM",
    context: "32,000 tokens",
    bestFor: "Mobile, Raspberry Pi 5, edge devices, and offline lightweight translation.",
    ollamaCommand: "ollama run lingofusion/native:1.7b",
  },
  {
    name: "LingoFusion Native-9B",
    parameters: "9.0 Billion",
    quantization: "Q4_K_M / Q8_0 / BF16",
    ramMin: "16 GB RAM",
    vramMin: "8 GB VRAM",
    context: "64,000 tokens",
    badge: "Recommended",
    bestFor: "Mac M1/M2/M3/M4 & RTX 4070+. Outstanding fluency and translation fidelity.",
    ollamaCommand: "ollama run lingofusion/native:9b",
  },
  {
    name: "LingoFusion Native-35B",
    parameters: "35.0 Billion",
    quantization: "Q4_K_M / Q8_0 / BF16",
    ramMin: "32 GB RAM",
    vramMin: "24 GB VRAM",
    context: "128,000 tokens",
    bestFor: "High-end workstations and private on-prem clusters requiring frontier local quality.",
    ollamaCommand: "ollama run lingofusion/native:35b",
  },
];

export function ModelsPage({ onOpenModel }: { onOpenModel: (model: string) => void }) {
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [search, setSearch] = useState("");
  const [pricingMode, setPricingMode] = useState<TextPricingMode>("instant");
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState<"curl" | "python" | "typescript">("curl");
  const [compareLeft, setCompareLeft] = useState("LingoFusion Pro");
  const [compareRight, setCompareRight] = useState("LingoFusion");

  const displayedCloudModels = flagshipCloudModels.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase().trim()) ||
      m.tagline.toLowerCase().includes(search.toLowerCase().trim()) ||
      m.description.toLowerCase().includes(search.toLowerCase().trim());
    if (!matchesSearch) return false;

    if (filter === "flagship") return m.category === "flagship";
    if (filter === "highspeed") return m.category === "highspeed";
    return true;
  });

  const codeSnippets = {
    curl: `curl https://api.lingofusion.com/v1/chat/completions \\
  -H "Authorization: Bearer $LINGOFUSION_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "lingofusion-pro",
    "messages": [
      {
        "role": "system",
        "content": "You are a professional localization engine with formal register."
      },
      {
        "role": "user",
        "content": "Translate to Japanese: We are pleased to announce our global enterprise rollout."
      }
    ],
    "temperature": 0.2
  }'`,
    python: `from lingofusion import LingoFusion

client = LingoFusion(api_key="lf_live_...")

response = client.chat.completions.create(
    model="lingofusion-pro",
    messages=[
        {"role": "system", "content": "You are an enterprise localization engine."},
        {"role": "user", "content": "Translate to German: Our Q3 financial statements are ready."}
    ],
    temperature=0.2,
)

print(response.choices[0].message.content)`,
    typescript: `import { LingoFusion } from "@lingofusion/sdk";

const client = new LingoFusion({
  apiKey: process.env.LINGOFUSION_API_KEY,
});

const completion = await client.chat.completions.create({
  model: "lingofusion-pro",
  messages: [
    { role: "system", content: "You are an enterprise localization engine." },
    { role: "user", content: "Translate to Spanish: Real-time sync is now enabled." },
  ],
  temperature: 0.2,
});

console.log(completion.choices[0].message.content);`,
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(codeSnippets[activeCodeTab]);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // ignore
    }
  };

  const selectedLeft = flagshipCloudModels.find((m) => m.name === compareLeft) ?? flagshipCloudModels[0];
  const selectedRight = flagshipCloudModels.find((m) => m.name === compareRight) ?? flagshipCloudModels[2];

  return (
    <div className="mx-auto max-w-6xl pb-24 text-neutral-900 dark:text-neutral-100">
      {/* Hero Section */}
      <section className="border-b border-neutral-200/80 pb-14 pt-4 dark:border-neutral-800/80">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
            <Sparkles className="h-3.5 w-3.5 text-neutral-950 dark:text-neutral-200" />
            LingoFusion Model Catalog v2.4
          </span>
          <span className="hidden text-xs text-neutral-400 sm:inline">&bull;</span>
          <span className="hidden text-xs text-neutral-500 sm:inline">Updated Q4 2026</span>
        </div>

        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-neutral-950 sm:text-5xl lg:text-6xl dark:text-white">
          Frontier Models for Global Intelligence
        </h1>

        <p className="mt-5 max-w-3xl text-base leading-7 text-neutral-600 sm:text-lg dark:text-neutral-400">
          Build high-fidelity localization, real-time voice translation, and cross-lingual AI workflows with LingoFusion’s family of production-ready foundation models. Engineered for extreme token throughput, cultural nuance, and sub-100ms latency.
        </p>

        {/* Quick Links & Platform Highlights */}
        <div className="mt-8 flex flex-wrap items-center gap-4 text-xs font-medium sm:text-sm">
          <a
            href="#cloud-models"
            className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-950 px-4 py-2 text-white transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
          >
            Explore Flagship Models
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
          <a
            href="#compare"
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-neutral-800 transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            Side-by-Side Comparator
          </a>
          <a
            href="#multimodal"
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-4 py-2 text-neutral-700 hover:text-neutral-950 dark:border-neutral-800 dark:text-neutral-400 dark:hover:text-white"
          >
            Voice & Dubbing
          </a>
          <a
            href="#self-hosted"
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-4 py-2 text-neutral-700 hover:text-neutral-950 dark:border-neutral-800 dark:text-neutral-400 dark:hover:text-white"
          >
            Open Weights (Native)
          </a>
        </div>

        {/* Live Metrics Row */}
        <div className="mt-12 grid grid-cols-2 gap-4 border-t border-neutral-200/80 pt-8 sm:grid-cols-4 dark:border-neutral-800/80">
          <div>
            <p className="font-mono text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">100+</p>
            <p className="text-xs text-neutral-500">Supported Languages</p>
          </div>
          <div>
            <p className="font-mono text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">400 tok/s</p>
            <p className="text-xs text-neutral-500">Peak Production Speed</p>
          </div>
          <div>
            <p className="font-mono text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">1,000,000</p>
            <p className="text-xs text-neutral-500">Token Context Window</p>
          </div>
          <div>
            <p className="font-mono text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">&lt; 95ms</p>
            <p className="text-xs text-neutral-500">Time to First Token (TTFT)</p>
          </div>
        </div>
      </section>

      {/* Flagship Cloud Models Showcase */}
      <section id="cloud-models" className="mt-14 scroll-mt-20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl dark:text-white">
              The Flagship Cloud Lineup
            </h2>
            <p className="mt-1.5 text-xs text-neutral-500 sm:text-sm">
              Hosted on high-speed global clusters with instant API access and enterprise SLA guarantees.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-neutral-200/80 bg-neutral-50/60 p-1 dark:border-neutral-800/80 dark:bg-neutral-900/60">
            {(
              [
                { id: "all", label: "All Cloud Models" },
                { id: "flagship", label: "Frontier & Reasoning" },
                { id: "highspeed", label: "High Speed & Edge" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  filter === tab.id
                    ? "bg-white text-neutral-950 shadow-xs dark:bg-neutral-800 dark:text-white"
                    : "text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Search */}
        <div className="mt-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by capability, name, or speed..."
              className="h-9 w-full rounded-lg border border-neutral-200 bg-white pl-8 pr-3 text-xs text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
            />
          </div>
        </div>

        {/* Cards Grid */}
        <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {displayedCloudModels.map((model) => (
            <div
              key={model.id}
              onClick={() => onOpenModel(model.name)}
              className="group flex flex-col justify-between rounded-xl border border-neutral-200/80 bg-white p-6 shadow-xs transition hover:border-neutral-400 hover:shadow-md dark:border-neutral-800 dark:bg-[#111113] dark:hover:border-neutral-600 cursor-pointer"
            >
              <div>
                {/* Header row */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight text-neutral-950 group-hover:text-black dark:text-white">
                      {model.name}
                    </h3>
                    <p className="mt-0.5 text-xs font-medium text-neutral-500">{model.tagline}</p>
                  </div>
                  {model.badge && (
                    <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[10px] font-semibold text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
                      {model.badge}
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="mt-4 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                  {model.description}
                </p>

                {/* Highlights List */}
                <ul className="mt-4 space-y-2 border-t border-neutral-100 pt-4 dark:border-neutral-800/80">
                  {model.highlights.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-[11px] text-neutral-600 dark:text-neutral-400">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Footer specs */}
              <div className="mt-6 border-t border-neutral-100 pt-4 text-xs dark:border-neutral-800/80">
                <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                  <div>
                    <span className="text-neutral-500">Speed:</span>{" "}
                    <span className="font-semibold text-neutral-900 dark:text-white">{model.speed}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Context:</span>{" "}
                    <span className="font-semibold text-neutral-900 dark:text-white">{model.context}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Input / 1M:</span>{" "}
                    <span className="font-semibold text-neutral-900 dark:text-white">${model.inputPrice.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Output / 1M:</span>{" "}
                    <span className="font-semibold text-neutral-900 dark:text-white">${model.outputPrice.toFixed(2)}</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-neutral-500">
                    {model.languages}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-950 group-hover:translate-x-0.5 transition dark:text-white">
                    View docs <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Multimodal Spotlight (Speech, Dubbing, Vision) */}
      <section id="multimodal" className="mt-20 scroll-mt-20 border-t border-neutral-200/80 pt-14 dark:border-neutral-800/80">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
            Audio, Video & Vision
          </span>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl dark:text-white">
            Multimodal Generation APIs
          </h2>
          <p className="mt-2 max-w-2xl text-xs text-neutral-600 sm:text-sm dark:text-neutral-400">
            Extend beyond text with neural speech synthesis in 85+ languages, automated studio dubbing with lip synchronization, and layout-preserving PDF translation.
          </p>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {multimodalOfferings.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="flex flex-col justify-between rounded-xl border border-neutral-200/80 bg-white p-6 dark:border-neutral-800 dark:bg-[#111113]"
              >
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white">
                    <Icon className="h-5 w-5" />
                  </div>

                  <h3 className="mt-4 text-base font-semibold text-neutral-950 dark:text-white">
                    {item.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-neutral-500">{item.subtitle}</p>

                  <p className="mt-3 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                    {item.description}
                  </p>

                  <ul className="mt-4 space-y-2 border-t border-neutral-100 pt-4 dark:border-neutral-800/80">
                    {item.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-[11px] text-neutral-600 dark:text-neutral-400">
                        <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 border-t border-neutral-100 pt-4 dark:border-neutral-800/80">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-neutral-500">Pricing:</span>
                    <span className="font-semibold text-neutral-900 dark:text-white">{item.pricing}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenModel("Playground")}
                    className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-neutral-200 py-2 text-xs font-medium text-neutral-900 transition hover:bg-neutral-50 dark:border-neutral-800 dark:text-white dark:hover:bg-neutral-800"
                  >
                    Test in Playground &rarr;
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Interactive Quickstart Code Box (OpenAI Developer Style) */}
      <section className="mt-20 border-t border-neutral-200/80 pt-14 dark:border-neutral-800/80">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl dark:text-white">
              Instant API Integration
            </h2>
            <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
              Drop-in OpenAI SDK compatibility. Simply update the base URL and API key.
            </p>
          </div>

          {/* Language selector tabs */}
          <div className="flex items-center gap-1 rounded-lg border border-neutral-200/80 bg-neutral-100/70 p-0.5 dark:border-neutral-800 dark:bg-neutral-900">
            {(
              [
                { id: "curl", label: "cURL" },
                { id: "python", label: "Python" },
                { id: "typescript", label: "Node.js (TypeScript)" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCodeTab(tab.id)}
                className={`rounded px-3 py-1 text-xs font-medium transition ${
                  activeCodeTab === tab.id
                    ? "bg-white text-neutral-950 shadow-xs dark:bg-neutral-800 dark:text-white"
                    : "text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Code Container */}
        <div className="relative mt-5 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-950 text-neutral-200 shadow-md dark:border-neutral-800">
          <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2.5 text-xs text-neutral-400">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
              <span className="ml-2 font-mono text-[11px] text-neutral-400">
                {activeCodeTab === "curl" ? "terminal" : activeCodeTab === "python" ? "translate.py" : "translate.ts"}
              </span>
            </div>

            <button
              type="button"
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-neutral-300 transition hover:bg-neutral-800 hover:text-white"
            >
              {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedCode ? "Copied" : "Copy"}</span>
            </button>
          </div>

          <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-neutral-200">
            <code>{codeSnippets[activeCodeTab]}</code>
          </pre>
        </div>
      </section>

      {/* Side-by-Side Model Comparator */}
      <section id="compare" className="mt-20 scroll-mt-20 border-t border-neutral-200/80 pt-14 dark:border-neutral-800/80">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl dark:text-white">
              Model Comparator
            </h2>
            <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
              Inspect two flagship models side-by-side across speed, token throughput, and pricing tiers.
            </p>
          </div>

          {/* Pricing mode pills */}
          <div className="flex items-center gap-1 rounded-lg border border-neutral-200 p-0.5 dark:border-neutral-800">
            {(["instant", "batch", "fast", "ultrafast"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPricingMode(mode)}
                className={`rounded px-2.5 py-1 text-xs font-medium capitalize transition ${
                  pricingMode === mode
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                }`}
              >
                {mode === "instant" ? "Default" : mode === "batch" ? "Batch (-50%)" : mode}
              </button>
            ))}
          </div>
        </div>

        {/* Model Selectors */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <SelectField label="Model A" value={selectedLeft.name} onChange={setCompareLeft}>
            {flagshipCloudModels.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name} ({m.tagline})
              </option>
            ))}
          </SelectField>

          <SelectField label="Model B" value={selectedRight.name} onChange={setCompareRight}>
            {flagshipCloudModels.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name} ({m.tagline})
              </option>
            ))}
          </SelectField>
        </div>

        {/* Comparison Boxes */}
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <ComparatorCard
            model={selectedLeft}
            mode={pricingMode}
            onOpen={() => onOpenModel(selectedLeft.name)}
          />
          <ComparatorCard
            model={selectedRight}
            mode={pricingMode}
            onOpen={() => onOpenModel(selectedRight.name)}
          />
        </div>
      </section>

      {/* Cloud Flagship Pricing Matrix (Clean Table) */}
      <section className="mt-20 border-t border-neutral-200/80 pt-14 dark:border-neutral-800/80">
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl dark:text-white">
          Cloud Models Pricing Matrix
        </h2>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          Transparent per-token rates with no hidden fees or minimum commitments.
        </p>

        <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-[#111113]">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/70 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-400">
                <th className="py-3.5 pl-6 pr-4 font-semibold uppercase tracking-wider">Model</th>
                <th className="py-3.5 pr-4 font-semibold uppercase tracking-wider">Context</th>
                <th className="py-3.5 pr-4 font-semibold uppercase tracking-wider">Speed</th>
                <th className="py-3.5 pr-4 font-semibold uppercase tracking-wider">Input / 1M</th>
                <th className="py-3.5 pr-4 font-semibold uppercase tracking-wider">Output / 1M</th>
                <th className="py-3.5 pr-6 text-right font-semibold uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
              {flagshipCloudModels.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => onOpenModel(m.name)}
                  className="group cursor-pointer hover:bg-neutral-50/80 dark:hover:bg-neutral-900/40"
                >
                  <td className="py-4 pl-6 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-neutral-950 group-hover:underline dark:text-white">
                        {m.name}
                      </span>
                      {m.badge && (
                        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                          {m.badge}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-neutral-500">{m.tagline}</p>
                  </td>
                  <td className="py-4 pr-4 font-mono text-neutral-700 dark:text-neutral-300">
                    {m.context}
                  </td>
                  <td className="py-4 pr-4 font-mono text-neutral-700 dark:text-neutral-300">
                    {m.speed}
                  </td>
                  <td className="py-4 pr-4 font-mono font-medium text-neutral-950 dark:text-white">
                    ${m.inputPrice.toFixed(2)}
                  </td>
                  <td className="py-4 pr-4 font-mono font-medium text-neutral-950 dark:text-white">
                    ${m.outputPrice.toFixed(2)}
                  </td>
                  <td className="py-4 pr-6 text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-950 group-hover:translate-x-0.5 transition dark:text-white">
                      Explore &rarr;
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Web Search Grounding Rates */}
      <section className="mt-14 border-t border-neutral-200/80 pt-10 dark:border-neutral-800/80">
        <h3 className="text-lg font-semibold text-neutral-950 dark:text-white">
          Web Search Grounding Rates
        </h3>
        <p className="mt-0.5 text-xs text-neutral-500">
          Per-query live search retrieval rates when verifying dynamic claims against public web sources.
        </p>

        <div className="mt-4 max-w-lg overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/50">
              <tr>
                <th className="px-4 py-2.5 font-medium text-neutral-600 dark:text-neutral-400">Model</th>
                <th className="px-4 py-2.5 font-medium text-neutral-600 dark:text-neutral-400">Rate per Grounded Call</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {webSearchPricing.map(({ model, priceUsd }) => (
                <tr key={model}>
                  <td className="px-4 py-2.5 font-medium text-neutral-900 dark:text-white">{model}</td>
                  <td className="px-4 py-2.5 font-mono text-neutral-700 dark:text-neutral-300">${priceUsd.toString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Dedicated Clean Section: Self-Hosted Open Weights (Kept Separate & Discreet) */}
      <section id="self-hosted" className="mt-20 scroll-mt-20 border-t border-neutral-200/80 pt-14 dark:border-neutral-800/80">
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-8 sm:p-10 dark:border-neutral-800 dark:bg-[#101012]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-semibold text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
                <Download className="h-3.5 w-3.5" />
                Self-Hosted & Edge Weights (Native)
              </span>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl dark:text-white">
                Private On-Premises & Workstation Deployment
              </h2>
              <p className="mt-1.5 max-w-2xl text-xs text-neutral-600 sm:text-sm dark:text-neutral-400">
                Prefer executing inference entirely on your private hardware? LingoFusion Native open weights can be run offline via Ollama, LM Studio, vLLM, or llama.cpp under a commercial-friendly license.
              </p>
            </div>
            <a
              href="https://huggingface.co/lingofusion"
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:hover:bg-neutral-700"
            >
              Hugging Face Hub
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Native Open-Weight Cards */}
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {openWeightModels.map((item) => (
              <div
                key={item.name}
                className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-5 shadow-xs dark:border-neutral-800 dark:bg-neutral-950"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
                      {item.name}
                    </h3>
                    {item.badge && (
                      <span className="rounded bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
                        {item.badge}
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
                    {item.bestFor}
                  </p>

                  <div className="mt-4 space-y-1.5 border-t border-neutral-100 pt-3 text-[11px] font-mono text-neutral-600 dark:border-neutral-800/80 dark:text-neutral-400">
                    <div>Params: <strong className="text-neutral-900 dark:text-white">{item.parameters}</strong></div>
                    <div>Hardware: <strong className="text-neutral-900 dark:text-white">{item.ramMin} / {item.vramMin}</strong></div>
                    <div>Context: <strong className="text-neutral-900 dark:text-white">{item.context}</strong></div>
                    <div>Format: <strong className="text-neutral-900 dark:text-white">{item.quantization}</strong></div>
                  </div>
                </div>

                <div className="mt-5 border-t border-neutral-100 pt-3 dark:border-neutral-800/80">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">Run with Ollama</p>
                  <code className="mt-1 block overflow-x-auto rounded bg-neutral-100 px-2 py-1 font-mono text-[11px] text-neutral-900 dark:bg-neutral-900 dark:text-neutral-200">
                    {item.ollamaCommand}
                  </code>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function ComparatorCard({
  model,
  mode,
  onOpen,
}: {
  model: CloudFlagshipModel;
  mode: TextPricingMode;
  onOpen: () => void;
}) {
  const multiplier = mode === "batch" ? 0.5 : mode === "fast" ? 1.5 : mode === "ultrafast" ? 4.0 : 1.0;
  const inPrice = (model.inputPrice * multiplier).toFixed(2);
  const outPrice = (model.outputPrice * multiplier).toFixed(2);

  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white p-6 dark:border-neutral-800 dark:bg-[#111113]">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-neutral-950 dark:text-white">{model.name}</h3>
          <p className="text-xs text-neutral-500">{model.tagline}</p>
        </div>
        <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-[10px] uppercase font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
          {mode} tier
        </span>
      </div>

      <dl className="mt-5 space-y-3 divide-y divide-neutral-100 text-xs dark:divide-neutral-800/60">
        <div className="flex justify-between pt-3">
          <dt className="text-neutral-500">Input per 1M Tokens</dt>
          <dd className="font-mono font-semibold text-neutral-950 dark:text-white">${inPrice}</dd>
        </div>
        <div className="flex justify-between pt-3">
          <dt className="text-neutral-500">Output per 1M Tokens</dt>
          <dd className="font-mono font-semibold text-neutral-950 dark:text-white">${outPrice}</dd>
        </div>
        <div className="flex justify-between pt-3">
          <dt className="text-neutral-500">Context Window</dt>
          <dd className="font-mono font-semibold text-neutral-950 dark:text-white">{model.context}</dd>
        </div>
        <div className="flex justify-between pt-3">
          <dt className="text-neutral-500">Peak Generation Speed</dt>
          <dd className="font-mono font-semibold text-neutral-950 dark:text-white">{model.speed}</dd>
        </div>
        <div className="flex justify-between pt-3">
          <dt className="text-neutral-500">Time-to-First-Token</dt>
          <dd className="font-mono font-semibold text-neutral-950 dark:text-white">{model.ttft}</dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={onOpen}
        className="mt-6 inline-flex w-full items-center justify-center rounded-lg border border-neutral-200 py-2 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-50 dark:border-neutral-800 dark:text-white dark:hover:bg-neutral-800"
      >
        View full documentation &rarr;
      </button>
    </div>
  );
}
