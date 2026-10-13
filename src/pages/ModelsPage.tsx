import {
  ArrowRight,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Search,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { nativeLocalModels } from "../data/nativeLocal";
import { textModelPresentations, textModelsByPricingMode, webSearchPricing } from "../data/pricing";
import type { TextModel, TextPricingMode } from "../data/pricing";
import { SelectField } from "../components/shared/FormFields";

type CategoryTab = "all" | "flagship" | "efficient" | "local";

export function ModelsPage({ onOpenModel }: { onOpenModel: (model: string) => void }) {
  const [activeTab, setActiveTab] = useState<CategoryTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [pricingMode, setPricingMode] = useState<TextPricingMode>("instant");
  const [leftModelName, setLeftModelName] = useState("LingoFusion");
  const [rightModelName, setRightModelName] = useState("LingoFusion Pro");

  const models = textModelsByPricingMode[pricingMode];
  const catalogModels = textModelsByPricingMode.instant;

  // Filter models
  const filteredModels = catalogModels.filter((model) => {
    const matchesSearch =
      model.model.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      (textModelPresentations[model.model]?.capability || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase().trim());

    if (!matchesSearch) return false;

    if (activeTab === "flagship") {
      return ["LingoFusion Ultra", "LingoFusion Pro", "LingoFusion"].includes(model.model);
    }
    if (activeTab === "efficient") {
      return ["LingoFusion Lite", "LingoFusion Nano", "LingoFusion Explain"].includes(model.model);
    }
    if (activeTab === "local") {
      return Boolean(model.local);
    }
    return true;
  });

  const leftModel = models.find((m) => m.model === leftModelName) ?? models[0];
  const rightModel = models.find((m) => m.model === rightModelName) ?? models[1] ?? models[0];

  return (
    <div className="mx-auto max-w-6xl pb-24">
      {/* OpenAI Hero */}
      <section className="border-b border-neutral-200 pb-12 dark:border-neutral-800">
        <h1 className="text-4xl font-normal tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-5xl lg:text-6xl">
          Models
        </h1>
        <p className="mt-4 max-w-3xl text-lg text-neutral-600 dark:text-neutral-400">
          Explore our collection of multilingual reasoning, localization, and real-time translation models. Compare benchmarks, context windows, and token pricing to choose the right model for your workload.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
          <a
            href="#compare"
            className="inline-flex items-center gap-1.5 font-medium text-neutral-900 underline underline-offset-4 hover:text-neutral-600 dark:text-neutral-100 dark:hover:text-neutral-300"
          >
            Compare model benchmarks &darr;
          </a>
          <span className="text-neutral-300 dark:text-neutral-700">&bull;</span>
          <button
            type="button"
            onClick={() => onOpenModel("API Prices")}
            className="font-medium text-neutral-900 underline underline-offset-4 hover:text-neutral-600 dark:text-neutral-100 dark:hover:text-neutral-300"
          >
            View pricing schedule &rarr;
          </button>
        </div>
      </section>

      {/* Category Tabs & Search (OpenAI style) */}
      <section className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1 border-b border-neutral-200 pb-2 sm:border-0 sm:pb-0 dark:border-neutral-800">
          {(
            [
              { id: "all", label: "All models" },
              { id: "flagship", label: "Flagship & Reasoning" },
              { id: "efficient", label: "High speed & Lightweight" },
              { id: "local", label: "Open source (Native)" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                activeTab === tab.id
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Minimal Search */}
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter models..."
            className="h-9 w-full rounded-md border border-neutral-200 bg-transparent pl-8 pr-3 text-xs text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 dark:border-neutral-800 dark:text-neutral-100 dark:focus:border-neutral-400"
          />
        </div>
      </section>

      {/* OpenAI Table View */}
      <section className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
              <th className="pb-3 pr-4 font-medium uppercase tracking-wider">Model</th>
              <th className="pb-3 pr-4 font-medium uppercase tracking-wider">Description</th>
              <th className="pb-3 pr-4 font-medium uppercase tracking-wider">Context Window</th>
              <th className="pb-3 pr-4 font-medium uppercase tracking-wider">Input / 1M</th>
              <th className="pb-3 pr-4 font-medium uppercase tracking-wider">Output / 1M</th>
              <th className="pb-3 font-medium uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
            {filteredModels.map((model) => {
              const presentation = textModelPresentations[model.model];
              const local = model.local ? nativeLocalModels[model.model as keyof typeof nativeLocalModels] : null;

              return (
                <tr
                  key={model.model}
                  onClick={() => onOpenModel(model.model)}
                  className="group cursor-pointer transition hover:bg-neutral-50/80 dark:hover:bg-neutral-900/40"
                >
                  <td className="py-4 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-neutral-900 group-hover:underline dark:text-neutral-100">
                        {model.model}
                      </span>
                      {model.recommended && (
                        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                          Default
                        </span>
                      )}
                      {model.local && (
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                          Local
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 pr-4 text-neutral-600 dark:text-neutral-400">
                    <p className="line-clamp-2 max-w-sm">
                      {presentation?.capability ?? "Universal multilingual intelligence model."}
                    </p>
                  </td>
                  <td className="py-4 pr-4 font-mono text-neutral-700 dark:text-neutral-300">
                    {local ? local.context : "1,000,000"}
                  </td>
                  <td className="py-4 pr-4 font-mono text-neutral-900 dark:text-neutral-100">
                    {model.local ? "Free" : `$${model.inputUsd.toFixed(2)}`}
                  </td>
                  <td className="py-4 pr-4 font-mono text-neutral-900 dark:text-neutral-100">
                    {model.local ? "Free" : `$${model.outputUsd.toFixed(2)}`}
                  </td>
                  <td className="py-4 text-right">
                    <span className="inline-flex items-center gap-1 font-medium text-neutral-900 group-hover:translate-x-0.5 dark:text-neutral-100">
                      View <ArrowRight className="h-3 w-3" />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Featured Model Cards (Clean Editorial Style) */}
      <section className="mt-16 border-t border-neutral-200 pt-12 dark:border-neutral-800">
        <h2 className="text-xl font-normal text-neutral-900 dark:text-white">
          Flagship models in detail
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          Primary production endpoints for enterprise localization and everyday inference.
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {catalogModels.slice(3, 7).map((model) => {
            const presentation = textModelPresentations[model.model];
            return (
              <div
                key={model.model}
                onClick={() => onOpenModel(model.model)}
                className="group cursor-pointer rounded-xl border border-neutral-200 bg-white p-6 transition hover:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-100"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                      {model.model}
                    </h3>
                    <p className="mt-1 text-xs text-neutral-500">
                      {presentation?.bestFor || "Universal multilingual translation"}
                    </p>
                  </div>
                  {model.recommended && (
                    <span className="rounded-full bg-neutral-900 px-2.5 py-0.5 text-[10px] font-medium text-white dark:bg-white dark:text-neutral-900">
                      Recommended
                    </span>
                  )}
                </div>

                <p className="mt-4 text-xs leading-6 text-neutral-600 dark:text-neutral-400">
                  {presentation?.capability}
                </p>

                <div className="mt-6 flex items-center justify-between border-t border-neutral-100 pt-4 text-xs dark:border-neutral-800/80">
                  <div className="flex items-center gap-4 font-mono text-neutral-600 dark:text-neutral-400">
                    <span>In: <strong className="text-neutral-900 dark:text-white">${model.inputUsd}</strong>/1M</span>
                    <span>Out: <strong className="text-neutral-900 dark:text-white">${model.outputUsd}</strong>/1M</span>
                  </div>
                  <span className="font-medium text-neutral-900 group-hover:underline dark:text-white">
                    Explore &rarr;
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Side-by-Side Model Comparator (OpenAI Clean Form) */}
      <section
        id="compare"
        className="mt-16 scroll-mt-24 border-t border-neutral-200 pt-12 dark:border-neutral-800"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-normal text-neutral-900 dark:text-white">
              Compare models
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Inspect two models side-by-side across latency profiles and token tiers.
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
                {mode === "instant" ? "Default" : mode}
              </button>
            ))}
          </div>
        </div>

        {/* Model Selectors */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <SelectField label="Model A" value={leftModel.model} onChange={setLeftModelName}>
            {models.map((m) => (
              <option key={m.model} value={m.model}>
                {m.model}
              </option>
            ))}
          </SelectField>

          <SelectField label="Model B" value={rightModel.model} onChange={setRightModelName}>
            {models.map((m) => (
              <option key={m.model} value={m.model}>
                {m.model}
              </option>
            ))}
          </SelectField>
        </div>

        {/* Side-by-Side Specs Grid */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <CleanComparisonBox model={leftModel} mode={pricingMode} onOpen={() => onOpenModel(leftModel.model)} />
          <CleanComparisonBox model={rightModel} mode={pricingMode} onOpen={() => onOpenModel(rightModel.model)} />
        </div>
      </section>

      {/* Web Search Pricing Table */}
      <section className="mt-16 border-t border-neutral-200 pt-12 dark:border-neutral-800">
        <h2 className="text-xl font-normal text-neutral-900 dark:text-white">
          Web search grounding rates
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          Per-query search grounding retrieval costs for live citation verification.
        </p>

        <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
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
                  <td className="px-5 py-3 font-medium text-neutral-900 dark:text-white">{model}</td>
                  <td className="px-5 py-3 font-mono text-neutral-700 dark:text-neutral-300">${priceUsd.toString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function CleanComparisonBox({
  model,
  mode,
  onOpen,
}: {
  model: TextModel;
  mode: TextPricingMode;
  onOpen: () => void;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-neutral-900 dark:text-white">{model.model}</h3>
        {model.local ? (
          <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            Free Local
          </span>
        ) : (
          <span className="font-mono text-xs text-neutral-500 capitalize">{mode}</span>
        )}
      </div>

      <dl className="mt-5 space-y-3 divide-y divide-neutral-100 text-xs dark:divide-neutral-800/60">
        <div className="flex justify-between pt-3">
          <dt className="text-neutral-500">Input per 1M</dt>
          <dd className="font-mono font-medium text-neutral-900 dark:text-white">
            {model.local ? "Free" : `$${model.inputUsd.toFixed(2)}`}
          </dd>
        </div>
        <div className="flex justify-between pt-3">
          <dt className="text-neutral-500">Output per 1M</dt>
          <dd className="font-mono font-medium text-neutral-900 dark:text-white">
            {model.local ? "Free" : `$${model.outputUsd.toFixed(2)}`}
          </dd>
        </div>
        <div className="flex justify-between pt-3">
          <dt className="text-neutral-500">Context Window</dt>
          <dd className="font-mono font-medium text-neutral-900 dark:text-white">
            {model.local ? "Hardware native" : "1,000,000 tokens"}
          </dd>
        </div>
        <div className="flex justify-between pt-3">
          <dt className="text-neutral-500">Max Output</dt>
          <dd className="font-mono font-medium text-neutral-900 dark:text-white">
            {model.local ? "32,000 tokens" : "384,000 tokens"}
          </dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={onOpen}
        className="mt-6 inline-flex w-full items-center justify-center rounded-lg border border-neutral-200 py-2 text-xs font-medium text-neutral-900 transition hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-900"
      >
        View full model documentation &rarr;
      </button>
    </div>
  );
}
