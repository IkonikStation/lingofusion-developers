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
  Image,
  Layers3,
  Mic,
  Music,
  Play,
  Type,
  Video,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { DashboardModal } from "./components/DashboardModal";
import { Header } from "./components/Header";
import { PricingCard } from "./components/PricingCard";
import { Sidebar } from "./components/Sidebar";
import { SubscriptionPage } from "./components/SubscriptionPage";
import { createContentTranslator, createTranslator, getLanguage } from "./data/i18n";
import type { LanguageCode, TranslationKey } from "./data/i18n";
import { currencies, defaultCurrencyRates, formatCurrencyAmount } from "./data/currency";
import type { CurrencyCode } from "./data/currency";
import {
  dubbingModels,
  imageModels,
  latestModels,
  modelDetails,
  musicModels,
  pageSummaries,
  pdfModels,
  sidebarSections,
  textModels,
  textModelsByPricingMode,
  textModelPresentations,
  transcriptionModels,
  ttsModels,
} from "./data/pricing";
import type { TextModel, TextModelPresentation, TextPricingMode } from "./data/pricing";
import type { ProVariantKey } from "./data/subscriptions";

const billingNotes = [
  {
    icon: FileText,
    key: "billingText",
  },
  {
    icon: Mic,
    key: "billingTts",
  },
  {
    icon: FileText,
    key: "billingTranscription",
  },
  {
    icon: Video,
    key: "billingDubbing",
  },
  {
    icon: Music,
    key: "billingMusic",
  },
  {
    icon: Image,
    key: "billingImage",
  },
  {
    icon: FileText,
    key: "billingPdf",
  },
] as const;

const showcaseItems = [
  {
    kind: "image",
    title: "Document translation",
    label: "Before and after",
    description: "Demonstrates LingoFusion translating a full document while preserving headings, lists, terminology, and tone.",
    src: "",
  },
  {
    kind: "video",
    title: "Live conversation",
    label: "Real-time demo",
    description: "Demonstrates LingoFusion Live Translate interpreting a conversation with low latency and natural turn-taking.",
    src: "",
  },
  {
    kind: "video",
    title: "Video dubbing",
    label: "Dubbing demo",
    description: "Demonstrates translated speech aligned to the original video with consistent voices and timing.",
    src: "",
  },
  {
    kind: "image",
    title: "PDF localization",
    label: "Layout preservation",
    description: "Demonstrates extracting and translating PDF content without losing the document's visual structure.",
    src: "",
  },
  {
    kind: "image",
    title: "Image translation",
    label: "Visual text replacement",
    description: "Demonstrates detecting text inside an image, translating it, and placing the result back into the design.",
    src: "",
  },
  {
    kind: "video",
    title: "Aurora music generation",
    label: "Prompt to music",
    description: "Demonstrates Aurora turning a written creative direction into a complete, production-ready music sample.",
    src: "",
  },
] as const;

const searchItems = Array.from(
  new Set([
    "API Prices",
    "Subscription Prices",
    ...Object.keys(pageSummaries),
    ...latestModels,
    ...textModels.map((model) => model.model),
    ...ttsModels.map((model) => model.model),
    ...transcriptionModels.map((model) => model.model),
    ...dubbingModels.map((model) => model.model),
    ...musicModels.map((model) => model.model),
    ...imageModels.map((model) => model.size),
    ...pdfModels.map((model) => model.model),
  ]),
);

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function clampMinuteNotation(value: number, min: number, max: number) {
  const clamped = clampNumber(value, min, max);
  const wholeMinutes = Math.trunc(clamped);
  const seconds = Math.min(59, Math.round((clamped - wholeMinutes) * 100));

  return Number((wholeMinutes + seconds / 100).toFixed(2));
}

function minuteNotationToMinutes(value: number) {
  const wholeMinutes = Math.trunc(value);
  const seconds = Math.round((value - wholeMinutes) * 100);

  return wholeMinutes + seconds / 60;
}

function modelSlug(modelName: string) {
  return modelName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const appBasePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBasePath(pathname: string) {
  if (!appBasePath || !pathname.startsWith(appBasePath)) return pathname;
  return pathname.slice(appBasePath.length) || "/";
}

function withBasePath(pathname: string) {
  return `${appBasePath}${pathname}`;
}

function modelNameFromPath(pathname: string) {
  const slug = stripBasePath(pathname).match(/^\/models\/([^/]+)\/?$/)?.[1];
  return slug ? textModels.find((model) => modelSlug(model.model) === slug)?.model : undefined;
}

function pageFromPath(pathname: string) {
  const appPath = stripBasePath(pathname);
  if (appPath === "/subscriptions") return "Subscription Prices";
  if (appPath === "/models" || appPath === "/models/") return "Models";
  return modelNameFromPath(pathname) ?? "Pricing";
}

export default function App() {
  const [activePage, setActivePage] = useState(() => pageFromPath(window.location.pathname));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [proVariantKey, setProVariantKey] = useState<ProVariantKey>(() =>
    window.localStorage.getItem("lingofusion-pro-variant") === "1m" ? "1m" : "500k",
  );
  const [toast, setToast] = useState<string | null>(null);
  const scrollProgressRef = useRef<HTMLSpanElement>(null);
  const t = useMemo(() => createTranslator(language), [language]);
  const tc = useMemo(() => createContentTranslator(language), [language]);
  const activeLanguage = getLanguage(language);
  const isSubscriptionPage = activePage === "Subscription Prices";

  const navigate = (page: string) => {
    const nextPage = page === "API Prices" ? "Pricing" : page;
    const nextPath = nextPage === "Subscription Prices"
      ? "/subscriptions"
      : nextPage === "Models"
        ? "/models"
        : textModels.some((model) => model.model === nextPage)
          ? `/models/${modelSlug(nextPage)}`
          : "/";
    const deployedPath = withBasePath(nextPath);
    if (window.location.pathname !== deployedPath) window.history.pushState({}, "", deployedPath);
    setActivePage(nextPage);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  };
  const selectProVariant = (variant: ProVariantKey) => {
    setProVariantKey(variant);
    window.localStorage.setItem("lingofusion-pro-variant", variant);
  };

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(
        "curl https://api.lingofusion.dev/v1/responses -H 'Authorization: Bearer $LINGOFUSION_API_KEY'",
      );
      notify(`${t("copyQuickstart")} copied`);
    } catch {
      notify("Clipboard permission was blocked");
    }
  };

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
    document.body.style.background = theme === "dark" ? "#0a0a0a" : "#ffffff";
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = activeLanguage.dir;
  }, [activeLanguage.dir, language]);

  useEffect(() => {
    const handlePopState = () => {
      setActivePage(pageFromPath(window.location.pathname));
      setMobileOpen(false);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (isSubscriptionPage) return;
    document.title = activePage === "Pricing" ? "API Prices | LingoFusion Developers" : `${activePage} | LingoFusion Developers`;
    const description = activePage === "Pricing"
      ? "LingoFusion API pricing for text, speech, transcription, dubbing, image, PDF, and music models."
      : pageSummaries[activePage] ?? pageSummaries.Overview;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.append(meta);
    }
    meta.content = description;
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.append(canonical);
    }
    canonical.href = `${window.location.origin}${window.location.pathname}`;
  }, [activePage, isSubscriptionPage]);

  useEffect(() => {
    if (isSubscriptionPage) return;
    let frame = 0;

    const updateProgress = () => {
      frame = 0;
      const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollableHeight > 0 ? Math.min(Math.max(window.scrollY / scrollableHeight, 0), 1) : 0;
      if (scrollProgressRef.current) {
        scrollProgressRef.current.style.transform = `scaleX(${progress})`;
      }
    };
    const handleScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(updateProgress);
    };

    updateProgress();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [activePage, isSubscriptionPage]);

  useEffect(() => {
    if (isSubscriptionPage) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const elements = Array.from(document.querySelectorAll<HTMLElement>(".site-reveal"));

    if (reducedMotion || !("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("site-reveal-visible"));
      return;
    }

    elements.forEach((element) => element.classList.add("site-reveal-ready"));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("site-reveal-visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [activePage, isSubscriptionPage]);

  return (
    <div className="min-h-screen bg-white text-neutral-950 selection:bg-neutral-900 selection:text-white dark:bg-[#0a0a0a] dark:text-neutral-100 dark:selection:bg-neutral-100 dark:selection:text-neutral-950">
      {!isSubscriptionPage && <div className="site-scroll-progress" aria-hidden="true"><span ref={scrollProgressRef} /></div>}
      <Header
        activePage={activePage}
        isSubscriptionPage={isSubscriptionPage}
        theme={theme}
        language={language}
        mobileOpen={mobileOpen}
        searchItems={searchItems}
        t={t}
        tc={tc}
        onNavigate={navigate}
        onLanguageChange={setLanguage}
        onDashboard={() => setDashboardOpen(true)}
        onToggleTheme={() => setTheme((value) => (value === "light" ? "dark" : "light"))}
        onToggleMobile={() => setMobileOpen((value) => !value)}
      />

      {isSubscriptionPage ? (
        <main className="min-w-0 flex-1 overflow-hidden">
          <SubscriptionPage
            onApiPrices={() => navigate("API Prices")}
            onSelectPlan={(planId, billingInterval) => {
              // Checkout integration point: pass the plan id and billing interval to the future authenticated checkout flow.
              notify(`Checkout is not connected yet. Selected plan: ${planId} (${billingInterval})`);
            }}
            onBuildTeam={(billingInterval) => notify(`Team checkout is not connected yet (${billingInterval}).`)}
            onContactSales={(seatCount, seatPlanId, billingInterval) => notify(`Sales request saved for ${seatCount.toLocaleString("en-US")} ${seatPlanId} seats (${billingInterval}).`)}
            proVariantKey={proVariantKey}
            onProVariantChange={selectProVariant}
          />
        </main>
      ) : (
      <div className="flex">
        <Sidebar
          activePage={activePage}
          collapsed={sidebarCollapsed}
          mobileOpen={mobileOpen}
          language={language}
          t={t}
          tc={tc}
          onNavigate={navigate}
          onLanguageChange={setLanguage}
          onDashboard={() => {
            setMobileOpen(false);
            setDashboardOpen(true);
          }}
          onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
          onCloseMobile={() => setMobileOpen(false)}
        />

        <main className="min-w-0 flex-1 overflow-hidden px-4 py-6 sm:px-8 sm:py-10 lg:px-12">
          <div className={`mx-auto grid max-w-7xl gap-10 ${activePage === "Pricing" ? "xl:grid-cols-[minmax(0,1fr)_15rem]" : ""}`}>
            <div key={activePage} className="page-enter min-w-0">
              {activePage === "Pricing" ? (
                <PricingPage t={t} onDashboard={() => setDashboardOpen(true)} onOpenModel={navigate} />
              ) : activePage === "Models" ? (
                <ModelComparisonPage onOpenModel={navigate} />
              ) : textModels.some((model) => model.model === activePage) ? (
                <ModelDetailPage
                  modelName={activePage}
                  onBack={() => navigate("Models")}
                  onCompare={() => {
                    navigate("Models");
                    window.setTimeout(() => document.getElementById("compare-models")?.scrollIntoView({ behavior: "smooth" }), 120);
                  }}
                  onOpenPlayground={() => notify(`${activePage} selected in the Playground.`)}
                />
              ) : (
                <DocsPage activePage={activePage} t={t} tc={tc} onNavigate={navigate} onCopy={copySnippet} />
              )}
            </div>

            {activePage === "Pricing" && <aside className="hidden xl:block">
              <div className="sticky top-24 border-l border-neutral-200 pl-5 dark:border-white/10">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-500">
                  {t("onThisPage")}
                </p>
                <nav className="space-y-2 text-sm">
                  {[
                    ["product-demos", "Product demos"],
                    ["text-models", t("textModels")],
                    ["tts-models", t("ttsModels")],
                    ["transcription-models", t("transcriptionModels")],
                    ["dubbing-models", t("dubbingModels")],
                    ["image-translation", t("imageTranslation")],
                    ["pdf-extraction-and-editing", t("pdfExtractionEditing")],
                    ["music-models", t("musicModels")],
                    ["billing-notes", t("billingNotes")],
                  ].map(([id, item]) => (
                    <a
                      key={id}
                      href={`#${id}`}
                      className="block text-neutral-500 hover:text-neutral-950 dark:text-neutral-500 dark:hover:text-neutral-100"
                    >
                      {item}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>}
          </div>
        </main>
      </div>
      )}

      {dashboardOpen && (
        <DashboardModal tc={tc} onClose={() => setDashboardOpen(false)} onNotify={notify} />
      )}

      {toast && (
        <div className="toast-enter fixed bottom-4 left-4 right-4 z-50 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-950 shadow-lg dark:border-white/10 dark:bg-[#161616] dark:text-neutral-100 sm:bottom-5 sm:left-auto sm:right-5">
          {toast}
        </div>
      )}
    </div>
  );
}

function PricingPage({ t, onDashboard, onOpenModel }: { t: (key: TranslationKey) => string; onDashboard: () => void; onOpenModel: (model: string) => void }) {
  const [currency, setCurrency] = useState<CurrencyCode>(() => {
    const storedCurrency = window.localStorage.getItem("lingofusion-pricing-currency");
    return currencies.some((item) => item.code === storedCurrency) ? (storedCurrency as CurrencyCode) : "USD";
  });
  const [currencyRates, setCurrencyRates] = useState(defaultCurrencyRates);
  const [ratesUnavailable, setRatesUnavailable] = useState(false);
  const [textPricingMode, setTextPricingMode] = useState<TextPricingMode>(() => {
    const storedMode = window.localStorage.getItem("lingofusion-text-pricing-mode");
    return storedMode === "batch" ? "batch" : "instant";
  });
  const [selectedModel, setSelectedModel] = useState("LingoFusion");
  const [inputTokens, setInputTokens] = useState(1_000_000);
  const [outputTokens, setOutputTokens] = useState(1_000_000);
  const ttsCharacterModels = ttsModels.filter((model) => model.pricingUnit === "per_1k_characters");
  const liveTranslateModel = ttsModels.find((model) => model.model === "LingoFusion Live Translate");
  const [selectedTtsModel, setSelectedTtsModel] = useState(ttsCharacterModels[0]?.model ?? "");
  const [ttsCharacters, setTtsCharacters] = useState(1000);
  const [liveTranslateMinutes, setLiveTranslateMinutes] = useState(1);
  const [selectedTranscriptionModel, setSelectedTranscriptionModel] = useState(transcriptionModels[0].model);
  const [transcriptionMinutes, setTranscriptionMinutes] = useState(1);
  const [selectedDubbingModel, setSelectedDubbingModel] = useState(dubbingModels[0].model);
  const [dubbingMinutes, setDubbingMinutes] = useState(1);
  const [selectedMusicModel, setSelectedMusicModel] = useState(musicModels[0].model);
  const [musicMinutes, setMusicMinutes] = useState(1);
  const [selectedImageSize, setSelectedImageSize] = useState(imageModels[0].size);
  const [imageCount, setImageCount] = useState(1);
  const [selectedPdfModel, setSelectedPdfModel] = useState(pdfModels[0].model);
  const [pdfCount, setPdfCount] = useState(500);

  useEffect(() => {
    let cancelled = false;

    fetch("https://open.er-api.com/v6/latest/USD")
      .then((response) => {
        if (!response.ok) throw new Error("exchange_rates_unavailable");
        return response.json() as Promise<{ rates?: Record<string, number> }>;
      })
      .then((data) => {
        if (cancelled || !data.rates) return;
        const liveRates = data.rates;
        const nextRates = { ...defaultCurrencyRates };
        currencies.forEach((item) => {
          if (item.code !== "USD" && Number.isFinite(liveRates[item.code])) nextRates[item.code] = liveRates[item.code];
        });
        setCurrencyRates(nextRates);
        setRatesUnavailable(false);
      })
      .catch(() => {
        if (cancelled) return;
        setRatesUnavailable(true);
        setCurrency("USD");
        window.localStorage.setItem("lingofusion-pricing-currency", "USD");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const activeCurrency = currencyRates[currency] ? currency : "USD";
  const activeRate = currencyRates[activeCurrency];
  const currencyPresentationKey = `${activeCurrency}-${activeRate}`;
  const displayCurrency = (usdAmount: number, precise = false) => formatCurrencyAmount(usdAmount, activeCurrency, activeRate, precise);
  const displayPrice = (usdAmount: number | null, unit?: string) => {
    if (usdAmount === null) return "TBD";
    const suffix = unit === "per_minute" ? "/min" : unit === "per_500_extractions" ? " / 500 extractions" : "";
    return `${displayCurrency(usdAmount)}${suffix}`;
  };

  const visibleTextModels = textModelsByPricingMode[textPricingMode];
  const selectedTextModel = visibleTextModels.find((model) => model.model === selectedModel) ?? visibleTextModels[2];
  const selectedTts = ttsCharacterModels.find((model) => model.model === selectedTtsModel) ?? ttsCharacterModels[0];
  const selectedTranscription =
    transcriptionModels.find((model) => model.model === selectedTranscriptionModel) ?? transcriptionModels[0];
  const selectedDubbing = dubbingModels.find((model) => model.model === selectedDubbingModel) ?? dubbingModels[0];
  const selectedMusic = musicModels.find((model) => model.model === selectedMusicModel) ?? musicModels[0];
  const selectedImage = imageModels.find((model) => model.size === selectedImageSize) ?? imageModels[0];
  const selectedPdf = pdfModels.find((model) => model.model === selectedPdfModel) ?? pdfModels[0];
  const textPricingDescription =
    textPricingMode === "instant"
      ? "Real-time processing with immediate results."
      : "Lower-cost asynchronous processing for large or non-urgent jobs. Results may take up to 24 hours.";
  const pricingLabels = {
    model: t("tableModel"),
    input: t("tableInput"),
    output: t("tableOutput"),
    price: t("tablePrice"),
    imageSize: t("tableImageSize"),
    recommended: t("recommended"),
  };

  const displayedTextModels = visibleTextModels.map((model) => ({ ...model, input: displayCurrency(model.inputUsd), output: displayCurrency(model.outputUsd) }));
  const displayedTtsModels = ttsModels.map((model) => ({ ...model, price: displayPrice(model.priceUsd, model.pricingUnit) }));
  const displayedTranscriptionModels = transcriptionModels.map((model) => ({ ...model, price: displayPrice(model.priceUsd, model.pricingUnit) }));
  const displayedDubbingModels = dubbingModels.map((model) => ({ ...model, price: displayPrice(model.priceUsd, model.pricingUnit) }));
  const displayedMusicModels = musicModels.map((model) => ({ ...model, price: displayPrice(model.priceUsd, model.pricingUnit) }));
  const displayedImageModels = imageModels.map((model) => ({ ...model, price: displayCurrency(model.priceUsd) }));
  const displayedPdfModels = pdfModels.map((model) => ({ ...model, price: displayPrice(model.priceUsd, model.pricingUnit) }));

  const textEstimate = useMemo(() => {
    return (inputTokens / 1_000_000) * selectedTextModel.inputUsd + (outputTokens / 1_000_000) * selectedTextModel.outputUsd;
  }, [inputTokens, outputTokens, selectedTextModel]);

  const ttsEstimate = useMemo(() => {
    return !selectedTts || selectedTts.priceUsd === null ? null : (ttsCharacters / 1000) * selectedTts.priceUsd;
  }, [selectedTts, ttsCharacters]);

  const liveTranslateEstimate = useMemo(() => {
    return !liveTranslateModel || liveTranslateModel.priceUsd === null ? null : minuteNotationToMinutes(liveTranslateMinutes) * liveTranslateModel.priceUsd;
  }, [liveTranslateModel, liveTranslateMinutes]);

  const transcriptionEstimate = useMemo(() => {
    return selectedTranscription.priceUsd === null ? null : minuteNotationToMinutes(transcriptionMinutes) * selectedTranscription.priceUsd;
  }, [selectedTranscription, transcriptionMinutes]);

  const dubbingEstimate = useMemo(() => {
    return selectedDubbing.priceUsd === null ? null : minuteNotationToMinutes(dubbingMinutes) * selectedDubbing.priceUsd;
  }, [selectedDubbing, dubbingMinutes]);

  const musicEstimate = useMemo(() => {
    return selectedMusic.priceUsd === null ? null : minuteNotationToMinutes(musicMinutes) * selectedMusic.priceUsd;
  }, [selectedMusic, musicMinutes]);

  const imageEstimate = useMemo(() => {
    return imageCount * selectedImage.priceUsd;
  }, [selectedImage, imageCount]);

  const pdfEstimate = useMemo(() => {
    if (selectedPdf.model === "PDF text extraction" && selectedPdf.priceUsd !== null) {
      return Math.ceil(pdfCount / 500) * selectedPdf.priceUsd;
    }

    return null;
  }, [selectedPdf, pdfCount]);

  return (
    <>
      <section className="site-reveal section-enter max-w-3xl">
        <p className="mb-4 text-sm font-medium text-neutral-600 dark:text-neutral-400">{t("lingoFusionApi")}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-6xl">
          {t("pricing")}
        </h1>
        <p className="mt-4 text-base leading-7 text-neutral-700 dark:text-neutral-300 sm:mt-5 sm:text-lg sm:leading-8">{t("pricingHero")}</p>
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">Currency</span>
            <select
              value={currency}
              onChange={(event) => {
                const nextCurrency = event.target.value as CurrencyCode;
                setCurrency(nextCurrency);
                window.localStorage.setItem("lingofusion-pricing-currency", nextCurrency);
              }}
              className="clean-select h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-600 dark:border-white/15 dark:bg-white/5 dark:text-neutral-100 dark:focus:border-neutral-400"
              aria-label="Pricing display currency"
            >
              {currencies.map((item) => (
                <option key={item.code} value={item.code}>{item.flag} {item.code}</option>
              ))}
            </select>
          </label>
          {ratesUnavailable && (
            <p className="pb-2 text-sm text-neutral-500 dark:text-neutral-400" role="status">
              Live exchange rates are temporarily unavailable. Showing USD.
            </p>
          )}
        </div>
        <div className="mt-6 grid gap-2.5 sm:mt-7 sm:flex sm:flex-wrap sm:gap-3">
          <button
            type="button"
            onClick={onDashboard}
            className="pressable w-full rounded-md bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200 sm:w-auto"
          >
            {t("openDashboard")}
          </button>
          <a
            href="#text-models"
            className="pressable inline-flex w-full items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-950 hover:bg-neutral-50 dark:border-white/15 dark:bg-white/5 dark:text-neutral-100 dark:hover:bg-white/10 sm:w-auto"
          >
            {t("comparePricing")}
          </a>
          <a
            href="#product-demos"
            className="pressable inline-flex w-full items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-950 hover:bg-neutral-50 dark:border-white/15 dark:bg-white/5 dark:text-neutral-100 dark:hover:bg-white/10 sm:w-auto"
          >
            View product demos
          </a>
        </div>
      </section>

      <div className="mt-8 space-y-9 sm:mt-12 sm:space-y-12">
        <MediaShowcase />
        <div id="text-models" className="site-reveal section-enter [--section-index:1]">
          <TextModelGallery
            models={visibleTextModels}
            pricingMode={textPricingMode}
            displayPrice={displayCurrency}
            onOpenModel={onOpenModel}
          />
          <SectionCalculator title={t("textCalculator")} estimateLabel={t("estimate")} estimate={textEstimate === null ? "TBD" : displayCurrency(textEstimate, true)}>
            <SelectField label={t("model")} value={selectedModel} onChange={setSelectedModel}>
              {visibleTextModels.map((model) => (
                <option key={model.model}>{model.model}</option>
              ))}
            </SelectField>
            <NumberField
              label={t("inputTokens")}
              min={1}
              max={1_000_000_000}
              step={1}
              value={inputTokens}
              onChange={setInputTokens}
            />
            <NumberField
              label={t("outputTokens")}
              min={1}
              max={1_000_000_000}
              step={1}
              value={outputTokens}
              onChange={setOutputTokens}
            />
          </SectionCalculator>
          <PricingCard
            key={`text-${textPricingMode}-${currencyPresentationKey}`}
            title={t("textModels")}
            unit={t("pricesPer1MTokens")}
            kind="text"
            rows={displayedTextModels}
            labels={pricingLabels}
            tableClassName="pricing-table-change"
            headerAction={
              <div
                role="group"
                aria-label="Text model pricing mode"
                className="inline-flex rounded-md border border-neutral-300 bg-neutral-100 p-0.5 dark:border-white/15 dark:bg-white/[0.06]"
              >
                {(["instant", "batch"] as const).map((mode) => {
                  const selected = textPricingMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setTextPricingMode(mode);
                        window.localStorage.setItem("lingofusion-text-pricing-mode", mode);
                      }}
                      className={`pressable rounded px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 dark:focus-visible:ring-white dark:focus-visible:ring-offset-[#0a0a0a] ${
                        selected
                          ? "bg-neutral-950 text-white shadow-sm dark:bg-white dark:text-neutral-950"
                          : "text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-neutral-100"
                      }`}
                    >
                      {mode === "instant" ? "Default" : "Batch"}
                    </button>
                  );
                })}
              </div>
            }
            headerNote={textPricingDescription}
          />
        </div>
        <div id="tts-models" className="site-reveal section-enter [--section-index:2]">
          <SectionCalculator title={t("ttsCalculator")} estimateLabel={t("estimate")} estimate={ttsEstimate === null ? "TBD" : displayCurrency(ttsEstimate, true)}>
            <SelectField label={t("model")} value={selectedTtsModel} onChange={setSelectedTtsModel}>
              {ttsCharacterModels.map((model) => (
                <option key={model.model}>{model.model}</option>
              ))}
            </SelectField>
            <NumberField
              label={t("characters")}
              min={1}
              max={100000000}
              step={1}
              value={ttsCharacters}
              onChange={setTtsCharacters}
            />
          </SectionCalculator>
          {liveTranslateModel && (
            <SectionCalculator title={t("liveTranslateCalculator")} estimateLabel={t("estimate")} estimate={liveTranslateEstimate === null ? "TBD" : displayCurrency(liveTranslateEstimate, true)}>
              <ReadOnlyField label={t("model")} value={liveTranslateModel.model} />
              <NumberField
                label={t("minutes")}
                min={1}
                max={1000000}
                step={0.01}
                value={liveTranslateMinutes}
                onChange={setLiveTranslateMinutes}
                minuteNotation
                minuteHelp={t("minuteHelp")}
              />
            </SectionCalculator>
          )}
          <PricingCard
            key={`tts-${currencyPresentationKey}`}
            title={t("ttsModels")}
            unit={t("pricesPer1KCharactersAndMinute")}
            kind="simple"
            rows={displayedTtsModels}
            labels={pricingLabels}
            tableClassName="pricing-table-change"
          />
        </div>
        <div id="transcription-models" className="site-reveal section-enter [--section-index:3]">
          <SectionCalculator title={t("transcriptionCalculator")} estimateLabel={t("estimate")} estimate={transcriptionEstimate === null ? "TBD" : displayCurrency(transcriptionEstimate, true)}>
            <SelectField
              label={t("model")}
              value={selectedTranscriptionModel}
              onChange={setSelectedTranscriptionModel}
            >
              {transcriptionModels.map((model) => (
                <option key={model.model}>{model.model}</option>
              ))}
            </SelectField>
            <NumberField
              label={t("minutes")}
              min={1}
              max={1000000}
              step={0.01}
              value={transcriptionMinutes}
              onChange={setTranscriptionMinutes}
              minuteNotation
              minuteHelp={t("minuteHelp")}
            />
          </SectionCalculator>
          <PricingCard
            key={`transcription-${currencyPresentationKey}`}
            title={t("transcriptionModels")}
            unit={t("pricesPerMinute")}
            kind="simple"
            rows={displayedTranscriptionModels}
            labels={pricingLabels}
            tableClassName="pricing-table-change"
          />
        </div>
        <div id="dubbing-models" className="site-reveal section-enter [--section-index:4]">
          <SectionCalculator title={t("dubbingCalculator")} estimateLabel={t("estimate")} estimate={dubbingEstimate === null ? "TBD" : displayCurrency(dubbingEstimate, true)}>
            <SelectField label={t("model")} value={selectedDubbingModel} onChange={setSelectedDubbingModel}>
              {dubbingModels.map((model) => (
                <option key={model.model}>{model.model}</option>
              ))}
            </SelectField>
            <NumberField
              label={t("minutes")}
              min={1}
              max={1000000}
              step={0.01}
              value={dubbingMinutes}
              onChange={setDubbingMinutes}
              minuteNotation
              minuteHelp={t("minuteHelp")}
            />
          </SectionCalculator>
          <PricingCard
            key={`dubbing-${currencyPresentationKey}`}
            title={t("dubbingModels")}
            unit={t("pricesPerMinute")}
            kind="simple"
            rows={displayedDubbingModels}
            labels={pricingLabels}
            tableClassName="pricing-table-change"
          />
        </div>
        <div id="image-translation" className="site-reveal section-enter [--section-index:5]">
          <SectionCalculator title={t("imageCalculator")} estimateLabel={t("estimate")} estimate={displayCurrency(imageEstimate, true)}>
            <SelectField label={t("tableImageSize")} value={selectedImageSize} onChange={setSelectedImageSize}>
              {imageModels.map((model) => (
                <option key={model.size}>{model.size}</option>
              ))}
            </SelectField>
            <NumberField
              label={t("images")}
              min={1}
              max={1000000}
              step={1}
              value={imageCount}
              onChange={setImageCount}
            />
          </SectionCalculator>
          <PricingCard
            key={`images-${currencyPresentationKey}`}
            title={t("imageTranslation")}
            unit={t("pricesPerImage")}
            kind="image"
            rows={displayedImageModels}
            labels={pricingLabels}
            tableClassName="pricing-table-change"
          />
        </div>
        <div id="pdf-extraction-and-editing" className="site-reveal section-enter [--section-index:6]">
          <SectionCalculator title={t("pdfCalculator")} estimateLabel={t("estimate")} estimate={pdfEstimate === null ? "TBD" : displayCurrency(pdfEstimate, true)}>
            <SelectField label={t("workflow")} value={selectedPdfModel} onChange={setSelectedPdfModel}>
              {pdfModels.map((model) => (
                <option key={model.model}>{model.model}</option>
              ))}
            </SelectField>
            <NumberField
              label={selectedPdf.model === "PDF text extraction" ? t("extractions") : t("documents")}
              min={1}
              max={1000000}
              step={1}
              value={pdfCount}
              onChange={setPdfCount}
            />
          </SectionCalculator>
          <PricingCard
            key={`pdf-${currencyPresentationKey}`}
            title={t("pdfExtractionEditing")}
            unit={t("pdfWorkflows")}
            kind="simple"
            rows={displayedPdfModels}
            labels={pricingLabels}
            tableClassName="pricing-table-change"
          />
        </div>
        <div id="music-models" className="site-reveal section-enter [--section-index:7]">
          <SectionCalculator title={t("musicCalculator")} estimateLabel={t("estimate")} estimate={musicEstimate === null ? "TBD" : displayCurrency(musicEstimate, true)}>
            <SelectField label={t("model")} value={selectedMusicModel} onChange={setSelectedMusicModel}>
              {musicModels.map((model) => (
                <option key={model.model}>{model.model}</option>
              ))}
            </SelectField>
            <NumberField
              label={t("minutes")}
              min={1}
              max={1000000}
              step={0.01}
              value={musicMinutes}
              onChange={setMusicMinutes}
              minuteNotation
              minuteHelp={t("minuteHelp")}
            />
          </SectionCalculator>
          <PricingCard
            key={`music-${currencyPresentationKey}`}
            title={t("musicModels")}
            unit={t("pricesPerMinute")}
            kind="simple"
            rows={displayedMusicModels}
            labels={pricingLabels}
            tableClassName="pricing-table-change"
          />
        </div>
      </div>


      <section id="billing-notes" className="site-reveal section-enter mt-12 border-t border-neutral-200 pt-8 dark:border-white/10 [--section-index:8]">
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">{t("billingNotes")}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {billingNotes.map((note) => {
            const Icon = note.icon;

            return (
              <div
                key={note.key}
                className="surface-lift flex items-start gap-3 rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-600 dark:border-white/10 dark:bg-[#161616] dark:text-neutral-400"
              >
                <Icon className="mt-0.5 h-4 w-4 text-neutral-500 dark:text-neutral-500" />
                {t(note.key)}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

function TextModelGallery({ models, pricingMode, displayPrice, onOpenModel }: {
  models: TextModel[];
  pricingMode: TextPricingMode;
  displayPrice: (usdAmount: number) => string;
  onOpenModel: (model: string) => void;
}) {
  return (
    <section className="mb-8" aria-labelledby="pricing-model-gallery-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h2 id="pricing-model-gallery-heading" className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">LingoFusion models</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Our text models, designed for fast, capable multilingual work.</p>
        </div>
        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-500">{pricingMode === "batch" ? "Batch" : "Default"} pricing · open a model for details</span>
      </div>
      <div className="mt-8 grid gap-x-12 gap-y-7 md:grid-cols-2">
        {models.map((model) => {
          const presentation = textModelPresentations[model.model];
          return (
            <button
              key={model.model}
              type="button"
              onClick={() => onOpenModel(model.model)}
              className="model-catalog-item pressable group flex min-w-0 items-start gap-5 rounded-lg p-2 text-left opacity-90 outline-none transition hover:opacity-100 focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-4 dark:focus-visible:ring-white dark:focus-visible:ring-offset-[#0a0a0a]"
            >
              <ModelIcon presentation={presentation} />
              <span className="min-w-0 flex-1 pt-0.5">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">{model.model}</span>
                  {model.recommended && <span className="rounded-full bg-neutral-950 px-2 py-0.5 text-[10px] font-semibold text-white dark:bg-white dark:text-neutral-950">Recommended</span>}
                </span>
                <span className="mt-1 block text-base leading-6 text-neutral-600 dark:text-neutral-400">{presentation?.capability ?? modelDetails[model.model]}</span>
                <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-neutral-500 dark:text-neutral-500">
                  <span>Input <strong className="font-medium text-neutral-800 dark:text-neutral-200">{displayPrice(model.inputUsd)}</strong> / 1M</span>
                  <span>Output <strong className="font-medium text-neutral-800 dark:text-neutral-200">{displayPrice(model.outputUsd)}</strong> / 1M</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MediaShowcase() {
  return (
    <section id="product-demos" className="site-reveal scroll-mt-24 border-y border-neutral-200 py-9 dark:border-white/10" aria-labelledby="media-showcase-heading">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-500">LingoFusion in action</p>
        <h2 id="media-showcase-heading" className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-3xl">
          Show what the platform can do
        </h2>
        <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
          These media slots are ready for your final product images and videos. Each caption explains the result the demo should highlight.
        </p>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {showcaseItems.map((item, index) => {
          const PlaceholderIcon = item.kind === "video" ? Play : Image;
          return (
            <figure
              key={item.title}
              className="media-showcase-card group overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-white/10 dark:bg-[#141414]"
              style={{ "--media-index": index } as CSSProperties}
            >
              <div className="media-showcase-frame relative aspect-video overflow-hidden border-b border-neutral-200 bg-neutral-100 dark:border-white/10 dark:bg-[#101010]">
                {item.src ? (
                  item.kind === "video" ? (
                    <video className="h-full w-full object-cover" controls preload="metadata" src={item.src} />
                  ) : (
                    <img className="h-full w-full object-cover" src={item.src} alt={item.title} />
                  )
                ) : (
                  <div
                    role="img"
                    aria-label={`${item.title} ${item.kind} placeholder`}
                    className="media-placeholder grid h-full w-full place-items-center"
                  >
                    <span className="media-placeholder-number">
                      Media placeholder {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="text-center">
                      <span className="media-placeholder-icon mx-auto grid h-10 w-10 place-items-center text-neutral-700 dark:text-neutral-300">
                        <PlaceholderIcon className="h-8 w-8 stroke-[1.5]" />
                      </span>
                      <p className="mt-3 text-base font-semibold text-neutral-950 dark:text-neutral-100">
                        Replace with {item.kind}
                      </p>
                      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
                        16:9 · JPG, PNG, WebP or MP4
                      </p>
                    </div>
                    {item.kind === "video" && <span className="media-scan-line" aria-hidden="true" />}
                  </div>
                )}
              </div>
              <figcaption className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-neutral-950 dark:text-neutral-50">{item.title}</h3>
                  <span className="shrink-0 rounded-full border border-neutral-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:border-white/10 dark:text-neutral-400">
                    {item.label}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">{item.description}</p>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}

function ModelIcon({
  presentation,
  size = "catalog",
}: {
  presentation?: TextModelPresentation;
  size?: "catalog" | "detail";
}) {
  const sizeClass = size === "detail" ? "h-24 w-24 rounded-2xl" : "h-16 w-16 rounded-2xl";
  const imageScale = presentation?.imageScale ?? 1;
  const resolvedImageScale = size === "detail" && imageScale > 1 ? imageScale - 0.04 : imageScale;

  return (
    <span
      className={`model-icon-motion ${sizeClass} shrink-0 overflow-hidden`}
      aria-hidden="true"
    >
      <img
        src={`${import.meta.env.BASE_URL}${(presentation?.image ?? "/assets/models/lingofusion.png").replace(/^\/+/, "")}`}
        alt=""
        className="h-full w-full object-cover transition-transform duration-300"
        style={{ transform: `scale(${resolvedImageScale})` }}
      />
    </span>
  );
}

function ModelComparisonPage({ onOpenModel }: { onOpenModel: (model: string) => void }) {
  const [pricingMode, setPricingMode] = useState<TextPricingMode>(() =>
    window.localStorage.getItem("lingofusion-model-comparison-mode") === "batch" ? "batch" : "instant",
  );
  const [leftModelName, setLeftModelName] = useState("LingoFusion");
  const [rightModelName, setRightModelName] = useState("LingoFusion Pro");
  const models = textModelsByPricingMode[pricingMode];
  const leftModel = models.find((model) => model.model === leftModelName) ?? models[2];
  const rightModel = models.find((model) => model.model === rightModelName) ?? models[3];

  const selectPricingMode = (mode: TextPricingMode) => {
    setPricingMode(mode);
    window.localStorage.setItem("lingofusion-model-comparison-mode", mode);
  };

  return (
    <div className="max-w-6xl">
      <button type="button" onClick={() => window.history.length > 1 ? window.history.back() : onOpenModel("Models")} className="pressable inline-flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"><ArrowLeft className="h-4 w-4" /> Models</button>
      <section className="site-reveal mt-10 flex flex-col gap-5 border-b border-neutral-200 pb-8 dark:border-white/10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-5xl">All models</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-neutral-600 dark:text-neutral-300">Browse all available LingoFusion models and compare their capabilities.</p>
        </div>
        <a href="#compare-models" className="pressable inline-flex min-h-11 items-center justify-center rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200">Compare models</a>
      </section>

      <section className="site-reveal mt-10" aria-labelledby="model-gallery-heading">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-3">
          <h2 id="model-gallery-heading" className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">Translation models</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">LingoFusion's text models for multilingual tasks at every scale.</p>
        </div>
        <div className="mt-8 grid gap-x-12 gap-y-7 md:grid-cols-2">
          {models.map((model) => <ModelGalleryItem key={model.model} model={model} onOpen={() => onOpenModel(model.model)} />)}
        </div>
      </section>

      <section id="compare-models" className="site-reveal mt-12 scroll-mt-24 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#161616] sm:p-6" aria-labelledby="model-comparison-heading">
        <div className="flex flex-col gap-5 border-b border-neutral-200 pb-5 dark:border-white/10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-500">API model comparison</p>
            <h2 id="model-comparison-heading" className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">Compare two models</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <div role="group" aria-label="Model comparison pricing mode" className="inline-flex rounded-md border border-neutral-300 bg-neutral-100 p-0.5 dark:border-white/15 dark:bg-white/[0.06]">
              {(["instant", "batch"] as const).map((mode) => {
                const selected = pricingMode === mode;
                return <button key={mode} type="button" aria-pressed={selected} onClick={() => selectPricingMode(mode)} className={`pressable rounded px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 dark:focus-visible:ring-white dark:focus-visible:ring-offset-[#161616] ${selected ? "bg-neutral-950 text-white shadow-sm dark:bg-white dark:text-neutral-950" : "text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-neutral-100"}`}>{mode === "instant" ? "Default" : "Batch"}</button>;
              })}
            </div>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end">
          <SelectField label="First model" value={leftModel.model} onChange={setLeftModelName}>
            {models.map((model) => <option key={model.model}>{model.model}</option>)}
          </SelectField>
          <button type="button" onClick={() => { setLeftModelName(rightModel.model); setRightModelName(leftModel.model); }} className="pressable min-h-10 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-50 dark:border-white/15 dark:bg-white/5 dark:text-neutral-100 dark:hover:bg-white/10">Swap</button>
          <SelectField label="Second model" value={rightModel.model} onChange={setRightModelName}>
            {models.map((model) => <option key={model.model}>{model.model}</option>)}
          </SelectField>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <ModelComparisonCard model={leftModel} pricingMode={pricingMode} />
          <ModelComparisonCard model={rightModel} pricingMode={pricingMode} />
        </div>
      </section>
    </div>
  );
}

function ModelGalleryItem({ model, onOpen }: { model: TextModel; onOpen: () => void }) {
  const presentation = textModelPresentations[model.model];

  return (
    <button type="button" onClick={onOpen} className="model-catalog-item pressable group flex min-w-0 items-start gap-5 rounded-lg p-2 text-left opacity-90 outline-none transition hover:opacity-100 focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-4 dark:focus-visible:ring-white dark:focus-visible:ring-offset-[#0a0a0a]">
      <ModelIcon presentation={presentation} />
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">{model.model}</h3>
          {model.recommended && <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[11px] font-semibold text-white dark:bg-white dark:text-neutral-950">Recommended</span>}
        </div>
        <p className="mt-1 text-base leading-6 text-neutral-600 dark:text-neutral-400">{presentation?.capability ?? modelDetails[model.model]}</p>
      </div>
    </button>
  );
}

type ModelProfileSpec = {
  reasoning: string;
  reasoningLevel: number;
  speed: string;
  speedLevel: number;
  contextWindow: string;
  maxOutput: string;
  quality: string;
  description: string;
  limitations: string[];
};

const modelProfileSpecs: Record<string, ModelProfileSpec> = {
  "LingoFusion Nano": {
    reasoning: "Light",
    reasoningLevel: 1,
    speed: "Fastest",
    speedLevel: 4,
    contextWindow: "400,000",
    maxOutput: "128,000",
    quality: "Utility",
    description: "LingoFusion Nano is optimized for low-latency, high-volume language work where predictable structure and cost matter more than deep linguistic analysis.",
    limitations: ["Best with short or clearly structured source text", "Limited terminology research", "Not intended for document-scale review"],
  },
  "LingoFusion Lite": {
    reasoning: "Standard",
    reasoningLevel: 2,
    speed: "Very fast",
    speedLevel: 4,
    contextWindow: "400,000",
    maxOutput: "128,000",
    quality: "Efficient",
    description: "LingoFusion Lite balances low cost with stronger multilingual comprehension for production translation, extraction, classification, and summarization.",
    limitations: ["May simplify highly specialized language", "Limited cross-document consistency", "Complex tone may require review"],
  },
  LingoFusion: {
    reasoning: "Balanced",
    reasoningLevel: 3,
    speed: "Fast",
    speedLevel: 3,
    contextWindow: "1,000,000",
    maxOutput: "384,000",
    quality: "High",
    description: "LingoFusion is the recommended default for dependable translation and multilingual generation, balancing quality, latency, and cost across everyday workloads.",
    limitations: ["Specialist terminology may benefit from supplied glossaries", "Long legal or medical documents should be reviewed", "Deep research is reserved for higher tiers"],
  },
  "LingoFusion Pro": {
    reasoning: "Higher",
    reasoningLevel: 4,
    speed: "Moderate",
    speedLevel: 3,
    contextWindow: "1,000,000",
    maxOutput: "384,000",
    quality: "Advanced",
    description: "LingoFusion Pro is designed for professional localization and complex translation where context, tone, ambiguity, and terminology must remain consistent.",
    limitations: ["Higher latency than standard LingoFusion", "Very long jobs may be better suited to Batch", "Human review remains recommended for regulated content"],
  },
  ExplainFusion: {
    reasoning: "Higher",
    reasoningLevel: 4,
    speed: "Moderate",
    speedLevel: 3,
    contextWindow: "1,000,000",
    maxOutput: "384,000",
    quality: "Explanatory",
    description: "ExplainFusion specializes in translations that must also teach, explain, annotate, or clearly justify language choices for readers and reviewers.",
    limitations: ["Explanations increase output length", "Not the lowest-cost choice for direct translation", "Concise mode is recommended for simple requests"],
  },
  "LingoFusion Ultra": {
    reasoning: "Maximum",
    reasoningLevel: 4,
    speed: "Deliberate",
    speedLevel: 2,
    contextWindow: "1,000,000",
    maxOutput: "384,000",
    quality: "Highest",
    description: "LingoFusion Ultra is built for the hardest multilingual work, combining deep reasoning, specialist terminology handling, and document-scale consistency review.",
    limitations: ["Highest price in the LingoFusion text family", "Longer response time for deep analysis", "Batch is recommended for large non-urgent jobs"],
  },
};

function RatingMarks({ value, icon: Icon }: { value: number; icon: typeof Zap }) {
  return (
    <span className="flex items-center justify-center gap-1" aria-label={`${value} out of 4`}>
      {[1, 2, 3, 4].map((mark) => <Icon key={mark} className={`h-4 w-4 ${mark <= value ? "text-neutral-950 dark:text-white" : "text-neutral-300 dark:text-neutral-700"}`} fill={mark <= value ? "currentColor" : "none"} />)}
    </span>
  );
}

function ModelDetailPage({
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
  const presentation = textModelPresentations[modelName];
  const profile = modelProfileSpecs[modelName];
  const [pricingMode, setPricingMode] = useState<TextPricingMode>("instant");
  const [comparisonMetric, setComparisonMetric] = useState<"input" | "output">("input");
  const [copied, setCopied] = useState<"model" | "request" | null>(null);
  if (!defaultModel || !batchModel || !presentation || !profile) return null;

  const price = (value: number) => new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 1 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value);
  const apiModelId = modelSlug(modelName);
  const activePrice = pricingMode === "batch" ? batchModel : defaultModel;
  const comparisonModels = textModelsByPricingMode[pricingMode];
  const comparisonMax = Math.max(...comparisonModels.map((model) => model[comparisonMetric === "input" ? "inputUsd" : "outputUsd"]));
  const requestSnippet = `curl https://api.lingofusion.ai/v1/translate \\
  -H "Authorization: Bearer $LINGOFUSION_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${apiModelId}",
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
      <button type="button" onClick={onBack} className="pressable inline-flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"><ArrowLeft className="h-4 w-4" /> All models</button>

      <header className="site-reveal mt-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <ModelIcon presentation={presentation} size="detail" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-4xl">{modelName}</h1>
                <select
                  value={pricingMode}
                  onChange={(event) => setPricingMode(event.target.value as TextPricingMode)}
                  aria-label="Processing mode"
                  className="h-9 rounded-full border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800 outline-none focus:border-neutral-600 dark:border-white/20 dark:bg-[#111] dark:text-neutral-100"
                >
                  <option value="instant">Default</option>
                  <option value="batch">Batch</option>
                </select>
                <button type="button" onClick={() => copyText(apiModelId, "model")} aria-label="Copy model ID" className="pressable rounded-md p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950 dark:hover:bg-white/10 dark:hover:text-white"><Copy className="h-4 w-4" /></button>
                {copied === "model" && <span className="text-xs font-medium text-neutral-500">Copied</span>}
              </div>
              <p className="mt-1 max-w-2xl text-base text-neutral-600 dark:text-neutral-400">{presentation.capability}</p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={onCompare} className="pressable inline-flex min-h-11 items-center justify-center rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-neutral-50 dark:border-white/20 dark:text-white dark:hover:bg-white/10">Compare</button>
            <button type="button" onClick={onOpenPlayground} className="pressable inline-flex min-h-11 items-center justify-center rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200">Try in Playground</button>
          </div>
        </div>
      </header>

      <section className="site-reveal mt-10 overflow-hidden rounded-lg border border-neutral-200 dark:border-white/10" aria-label="Model summary">
        <div className="grid grid-cols-2 divide-x divide-y divide-neutral-200 dark:divide-white/10 sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
          <div className="p-5 text-center"><p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Reasoning</p><div className="mt-3"><RatingMarks value={profile.reasoningLevel} icon={BrainCircuit} /></div><p className="mt-2 text-sm font-medium text-neutral-800 dark:text-neutral-200">{profile.reasoning}</p></div>
          <div className="p-5 text-center"><p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Speed</p><div className="mt-3"><RatingMarks value={profile.speedLevel} icon={Zap} /></div><p className="mt-2 text-sm font-medium text-neutral-800 dark:text-neutral-200">{profile.speed}</p></div>
          <div className="p-5 text-center"><p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Price</p><p className="mt-3 text-lg font-semibold text-neutral-950 dark:text-white">{price(activePrice.inputUsd)} · {price(activePrice.outputUsd)}</p><p className="mt-1 text-sm text-neutral-500">Input · Output</p></div>
          <div className="p-5 text-center"><p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Input</p><Type className="mx-auto mt-3 h-5 w-5 text-neutral-800 dark:text-neutral-200" /><p className="mt-2 text-sm font-medium text-neutral-800 dark:text-neutral-200">Text</p></div>
          <div className="col-span-2 p-5 text-center sm:col-span-1"><p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Output</p><FileText className="mx-auto mt-3 h-5 w-5 text-neutral-800 dark:text-neutral-200" /><p className="mt-2 text-sm font-medium text-neutral-800 dark:text-neutral-200">Text</p></div>
        </div>
      </section>

      <section className="site-reveal grid gap-8 border-b border-neutral-200 py-10 dark:border-white/10 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]">
        <p className="text-base leading-8 text-neutral-700 dark:text-neutral-300">{profile.description}</p>
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-1">
          <div className="flex items-center gap-3"><Layers3 className="h-5 w-5 text-neutral-500" /><div><dt className="text-neutral-500">Context window</dt><dd className="font-medium text-neutral-950 dark:text-white">{profile.contextWindow} tokens</dd></div></div>
          <div className="flex items-center gap-3"><Gauge className="h-5 w-5 text-neutral-500" /><div><dt className="text-neutral-500">Maximum output</dt><dd className="font-medium text-neutral-950 dark:text-white">{profile.maxOutput} tokens</dd></div></div>
          <div className="flex items-center gap-3"><Globe2 className="h-5 w-5 text-neutral-500" /><div><dt className="text-neutral-500">Translation quality</dt><dd className="font-medium text-neutral-950 dark:text-white">{profile.quality}</dd></div></div>
          <div className="flex items-center gap-3"><Clock3 className="h-5 w-5 text-neutral-500" /><div><dt className="text-neutral-500">Processing</dt><dd className="font-medium text-neutral-950 dark:text-white">Default, streaming, Batch</dd></div></div>
        </dl>
      </section>

      <section className="site-reveal grid gap-8 border-b border-neutral-200 py-12 dark:border-white/10 lg:grid-cols-[14rem_minmax(0,1fr)]" aria-labelledby="model-pricing-heading">
        <h2 id="model-pricing-heading" className="text-xl font-semibold text-neutral-950 dark:text-white">Pricing</h2>
        <div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <p className="max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">Pricing is based on tokens processed. API billing remains in USD, and Batch offers lower-cost asynchronous processing for non-urgent work.</p>
            <span className="shrink-0 text-sm text-neutral-500">Per 1M tokens</span>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 dark:border-white/10 dark:bg-white/[0.04]"><p className="text-sm text-neutral-500">Input</p><p className="mt-2 text-2xl font-semibold text-neutral-950 dark:text-white">{price(activePrice.inputUsd)}</p></div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 dark:border-white/10 dark:bg-white/[0.04]"><p className="text-sm text-neutral-500">Output</p><p className="mt-2 text-2xl font-semibold text-neutral-950 dark:text-white">{price(activePrice.outputUsd)}</p></div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 dark:border-white/10 dark:bg-white/[0.04]"><p className="text-sm text-neutral-500">{pricingMode === "batch" ? "Turnaround" : "Response"}</p><p className="mt-2 text-2xl font-semibold text-neutral-950 dark:text-white">{pricingMode === "batch" ? "Up to 24h" : "Immediate"}</p></div>
          </div>

          <div className="mt-8 flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">Quick comparison</h3>
            <div role="group" aria-label="Comparison metric" className="inline-flex rounded-md border border-neutral-200 p-0.5 dark:border-white/10">
              {(["input", "output"] as const).map((metric) => <button key={metric} type="button" aria-pressed={comparisonMetric === metric} onClick={() => setComparisonMetric(metric)} className={`rounded px-3 py-1 text-xs font-medium capitalize ${comparisonMetric === metric ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950" : "text-neutral-500"}`}>{metric}</button>)}
            </div>
          </div>
          <div className="mt-4 space-y-3 rounded-lg border border-neutral-200 p-5 dark:border-white/10">
            {comparisonModels.map((model) => {
              const value = model[comparisonMetric === "input" ? "inputUsd" : "outputUsd"];
              const visualWidth = Math.max(10, Math.cbrt(value / comparisonMax) * 100);
              return (
                <div key={model.model} className="grid grid-cols-[8rem_minmax(4rem,1fr)_4rem] items-center gap-3 text-sm">
                  <span className={`truncate ${model.model === modelName ? "font-semibold text-neutral-950 dark:text-white" : "text-neutral-600 dark:text-neutral-400"}`}>{model.model.replace("LingoFusion ", "")}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10"><span className={`block h-full rounded-full ${model.model === modelName ? "bg-neutral-950 dark:bg-white" : "bg-neutral-500"}`} style={{ width: `${visualWidth}%` }} /></span>
                  <span className="text-right font-mono text-xs text-neutral-600 dark:text-neutral-400">{price(value)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="site-reveal grid gap-8 border-b border-neutral-200 py-12 dark:border-white/10 lg:grid-cols-[14rem_minmax(0,1fr)]" aria-labelledby="capabilities-heading">
        <h2 id="capabilities-heading" className="text-xl font-semibold text-neutral-950 dark:text-white">Capabilities</h2>
        <div>
          <p className="max-w-3xl text-base leading-7 text-neutral-600 dark:text-neutral-300">{presentation.bestFor}</p>
          <ul className="mt-7 grid gap-px overflow-hidden rounded-lg border border-neutral-200 bg-neutral-200 dark:border-white/10 dark:bg-white/10 sm:grid-cols-2">
            {presentation.features.map((feature) => <li key={feature} className="flex items-start gap-3 bg-white p-5 text-sm text-neutral-700 dark:bg-[#111] dark:text-neutral-300"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" /> {feature}</li>)}
          </ul>
        </div>
      </section>

      <section className="site-reveal grid gap-8 border-b border-neutral-200 py-12 dark:border-white/10 lg:grid-cols-[14rem_minmax(0,1fr)]" aria-labelledby="api-usage-heading">
        <h2 id="api-usage-heading" className="text-xl font-semibold text-neutral-950 dark:text-white">API usage</h2>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-sm text-neutral-500">Model ID</p><code className="mt-1 block font-mono text-sm text-neutral-950 dark:text-white">{apiModelId}</code></div>
            <button type="button" onClick={() => copyText(requestSnippet, "request")} className="pressable inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 dark:border-white/20 dark:text-neutral-200 dark:hover:bg-white/10"><Copy className="h-4 w-4" /> {copied === "request" ? "Copied" : "Copy request"}</button>
          </div>
          <pre className="mt-5 overflow-x-auto rounded-lg bg-neutral-950 p-5 text-sm leading-6 text-neutral-100"><code>{requestSnippet}</code></pre>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {["/v1/responses", "/v1/translate", "/v1/batch"].map((endpoint) => <div key={endpoint} className="rounded-lg border border-neutral-200 p-4 dark:border-white/10"><p className="font-mono text-sm text-neutral-950 dark:text-white">{endpoint}</p><p className="mt-1 text-xs text-neutral-500">Available</p></div>)}
          </div>
        </div>
      </section>

      <section className="site-reveal grid gap-8 border-b border-neutral-200 py-12 dark:border-white/10 lg:grid-cols-[14rem_minmax(0,1fr)]" aria-labelledby="guidance-heading">
        <h2 id="guidance-heading" className="text-xl font-semibold text-neutral-950 dark:text-white">Usage guidance</h2>
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">Best for</h3>
            <p className="mt-3 text-sm leading-7 text-neutral-600 dark:text-neutral-400">{presentation.bestFor}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">Considerations</h3>
            <ul className="mt-3 space-y-3">
              {profile.limitations.map((limitation) => <li key={limitation} className="flex items-start gap-3 text-sm leading-6 text-neutral-600 dark:text-neutral-400"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" />{limitation}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="site-reveal grid gap-8 py-12 lg:grid-cols-[14rem_minmax(0,1fr)]" aria-labelledby="operations-heading">
        <h2 id="operations-heading" className="text-xl font-semibold text-neutral-950 dark:text-white">Operations</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <article className="rounded-lg border border-neutral-200 p-5 dark:border-white/10"><Activity className="h-5 w-5 text-neutral-500" /><h3 className="mt-4 font-semibold text-neutral-950 dark:text-white">Streaming</h3><p className="mt-2 text-sm leading-6 text-neutral-500">Receive text as it is generated for responsive interfaces and live translation workflows.</p></article>
          <article className="rounded-lg border border-neutral-200 p-5 dark:border-white/10"><Layers3 className="h-5 w-5 text-neutral-500" /><h3 className="mt-4 font-semibold text-neutral-950 dark:text-white">Batch processing</h3><p className="mt-2 text-sm leading-6 text-neutral-500">Queue large or non-urgent jobs at reduced token prices with completion within 24 hours.</p></article>
          <article className="rounded-lg border border-neutral-200 p-5 dark:border-white/10"><BadgeDollarSign className="h-5 w-5 text-neutral-500" /><h3 className="mt-4 font-semibold text-neutral-950 dark:text-white">Usage reporting</h3><p className="mt-2 text-sm leading-6 text-neutral-500">Every response reports input tokens, output tokens, processing mode, and exact USD cost.</p></article>
        </div>
      </section>
    </div>
  );
}

function ModelComparisonCard({ model, pricingMode }: { model: TextModel; pricingMode: TextPricingMode }) {
  const price = (value: number) => new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 1 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value);

  return (
    <article className={`comparison-card-motion rounded-lg border p-5 ${model.recommended ? "border-neutral-950 bg-neutral-50 dark:border-white/50 dark:bg-white/[0.05]" : "border-neutral-200 bg-white dark:border-white/10 dark:bg-[#111111]"}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-neutral-950 dark:text-neutral-50">{model.model}</h3>
          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">{modelDetails[model.model] ?? "A LingoFusion API model for translation and language workflows."}</p>
        </div>
        {model.recommended && <span className="rounded-full bg-neutral-950 px-2 py-1 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">Recommended</span>}
      </div>
      <dl className="mt-5 grid gap-3 border-t border-neutral-200 pt-5 text-sm dark:border-white/10 sm:grid-cols-2">
        <div><dt className="text-neutral-500 dark:text-neutral-500">Input per 1M tokens</dt><dd className="mt-1 text-lg font-semibold text-neutral-950 dark:text-neutral-50">{price(model.inputUsd)}</dd></div>
        <div><dt className="text-neutral-500 dark:text-neutral-500">Output per 1M tokens</dt><dd className="mt-1 text-lg font-semibold text-neutral-950 dark:text-neutral-50">{price(model.outputUsd)}</dd></div>
        <div className="sm:col-span-2"><dt className="text-neutral-500 dark:text-neutral-500">Pricing mode</dt><dd className="mt-1 font-medium text-neutral-950 dark:text-neutral-50">{pricingMode === "batch" ? "Batch, asynchronous processing" : "Default, real-time processing"}</dd></div>
      </dl>
    </article>
  );
}

function SectionCalculator({
  title,
  estimateLabel,
  estimate,
  children,
}: {
  title: string;
  estimateLabel: string;
  estimate: string;
  children: ReactNode;
}) {
  return (
    <div className="calculator-motion surface-lift mb-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-white/10 dark:bg-white/[0.03] sm:p-4">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">{title}</h3>
        <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-[#111111] sm:text-right">
          <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-500">
            {estimateLabel}
          </div>
          <div key={estimate} className="estimate-pop mt-0.5 break-all font-mono text-base font-semibold text-neutral-950 dark:text-neutral-50">
            {estimate}
          </div>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="min-w-0 text-sm">
      <span className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="clean-select h-10 w-full appearance-none rounded-md border border-neutral-300 bg-white px-3 pr-9 text-sm text-neutral-950 outline-none transition focus:border-neutral-600 dark:border-white/15 dark:bg-[#111111] dark:text-neutral-100 dark:focus:border-neutral-400"
        >
          {children}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500">
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
            <path d="M5.7 7.5a1 1 0 0 1 1.4 0L10 10.4l2.9-2.9a1 1 0 1 1 1.4 1.4l-3.6 3.6a1 1 0 0 1-1.4 0L5.7 8.9a1 1 0 0 1 0-1.4Z" />
          </svg>
        </span>
      </div>
    </label>
  );
}

function NumberField({
  label,
  min,
  max,
  step,
  value,
  onChange,
  minuteNotation = false,
  minuteHelp,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  minuteNotation?: boolean;
  minuteHelp?: string;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) =>
          onChange(
            minuteNotation
              ? clampMinuteNotation(Number(event.target.value), min, max)
              : clampNumber(Number(event.target.value), min, max),
          )
        }
        className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-600 dark:border-white/15 dark:bg-[#111111] dark:text-neutral-100 dark:focus:border-neutral-400"
      />
      {minuteNotation && (
        <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-500">
          {minuteHelp}
        </span>
      )}
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 text-sm">
      <span className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">{label}</span>
      <div className="flex h-10 items-center truncate rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-700 dark:border-white/10 dark:bg-[#111111] dark:text-neutral-300">
        {value}
      </div>
    </div>
  );
}

function DocsPage({
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

  return (
    <div>
      <section className="site-reveal max-w-3xl">
        <p className="mb-4 text-sm font-medium text-neutral-600 dark:text-neutral-400">
          {isModel ? t("modelReference") : t("developerDocs")}
        </p>
        <h1 className="text-5xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-6xl">
          {modelDetails[activePage] ? activePage : tc(activePage)}
        </h1>
        <p className="mt-5 text-lg leading-8 text-neutral-700 dark:text-neutral-300">{tc(summary)}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onNavigate("Pricing")}
            className="pressable inline-flex items-center gap-2 rounded-md bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
          >
            {t("viewPricing")}
            <BadgeDollarSign className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onCopy}
            className="pressable inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-950 hover:bg-neutral-50 dark:border-white/15 dark:bg-white/5 dark:text-neutral-100 dark:hover:bg-white/10"
          >
            {t("copyQuickstart")}
            <Copy className="h-4 w-4" />
          </button>
        </div>
      </section>

      <div className="site-reveal mt-12 grid gap-4 lg:grid-cols-3">
        <DocCard icon={Play} title={t("startFast")} tc={tc}>
          Generate a scoped key, pick a model, and send your first request from the
          dashboard or an SDK.
        </DocCard>
        <DocCard icon={Activity} title={t("monitorUsage")} tc={tc}>
          Track token, character, image, and minute usage with budget alerts and invoices.
        </DocCard>
        <DocCard icon={CheckCircle2} title={t("shipReliably")} tc={tc}>
          Production retries, status visibility, and clear error responses keep integrations predictable.
        </DocCard>
      </div>

      <section className="site-reveal mt-8 border-t border-neutral-200 pt-8 dark:border-white/10">
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">{t("relatedPages")}</h2>
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
                className="pressable rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 hover:text-neutral-950 dark:border-white/15 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-neutral-100"
              >
                {tc(item)}
              </button>
            ))}
        </div>
      </section>
    </div>
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
    <article className="surface-lift rounded-lg border border-neutral-200 bg-white p-5 dark:border-white/10 dark:bg-[#161616]">
      <Icon className="mb-4 h-5 w-5 text-neutral-500 dark:text-neutral-500" />
      <h2 className="font-semibold text-neutral-950 dark:text-neutral-50">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
        {typeof children === "string" ? tc(children) : children}
      </p>
    </article>
  );
}
