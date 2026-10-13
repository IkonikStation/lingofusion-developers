import {
  Activity,
  ArrowLeft,
  BadgeDollarSign,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Copy,
  FileText,
  Gauge,
  Globe2,
  Layers3,
  Sparkles,
  Type,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { formatCurrencyAmount } from "../data/currency";
import { nativeLocalModels } from "../data/nativeLocal";
import { modelPriceTone } from "../data/priceTone";
import { textModelPresentations, textModelsByPricingMode } from "../data/pricing";
import type { TextModel, TextPricingMode } from "../data/pricing";
import { modelSlug } from "../lib/utils";
import { ModelIcon, RatingMarks } from "../components/shared/FormFields";

export type ModelProfileSpec = {
  reasoning: string;
  reasoningLevel: number;
  speed: string;
  speedLevel: number;
  speedRank?: number;
  tokensPerSecond?: string;
  contextWindow: string;
  maxOutput: string;
  quality: string;
  description: string;
  limitations: string[];
};

export const modelProfileSpecs: Record<string, ModelProfileSpec> = {
  "LingoFusion Native-1.7B": {
    reasoning: "Minimal",
    reasoningLevel: 1,
    speed: "Hardware-dependent",
    speedLevel: 0,
    contextWindow: "32,000",
    maxOutput: "32,000",
    quality: "Practical local",
    description: "LingoFusion Native-1.7B runs directly on your computer for lightweight, everyday translation without the LingoFusion cloud API, API credits, or monthly character allowances.",
    limitations: ["Performance depends on your local hardware", "Best for everyday and straightforward source text", "Not intended for specialist terminology or document-scale review"],
  },
  "LingoFusion Native-9B": {
    reasoning: "Steady",
    reasoningLevel: 3,
    speed: "Hardware-dependent",
    speedLevel: 0,
    contextWindow: "Build-specific",
    maxOutput: "Build-specific",
    quality: "Capable local",
    description: "LingoFusion Native-9B is the recommended free local model for most users, combining strong translation quality, practical speed, and 16 GB-class hardware requirements without cloud API usage.",
    limitations: ["A compatible local build is required", "Exact context, output, download size, and quantization depend on the chosen build", "Not available through the LingoFusion cloud API or Playground"],
  },
  "LingoFusion Native-35B": {
    reasoning: "Higher",
    reasoningLevel: 4,
    speed: "Hardware-dependent",
    speedLevel: 0,
    contextWindow: "128,000",
    maxOutput: "32,000",
    quality: "Premium local",
    description: "LingoFusion Native-35B runs directly on your computer and is designed to provide the highest local translation quality in the Native family, without consuming cloud API credits or monthly character allowances.",
    limitations: ["Requires powerful local hardware and substantial storage", "Performance depends on CPU, GPU, memory, and local runtime settings", "Not available through the LingoFusion cloud API or Playground"],
  },
  "LingoFusion Nano": {
    reasoning: "Light",
    reasoningLevel: 1,
    speed: "Fast",
    speedLevel: 3,
    speedRank: 4,
    contextWindow: "400,000",
    maxOutput: "128,000",
    quality: "Fluent",
    description: "LingoFusion Nano is the smallest and fastest model in the LingoFusion family. It is engineered for high-volume, latency-sensitive work where speed and cost matter more than deep linguistic analysis. Nano handles short, clearly structured text with ease — ideal for classification, extraction, quick translations, and real-time interfaces. It is the lightest way to add LingoFusion to your workflow.",
    limitations: ["Best with short or clearly structured source text", "Limited terminology research", "Not intended for document-scale review"],
  },
  "LingoFusion Lite": {
    reasoning: "Standard",
    reasoningLevel: 2,
    speed: "Fast",
    speedLevel: 4,
    speedRank: 3,
    contextWindow: "400,000",
    maxOutput: "128,000",
    quality: "Native-Level",
    description: "LingoFusion Lite is the second-smallest model in the family, offering a meaningful step up in multilingual comprehension while staying fast and affordable. It balances low cost with stronger understanding for production translation, extraction, classification, and summarization. Lite is the sweet spot for teams that want better quality than Nano without paying for the full LingoFusion tier.",
    limitations: ["May simplify highly specialized language", "Limited cross-document consistency", "Complex tone may require review"],
  },
  LingoFusion: {
    reasoning: "Focused",
    reasoningLevel: 3,
    speed: "Fastest",
    speedLevel: 4,
    speedRank: 1,
    tokensPerSecond: "up to 400 tokens/sec",
    contextWindow: "1,000,000",
    maxOutput: "384,000",
    quality: "Expert Linguist",
    description: "LingoFusion is the recommended default, the dependable all-rounder of the family, and the fastest model we offer — reaching up to 400 tokens per second. It delivers high-quality, natural translation and multilingual generation across everyday workloads, balancing quality, latency, and cost. Whether you are localizing a product, translating documents, or generating multilingual content, LingoFusion handles it reliably — which is why it is the model most developers reach for.",
    limitations: ["Specialist terminology may benefit from supplied glossaries", "Long legal or medical documents should be reviewed", "Deep research is reserved for higher tiers"],
  },
  "LingoFusion Pro": {
    reasoning: "Higher",
    reasoningLevel: 4,
    speed: "Moderate",
    speedLevel: 2,
    speedRank: 5,
    contextWindow: "1,000,000",
    maxOutput: "384,000",
    quality: "Professional Translator",
    description: "LingoFusion Pro is a professional-grade translator built for complex, high-stakes localization. It preserves context, tone, and ambiguity across long documents, keeps terminology consistent, and handles specialized subject matter with care. When accuracy and nuance are non-negotiable — legal, medical, technical, or marketing content — Pro delivers professional-quality results you can trust.",
    limitations: ["Higher latency than standard LingoFusion", "Very long jobs may be better suited to Batch", "Human review remains recommended for regulated content"],
  },
  "LingoFusion Explain": {
    reasoning: "Higher",
    reasoningLevel: 4,
    speed: "Very fast",
    speedLevel: 4,
    speedRank: 2,
    contextWindow: "1,000,000",
    maxOutput: "384,000",
    quality: "Insightful",
    description: "LingoFusion Explain specializes in translations that must also teach, explain, annotate, or clearly justify language choices for readers and reviewers.",
    limitations: ["Explanations increase output length", "Not the lowest-cost choice for direct translation", "Concise mode is recommended for simple requests"],
  },
  "LingoFusion Ultra": {
    reasoning: "Maximum",
    reasoningLevel: 4,
    speed: "Deliberate",
    speedLevel: 1,
    speedRank: 6,
    contextWindow: "1,050,000",
    maxOutput: "384,000",
    quality: "Master Linguist",
    description: "LingoFusion Ultra is built for the hardest multilingual work, with maximum reasoning, specialist terminology handling, and document-scale consistency review. Standard pricing applies up to 272K input tokens. Long pricing applies above 272K input tokens. Fast processing has separate Fast and Fast + Long rates. All rates below are per 1M input and output tokens.",
    limitations: ["Highest price in the LingoFusion text family", "Longer response time for deep analysis", "Batch is recommended for large non-urgent jobs"],
  },
};

export function ModelDetailPage({
  modelName,
  onBack,
  onCompare,
  onOpenPlayground,
}: {
  modelName: string;
  onBack: () => void;
  onCompare: () => void;
  onOpenPlayground: () => void;
}) {
  const defaultModel = textModelsByPricingMode.instant.find((model) => model.model === modelName);
  const batchModel = textModelsByPricingMode.batch.find((model) => model.model === modelName);
  const fastModel = textModelsByPricingMode.fast.find((model) => model.model === modelName);
  const presentation = textModelPresentations[modelName];
  const profile = modelProfileSpecs[modelName];
  const [pricingMode, setPricingMode] = useState<TextPricingMode>("instant");
  const [comparisonMetric, setComparisonMetric] = useState<"input" | "output">("input");
  const [copied, setCopied] = useState<"model" | "request" | null>(null);

  if (!defaultModel || !presentation || !profile) return null;

  const price = (value: number) => formatCurrencyAmount(value, "USD", 1, true);
  const apiModelId = modelSlug(modelName);
  const isLocalModel = Boolean(defaultModel.local);
  const hasBatchPricing = Boolean(batchModel);
  const localModel = isLocalModel ? nativeLocalModels[modelName as keyof typeof nativeLocalModels] : null;
  const ultrafastModel = textModelsByPricingMode.ultrafast.find((model) => model.model === modelName);
  const activePrice =
    pricingMode === "fast" && fastModel
      ? fastModel
      : pricingMode === "ultrafast" && ultrafastModel
      ? ultrafastModel
      : pricingMode === "batch" && hasBatchPricing
      ? batchModel!
      : defaultModel;
  const comparisonModels = textModelsByPricingMode[pricingMode];
  const comparisonMax = Math.max(
    ...comparisonModels.map((model) => model[comparisonMetric === "input" ? "inputUsd" : "outputUsd"]),
  );

  const requestSnippet = `curl https://api.lingofusion.ai/v1/translate \\
  -H "Authorization: Bearer $LINGOFUSION_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${apiModelId}",${pricingMode === "fast" ? '\n    "pricing_mode": "fast",' : ""}
    "source_language": "en",
    "target_language": "fr",
    "input": "Build for every language."
  }'`;

  const copyText = async (text: string, target: "model" | "request") => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setCopied(target);
    window.setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="mx-auto max-w-6xl pb-20">
      <button
        type="button"
        onClick={onBack}
        className="pressable inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All Models
      </button>

      <header className="site-reveal mt-6">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
            <ModelIcon presentation={presentation} size="detail" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="min-w-0 break-words text-3xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-4xl">
                  {modelName}
                </h1>
                {!isLocalModel && hasBatchPricing && (
                  <select
                    value={pricingMode}
                    onChange={(event) => setPricingMode(event.target.value as TextPricingMode)}
                    aria-label="Processing mode"
                    className="clean-select h-8 rounded-full border border-neutral-300/80 bg-neutral-100/80 px-3 text-xs font-semibold text-neutral-800 outline-none transition hover:border-neutral-400 dark:border-white/10 dark:bg-white/[0.06] dark:text-neutral-200"
                  >
                    <option value="instant">Default</option>
                    <option value="batch">Batch (-50%)</option>
                    {fastModel && <option value="fast">Fast</option>}
                    {ultrafastModel && <option value="ultrafast">Ultrafast</option>}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => copyText(apiModelId, "model")}
                  aria-label="Copy model ID"
                  className="pressable inline-flex items-center gap-1 rounded-lg border border-neutral-200/80 bg-neutral-100/60 px-2.5 py-1 text-xs font-mono text-neutral-600 hover:bg-neutral-200/60 hover:text-neutral-950 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-300 dark:hover:bg-white/10"
                >
                  <Copy className="h-3 w-3" />
                  <span>{apiModelId}</span>
                  {copied === "model" && <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Copied</span>}
                </button>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                {presentation.capability}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 xl:shrink-0">
            <button
              type="button"
              onClick={onCompare}
              className="pressable inline-flex min-h-11 items-center justify-center rounded-xl border border-neutral-200/90 bg-white px-5 py-2 text-sm font-semibold text-neutral-900 shadow-xs transition hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
            >
              Compare Model
            </button>
            <button
              type="button"
              onClick={onOpenPlayground}
              className="pressable inline-flex min-h-11 items-center justify-center rounded-xl bg-neutral-950 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
            >
              Try in Playground
            </button>
          </div>
        </div>
      </header>

      {/* Metric Cards Banner */}
      <section className="site-reveal mt-8 overflow-hidden rounded-2xl border border-neutral-200/90 shadow-xs dark:border-white/[0.08]" aria-label="Model summary">
        <div className="grid gap-px bg-neutral-200/80 dark:bg-white/[0.08] sm:grid-cols-2 lg:grid-cols-5">
          <div className="bg-white p-5 text-center dark:bg-[#0e0e11]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Reasoning</p>
            <div className="mt-3"><RatingMarks value={profile.reasoningLevel} icon={BrainCircuit} /></div>
            <p className="mt-2 text-xs font-semibold text-neutral-800 dark:text-neutral-200">{profile.reasoning}</p>
          </div>
          <div className="bg-white p-5 text-center dark:bg-[#0e0e11]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Speed</p>
            {isLocalModel ? (
              <>
                <Gauge className="mx-auto mt-3 h-5 w-5 text-neutral-700 dark:text-neutral-300" />
                <p className="mt-2 text-xs font-semibold text-neutral-800 dark:text-neutral-200">Hardware Dependent</p>
              </>
            ) : (
              <>
                <div className="mt-3"><RatingMarks value={profile.speedLevel} icon={Zap} /></div>
                <p className="mt-2 text-xs font-semibold text-neutral-800 dark:text-neutral-200">{profile.speed}</p>
              </>
            )}
          </div>
          <div className="bg-white p-5 text-center dark:bg-[#0e0e11]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Price (USD)</p>
            <p className={`mt-2 font-mono text-base font-bold ${modelPriceTone(modelName)}`}>
              {isLocalModel ? "Free (Local)" : `${price(activePrice.inputUsd)} / ${price(activePrice.outputUsd)}`}
            </p>
            <p className="mt-1 text-[11px] text-neutral-500">Per 1M In / Out</p>
          </div>
          <div className="bg-white p-5 text-center dark:bg-[#0e0e11]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Context Window</p>
            <p className="mt-2 font-mono text-base font-bold text-neutral-900 dark:text-neutral-100">{profile.contextWindow}</p>
            <p className="mt-1 text-[11px] text-neutral-500">Max tokens</p>
          </div>
          <div className="bg-white p-5 text-center dark:bg-[#0e0e11] sm:col-span-2 lg:col-span-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Quality Rating</p>
            <p className="mt-2 text-xs font-bold text-neutral-900 dark:text-neutral-100">{profile.quality}</p>
            <p className="mt-1 text-[11px] text-neutral-500">Benchmark tier</p>
          </div>
        </div>
      </section>

      {/* Description & Spec Grid */}
      <section className="site-reveal grid gap-8 border-b border-neutral-200/80 py-10 dark:border-white/[0.08] lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Overview</h2>
          <p className="mt-3 text-base leading-8 text-neutral-700 dark:text-neutral-300">{profile.description}</p>
        </div>
        <dl className="grid gap-3.5 rounded-2xl border border-neutral-200/80 bg-neutral-50/60 p-5 text-xs dark:border-white/[0.08] dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <Layers3 className="h-4 w-4 text-neutral-500" />
            <div>
              <dt className="text-neutral-500">Context window</dt>
              <dd className="font-semibold text-neutral-950 dark:text-white">{profile.contextWindow} tokens</dd>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Gauge className="h-4 w-4 text-neutral-500" />
            <div>
              <dt className="text-neutral-500">Maximum output</dt>
              <dd className="font-semibold text-neutral-950 dark:text-white">{profile.maxOutput} tokens</dd>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Globe2 className="h-4 w-4 text-neutral-500" />
            <div>
              <dt className="text-neutral-500">Quality grade</dt>
              <dd className="font-semibold text-neutral-950 dark:text-white">{profile.quality}</dd>
            </div>
          </div>
        </dl>
      </section>

      {/* Pricing Comparison */}
      <section className="site-reveal grid gap-8 border-b border-neutral-200/80 py-12 dark:border-white/[0.08] lg:grid-cols-[14rem_minmax(0,1fr)]">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-950 dark:text-white">Pricing</h2>
          <p className="mt-2 text-xs text-neutral-500">Detailed token rates and comparison against family peers.</p>
        </div>

        <div>
          {isLocalModel ? (
            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-6 dark:border-emerald-500/20 dark:bg-emerald-950/20">
              <p className="text-lg font-bold text-emerald-950 dark:text-emerald-50">$0 — Runs locally on your device</p>
              <p className="mt-2 text-xs leading-6 text-emerald-900/80 dark:text-emerald-200/80">
                LingoFusion Native models run directly on your hardware without consuming cloud credits or character allowances.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/80 p-4 dark:border-white/[0.08] dark:bg-white/[0.03]">
                  <p className="text-xs text-neutral-500">Input / 1M</p>
                  <p className="mt-1 font-mono text-xl font-bold text-neutral-950 dark:text-white">{price(activePrice.inputUsd)}</p>
                </div>
                <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/80 p-4 dark:border-white/[0.08] dark:bg-white/[0.03]">
                  <p className="text-xs text-neutral-500">Output / 1M</p>
                  <p className="mt-1 font-mono text-xl font-bold text-neutral-950 dark:text-white">{price(activePrice.outputUsd)}</p>
                </div>
                <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/80 p-4 dark:border-white/[0.08] dark:bg-white/[0.03]">
                  <p className="text-xs text-neutral-500">Processing Mode</p>
                  <p className="mt-1 text-sm font-semibold capitalize text-neutral-950 dark:text-white">{pricingMode}</p>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between gap-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Relative Price Index</h3>
                <div role="group" aria-label="Comparison metric" className="inline-flex rounded-lg border border-neutral-200/80 bg-neutral-100/60 p-0.5 dark:border-white/10 dark:bg-white/[0.05]">
                  {(["input", "output"] as const).map((metric) => (
                    <button
                      key={metric}
                      type="button"
                      aria-pressed={comparisonMetric === metric}
                      onClick={() => setComparisonMetric(metric)}
                      className={`rounded-md px-3 py-1 text-xs font-semibold capitalize transition ${
                        comparisonMetric === metric
                          ? "bg-white text-neutral-950 shadow-xs dark:bg-neutral-800 dark:text-white"
                          : "text-neutral-500 hover:text-neutral-950 dark:text-neutral-400"
                      }`}
                    >
                      {metric}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 space-y-2.5 rounded-2xl border border-neutral-200/80 p-5 dark:border-white/[0.08]">
                {comparisonModels.map((model) => {
                  const value = model[comparisonMetric === "input" ? "inputUsd" : "outputUsd"];
                  const visualWidth = Math.max(10, Math.cbrt(value / comparisonMax) * 100);
                  const isCurrent = model.model === modelName;

                  return (
                    <div key={model.model} className="grid grid-cols-[8rem_minmax(4rem,1fr)_4rem] items-center gap-3 text-xs">
                      <span className={`truncate ${isCurrent ? "font-bold text-neutral-950 dark:text-white" : "text-neutral-600 dark:text-neutral-400"}`}>
                        {model.model.replace("LingoFusion ", "")}
                      </span>
                      <div className="h-2 overflow-hidden rounded-full bg-neutral-200/80 dark:bg-white/10">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${isCurrent ? "bg-blue-600 dark:bg-blue-400" : "bg-neutral-400 dark:bg-neutral-600"}`}
                          style={{ width: `${visualWidth}%` }}
                        />
                      </div>
                      <span className="text-right font-mono text-neutral-600 dark:text-neutral-400">
                        {model.local ? "Free" : price(value)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Capabilities & Features */}
      <section className="site-reveal grid gap-8 border-b border-neutral-200/80 py-12 dark:border-white/[0.08] lg:grid-cols-[14rem_minmax(0,1fr)]">
        <h2 className="text-xl font-bold tracking-tight text-neutral-950 dark:text-white">Capabilities</h2>
        <div>
          <p className="text-sm leading-7 text-neutral-600 dark:text-neutral-300">{presentation.bestFor}</p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {presentation.features.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-3 rounded-xl border border-neutral-200/80 bg-white p-4 text-xs font-medium text-neutral-800 shadow-xs dark:border-white/[0.08] dark:bg-neutral-900/60 dark:text-neutral-200"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* API Usage Section */}
      <section className="site-reveal grid gap-8 py-12 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-950 dark:text-white">
            {isLocalModel ? "Local Setup" : "Quick Request"}
          </h2>
          <p className="mt-2 text-xs text-neutral-500">Copy-pasteable code snippet to call this model.</p>
        </div>

        <div>
          {isLocalModel ? (
            <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/70 p-6 text-xs leading-6 text-neutral-600 dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-neutral-400">
              <p className="font-semibold text-neutral-950 dark:text-white">Local Run via LM Studio or Ollama</p>
              <p className="mt-2">
                Download the GGUF weights for {modelName} to run locally. Does not require internet connectivity or API token balances.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-[#0d0d11] text-white shadow-md dark:border-white/[0.08]">
              <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3 text-xs">
                <span className="font-mono text-neutral-400">cURL Example</span>
                <button
                  type="button"
                  onClick={() => copyText(requestSnippet, "request")}
                  className="pressable inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-white/20"
                >
                  <Copy className="h-3 w-3" />
                  {copied === "request" ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-xs leading-6 text-emerald-300">
                <code>{requestSnippet}</code>
              </pre>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function ModelComparisonCard({
  model,
  pricingMode,
}: {
  model: TextModel;
  pricingMode: TextPricingMode;
}) {
  const price = (value: number) => formatCurrencyAmount(value, "USD", 1, true);

  return (
    <article
      className={`comparison-card-motion rounded-2xl border p-6 transition-all ${
        model.recommended
          ? "border-neutral-900 bg-neutral-50/80 shadow-md dark:border-white/30 dark:bg-white/[0.05]"
          : "border-neutral-200/90 bg-white shadow-xs dark:border-white/[0.08] dark:bg-neutral-900/60"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-neutral-950 dark:text-neutral-50">{model.model}</h3>
          <p className="mt-1.5 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
            {model.model in textModelPresentations
              ? textModelPresentations[model.model]?.capability
              : "A LingoFusion API model for translation and language workflows."}
          </p>
        </div>
        {model.recommended && (
          <span className="rounded-full bg-neutral-950 px-2.5 py-0.5 text-[10px] font-semibold text-white dark:bg-white dark:text-neutral-950">
            Recommended
          </span>
        )}
      </div>

      <dl className="mt-5 grid gap-3 border-t border-neutral-200/80 pt-5 text-xs dark:border-white/[0.08] sm:grid-cols-2">
        {model.local ? (
          <div className="sm:col-span-2">
            <dt className="text-neutral-500">Local Hardware Execution</dt>
            <dd className="mt-1 font-semibold text-emerald-700 dark:text-emerald-300">
              Free · Zero API charges, tokens or cloud quota consumed.
            </dd>
          </div>
        ) : (
          <>
            <div>
              <dt className="text-neutral-500">Input per 1M</dt>
              <dd className="mt-0.5 font-mono text-base font-bold text-neutral-950 dark:text-neutral-50">
                {price(model.inputUsd)}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Output per 1M</dt>
              <dd className="mt-0.5 font-mono text-base font-bold text-neutral-950 dark:text-neutral-50">
                {price(model.outputUsd)}
              </dd>
            </div>
          </>
        )}
      </dl>
    </article>
  );
}
