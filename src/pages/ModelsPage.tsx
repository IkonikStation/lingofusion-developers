import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Cpu,
  Layers,
  Search,
  Sparkles,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { nativeLocalModels } from "../data/nativeLocal";
import { textModelPresentations, textModelsByPricingMode, webSearchPricing } from "../data/pricing";
import type { TextModel, TextPricingMode } from "../data/pricing";
import { ModelIcon, SelectField } from "../components/shared/FormFields";
import { ModelComparisonCard } from "./ModelDetailPage";

export function ModelsPage({ onOpenModel }: { onOpenModel: (model: string) => void }) {
  const [pricingMode, setPricingMode] = useState<TextPricingMode>(() => {
    const saved = window.localStorage.getItem("lingofusion-model-comparison-mode");
    return saved === "ultrafast" ? "ultrafast" : saved === "fast" ? "fast" : saved === "batch" ? "batch" : "instant";
  });
  const [searchFilter, setSearchFilter] = useState("");
  const [leftModelName, setLeftModelName] = useState("LingoFusion");
  const [rightModelName, setRightModelName] = useState("LingoFusion Pro");

  const models = textModelsByPricingMode[pricingMode];
  const catalogModels = textModelsByPricingMode.instant;
  const filteredCatalog = catalogModels.filter((m) =>
    m.model.toLowerCase().includes(searchFilter.toLowerCase().trim()),
  );
  const openSourceModels = filteredCatalog.filter((model) => model.local);
  const cloudModels = filteredCatalog.filter((model) => !model.local);

  const leftModel = models.find((model) => model.model === leftModelName) ?? models[0];
  const rightModel = models.find((model) => model.model === rightModelName) ?? models[1] ?? models[0];

  const selectPricingMode = (mode: TextPricingMode) => {
    setPricingMode(mode);
    if (mode === "fast") {
      setLeftModelName("LingoFusion");
      setRightModelName("LingoFusion");
    }
    window.localStorage.setItem("lingofusion-model-comparison-mode", mode);
  };

  return (
    <div className="max-w-6xl pb-16">
      {/* Header */}
      <section className="site-reveal flex flex-col gap-6 border-b border-neutral-200/80 pb-10 dark:border-white/[0.08] sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200/80 bg-neutral-100/80 px-3 py-1 text-xs font-semibold text-neutral-800 shadow-xs dark:border-white/10 dark:bg-white/[0.06] dark:text-neutral-200">
            <Cpu className="h-3.5 w-3.5 text-blue-500" />
            Model Catalog & Benchmarks
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-5xl">
            LingoFusion Models
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-neutral-600 dark:text-neutral-400">
            Explore state-of-the-art multilingual text models engineered for translation accuracy, low latency, and large-context reasoning.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search models..."
              className="h-10 w-full rounded-xl border border-neutral-300/80 bg-white pl-9 pr-3 text-xs text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 dark:border-white/10 dark:bg-[#121214] dark:text-white dark:focus:border-white/40"
            />
          </div>
          <a
            href="#compare-models"
            className="pressable inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-neutral-950 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
          >
            Compare Models &darr;
          </a>
        </div>
      </section>

      {/* Cloud Managed Models Grid */}
      <section className="site-reveal mt-10" aria-labelledby="model-gallery-heading">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="model-gallery-heading" className="text-xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">
              Cloud Managed Models
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Production-ready API models served across high-availability global endpoints.
            </p>
          </div>
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-600 dark:bg-white/10 dark:text-neutral-300">
            {cloudModels.length} models
          </span>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {cloudModels.map((model) => (
            <ModelCard key={model.model} model={model} onOpen={() => onOpenModel(model.model)} />
          ))}
        </div>
      </section>

      {/* Native Open-Source Models Grid */}
      <section className="site-reveal mt-14 border-t border-neutral-200/80 pt-10 dark:border-white/[0.08]" aria-labelledby="cloud-model-gallery-heading">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="cloud-model-gallery-heading" className="text-xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">
              Native Local Models (Open Source)
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Free, self-hosted weights that run completely offline on Apple Silicon, NVIDIA RTX, or x86 CPUs.
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            Free · Local
          </span>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {openSourceModels.map((model) => (
            <ModelCard key={model.model} model={model} onOpen={() => onOpenModel(model.model)} />
          ))}
        </div>
      </section>

      {/* Interactive Model Comparator */}
      <section
        id="compare-models"
        className="site-reveal mt-16 scroll-mt-24 rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-sm dark:border-white/[0.08] dark:bg-neutral-900/60 sm:p-8"
        aria-labelledby="model-comparison-heading"
      >
        <div className="flex flex-col gap-4 border-b border-neutral-200/80 pb-6 dark:border-white/[0.08] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Benchmark Tool</p>
            <h2 id="model-comparison-heading" className="mt-1 text-2xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">
              Side-by-Side Model Comparison
            </h2>
          </div>

          <div role="group" aria-label="Model comparison pricing mode" className="inline-flex rounded-xl border border-neutral-200/80 bg-neutral-100/60 p-1 dark:border-white/10 dark:bg-white/[0.05]">
            {(["instant", "batch", "fast", "ultrafast"] as const).map((mode) => {
              const selected = pricingMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => selectPricingMode(mode)}
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
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end">
          <SelectField label="First Model" value={leftModel.model} onChange={setLeftModelName}>
            {models.map((model) => (
              <option key={model.model}>{model.model}</option>
            ))}
          </SelectField>

          {pricingMode !== "fast" && (
            <>
              <button
                type="button"
                onClick={() => {
                  setLeftModelName(rightModel.model);
                  setRightModelName(leftModel.model);
                }}
                className="pressable mb-0.5 inline-flex h-10 items-center justify-center rounded-xl border border-neutral-200/90 bg-white px-4 text-xs font-semibold text-neutral-800 shadow-xs transition hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                Swap
              </button>
              <SelectField label="Second Model" value={rightModel.model} onChange={setRightModelName}>
                {models.map((model) => (
                  <option key={model.model}>{model.model}</option>
                ))}
              </SelectField>
            </>
          )}
        </div>

        <div className={`mt-6 grid gap-5 ${pricingMode === "fast" ? "lg:grid-cols-1" : "lg:grid-cols-2"}`}>
          <ModelComparisonCard model={leftModel} pricingMode={pricingMode} />
          {pricingMode !== "fast" && <ModelComparisonCard model={rightModel} pricingMode={pricingMode} />}
        </div>
      </section>

      {/* Web Search Pricing */}
      <WebSearchPricingTable />
    </div>
  );
}

function ModelCard({ model, onOpen }: { model: TextModel; onOpen: () => void }) {
  const presentation = textModelPresentations[model.model];
  const localModel = model.local ? nativeLocalModels[model.model as keyof typeof nativeLocalModels] : null;

  return (
    <div
      onClick={onOpen}
      className="surface-lift group relative flex cursor-pointer flex-col justify-between rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-xs transition-all hover:border-neutral-400 hover:shadow-md dark:border-white/[0.08] dark:bg-neutral-900/60 dark:hover:border-white/20"
    >
      <div>
        <div className="flex items-start gap-4">
          <ModelIcon presentation={presentation} size="catalog" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold tracking-tight text-neutral-950 group-hover:text-blue-600 dark:text-neutral-50 dark:group-hover:text-blue-400">
                {model.model}
              </h3>
              {localModel && (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300">
                  {localModel.badge}
                </span>
              )}
              {model.recommended && (
                <span className="rounded-full bg-neutral-950 px-2 py-0.5 text-[10px] font-semibold text-white dark:bg-white dark:text-neutral-950">
                  Recommended
                </span>
              )}
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
              {presentation?.capability ?? "Universal multilingual intelligence model"}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-neutral-100 pt-3.5 text-xs dark:border-white/[0.05]">
        <div className="flex items-center gap-3 font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
          {model.local ? (
            <>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Free · Local</span>
              <span>{localModel?.downloadSize}</span>
            </>
          ) : (
            <>
              <span>In: <strong className="font-semibold text-neutral-800 dark:text-neutral-200">${model.inputUsd}</strong>/1M</span>
              <span>Out: <strong className="font-semibold text-neutral-800 dark:text-neutral-200">${model.outputUsd}</strong>/1M</span>
            </>
          )}
        </div>

        <span className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-700 group-hover:translate-x-0.5 group-hover:text-neutral-950 dark:text-neutral-300 dark:group-hover:text-white">
          Inspect specs <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </div>
  );
}

function WebSearchPricingTable() {
  return (
    <section className="site-reveal mt-16 border-t border-neutral-200/80 pt-10 dark:border-white/[0.08]" aria-labelledby="web-search-pricing-heading">
      <div className="mb-4">
        <h2 id="web-search-pricing-heading" className="text-xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">
          Web Search Grounding Rates
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          Per-query search engine retrieval costs for fresh online verification.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-xs dark:border-white/[0.08] dark:bg-neutral-900/60">
        <table className="mobile-record-table w-full text-left text-xs">
          <thead className="border-b border-neutral-200/80 bg-neutral-50/70 uppercase tracking-wider text-neutral-500 dark:border-white/[0.08] dark:bg-white/[0.02]">
            <tr>
              <th className="px-5 py-3.5 font-semibold">Model</th>
              <th className="px-5 py-3.5 font-semibold">Price per Grounded Call</th>
            </tr>
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
  );
}
