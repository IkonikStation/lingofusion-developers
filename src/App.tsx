import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardModal } from "./components/DashboardModal";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { SubscriptionPage } from "./components/SubscriptionPage";
import { createContentTranslator, createTranslator, getLanguage } from "./data/i18n";
import type { LanguageCode } from "./data/i18n";
import {
  dubbingModels,
  imageModels,
  latestModels,
  musicModels,
  pageSummaries,
  pdfModels,
  textModels,
  transcriptionModels,
  ttsModels,
} from "./data/pricing";
import type { ProVariantKey } from "./data/subscriptions";
import {
  documentationPages,
  modelSlug,
  pageFromPath,
  withBasePath,
} from "./lib/utils";

// Pages
import { CheckoutPage } from "./pages/CheckoutPage";
import { ContactSalesPage } from "./pages/ContactSalesPage";
import { DocsPage } from "./pages/DocsPage";
import { ModelDetailPage } from "./pages/ModelDetailPage";
import { ModelsPage } from "./pages/ModelsPage";
import { PlaygroundPage } from "./pages/PlaygroundPage";
import { PricingPage } from "./pages/PricingPage";
import { TeamsPage } from "./pages/TeamsPage";

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
    ...imageModels.flatMap((model) => [model.size, model.model, model.label]),
    ...pdfModels.map((model) => model.model),
  ]),
);

import { browserApi, getApiBaseUrl, shouldUseBrowserApi } from "./data/browserApi";

export default function App() {
  const [activePage, setActivePage] = useState(() => pageFromPath(window.location.pathname));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [balanceUsd, setBalanceUsd] = useState<number>(0.0);
  const [proVariantKey, setProVariantKey] = useState<ProVariantKey>(() =>
    ["750k", "1m"].includes(window.localStorage.getItem("lingofusion-pro-variant") ?? "") ? "750k" : "350k",
  );
  const [toast, setToast] = useState<string | null>(null);
  const scrollProgressRef = useRef<HTMLSpanElement>(null);
  const t = useMemo(() => createTranslator(language), [language]);
  const tc = useMemo(() => createContentTranslator(language), [language]);
  const activeLanguage = getLanguage(language);
  const isSubscriptionPage = activePage === "Subscription Prices";

  const refreshLiveBalance = async () => {
    try {
      if (shouldUseBrowserApi()) {
        const dash = await browserApi<{ user?: { balance_usd: number }; account: { paidBalance: number } }>("/api/dashboard");
        setBalanceUsd(Number((dash.user?.balance_usd ?? dash.account.paidBalance ?? 0).toFixed(6)));
        return;
      }
      const res = await fetch(`${getApiBaseUrl()}/api/dashboard`);
      if (res.ok) {
        const dash = await res.json();
        setBalanceUsd(Number((dash.user?.balance_usd ?? dash.account?.paidBalance ?? 0).toFixed(6)));
      }
    } catch {
      // ignore offline
    }
  };

  useEffect(() => {
    refreshLiveBalance();
  }, [activePage, dashboardOpen]);

  const navigate = (page: string, query?: Record<string, string | number | undefined>) => {
    const nextPage = page === "API Prices" ? "Pricing" : page;
    const nextPath =
      nextPage === "Subscription Prices"
        ? "/subscriptions"
        : nextPage === "Models"
        ? "/models"
        : nextPage === "Playground"
        ? "/playground"
        : nextPage === "Checkout"
        ? "/checkout"
        : nextPage === "Teams"
        ? "/teams"
        : nextPage === "Contact Sales"
        ? "/contact-sales"
        : documentationPages.includes(nextPage)
        ? `/docs/${modelSlug(nextPage)}`
        : textModels.some((model) => model.model === nextPage)
        ? `/models/${modelSlug(nextPage)}`
        : "/";

    const search = query
      ? `?${new URLSearchParams(
          Object.entries(query)
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => [key, String(value)]),
        ).toString()}`
      : "";

    const deployedPath = `${withBasePath(nextPath)}${search}`;
    if (`${window.location.pathname}${window.location.search}` !== deployedPath) {
      window.history.pushState({}, "", deployedPath);
    }
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
    document.body.style.background = theme === "dark" ? "#09090b" : "#ffffff";
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
    document.title =
      activePage === "Pricing"
        ? "API Prices | LingoFusion Developers"
        : `${activePage} | LingoFusion Developers`;

    const description =
      activePage === "Pricing"
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
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("site-reveal-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [activePage, isSubscriptionPage]);

  return (
    <div className="min-h-screen bg-white text-neutral-950 selection:bg-neutral-900 selection:text-white dark:bg-[#09090b] dark:text-neutral-100 dark:selection:bg-neutral-100 dark:selection:text-neutral-950">
      {!isSubscriptionPage && (
        <div className="site-scroll-progress" aria-hidden="true">
          <span ref={scrollProgressRef} />
        </div>
      )}

      <Header
        activePage={activePage}
        isSubscriptionPage={isSubscriptionPage}
        theme={theme}
        language={language}
        mobileOpen={mobileOpen}
        searchItems={searchItems}
        balanceUsd={balanceUsd}
        t={t}
        tc={tc}
        onNavigate={navigate}
        onLanguageChange={setLanguage}
        onDashboard={() => setDashboardOpen(true)}
        onToggleTheme={() => setTheme((value) => (value === "light" ? "dark" : "light"))}
        onToggleMobile={() => setMobileOpen((value) => !value)}
      />

      <div className="flex min-h-[calc(100vh-3.5rem)]">
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
          {isSubscriptionPage ? (
            <SubscriptionPage
              onApiPrices={() => navigate("API Prices")}
              onSelectPlan={(planId, billingInterval) =>
                navigate("Checkout", { plan: planId, billing: billingInterval })
              }
              onBuildTeam={(billingInterval) => navigate("Teams", { billing: billingInterval })}
              onContactSales={(seatCount, seatPlanId, billingInterval) =>
                navigate("Contact Sales", { seats: seatCount, plan: seatPlanId, billing: billingInterval })
              }
              proVariantKey={proVariantKey}
              onProVariantChange={selectProVariant}
            />
          ) : (
            <div
              className={`mx-auto grid max-w-7xl gap-10 ${
                activePage === "Pricing" ? "xl:grid-cols-[minmax(0,1fr)_15rem]" : ""
              }`}
            >
              <div key={activePage} className="page-enter min-w-0">
                {activePage === "Pricing" ? (
                  <PricingPage t={t} onDashboard={() => setDashboardOpen(true)} onOpenModel={navigate} />
                ) : activePage === "Models" ? (
                  <ModelsPage onOpenModel={navigate} />
                ) : activePage === "Playground" ? (
                  <PlaygroundPage
                    onOpenDashboard={() => setDashboardOpen(true)}
                    onNavigate={navigate}
                    balanceUsd={balanceUsd}
                    onBalanceChange={setBalanceUsd}
                  />
                ) : activePage === "Checkout" ? (
                  <CheckoutPage onNavigate={navigate} onBalanceChange={setBalanceUsd} />
                ) : activePage === "Teams" ? (
                  <TeamsPage onNavigate={navigate} />
                ) : activePage === "Contact Sales" ? (
                  <ContactSalesPage onNavigate={navigate} />
                ) : textModels.some((model) => model.model === activePage) ? (
                  <ModelDetailPage
                    modelName={activePage}
                    onBack={() => navigate("Models")}
                    onCompare={() => {
                      navigate("Models");
                      window.setTimeout(
                        () => document.getElementById("compare-models")?.scrollIntoView({ behavior: "smooth" }),
                        120,
                      );
                    }}
                    onOpenPlayground={() => navigate("Playground", { model: activePage })}
                  />
                ) : (
                  <DocsPage activePage={activePage} t={t} tc={tc} onNavigate={navigate} onCopy={copySnippet} />
                )}
              </div>

              {activePage === "Pricing" && (
                <aside className="hidden xl:block">
                  <div className="sticky top-24 border-l border-neutral-200/80 pl-5 dark:border-white/[0.08]">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                      {t("onThisPage")}
                    </p>
                    <nav className="space-y-2 text-xs font-medium">
                      {[
                        ["product-demos", "Product Demos"],
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
                          className="block text-neutral-500 transition hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
                        >
                          {item}
                        </a>
                      ))}
                    </nav>
                  </div>
                </aside>
              )}
            </div>
          )}
        </main>
      </div>

      {dashboardOpen && (
        <DashboardModal tc={tc} onClose={() => setDashboardOpen(false)} onNotify={notify} />
      )}

      {toast && (
        <div className="toast-enter fixed bottom-4 left-4 right-4 z-50 rounded-xl border border-neutral-200/90 bg-white/95 px-4 py-3 text-xs font-semibold text-neutral-950 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-[#141417]/95 dark:text-neutral-100 sm:bottom-5 sm:left-auto sm:right-5">
          {toast}
        </div>
      )}
    </div>
  );
}
