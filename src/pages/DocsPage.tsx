import {
  Activity,
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
  Copy,
  ExternalLink,
  KeyRound,
  Layers,
  Server,
  Terminal,
} from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import type { TranslationKey } from "../data/i18n";
import { modelDetails, pageSummaries, sidebarSections } from "../data/pricing";

export function DocsPage({
  activePage,
  t,
  tc,
  onNavigate,
  onCopy,
}: {
  activePage: string;
  t: (key: TranslationKey) => string;
  tc: (text: string) => string;
  onNavigate: (page: string) => void;
  onCopy: () => void;
}) {
  const isModel = Boolean(modelDetails[activePage]);
  const summary = modelDetails[activePage] ?? pageSummaries[activePage] ?? pageSummaries.Overview;
  const [exampleLanguage, setExampleLanguage] = useState<"curl" | "javascript" | "python">("curl");
  const [copiedCode, setCopiedCode] = useState(false);

  const isOverview = activePage === "Overview";
  const isQuickstart = activePage === "Quickstart";
  const pageFocus = isOverview
    ? "A practical architectural view of the platform, from the first request through production scale."
    : isQuickstart
      ? "Create an API key, choose a model, and execute your first translation in under two minutes."
      : isModel
        ? "Use this model reference to select the right capability, context window, and pricing mode."
        : `Everything needed to integrate ${activePage.toLowerCase()} into your production stack.`;

  const isSpeechGeneration = activePage === "Speech generation";

  const codeExamples = isSpeechGeneration
    ? {
        curl: `curl https://api.lingofusion.dev/v1/audio/speech \\
  -H "Authorization: Bearer $LINGOFUSION_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "LingoFusion Voice",
    "input": "Natural multilingual speech powered by LingoFusion."
  }' \\
  --output speech.mp3`,
        javascript: `import { LingoFusion } from "@lingofusion/sdk";
import fs from "node:fs";

const client = new LingoFusion({
  apiKey: process.env.LINGOFUSION_API_KEY,
});

const audio = await client.audio.speech.create({
  model: "LingoFusion Voice",
  input: "Natural multilingual speech powered by LingoFusion.",
});

fs.writeFileSync("speech.mp3", Buffer.from(await audio.arrayBuffer()));`,
        python: `from lingofusion import LingoFusion
import os

client = LingoFusion(api_key=os.environ["LINGOFUSION_API_KEY"])

response = client.audio.speech.create(
    model="LingoFusion Voice",
    input="Natural multilingual speech powered by LingoFusion.",
)

response.stream_to_file("speech.mp3")`,
      }
    : {
        curl: `curl https://api.lingofusion.dev/v1/translate \\
  -H "Authorization: Bearer $LINGOFUSION_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "lingofusion",
    "source_language": "en",
    "target_language": "fr",
    "input": "Build for every language."
  }'`,
        javascript: `import { LingoFusion } from "@lingofusion/sdk";

const client = new LingoFusion({
  apiKey: process.env.LINGOFUSION_API_KEY,
});

const result = await client.translate({
  model: "lingofusion",
  sourceLanguage: "en",
  targetLanguage: "fr",
  input: "Build for every language.",
});

console.log(result.output);`,
        python: `from lingofusion import LingoFusion
import os

client = LingoFusion(api_key=os.environ["LINGOFUSION_API_KEY"])

response = client.translate(
    model="lingofusion",
    source_language="en",
    target_language="fr",
    input="Build for every language."
)

print(response.output_text)`,
      };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(codeExamples[exampleLanguage]);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      onCopy();
    }
  };

  return (
    <div>
      <section className="site-reveal max-w-4xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200/80 bg-neutral-100/80 px-3 py-1 text-xs font-semibold text-neutral-800 shadow-xs dark:border-white/10 dark:bg-white/[0.06] dark:text-neutral-200">
          <Terminal className="h-3.5 w-3.5 text-blue-500" />
          {isModel ? t("modelReference") : t("developerDocs")}
        </div>

        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-5xl">
          {modelDetails[activePage] ? activePage : tc(activePage)}
        </h1>
        <p className="mt-4 text-lg leading-8 text-neutral-700 dark:text-neutral-300">{tc(summary)}</p>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-neutral-500 dark:text-neutral-400">{pageFocus}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onNavigate("Pricing")}
            className="pressable inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
          >
            {t("viewPricing")}
            <BadgeDollarSign className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onCopy}
            className="pressable inline-flex items-center gap-2 rounded-xl border border-neutral-200/90 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-800 shadow-xs transition hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
          >
            {t("copyQuickstart")}
            <Copy className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* Code Demo & Quickstart Card */}
      <section className="site-reveal mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]">
        <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-[#0d0d11] text-white shadow-md dark:border-white/[0.08]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-3.5">
            <div className="flex items-center gap-2.5 text-xs font-semibold tracking-wide text-neutral-200">
              <span className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
              </span>
              <span className="ml-2 font-mono text-neutral-400">
                {isSpeechGeneration ? "api.lingofusion.dev/v1/audio/speech" : "api.lingofusion.dev/v1/translate"}
              </span>
            </div>

            <div role="tablist" aria-label="Example language" className="inline-flex rounded-lg bg-white/10 p-1">
              {(["curl", "javascript", "python"] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  role="tab"
                  aria-selected={exampleLanguage === lang}
                  onClick={() => setExampleLanguage(lang)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    exampleLanguage === lang
                      ? "bg-white text-neutral-950 shadow-xs"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {lang === "javascript" ? "Node.js" : lang === "curl" ? "cURL" : "Python"}
                </button>
              ))}
            </div>
          </div>

          <pre className="min-h-64 overflow-x-auto p-5 font-mono text-xs leading-6 text-emerald-300">
            <code>{codeExamples[exampleLanguage]}</code>
          </pre>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] px-5 py-3 text-xs text-neutral-400">
            <span>Production ready with streaming support and rate-limit headers.</span>
            <button
              type="button"
              onClick={handleCopyCode}
              className="pressable inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              <Copy className="h-3.5 w-3.5" />
              {copiedCode ? "Copied!" : "Copy Snippet"}
            </button>
          </div>
        </div>

        {/* Request checklist */}
        <aside className="flex flex-col justify-between rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-xs dark:border-white/[0.08] dark:bg-neutral-900/60">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Deployment Checklist
            </p>
            <ol className="mt-5 space-y-4">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-950 font-mono text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
                  1
                </span>
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">Generate an API key</p>
                  <p className="mt-0.5 text-xs text-neutral-500">Create scoped keys per environment in the Dashboard.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-950 font-mono text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
                  2
                </span>
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">Select model architecture</p>
                  <p className="mt-0.5 text-xs text-neutral-500">Balance quality, latency, context size, and token costs.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-950 font-mono text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
                  3
                </span>
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">Verify telemetry</p>
                  <p className="mt-0.5 text-xs text-neutral-500">Monitor usage headers and audit logs in production.</p>
                </div>
              </li>
            </ol>
          </div>

          <button
            type="button"
            onClick={() => onNavigate("Playground")}
            className="pressable mt-6 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-neutral-200/90 bg-neutral-50 px-4 py-2 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]"
          >
            Open Interactive Playground &rarr;
          </button>
        </aside>
      </section>

      {/* Production Best Practices */}
      <section className="site-reveal mt-12">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Architecture</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">
              Production Best Practices
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("Models")}
            className="pressable text-left text-sm font-semibold text-neutral-950 underline underline-offset-4 dark:text-white"
          >
            Explore all models &rarr;
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <DocCard icon={KeyRound} title="Secure Scoping" tc={tc}>
            Rotate API tokens via automated scripts, store keys in secret vaults, and enforce per-endpoint restrictions.
          </DocCard>
          <DocCard icon={Server} title="Idempotent Requests" tc={tc}>
            Pass custom idempotency keys on batch operations to safely retry transient connection failures without duplicate token billing.
          </DocCard>
          <DocCard icon={Activity} title="Cost Accounting" tc={tc}>
            Track exact prompt tokens, reasoning tokens, and completion tokens returned in each response payload.
          </DocCard>
        </div>
      </section>

      {/* Endpoints at a glance */}
      <section className="site-reveal mt-12 overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-xs dark:border-white/[0.08] dark:bg-neutral-900/60">
        <div className="border-b border-neutral-200/80 bg-neutral-50/60 px-6 py-4 dark:border-white/[0.08] dark:bg-white/[0.02]">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Core API Endpoints</h2>
        </div>
        <div>
          <EndpointRow
            endpoint="POST /v1/translate"
            description="Translate text between 120+ supported languages with custom formatting rules."
            onClick={() => onNavigate("Text generation")}
          />
          <EndpointRow
            endpoint="POST /v1/responses"
            description="Run full LLM multilingual generation with streaming and token usage reporting."
            onClick={() => onNavigate("Playground")}
          />
          <EndpointRow
            endpoint="POST /v1/batch"
            description="Submit bulk asynchronous localization jobs at up to 50% lower token pricing."
            onClick={() => onNavigate("API Prices")}
          />
        </div>
      </section>

      {/* Related Pages */}
      <section className="site-reveal mt-12 border-t border-neutral-200/80 pt-8 dark:border-white/[0.08]">
        <h2 className="text-base font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
          {t("relatedPages")}
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {sidebarSections
            .flatMap((section) => section.items)
            .filter((item) => item !== activePage)
            .slice(0, 8)
            .map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => onNavigate(item)}
                className="pressable rounded-lg border border-neutral-200/80 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-xs transition hover:bg-neutral-50 hover:text-neutral-950 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-300 dark:hover:bg-white/[0.08] dark:hover:text-white"
              >
                {tc(item)}
              </button>
            ))}
        </div>
      </section>
    </div>
  );
}

function EndpointRow({
  endpoint,
  description,
  onClick,
}: {
  endpoint: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pressable flex w-full items-center justify-between gap-4 border-b border-neutral-200/80 px-6 py-4 text-left last:border-b-0 hover:bg-neutral-50/80 dark:border-white/[0.08] dark:hover:bg-white/[0.03]"
    >
      <div>
        <code className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-xs font-semibold text-neutral-900 dark:bg-white/10 dark:text-white">
          {endpoint}
        </code>
        <p className="mt-1.5 text-xs text-neutral-600 dark:text-neutral-400">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-neutral-400" />
    </button>
  );
}

function DocCard({
  icon: Icon,
  title,
  tc,
  children,
}: {
  icon: typeof Activity;
  title: string;
  tc: (text: string) => string;
  children: ReactNode;
}) {
  return (
    <article className="surface-lift rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-xs dark:border-white/[0.08] dark:bg-neutral-900/60">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200/80 bg-neutral-50 text-neutral-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-neutral-200">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-neutral-950 dark:text-neutral-50">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
        {typeof children === "string" ? tc(children) : children}
      </p>
    </article>
  );
}
