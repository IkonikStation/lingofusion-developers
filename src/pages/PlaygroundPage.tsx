import { ArrowRight, Code2, Cpu, Play, Sparkles, Terminal } from "lucide-react";
import { textModels, textModelPresentations } from "../data/pricing";
import { pageQuery } from "../lib/utils";
import { ModelIcon } from "../components/shared/FormFields";

export function PlaygroundPage({
  onOpenDashboard,
  onNavigate,
}: {
  onOpenDashboard: () => void;
  onNavigate: (page: string) => void;
}) {
  const requestedModel = pageQuery().get("model");
  const selectedModel = requestedModel && textModels.some((model) => model.model === requestedModel)
    ? requestedModel
    : "LingoFusion";
  const modelInfo = textModels.find((m) => m.model === selectedModel) ?? textModels[0];
  const presentation = textModelPresentations[selectedModel];

  return (
    <section className="mx-auto max-w-4xl py-6 sm:py-12">
      <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200/80 bg-neutral-100/80 px-3 py-1 text-xs font-semibold text-neutral-800 shadow-xs backdrop-blur-md dark:border-white/10 dark:bg-white/[0.06] dark:text-neutral-200">
        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
        Interactive Playground & Simulator
      </div>

      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-5xl">
        Test multilingual models with zero setup.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-600 dark:text-neutral-400">
        Run real-time and simulated requests against {selectedModel}. Inspect token counts, calculate exact payload costs, and export copy-pasteable API code.
      </p>

      {/* Hero Interactive Card */}
      <div className="mt-8 overflow-hidden rounded-2xl border border-neutral-200/90 bg-neutral-50/60 p-6 shadow-sm backdrop-blur-sm dark:border-white/[0.08] dark:bg-neutral-900/50 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <ModelIcon presentation={presentation} size="catalog" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-neutral-950 dark:text-white">
                  {selectedModel}
                </span>
                {modelInfo.recommended && (
                  <span className="rounded-full bg-neutral-950 px-2 py-0.5 text-[10px] font-semibold text-white dark:bg-white dark:text-neutral-950">
                    Recommended
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {presentation?.capability ?? "Universal multilingual intelligence model"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenDashboard}
            className="pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
          >
            <Play className="h-4 w-4 fill-current" />
            Open Playground Simulator
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-neutral-200/80 pt-6 dark:border-white/[0.08] sm:grid-cols-4">
          <div className="rounded-lg border border-neutral-200/60 bg-white/70 p-3 dark:border-white/5 dark:bg-neutral-800/40">
            <span className="text-[11px] font-medium text-neutral-500">Latency Mode</span>
            <p className="mt-0.5 text-sm font-semibold text-neutral-900 dark:text-neutral-100">Streaming Instant</p>
          </div>
          <div className="rounded-lg border border-neutral-200/60 bg-white/70 p-3 dark:border-white/5 dark:bg-neutral-800/40">
            <span className="text-[11px] font-medium text-neutral-500">Context Window</span>
            <p className="mt-0.5 text-sm font-semibold text-neutral-900 dark:text-neutral-100">1,000,000 Tokens</p>
          </div>
          <div className="rounded-lg border border-neutral-200/60 bg-white/70 p-3 dark:border-white/5 dark:bg-neutral-800/40">
            <span className="text-[11px] font-medium text-neutral-500">Input / 1M</span>
            <p className="mt-0.5 font-mono text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {modelInfo.local ? "Free" : `$${modelInfo.inputUsd}`}
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200/60 bg-white/70 p-3 dark:border-white/5 dark:bg-neutral-800/40">
            <span className="text-[11px] font-medium text-neutral-500">Output / 1M</span>
            <p className="mt-0.5 font-mono text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {modelInfo.local ? "Free" : `$${modelInfo.outputUsd}`}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onNavigate(selectedModel)}
          className="pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-neutral-200/90 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-800 shadow-xs transition hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
        >
          <Cpu className="h-4 w-4 text-neutral-500" />
          View Model Specifications
        </button>
        <button
          type="button"
          onClick={() => onNavigate("API Prices")}
          className="pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-neutral-200/90 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-800 shadow-xs transition hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
        >
          <Code2 className="h-4 w-4 text-neutral-500" />
          Compare All API Prices
        </button>
      </div>
    </section>
  );
}
