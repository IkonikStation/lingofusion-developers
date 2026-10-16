import { ArrowDown, ArrowRight, Search, X } from "lucide-react";
import { useState } from "react";
import { ModelIcon, SelectField } from "../components/shared/FormFields";
import { nativeLocalModels } from "../data/nativeLocal";
import { textModelPresentations, textModelsByPricingMode, webSearchPricing } from "../data/pricing";
import type { TextModel, TextPricingMode } from "../data/pricing";
import { modelSlug, withBasePath } from "../lib/utils";

type CategoryTab = "all" | "flagship" | "efficient" | "local";

function localSpecs(model: TextModel) {
  return model.local ? nativeLocalModels[model.model as keyof typeof nativeLocalModels] : undefined;
}

export function ModelsPage({ onOpenModel }: { onOpenModel: (model: string) => void }) {
  const [activeTab, setActiveTab] = useState<CategoryTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [pricingMode, setPricingMode] = useState<TextPricingMode>("instant");
  const [leftModelName, setLeftModelName] = useState("LingoFusion");
  const [rightModelName, setRightModelName] = useState("LingoFusion Pro");
  const catalog = textModelsByPricingMode.instant;
  const models = textModelsByPricingMode[pricingMode];
  const query = searchQuery.trim().toLowerCase();
  const filtered = catalog.filter((model) => {
    const presentation = textModelPresentations[model.model];
    const matchesQuery = `${model.model} ${presentation?.capability ?? ""} ${presentation?.bestFor ?? ""}`.toLowerCase().includes(query);
    const matchesCategory = activeTab === "all" ||
      (activeTab === "local" && model.local) ||
      (activeTab === "flagship" && ["LingoFusion", "LingoFusion Pro", "LingoFusion Ultra"].includes(model.model)) ||
      (activeTab === "efficient" && ["LingoFusion Nano", "LingoFusion Lite", "ExplainFusion"].includes(model.model));
    return matchesQuery && matchesCategory;
  });
  const featured = ["LingoFusion", "LingoFusion Pro", "LingoFusion Ultra"]
    .map((name) => catalog.find((model) => model.model === name))
    .filter((model): model is TextModel => Boolean(model));
  const leftModel = models.find((model) => model.model === leftModelName) ?? models[0];
  const rightModel = models.find((model) => model.model === rightModelName) ?? models[1] ?? models[0];

  const modelLink = (model: TextModel, className: string, children: React.ReactNode) => (
    <a key={model.model} href={withBasePath(`/models/${modelSlug(model.model)}`)} className={className}
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onOpenModel(model.model);
      }}>{children}</a>
  );

  return (
    <div className="models-page mx-auto max-w-6xl pb-16">
      <section className="models-intro">
        <p className="models-eyebrow">LingoFusion / Models</p>
        <h1>Models for a world<br className="hidden sm:block" /> of languages.</h1>
        <p className="models-intro-copy">Translate, reason, and localize with our most capable models. Find the right balance of intelligence, speed, and cost.</p>
        <div className="mt-7 flex flex-wrap items-center gap-6">
          <button type="button" onClick={() => onOpenModel("Playground")} className="models-primary">Try in Playground <ArrowRight size={16} /></button>
          <a href="#compare-models" className="models-text-link">Compare models <ArrowDown size={15} /></a>
        </div>
      </section>

      <section className="models-section" aria-labelledby="featured-heading">
        <div className="models-section-heading">
          <h2 id="featured-heading">Our flagship models</h2>
          <button type="button" className="models-text-link" onClick={() => onOpenModel("API Prices")}>View pricing <ArrowRight size={15} /></button>
        </div>
        <div className="models-featured-grid">
          {featured.map((model, index) => {
            const presentation = textModelPresentations[model.model];
            return modelLink(model, "models-featured", <>
              <div className={`models-art models-art-${index}`}>
                <img src={`${import.meta.env.BASE_URL}${presentation.image.replace(/^\//, "")}`} alt="" loading="eager" />
              </div>
              <div className="models-featured-title"><h3>{model.model}</h3><ArrowRight size={19} /></div>
              <p>{presentation.capability}</p>
              <div className="models-featured-price"><span>${model.inputUsd.toFixed(2)} input</span><span>${model.outputUsd.toFixed(2)} output</span><small>per 1M tokens</small></div>
            </>);
          })}
        </div>
      </section>

      <section className="models-section" aria-labelledby="catalog-heading">
        <div className="models-section-heading"><h2 id="catalog-heading">Explore all models</h2><span className="text-sm text-neutral-500" aria-live="polite">{filtered.length} models</span></div>
        <div className="models-catalog-toolbar">
          <div className="models-tabs" aria-label="Model categories">
            {([{ id: "all", label: "All models" }, { id: "flagship", label: "Flagship" }, { id: "efficient", label: "Efficient" }, { id: "local", label: "Local" }] as const).map((tab) => (
              <button key={tab.id} type="button" aria-pressed={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>
            ))}
          </div>
          <div className="models-search"><Search size={16} /><input aria-label="Search models" placeholder="Search models" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />{searchQuery && <button type="button" aria-label="Clear search" title="Clear search" onClick={() => setSearchQuery("")}><X size={16} /></button>}</div>
        </div>
        <div className="models-catalog">
          <div className="models-catalog-labels" aria-hidden="true"><span>Model</span><span>Context</span><span>Input / 1M</span><span>Output / 1M</span><span /></div>
          {filtered.map((model) => {
            const presentation = textModelPresentations[model.model];
            return modelLink(model, "models-catalog-row", <>
              <div className="flex items-center gap-3.5 min-w-0">
                <ModelIcon presentation={presentation} size="catalog" />
                <div className="min-w-0">
                  <h3>{model.model}{model.local && <span className="models-local-label">Local</span>}</h3>
                  <p>{presentation?.capability}</p>
                </div>
              </div>
              <span className="models-spec"><small>Context</small>{localSpecs(model)?.context ?? "1M tokens"}</span>
              <span className="models-spec"><small>Input / 1M</small>{model.local ? "Free" : `$${model.inputUsd.toFixed(2)}`}</span>
              <span className="models-spec"><small>Output / 1M</small>{model.local ? "Free" : `$${model.outputUsd.toFixed(2)}`}</span>
              <ArrowRight className="models-row-arrow" size={18} />
            </>);
          })}
          {!filtered.length && <div className="models-empty"><h3>No models found</h3><p>Try another name or category.</p><button type="button" className="models-text-link" onClick={() => { setSearchQuery(""); setActiveTab("all"); }}>Reset filters <X size={15} /></button></div>}
        </div>
        <p className="mt-4 text-xs text-neutral-500">Standard API rates in USD. Local models run on your own hardware with no per-token API charge.</p>
      </section>

      <section id="compare-models" className="models-section scroll-mt-24" aria-labelledby="compare-heading">
        <div className="models-section-heading"><h2 id="compare-heading">Compare models</h2>
          <div className="models-modes" aria-label="Processing mode">{(["instant", "batch", "fast", "ultrafast"] as const).map((mode) => <button key={mode} type="button" aria-pressed={pricingMode === mode} onClick={() => setPricingMode(mode)}>{mode === "instant" ? "Standard" : mode}</button>)}</div>
        </div>
        <div className="grid gap-8 sm:grid-cols-2">
          {[{ label: "Model A", model: leftModel, change: setLeftModelName }, { label: "Model B", model: rightModel, change: setRightModelName }].map(({ label, model, change }) => (
            <div key={label}>
              <SelectField label={label} value={model.model} onChange={change}>{models.map((option) => <option key={option.model} value={option.model}>{option.model}</option>)}</SelectField>
              <dl className="models-comparison">{[
                ["Input / 1M tokens", model.local ? "Free" : `$${model.inputUsd.toFixed(2)}`],
                ["Output / 1M tokens", model.local ? "Free" : `$${model.outputUsd.toFixed(2)}`],
                ["Context window", localSpecs(model)?.context ?? "1M tokens"],
                ["Best for", textModelPresentations[model.model]?.bestFor ?? "Multilingual translation"],
              ].map(([labelText, value]) => <div key={labelText}><dt>{labelText}</dt><dd>{value}</dd></div>)}</dl>
              {modelLink(model, "models-text-link mt-5", <>Model details <ArrowRight size={15} /></>)}
            </div>
          ))}
        </div>
      </section>

      <section className="models-section" aria-labelledby="search-pricing-heading">
        <div className="models-section-heading"><h2 id="search-pricing-heading">Web search</h2><span className="text-sm text-neutral-500">USD per call</span></div>
        <dl className="models-search-pricing">{webSearchPricing.map(({ model, priceUsd }) => <div key={model}><dt>{model}</dt><dd>${priceUsd}</dd></div>)}</dl>
      </section>
      <section className="models-bottom"><h2>Start with a conversation.</h2><button type="button" className="models-primary" onClick={() => onOpenModel("Playground")}>Open Playground <ArrowRight size={16} /></button></section>
    </div>
  );
}
