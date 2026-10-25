import {
  ArrowRight,
  BookOpenCheck,
  Check,
  ChevronDown,
  Globe2,
  Languages,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Users,
  Volume2,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  advancedTtsAdditionalPrice,
  billingIntervals,
  enterpriseConfiguration,
  priceForBillingInterval,
  subscriptionFaqs,
  subscriptionPlans,
  teamConfiguration,
  yearlyDiscountPercent,
} from "../data/subscriptions";
import type { BillingInterval, ProVariant, ProVariantKey, UltraVariant, UltraVariantKey } from "../data/subscriptions";
import { submitSalesRequest } from "../data/sales";
import { UltraSubscriptionBuilder } from "./UltraSubscriptionBuilder";
import { ULTRA_BASE_FEE, ULTRA_DEFAULTS, calculateUltraPrice } from "../data/ultraConfig";
import type { UltraResourceConfig } from "../data/ultraConfig";

type SubscriptionPageProps = {
  onApiPrices: () => void;
  onSelectPlan: (planId: string, billingInterval: BillingInterval, customParams?: Record<string, string | number>) => void;
  onBuildTeam: (billingInterval: BillingInterval) => void;
  onContactSales: (seatCount: number, seatPlanId: string, billingInterval: BillingInterval, customMessage?: string) => void;
  proVariantKey: ProVariantKey;
  onProVariantChange: (key: ProVariantKey) => void;
};

const numberFormatter = new Intl.NumberFormat("en-US");

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

export function SubscriptionPage({ onApiPrices, onSelectPlan, onBuildTeam, onContactSales, proVariantKey, onProVariantChange }: SubscriptionPageProps) {
  const [comparisonView, setComparisonView] = useState<"subscriptions" | "models">("subscriptions");
  const [billingInterval, setBillingInterval] = useState<BillingInterval>(() =>
    window.localStorage.getItem("lingofusion-subscription-billing") === "yearly" ? "yearly" : "monthly",
  );
  const [ultraVariantKey, setUltraVariantKey] = useState<UltraVariantKey>(() =>
    window.localStorage.getItem("lingofusion-ultra-variant") === "x2" ? "x2" : "x1",
  );
  const [ultraBuilderConfig, setUltraBuilderConfig] = useState<UltraResourceConfig>(ULTRA_DEFAULTS);
  const ultraCustomBreakdown = useMemo(() => calculateUltraPrice(ultraBuilderConfig), [ultraBuilderConfig]);
  const [teamSeatPlanId, setTeamSeatPlanId] = useState<string>(teamConfiguration.seats[0].planId);
  const [teamMemberCount, setTeamMemberCount] = useState<number>(teamConfiguration.minimumSeats);
  const [salesFormOpen, setSalesFormOpen] = useState(false);
  const selectorRefs = useRef<Record<ProVariantKey, HTMLButtonElement | null>>({ "350k": null, "750k": null });
  const billingRefs = useRef<Record<BillingInterval, HTMLButtonElement | null>>({ monthly: null, yearly: null });
  const scrollProgressRef = useRef<HTMLSpanElement | null>(null);
  const pro = subscriptionPlans.pro.variants[proVariantKey];
  const ultra = subscriptionPlans.ultra.variants[ultraVariantKey];
  const billing = billingIntervals[billingInterval];
  const selectedTeamSeat = teamConfiguration.seats.find((seat) => seat.planId === teamSeatPlanId) ?? teamConfiguration.seats[0];
  const selectedTeamPlan = "variant" in selectedTeamSeat
    ? subscriptionPlans.pro.variants[selectedTeamSeat.variant]
    : subscriptionPlans.ultra.variants[selectedTeamSeat.ultraVariant];
  const teamSeatPrice = priceForBillingInterval(selectedTeamPlan.monthlyPrice, selectedTeamPlan.yearlyPrice, billingInterval);
  const teamTotalPrice = teamSeatPrice * teamMemberCount;
  const isEnterpriseSeatCount = teamMemberCount >= enterpriseConfiguration.minimumSeats;

  const updateTeamSeatCount = (rawValue: string) => {
    const parsedValue = Number(rawValue.replace(/,/g, ""));
    const nextValue = Number.isFinite(parsedValue)
      ? Math.min(teamConfiguration.maximumSelectableSeats, Math.max(teamConfiguration.minimumSeats, Math.round(parsedValue)))
      : teamConfiguration.minimumSeats;
    setTeamMemberCount(nextValue);
  };

  const openSalesForm = (seatCount = teamMemberCount) => {
    setTeamMemberCount(Math.max(enterpriseConfiguration.minimumSeats, Math.min(teamConfiguration.maximumSelectableSeats, seatCount)));
    setSalesFormOpen(true);
  };

  useEffect(() => {
    document.title = "Subscription Prices | LingoFusion";
    const description = "Compare LingoFusion Free, Pro, Ultra, and Teams subscription plans for consumer translation and Advanced TTS.";
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
    canonical.href = `${window.location.origin}/subscriptions`;
  }, []);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const revealElements = Array.from(document.querySelectorAll<HTMLElement>("[data-scroll-reveal]"));

    if (reducedMotion || !("IntersectionObserver" in window)) {
      revealElements.forEach((element) => element.classList.add("scroll-reveal-visible"));
      return;
    }

    revealElements.forEach((element) => element.classList.add("scroll-reveal-ready"));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("scroll-reveal-visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -10%", threshold: 0.08 });

    revealElements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let frame = 0;
    const updateProgress = () => {
      frame = 0;
      const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollableHeight > 0 ? Math.min(window.scrollY / scrollableHeight, 1) : 0;
      if (scrollProgressRef.current) scrollProgressRef.current.style.transform = `scaleX(${progress})`;
    };
    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateProgress);
    };

    updateProgress();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const selectProVariant = (key: ProVariantKey, focus = false) => {
    onProVariantChange(key);
    if (focus) selectorRefs.current[key]?.focus();
  };

  const selectBillingInterval = (interval: BillingInterval, focus = false) => {
    setBillingInterval(interval);
    window.localStorage.setItem("lingofusion-subscription-billing", interval);
    if (focus) billingRefs.current[interval]?.focus();
  };

  const handleSelectorKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Home" || event.key === "ArrowLeft") selectProVariant("350k", true);
    if (event.key === "End" || event.key === "ArrowRight") selectProVariant("750k", true);
  };

  const handleBillingKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Home" || event.key === "ArrowLeft") selectBillingInterval("monthly", true);
    if (event.key === "End" || event.key === "ArrowRight") selectBillingInterval("yearly", true);
  };

  const proFeatures = [...pro.usageFeatures, ...pro.benefits];
  const ultraFeatures = [...ultra.usageFeatures, ...ultra.benefits];

  const selectUltraVariant = (key: UltraVariantKey) => {
    setUltraVariantKey(key);
    window.localStorage.setItem("lingofusion-ultra-variant", key);
  };

  return (
    <div className="subscriptions-page relative isolate overflow-hidden bg-[#f8fbff] text-[#132038] dark:bg-[#090d16] dark:text-white">
      <div className="subscription-scroll-progress" aria-hidden="true"><span ref={scrollProgressRef} /></div>
      <section className="subscription-hero relative mx-auto max-w-7xl px-4 pb-12 pt-12 sm:px-8 sm:pb-16 sm:pt-20 lg:px-12">
        <div className="mx-auto max-w-4xl text-center">
          <p className="subscription-kicker mx-auto mb-5 w-fit rounded-full border border-[#b9d5fa] bg-[#eaf4ff] px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-[#245796] dark:border-[#6ba8f3]/25 dark:bg-[#5b9cf0]/10 dark:text-[#8ec1ff]">
            LingoFusion subscriptions
          </p>
          <h1 className="subscription-title text-4xl font-semibold leading-tight tracking-tight text-[#101d36] dark:text-white sm:text-6xl lg:text-7xl">
            Find the plan that fits your translation work
          </h1>
          <p className="subscription-subtitle mx-auto mt-6 max-w-3xl text-base leading-7 text-[#5b6b82] dark:text-slate-300 sm:text-xl sm:leading-8">
            Start with LingoFusion, then move up when your work needs more translation capacity and deeper review.
          </p>
          <div role="tablist" aria-label="Subscription billing interval" onKeyDown={handleBillingKeyDown} className="mx-auto mt-8 grid w-full max-w-xs grid-cols-2 rounded-xl border border-[#c4d4e8] bg-white/80 p-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.06]">
            {(Object.keys(billingIntervals) as BillingInterval[]).map((interval) => {
              const option = billingIntervals[interval];
              const selected = interval === billingInterval;
              return (
                <button
                  key={interval}
                  ref={(element) => { billingRefs.current[interval] = element; }}
                  type="button"
                  role="tab"
                  aria-label={option.label}
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => selectBillingInterval(interval)}
                  className={`pressable subscription-segment flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-[#3679cc] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#090d16] ${selected ? "subscription-segment-active bg-[#16284a] text-white shadow-sm dark:bg-white dark:text-[#14233d]" : "text-[#607089] hover:text-[#163766] dark:text-slate-400 dark:hover:text-white"}`}
                >
                  <span>{option.label}</span>
                  {interval === "yearly" && <span className="rounded-full bg-[#dff4e9] px-1.5 py-0.5 text-[10px] text-[#23704b] dark:bg-emerald-400/10 dark:text-emerald-300">Save 15%</span>}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section aria-labelledby="plans-heading" data-scroll-reveal className="relative mx-auto max-w-7xl px-4 pb-14 sm:px-8 sm:pb-16 lg:px-12">
        <div className="mb-8 flex flex-col gap-4 border-b border-[#d9e3f0] pb-7 dark:border-white/10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#3679cc] dark:text-[#8ec1ff]">Choose your plan</p>
            <h2 id="plans-heading" className="mt-2 text-3xl font-semibold tracking-tight text-[#101d36] dark:text-white sm:text-4xl">Subscription plans</h2>
            <p className="mt-2 text-sm leading-6 text-[#607089] dark:text-slate-300">Every plan includes translation, with more capacity and advanced features as you move up.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="#comparison" className="pressable inline-flex min-h-10 items-center justify-center rounded-lg bg-[#16284a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#203b6d] dark:bg-white dark:text-[#14233d]">Compare side by side</a>
            <button type="button" onClick={onApiPrices} className="pressable inline-flex min-h-10 items-center justify-center rounded-lg border border-[#c8d8ea] bg-white px-4 py-2 text-sm font-semibold text-[#234267] hover:border-[#7ba9df] hover:text-[#163766] dark:border-white/15 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-[#8ec1ff]/50 dark:hover:text-white">
              View API pricing
            </button>
          </div>
        </div>
        <div className="grid items-stretch gap-5 lg:grid-cols-3">
          <PlanCard
            className="subscription-card-free"
            planId={subscriptionPlans.free.id}
            name={subscriptionPlans.free.name}
            description={subscriptionPlans.free.description}
            price={priceForBillingInterval(subscriptionPlans.free.monthlyPrice, subscriptionPlans.free.yearlyPrice, billingInterval)}
            monthlyPrice={subscriptionPlans.free.monthlyPrice}
            billingInterval={billingInterval}
            modelAccess={subscriptionPlans.free.modelAccess}
            features={subscriptionPlans.free.features}
            usageFeatureCount={4}
            ctaLabel={subscriptionPlans.free.ctaLabel}
            valueKey={`${subscriptionPlans.free.id}-${billingInterval}`}
            onSelect={() => onSelectPlan(subscriptionPlans.free.id, billingInterval)}
          />

          <PlanCard
            className="subscription-card-pro"
            planId={pro.id}
            name={subscriptionPlans.pro.name}
            description={pro.description}
            price={priceForBillingInterval(pro.monthlyPrice, pro.yearlyPrice, billingInterval)}
            monthlyPrice={pro.monthlyPrice}
            billingInterval={billingInterval}
            modelAccess={pro.modelAccess}
            features={proFeatures}
            usageFeatureCount={5}
            ctaLabel={pro.ctaLabel}
            badge="Most Popular"
            recommended
            valueKey={`${pro.id}-${billingInterval}`}
            onSelect={() => onSelectPlan(pro.id, billingInterval)}
            selector={
              <div role="tablist" aria-label="Choose a Pro allowance" onKeyDown={handleSelectorKeyDown} className="grid grid-cols-2 rounded-lg border border-[#bfd3ec] bg-[#edf5ff] p-1 dark:border-white/10 dark:bg-white/[0.06]">
                {(Object.keys(subscriptionPlans.pro.variants) as ProVariantKey[]).map((key) => {
                  const variant = subscriptionPlans.pro.variants[key];
                  const selected = key === proVariantKey;
                  return (
                    <button
                      key={key}
                      ref={(element) => { selectorRefs.current[key] = element; }}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      tabIndex={selected ? 0 : -1}
                      onClick={() => selectProVariant(key)}
                      className={`pressable subscription-segment min-h-11 rounded-md px-3 py-2 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-[#3679cc] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#111a2a] ${selected ? "subscription-segment-active bg-white text-[#163766] shadow-sm dark:bg-[#eaf4ff] dark:text-[#12284a]" : "text-[#607089] hover:text-[#163766] dark:text-slate-400 dark:hover:text-white"}`}
                    >
                      {variant.selectorLabel}
                    </button>
                  );
                })}
              </div>
            }
          />

          <PlanCard
            className="subscription-card-ultra"
            planId="ultra-custom"
            name="LingoFusion Ultra"
            description="Modular custom subscription with configurable monthly quotas and GPT-6 Astra access."
            price={ultraCustomBreakdown.totalMonthlyPrice}
            monthlyPrice={ultraCustomBreakdown.totalMonthlyPrice}
            billingInterval="monthly"
            modelAccess="Full access to LingoFusion Ultra (GPT-6 Astra) with priority routing."
            features={[
              `Base Fee: $${ULTRA_BASE_FEE.toFixed(2)}/mo included`,
              `${ultraBuilderConfig.dubbingMins.toLocaleString()} min Video Dubbing included`,
              `${(ultraBuilderConfig.voiceCredits / 1_000_000).toFixed(2)}M Voice Credits included`,
              `${(ultraBuilderConfig.textChars / 1_000_000).toFixed(2)}M Text Translation characters`,
              `${ultraBuilderConfig.transcribeMins.toLocaleString()} min Audio Transcription`,
              `${ultraBuilderConfig.imageCount} AI Image Generations included`,
              "Over-quota fallback via Pay-As-You-Go wallet",
              "Priority queues & dedicated concurrency",
            ]}
            usageFeatureCount={6}
            ctaLabel={ultraCustomBreakdown.isEnterpriseInvoice ? "Request Enterprise Invoice" : "Configure & Subscribe"}
            premium
            badge="Custom Builder"
            valueKey={`ultra-custom-${billingInterval}`}
            onSelect={() => {
              const el = document.getElementById("ultra-custom-builder");
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "start" });
              } else {
                onSelectPlan("ultra-custom", "monthly", {
                  dubbing_mins: ultraBuilderConfig.dubbingMins,
                  voice_credits: ultraBuilderConfig.voiceCredits,
                  text_chars: ultraBuilderConfig.textChars,
                  transcribe_mins: ultraBuilderConfig.transcribeMins,
                  image_count: ultraBuilderConfig.imageCount,
                  monthly_price_usd: ultraCustomBreakdown.totalMonthlyPrice,
                });
              }
            }}
            selector={
              <button
                type="button"
                onClick={() => {
                  document.getElementById("ultra-custom-builder")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="pressable flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#bfd3ec] bg-[#edf5ff] p-2 text-xs font-bold text-[#163766] shadow-2xs hover:bg-white dark:border-white/10 dark:bg-white/[0.06] dark:text-blue-300 dark:hover:bg-white/10"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Customize Quotas Below ↓
              </button>
            }
          />
        </div>

        {/* Modular Ultra Custom Subscription Builder */}
        <div id="ultra-custom-builder" className="mt-12 scroll-mt-24">
          <UltraSubscriptionBuilder
            initialConfig={ultraBuilderConfig}
            onSubscribe={(cfg, breakdown) => {
              onSelectPlan("ultra-custom", "monthly", {
                dubbing_mins: cfg.dubbingMins,
                voice_credits: cfg.voiceCredits,
                text_chars: cfg.textChars,
                transcribe_mins: cfg.transcribeMins,
                image_count: cfg.imageCount,
                monthly_price_usd: breakdown.totalMonthlyPrice,
              });
            }}
            onRequestInvoice={(cfg, breakdown) => {
              onContactSales(
                1,
                "ultra-custom",
                "monthly",
                `Requesting Enterprise Invoice / ACH Wire for Custom Ultra Subscription ($${breakdown.totalMonthlyPrice.toFixed(2)}/mo): ${cfg.dubbingMins} mins dubbing, ${cfg.voiceCredits} voice credits, ${cfg.textChars} text chars, ${cfg.transcribeMins} mins transcription, ${cfg.imageCount} AI images.`
              );
            }}
          />
        </div>

        <OrganizationPlanStrip
          billingInterval={billingInterval}
          onBuildTeam={() => onBuildTeam(billingInterval)}
          onContactSales={() => onContactSales(enterpriseConfiguration.minimumSeats, selectedTeamSeat.planId, billingInterval)}
        />

        <ComparisonPanel billingInterval={billingInterval} pro={pro} ultra={ultra} proVariantKey={proVariantKey} ultraVariantKey={ultraVariantKey} onProVariantChange={onProVariantChange} onUltraVariantChange={selectUltraVariant} view={comparisonView} onViewChange={setComparisonView} />
      </section>

      <nav aria-label="Subscription details" data-scroll-reveal className="mx-auto mb-2 max-w-7xl px-4 sm:px-8 lg:px-12">
        <div className="flex flex-wrap items-center gap-2 border-y border-[#d9e3f0] py-4 dark:border-white/10">
          <span className="mr-2 text-xs font-bold uppercase tracking-[0.12em] text-[#687a92] dark:text-slate-400">Plan details</span>
          <a href="#comparison" className="rounded-full px-3 py-1.5 text-sm font-medium text-[#385779] hover:bg-[#eaf4ff] hover:text-[#1e5f9f] dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white">Compare</a>
          <a href="#character-usage" className="rounded-full px-3 py-1.5 text-sm font-medium text-[#385779] hover:bg-[#eaf4ff] hover:text-[#1e5f9f] dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white">Character usage</a>
          <a href="#translation-quality" className="rounded-full px-3 py-1.5 text-sm font-medium text-[#385779] hover:bg-[#eaf4ff] hover:text-[#1e5f9f] dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white">Translation quality</a>
          <a href="#advanced-tts" className="rounded-full px-3 py-1.5 text-sm font-medium text-[#385779] hover:bg-[#eaf4ff] hover:text-[#1e5f9f] dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white">Advanced TTS</a>
          <a href="#teams" className="rounded-full px-3 py-1.5 text-sm font-medium text-[#385779] hover:bg-[#eaf4ff] hover:text-[#1e5f9f] dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white">Teams</a>
        </div>
      </nav>

      <SectionBlock id="character-usage" eyebrow="Simple accounting" title="Character-based usage" description="Monthly allowances are measured in characters for the text you submit and the generated translation.">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <InfoTile icon={Languages} title="Count characters">Characters in text you submit count toward your input usage.</InfoTile>
          <InfoTile icon={Globe2} title="Output characters">Generated translation and reasoning characters count as output characters.</InfoTile>
          <InfoTile icon={BookOpenCheck} title="Each target counts">Input characters count for each target language, and generated output characters count too.</InfoTile>
          <InfoTile icon={WalletCards} title="Included usage first">Monthly usage is consumed before purchased additional usage.</InfoTile>
          <InfoTile icon={BookOpenCheck} title="Monthly reset">Included character allowances reset each billing cycle and do not roll over.</InfoTile>
          <InfoTile icon={ShieldCheck} title="Extras stay available">Purchased additional usage does not expire.</InfoTile>
        </div>
      </SectionBlock>

      <SectionBlock id="translation-quality" eyebrow="Translation quality" title="Choose the right level of reasoning" description="Automatic terminology research is available at every level and becomes more thorough as quality increases.">
        <div className="grid gap-5 lg:grid-cols-3">
          <QualityCard name="LingoFusion" accent="standard" allowance={`${formatNumber(subscriptionPlans.free.standardCharacters)} characters on Free`} items={[
            "Fast, accurate everyday translations",
            "Fast everyday translations",
            "Thinking disabled for speed",
            "Concise term lookup when meaning cannot be resolved confidently",
            "Best for messages, regular documents, and everyday content",
          ]} />
          <QualityCard name="LingoFusion Pro" accent="pro" allowance={`${formatNumber(pro.proCharacters)} characters on ${pro.label}`} valueKey={pro.id} selector={
            <div role="group" aria-label="Choose Pro allowance" className="mt-4 grid grid-cols-2 rounded-lg border border-[#bfd3ec] bg-[#edf5ff] p-1 dark:border-white/10 dark:bg-white/[0.06]">
              {(["350k", "750k"] as ProVariantKey[]).map((key) => {
                const selected = key === proVariantKey;
                return <button key={key} type="button" aria-pressed={selected} onClick={() => onProVariantChange(key)} className={`pressable min-h-10 rounded-md px-2 py-1.5 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-[#3679cc] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#111827] ${selected ? "bg-white text-[#163766] shadow-sm dark:bg-[#eaf4ff] dark:text-[#12284a]" : "text-[#607089] hover:text-[#163766] dark:text-slate-400 dark:hover:text-white"}`}>{subscriptionPlans.pro.variants[key].selectorLabel}</button>;
              })}
            </div>
          } items={[
            "More accurate and advanced translations",
            "High reasoning effort",
            "Stronger context, tone, ambiguity, and specialized terminology handling",
            "Automatic terminology research when required",
            "Better for professional and complex translations",
          ]} />
          <QualityCard name="LingoFusion Ultra" accent="ultra" allowance={`${formatNumber(ultra.ultraCharacters)} characters on ${ultra.label}`} valueKey={ultra.id} selector={
            <div role="group" aria-label="Choose an Ultra allowance" className="mt-4 grid grid-cols-2 rounded-lg border border-[#bfd3ec] bg-[#edf5ff] p-1 dark:border-white/10 dark:bg-white/[0.06]">
              {(["x1", "x2"] as UltraVariantKey[]).map((key) => {
                const selected = key === ultraVariantKey;
                return <button key={key} type="button" aria-pressed={selected} onClick={() => selectUltraVariant(key)} className={`pressable min-h-10 rounded-md px-2 py-1.5 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-[#3679cc] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#111827] ${selected ? "bg-white text-[#163766] shadow-sm dark:bg-[#eaf4ff] dark:text-[#12284a]" : "text-[#607089] hover:text-[#163766] dark:text-slate-400 dark:hover:text-white"}`}>{subscriptionPlans.ultra.variants[key].selectorLabel}</button>;
              })}
            </div>
          } items={[
            "Built for the hardest translations with the highest accuracy",
            "Maximum reasoning effort",
            "Full translation and terminology audit",
            "Current dictionary, specialist-source, and broader web research",
            "Can compare multiple sources when terminology is disputed",
            "Consistent terminology across the entire document",
          ]} />
        </div>
      </SectionBlock>

      <SectionBlock id="advanced-tts" eyebrow="Natural speech" title="Advanced TTS included" description="Use expressive speech within your plan, then continue with Standard TTS when the Advanced allowance is used.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AllowanceTile label="Free" value={subscriptionPlans.free.advancedTtsCharacters} />
          <AllowanceTile label={pro.selectorLabel} value={pro.advancedTtsCharacters} valueKey={pro.id} featured />
          <AllowanceTile label={ultra.selectorLabel} value={ultra.advancedTtsCharacters} valueKey={ultra.id} />
          <div className="rounded-xl border border-dashed border-[#aac2df] bg-[#f3f8ff] p-5 dark:border-white/15 dark:bg-white/[0.04]">
            <Volume2 className="h-5 w-5 text-[#3679cc] dark:text-[#78aff5]" />
            <p className="mt-4 text-sm font-semibold text-[#53647c] dark:text-slate-400">Additional Advanced TTS</p>
            <p className="mt-1 text-xl font-semibold text-[#14233d] dark:text-white">${advancedTtsAdditionalPrice.usd.toFixed(2)} <span className="text-sm font-medium text-[#6c7b90]">/ {formatNumber(advancedTtsAdditionalPrice.characters)} characters</span></p>
          </div>
        </div>
          <p className="mt-4 text-sm text-[#637289] dark:text-slate-400">Pro and Ultra voice character allowances are included each month. Standard system voice playback remains available on Free.</p>
      </SectionBlock>

      <SectionBlock eyebrow="Flexible capacity" title="Need more?" description="Keep working after reaching an included allowance without losing previously purchased capacity.">
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-[#d5dfed] bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#111827] sm:p-8">
            <ul className="grid gap-4 sm:grid-cols-2">
              {["Purchase additional usage after reaching an included allowance", "Pay for additional usage from a prepaid balance", "Use monthly included usage before paid additional usage", "Keep purchased extra usage without an expiry", "Upgrade your subscription when your needs grow"].map((item) => <FeatureLine key={item}>{item}</FeatureLine>)}
            </ul>
          </div>
          <div className="rounded-2xl bg-[#16284a] p-6 text-white shadow-[0_18px_60px_rgba(22,40,74,0.2)] dark:bg-[#18243a] sm:p-8">
            <Sparkles className="h-6 w-6 text-[#8fc4ff]" />
            <h3 className="mt-4 text-xl font-semibold">Ready for future usage packs</h3>
            <p className="mt-3 text-sm leading-6 text-slate-200">Extra character-pack pricing will come from one central configuration or a backend endpoint when purchasing is connected. No placeholder prices are being presented as real offers.</p>
          </div>
        </div>
      </SectionBlock>

      <SectionBlock id="teams" eyebrow="For organizations" title={isEnterpriseSeatCount ? "Talk to Enterprise Sales" : "Set up your LingoFusion Team"} description={isEnterpriseSeatCount ? `${formatNumber(teamMemberCount)} seats qualifies for Enterprise. Your selected quantity is saved below while you share your contact details.` : `Teams supports ${formatNumber(teamConfiguration.minimumSeats)} to ${formatNumber(teamConfiguration.maximumSelfServeSeats)} seats with self-serve billing and flexible seat types.`}>
        <div className="overflow-hidden rounded-2xl border border-[#d5dfed] bg-white shadow-sm dark:border-white/10 dark:bg-[#111827]">
          <div className="grid gap-5 p-6 sm:p-8 lg:grid-cols-[1fr_1.3fr]">
            <div>
              <Users className="h-7 w-7 text-[#3679cc] dark:text-[#78aff5]" />
              <h3 className="mt-4 text-2xl font-semibold text-[#14233d] dark:text-white">{isEnterpriseSeatCount ? "Enterprise starts here" : "One team, flexible seats"}</h3>
              <p className="mt-3 text-sm leading-6 text-[#607089] dark:text-slate-300">{isEnterpriseSeatCount ? enterpriseConfiguration.publicScaleMessage : "Combine Pro, Pro Max, Ultra, and Ultra Max seats. Translation allowances may be pooled depending on organization settings. The two-seat minimum applies to the whole team, not to any one seat type."}</p>
              <button type="button" onClick={() => isEnterpriseSeatCount ? openSalesForm() : onBuildTeam(billingInterval)} className="pressable click-feedback mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#16284a] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#203b6d] dark:bg-white dark:text-[#14233d]">
                {isEnterpriseSeatCount ? "Contact Sales" : "Continue to checkout"} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <div className="rounded-xl border border-[#dbe4f0] bg-[#f8fbff] p-5 dark:border-white/10 dark:bg-white/[0.04] sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#3679cc] dark:text-[#8ec1ff]">Team price calculator</p>
                  <h3 className="mt-1 text-xl font-semibold text-[#14233d] dark:text-white">Estimate your team</h3>
                </div>
                <div role="group" aria-label="Team billing interval" className="grid grid-cols-2 rounded-lg border border-[#c8d8ea] bg-white p-1 dark:border-white/10 dark:bg-white/[0.06]">
                  {(Object.keys(billingIntervals) as BillingInterval[]).map((interval) => {
                    const selected = interval === billingInterval;
                    return (
                      <button
                        key={interval}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => selectBillingInterval(interval)}
                        className={`pressable subscription-segment min-h-9 rounded-md px-3 py-1.5 text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-[#3679cc] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#111827] ${selected ? "subscription-segment-active bg-[#16284a] text-white shadow-sm dark:bg-white dark:text-[#14233d]" : "text-[#607089] hover:text-[#163766] dark:text-slate-400 dark:hover:text-white"}`}
                      >
                        {billingIntervals[interval].label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-[#31445f] dark:text-slate-200">
                  Seat type
                  <select value={teamSeatPlanId} onChange={(event) => setTeamSeatPlanId(event.target.value)} className="min-h-11 rounded-lg border border-[#c8d8ea] bg-white px-3 text-sm font-medium text-[#14233d] outline-none transition focus:border-[#3679cc] focus:ring-2 focus:ring-[#3679cc]/20 dark:border-white/15 dark:bg-[#0d1523] dark:text-white">
                    {teamConfiguration.seats.map((seat) => <option key={seat.planId} value={seat.planId}>{seat.name}</option>)}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold text-[#31445f] dark:text-slate-200">
                  Members
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumber(teamMemberCount)}
                    aria-describedby="team-member-hint"
                    onChange={(event) => updateTeamSeatCount(event.target.value)}
                    className="min-h-11 rounded-lg border border-[#c8d8ea] bg-white px-3 text-sm font-medium text-[#14233d] outline-none transition focus:border-[#3679cc] focus:ring-2 focus:ring-[#3679cc]/20 dark:border-white/15 dark:bg-[#0d1523] dark:text-white"
                  />
                </label>
              </div>
              <p id="team-member-hint" className="mt-2 text-xs text-[#6a7890] dark:text-slate-400">Self-serve checkout supports {formatNumber(teamConfiguration.minimumSeats)} to {formatNumber(teamConfiguration.maximumSelfServeSeats)} seats. {formatNumber(enterpriseConfiguration.minimumSeats)} or more switches to Enterprise.</p>

              <div aria-live="polite" className="mt-5 rounded-xl bg-[#16284a] p-5 text-white shadow-sm dark:bg-[#18243a]">
                {isEnterpriseSeatCount ? <>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#a6d1ff]">Enterprise pricing</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight">Custom contract</p>
                  <p className="mt-2 text-sm text-slate-200">{formatNumber(teamMemberCount)} seats will be quoted with custom usage limits and volume pricing.</p>
                </> : <>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#a6d1ff]">Estimated team total</p>
                  <p key={`${teamSeatPlanId}-${teamMemberCount}-${billingInterval}`} className="subscription-value-change mt-2 text-3xl font-semibold tracking-tight">{formatPrice(teamTotalPrice)}<span className="ml-1 text-base font-medium text-slate-300">{billing.suffix}</span></p>
                  <p className="mt-2 text-sm text-slate-200">{formatNumber(teamMemberCount)} seats x {formatPrice(teamSeatPrice)} per person{billing.suffix}</p>
                </>}
              </div>

              <p className="mt-4 text-xs leading-5 text-[#637289] dark:text-slate-400">{isEnterpriseSeatCount ? "Enterprise sales will tailor pricing, infrastructure, and support to your organization." : "This estimate uses one seat type for the full team. You can mix Pro, Pro Max, Ultra, and Ultra Max seats when configuring your organization."}</p>
            </div>
          </div>
          {salesFormOpen && <SalesContactForm seatCount={teamMemberCount} seatName={selectedTeamSeat.name} billingInterval={billingInterval} onClose={() => setSalesFormOpen(false)} onSubmit={() => { onContactSales(teamMemberCount, selectedTeamSeat.planId, billingInterval); setSalesFormOpen(false); }} />}
        </div>
      </SectionBlock>

      <SectionBlock eyebrow="Questions, answered" title="Subscription FAQ" description="The important details about allowances, upgrades, teams, and API billing.">
        <div className="mx-auto max-w-4xl divide-y divide-[#d8e1ed] overflow-hidden rounded-2xl border border-[#d5dfed] bg-white shadow-sm dark:divide-white/10 dark:border-white/10 dark:bg-[#111827]">
          {subscriptionFaqs.map(([question, answer]) => <FaqItem key={question} question={question} answer={answer} />)}
        </div>
      </SectionBlock>

      <footer data-scroll-reveal className="mx-auto max-w-7xl px-4 pb-12 pt-4 text-center text-sm text-[#6a7890] dark:text-slate-400 sm:px-8 lg:px-12">
        Consumer subscriptions and API usage are billed separately. <button type="button" onClick={onApiPrices} className="font-semibold text-[#245796] underline-offset-4 hover:underline dark:text-[#8ec1ff]">View API Prices</button>
      </footer>
    </div>
  );
}

type ComparisonView = "subscriptions" | "models";

type ComparisonRow = {
  label: string;
  values: string[];
};

function ComparisonPanel({ billingInterval, pro, ultra, proVariantKey, ultraVariantKey, onProVariantChange, onUltraVariantChange, view, onViewChange }: {
  billingInterval: BillingInterval;
  pro: ProVariant;
  ultra: UltraVariant;
  proVariantKey: ProVariantKey;
  ultraVariantKey: UltraVariantKey;
  onProVariantChange: (key: ProVariantKey) => void;
  onUltraVariantChange: (key: UltraVariantKey) => void;
  view: ComparisonView;
  onViewChange: (view: ComparisonView) => void;
}) {
  const billing = billingIntervals[billingInterval];
  const columns = ["Free", pro.selectorLabel, ultra.selectorLabel];
  const subscriptionRows: ComparisonRow[] = [
    {
      label: "Price",
      values: [
        `${formatPrice(priceForBillingInterval(subscriptionPlans.free.monthlyPrice, subscriptionPlans.free.yearlyPrice, billingInterval))}${billing.suffix}`,
        `${formatPrice(priceForBillingInterval(pro.monthlyPrice, pro.yearlyPrice, billingInterval))}${billing.suffix}`,
        `${formatPrice(priceForBillingInterval(ultra.monthlyPrice, ultra.yearlyPrice, billingInterval))}${billing.suffix}`,
      ],
    },
    { label: "Included model", values: ["LingoFusion", "LingoFusion Pro", "LingoFusion Ultra"] },
    { label: "Characters / month", values: [formatNumber(subscriptionPlans.free.standardCharacters), formatNumber(pro.proCharacters), formatNumber(ultra.ultraCharacters)] },
    { label: "Image translations / month", values: [formatNumber(subscriptionPlans.free.imageTranslations), formatNumber(pro.imageTranslations), formatNumber(ultra.imageTranslations)] },
    { label: "Live dictation / month", values: [`${formatNumber(subscriptionPlans.free.liveDictationMinutes)} min`, `${formatNumber(pro.liveDictationMinutes)} min`, `${formatNumber(ultra.liveDictationMinutes)} min`] },
    { label: "File transcription / month", values: ["-", `${formatNumber(pro.fileTranscriptionMinutes)} min`, `${formatNumber(ultra.fileTranscriptionMinutes)} min`] },
    { label: "Voice generation characters / month", values: ["-", formatNumber(pro.voiceCharacters), formatNumber(ultra.voiceCharacters)] },
    { label: "Live web lookups / month", values: ["On-demand", typeof pro.liveWebLookups === "number" ? formatNumber(pro.liveWebLookups) : pro.liveWebLookups, typeof ultra.liveWebLookups === "number" ? formatNumber(ultra.liveWebLookups) : ultra.liveWebLookups] },
    { label: "Studio dubbing rate", values: ["$3.50/min", "$3.50/min", "$3.50/min"] },
  ];
  const modelRows: ComparisonRow[] = [
    { label: "Best for", values: ["Fast, accurate everyday translations", "More accurate and advanced translations", "Hardest translations and highest accuracy"] },
    { label: "Included with", values: ["Free", pro.label, ultra.label] },
    { label: "Reasoning", values: ["None", "High reasoning effort", "Maximum reasoning effort"] },
    { label: "Terminology research", values: ["Concise lookup when needed", "Automatic research when required", "Specialist-source and broader web research"] },
    { label: "Translation review", values: ["-", "Stronger context and tone handling", "Full terminology and consistency audit"] },
  ];

  return (
    <section id="comparison" className="mt-8 scroll-mt-24 rounded-xl border border-[#d5dfed] bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#111827] sm:mt-10 sm:p-7" aria-labelledby="comparison-heading">
      <div className="flex flex-col gap-5 border-b border-[#e1e8f1] pb-5 dark:border-white/10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#3679cc] dark:text-[#8ec1ff]">Compare</p>
          <h2 id="comparison-heading" className="mt-2 text-2xl font-semibold tracking-tight text-[#14233d] dark:text-white sm:text-3xl">See plans and models side by side</h2>
          <p className="mt-2 text-sm leading-6 text-[#607089] dark:text-slate-300">Your current {billing.label.toLowerCase()} billing selection and Pro allowance are shown below.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div role="group" aria-label="Choose Pro allowance" className="grid grid-cols-2 rounded-lg border border-[#c8d8ea] bg-[#f6f9fd] p-1 dark:border-white/10 dark:bg-white/[0.05]">
            {(["350k", "750k"] as ProVariantKey[]).map((variant) => {
              const selected = variant === proVariantKey;
              return <button key={variant} type="button" aria-pressed={selected} onClick={() => onProVariantChange(variant)} className={`pressable subscription-segment min-h-10 rounded-md px-4 py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#3679cc] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#111827] ${selected ? "subscription-segment-active bg-[#16284a] text-white shadow-sm dark:bg-white dark:text-[#14233d]" : "text-[#607089] hover:text-[#163766] dark:text-slate-400 dark:hover:text-white"}`}>{subscriptionPlans.pro.variants[variant].selectorLabel}</button>;
            })}
          </div>
          <div role="group" aria-label="Choose an Ultra allowance" className="grid grid-cols-2 rounded-lg border border-[#c8d8ea] bg-[#f6f9fd] p-1 dark:border-white/10 dark:bg-white/[0.05]">
            {(["x1", "x2"] as UltraVariantKey[]).map((variant) => {
              const selected = variant === ultraVariantKey;
              return <button key={variant} type="button" aria-pressed={selected} onClick={() => onUltraVariantChange(variant)} className={`pressable subscription-segment min-h-10 rounded-md px-4 py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#3679cc] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#111827] ${selected ? "subscription-segment-active bg-[#16284a] text-white shadow-sm dark:bg-white dark:text-[#14233d]" : "text-[#607089] hover:text-[#163766] dark:text-slate-400 dark:hover:text-white"}`}>{subscriptionPlans.ultra.variants[variant].selectorLabel}</button>;
            })}
          </div>
          <div role="group" aria-label="Comparison type" className="grid grid-cols-2 rounded-lg border border-[#c8d8ea] bg-[#f6f9fd] p-1 dark:border-white/10 dark:bg-white/[0.05]">
            {(["subscriptions", "models"] as ComparisonView[]).map((option) => {
              const selected = option === view;
              const label = option === "subscriptions" ? "Subscriptions" : "Models";
              return <button key={option} type="button" aria-pressed={selected} onClick={() => onViewChange(option)} className={`pressable subscription-segment min-h-10 rounded-md px-4 py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#3679cc] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#111827] ${selected ? "subscription-segment-active bg-[#16284a] text-white shadow-sm dark:bg-white dark:text-[#14233d]" : "text-[#607089] hover:text-[#163766] dark:text-slate-400 dark:hover:text-white"}`}>{label}</button>;
            })}
          </div>
        </div>
      </div>
      <ComparisonTable columns={columns} rows={view === "subscriptions" ? subscriptionRows : modelRows} valueKey={`${view}-${billingInterval}-${pro.id}-${ultra.id}`} />
    </section>
  );
}

function ComparisonTable({ columns, rows, valueKey }: { columns: string[]; rows: ComparisonRow[]; valueKey: string }) {
  return (
    <div className="mt-5 overflow-x-auto">
      <table key={valueKey} className="subscription-value-change min-w-[720px] w-full border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr>
            <th scope="col" className="w-[28%] border-b border-[#dce5f0] px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[#6a7b91] dark:border-white/10 dark:text-slate-400">Compare</th>
            {columns.map((column, index) => <th key={column} scope="col" className={`border-b border-[#dce5f0] px-4 py-3 text-base font-semibold ${index === 1 ? "bg-[#edf6ff] text-[#1f5da4] dark:bg-[#78aff5]/10 dark:text-[#8ec1ff]" : "text-[#21324d] dark:border-white/10 dark:text-white"}`}>{column}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => <tr key={row.label} className="align-top">
            <th scope="row" className="border-b border-[#e5ebf3] px-4 py-3.5 font-semibold text-[#4f6078] dark:border-white/10 dark:text-slate-300">{row.label}</th>
            {row.values.map((value, index) => <td key={`${row.label}-${columns[index]}`} className={`border-b border-[#e5ebf3] px-4 py-3.5 leading-5 text-[#607089] dark:border-white/10 dark:text-slate-300 ${index === 1 ? "bg-[#f8fbff] font-medium text-[#294b71] dark:bg-[#78aff5]/[0.04] dark:text-slate-200" : ""}`}>{value}</td>)}
          </tr>)}
        </tbody>
      </table>
    </div>
  );
}

function PlanCard({ planId, name, description, price, monthlyPrice, billingInterval, modelAccess, features, usageFeatureCount, ctaLabel, badge, selector, recommended, premium, className, valueKey, onSelect }: {
  planId: string;
  name: string;
  description: string;
  price: number;
  monthlyPrice: number;
  billingInterval: BillingInterval;
  modelAccess: string;
  features: readonly string[];
  usageFeatureCount: number;
  ctaLabel: string;
  badge?: string;
  selector?: React.ReactNode;
  recommended?: boolean;
  premium?: boolean;
  className: string;
  valueKey?: string;
  onSelect: () => void;
}) {
  return (
    <article data-plan-card className={`subscription-plan-card ${className} relative flex h-full flex-col overflow-hidden rounded-xl border bg-white p-5 shadow-sm sm:p-6 ${recommended ? "border-[#3679cc] shadow-[0_16px_40px_rgba(36,105,184,0.12)] dark:border-[#78aff5]/70 dark:bg-[#101a2b]" : premium ? "border-[#c4d3e6] bg-[#fbfcff] dark:border-white/15 dark:bg-[#121a29]" : "border-[#d5dfed] dark:border-white/10 dark:bg-[#111827]"}`}>
      {recommended && <div className="subscription-card-glow" aria-hidden="true" />}
      <div className="relative border-b border-[#e1e8f1] pb-6 dark:border-white/10">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-2xl font-semibold text-[#14233d] dark:text-white">{name}</h3>
          {badge && <span className="rounded-full bg-[#16284a] px-2.5 py-1 text-xs font-bold text-white dark:bg-[#eaf4ff] dark:text-[#14233d]">{badge}</span>}
        </div>
        {selector && <div className="mt-4">{selector}</div>}
        <p className="mt-4 text-sm leading-6 text-[#65748a] dark:text-slate-300">{description}</p>
        <div key={valueKey ?? name} className="subscription-value-change mt-5 flex items-end gap-1">
          <span className="text-4xl font-semibold tracking-tight text-[#101d36] dark:text-white">{formatPrice(billingInterval === "yearly" && monthlyPrice > 0 ? price / 12 : price)}</span>
          <span className="pb-1 text-sm font-medium text-[#6b7890] dark:text-slate-400">/month</span>
        </div>
        <div className="mt-1 flex min-h-5 flex-wrap items-center gap-2 text-xs text-[#718096] dark:text-slate-500">
          {billingInterval === "yearly" && monthlyPrice > 0 ? <>
            <span>Billed annually at {formatPrice(price)}/yr</span>
            <span className="rounded-full bg-[#dff4e9] px-2 py-0.5 font-semibold text-[#23704b] dark:bg-emerald-400/10 dark:text-emerald-300">Save {yearlyDiscountPercent(monthlyPrice, price)}%</span>
          </> : "\u00a0"}
        </div>
      </div>
      <div key={`features-${valueKey ?? name}`} className="subscription-value-change flex flex-1 flex-col text-sm leading-5 text-[#43546e] dark:text-slate-300">
        <div className="pt-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#62738c] dark:text-slate-400">Included model</p>
          <ul className="mt-2"><FeatureLine emphasized>{modelAccess}</FeatureLine></ul>
        </div>
        <div className="mt-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#62738c] dark:text-slate-400">Monthly allowance</p>
          <ul className="mt-2 space-y-3">{features.slice(0, usageFeatureCount).map((feature) => <FeatureLine key={feature}>{feature}</FeatureLine>)}</ul>
        </div>
        {features.length > usageFeatureCount && <div className="mt-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#62738c] dark:text-slate-400">Plan benefits</p>
          <ul className="mt-2 space-y-3">{features.slice(usageFeatureCount).map((feature) => <FeatureLine key={feature}>{feature}</FeatureLine>)}</ul>
        </div>}
      </div>
      <button type="button" data-plan-id={planId} data-billing-interval={billingInterval} onClick={onSelect} className={`pressable click-feedback mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold ${recommended ? "bg-[#2469b8] text-white hover:bg-[#1f5da4]" : premium ? "bg-[#263d66] text-white hover:bg-[#314c7e]" : "bg-[#16284a] text-white hover:bg-[#203b6d] dark:bg-white dark:text-[#14233d]"}`}>
        {ctaLabel}
      </button>
    </article>
  );
}

function OrganizationPlanStrip({ billingInterval, onBuildTeam, onContactSales }: { billingInterval: BillingInterval; onBuildTeam: () => void; onContactSales: () => void }) {
  const billing = billingIntervals[billingInterval];
  const pro350k = subscriptionPlans.pro.variants["350k"];
  const seatPrice = priceForBillingInterval(pro350k.monthlyPrice, pro350k.yearlyPrice, billingInterval);

  return (
    <section className="subscription-plan-card mt-5 overflow-hidden rounded-xl border border-[#bfd3ec] bg-[#f8fbff] shadow-sm dark:border-[#78aff5]/30 dark:bg-[#101a2b]" aria-label="Organization plans">
      <div className="grid divide-y divide-[#d9e5f2] dark:divide-white/10 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        <article className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-2xl font-semibold text-[#14233d] dark:text-white">Teams</h3>
            <span className="rounded-full bg-[#e7f2ff] px-2.5 py-1 text-xs font-bold text-[#245796] dark:bg-[#78aff5]/15 dark:text-[#9bcaff]">{formatNumber(teamConfiguration.minimumSeats)} to {formatNumber(teamConfiguration.maximumSelfServeSeats)} seats</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#65748a] dark:text-slate-300">Self-serve setup, automatic billing, annual discounts, and centralized team management.</p>
          <div className="mt-4 flex flex-wrap items-end gap-x-1 gap-y-2">
            <span className="text-sm font-medium text-[#6b7890] dark:text-slate-400">Starting at</span>
            <span className="text-2xl font-semibold tracking-tight text-[#101d36] dark:text-white">{formatPrice(seatPrice)}</span>
            <span className="text-sm font-medium text-[#6b7890] dark:text-slate-400">per seat{billing.suffix}</span>
          </div>
          <button type="button" onClick={onBuildTeam} className="pressable click-feedback mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#16284a] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#203b6d] dark:bg-white dark:text-[#14233d]">
            Calculate Teams <ArrowRight className="h-4 w-4" />
          </button>
        </article>
        <article className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-2xl font-semibold text-[#14233d] dark:text-white">Enterprise</h3>
            <span className="rounded-full bg-[#16284a] px-2.5 py-1 text-xs font-bold text-white dark:bg-white dark:text-[#14233d]">{formatNumber(enterpriseConfiguration.minimumSeats)}+ seats</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#65748a] dark:text-slate-300">Custom contracts, pricing, security, support, and infrastructure. {enterpriseConfiguration.publicScaleMessage}</p>
          <ul className="mt-4 grid gap-2 text-sm leading-5 text-[#43546e] dark:text-slate-300 sm:grid-cols-2">
            {enterpriseConfiguration.features.map((feature) => <FeatureLine key={feature}>{feature}</FeatureLine>)}
          </ul>
          <button type="button" onClick={onContactSales} className="pressable click-feedback mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#7ba9df] bg-white px-5 py-2.5 text-sm font-semibold text-[#1e5f9f] hover:border-[#3679cc] hover:bg-[#edf6ff] dark:border-[#78aff5]/50 dark:bg-white/[0.04] dark:text-[#9bcaff] dark:hover:bg-[#78aff5]/10">
            Contact Sales <ArrowRight className="h-4 w-4" />
          </button>
        </article>
      </div>
    </section>
  );
}

function SalesContactForm({ seatCount, seatName, billingInterval, onClose, onSubmit }: {
  seatCount: number;
  seatName: string;
  billingInterval: BillingInterval;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await submitSalesRequest({
        email: String(form.get("email") || ""),
        organization: String(form.get("organization") || ""),
        message: `Interested in Enterprise for ${formatNumber(seatCount)} seats.`,
        seats: seatCount,
        planId: seatName,
        billingInterval,
      });
      onSubmit();
    } catch {
      setError("We could not send the acknowledgement email. Please try again shortly.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-[#dbe4f0] bg-[#f8fbff] p-6 dark:border-white/10 dark:bg-white/[0.03] sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#3679cc] dark:text-[#8ec1ff]">Enterprise sales</p>
          <h3 className="mt-1 text-2xl font-semibold text-[#14233d] dark:text-white">Tell us about your organization</h3>
          <p className="mt-2 text-sm leading-6 text-[#607089] dark:text-slate-300">Your requested configuration is included with this request.</p>
        </div>
        <button type="button" onClick={onClose} className="pressable rounded-lg px-3 py-2 text-sm font-semibold text-[#52637a] hover:bg-white hover:text-[#14233d] dark:text-slate-300 dark:hover:bg-white/[0.08] dark:hover:text-white">Close</button>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-2 text-sm font-semibold text-[#31445f] dark:text-slate-200">Work email<input required type="email" name="email" autoComplete="email" placeholder="you@company.com" className="min-h-11 rounded-lg border border-[#c8d8ea] bg-white px-3 text-sm font-normal text-[#14233d] outline-none transition focus:border-[#3679cc] focus:ring-2 focus:ring-[#3679cc]/20 dark:border-white/15 dark:bg-[#0d1523] dark:text-white" /></label>
        <label className="grid gap-2 text-sm font-semibold text-[#31445f] dark:text-slate-200">Organization<input required type="text" name="organization" autoComplete="organization" placeholder="Company name" className="min-h-11 rounded-lg border border-[#c8d8ea] bg-white px-3 text-sm font-normal text-[#14233d] outline-none transition focus:border-[#3679cc] focus:ring-2 focus:ring-[#3679cc]/20 dark:border-white/15 dark:bg-[#0d1523] dark:text-white" /></label>
        <label className="grid gap-2 text-sm font-semibold text-[#31445f] dark:text-slate-200">Requested seats<input readOnly value={formatNumber(seatCount)} className="min-h-11 rounded-lg border border-[#c8d8ea] bg-[#edf5ff] px-3 text-sm font-normal text-[#14233d] dark:border-white/15 dark:bg-white/[0.08] dark:text-white" /></label>
        <label className="grid gap-2 text-sm font-semibold text-[#31445f] dark:text-slate-200">Configuration<input readOnly value={`${seatName} · ${billingIntervals[billingInterval].label}`} className="min-h-11 rounded-lg border border-[#c8d8ea] bg-[#edf5ff] px-3 text-sm font-normal text-[#14233d] dark:border-white/15 dark:bg-white/[0.08] dark:text-white" /></label>
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-[#637289] dark:text-slate-400">Enterprise requests are quoted individually with your selected {formatNumber(seatCount)} seats preserved.</p>
        <button type="submit" disabled={submitting} className="pressable click-feedback inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#16284a] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#203b6d] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-[#14233d]">{submitting ? "Sending..." : "Send sales request"} <ArrowRight className="h-4 w-4" /></button>
      </div>
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
    </form>
  );
}

function FeatureLine({ children, emphasized = false }: { children: React.ReactNode; emphasized?: boolean }) {
  if (emphasized) {
    return <li className="subscription-model-feature flex items-start gap-3 rounded-xl border border-[#cfe0f4] bg-[#f5f9ff] p-3 text-[#324969] dark:border-[#8ec1ff]/20 dark:bg-[#8ec1ff]/[0.07] dark:text-slate-200"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#dceeff] text-[#2469b8] dark:bg-[#8ec1ff]/15 dark:text-[#8ec1ff]"><Check className="h-3.5 w-3.5" /></span><span>{children}</span></li>;
  }

  return <li className="flex items-start gap-2.5"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#eaf4ff] text-[#2f72c1] dark:bg-[#78aff5]/10 dark:text-[#8ec1ff]"><Check className="h-3.5 w-3.5" /></span><span>{children}</span></li>;
}

function SectionBlock({ id, eyebrow, title, description, children }: { id?: string; eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <section id={id} data-scroll-reveal className="subscription-section relative mx-auto max-w-7xl scroll-mt-24 px-4 py-16 sm:px-8 sm:py-20 lg:px-12"><div className="mb-9 max-w-3xl"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#3679cc] dark:text-[#8ec1ff]">{eyebrow}</p><h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#101d36] dark:text-white sm:text-4xl">{title}</h2><p className="mt-4 text-base leading-7 text-[#607089] dark:text-slate-300">{description}</p></div>{children}</section>;
}

function InfoTile({ icon: Icon, title, children }: { icon: typeof Languages; title: string; children: React.ReactNode }) {
  return <div className="subscription-info-tile rounded-xl border border-[#d8e2ef] bg-white p-5 dark:border-white/10 dark:bg-[#111827]"><Icon className="h-5 w-5 text-[#3679cc] dark:text-[#78aff5]" /><h3 className="mt-4 font-semibold text-[#1c2c47] dark:text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-[#637289] dark:text-slate-400">{children}</p></div>;
}

function QualityCard({ name, items, allowance, accent, valueKey, selector }: { name: string; items: string[]; allowance: string; accent: string; valueKey?: string; selector?: React.ReactNode }) {
  return <article className={`quality-card quality-card-${accent} rounded-2xl border border-[#d5dfed] bg-white p-6 dark:border-white/10 dark:bg-[#111827]`}><SearchCheck className="h-6 w-6 text-[#3679cc] dark:text-[#78aff5]" /><h3 className="mt-4 text-xl font-semibold text-[#162641] dark:text-white">{name}</h3>{selector}<p key={valueKey ?? allowance} className="subscription-value-change mt-3 text-sm font-semibold text-[#3679cc] dark:text-[#8ec1ff]">{allowance}</p><ul className="mt-5 space-y-3 text-sm leading-6 text-[#53637a] dark:text-slate-300">{items.map((item) => <FeatureLine key={item}>{item}</FeatureLine>)}</ul></article>;
}

function AllowanceTile({ label, value, valueKey, featured }: { label: string; value: number; valueKey?: string; featured?: boolean }) {
  return <div className={`rounded-xl border p-5 ${featured ? "border-[#83b2ec] bg-[#edf6ff] dark:border-[#78aff5]/40 dark:bg-[#78aff5]/10" : "border-[#d5dfed] bg-white dark:border-white/10 dark:bg-[#111827]"}`}><p className="text-sm font-semibold text-[#53647c] dark:text-slate-400">{label}</p><p key={valueKey ?? label} className="subscription-value-change mt-3 text-2xl font-semibold text-[#14233d] dark:text-white">{formatNumber(value)}</p><p className="mt-1 text-xs text-[#718096] dark:text-slate-500">characters per month</p></div>;
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return <details className="subscription-faq group"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 text-left font-semibold text-[#21324d] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3679cc] dark:text-white sm:px-6"><span>{question}</span><ChevronDown className="h-5 w-5 shrink-0 text-[#6b7890] transition-transform duration-200 group-open:rotate-180" /></summary><div className="subscription-faq-answer px-5 pb-5 text-sm leading-6 text-[#617087] dark:text-slate-300 sm:px-6"><p>{answer}</p></div></details>;
}
