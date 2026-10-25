import { ArrowLeft, Sparkles } from "lucide-react";
import { UltraSubscriptionBuilder } from "../components/UltraSubscriptionBuilder";
import type { BillingInterval } from "../data/subscriptions";
import type { UltraResourceConfig } from "../data/ultraConfig";
import { pageQuery } from "../lib/utils";

interface UltraBuilderPageProps {
  onNavigate: (page: string, query?: Record<string, string | number | undefined>) => void;
}

export function UltraBuilderPage({ onNavigate }: UltraBuilderPageProps) {
  const query = pageQuery();
  const initialBilling: BillingInterval = query.get("billing") === "yearly" ? "yearly" : "monthly";

  const initialConfig: Partial<UltraResourceConfig> = {};
  const dubM = query.get("dubbing_mins");
  if (dubM && !isNaN(Number(dubM))) initialConfig.dubbingMins = Number(dubM);
  const voiceC = query.get("voice_credits");
  if (voiceC && !isNaN(Number(voiceC))) initialConfig.voiceCredits = Number(voiceC);
  const textC = query.get("text_chars");
  if (textC && !isNaN(Number(textC))) initialConfig.textChars = Number(textC);
  const transM = query.get("transcribe_mins");
  if (transM && !isNaN(Number(transM))) initialConfig.transcribeMins = Number(transM);
  const imgC = query.get("image_count");
  if (imgC && !isNaN(Number(imgC))) initialConfig.imageCount = Number(imgC);

  return (
    <section className="mx-auto max-w-6xl py-4 sm:py-8">
      {/* Top Breadcrumb / Back button */}
      <button
        type="button"
        onClick={() => onNavigate("Subscription Prices")}
        className="pressable inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 transition hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Subscriptions
      </button>

      {/* Page Header */}
      <div className="mt-4 mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-blue-50/80 px-3 py-1 text-xs font-bold text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
          <Sparkles className="h-3.5 w-3.5" /> Ultra Plan Configuration
        </div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-neutral-950 dark:text-white sm:text-4xl">
          Customize your Ultra subscription.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          Scale your monthly quotas for dubbing, speech, translation, transcription, and image synthesis with real-time pricing and automatic fallback.
        </p>
      </div>

      {/* Builder Component */}
      <UltraSubscriptionBuilder
        initialBilling={initialBilling}
        initialConfig={initialConfig}
        isStandalone={true}
        onSubscribe={(cfg, breakdown, billing) => {
          onNavigate("Checkout", {
            plan: "ultra-custom",
            billing,
            dubbing_mins: cfg.dubbingMins,
            voice_credits: cfg.voiceCredits,
            text_chars: cfg.textChars,
            transcribe_mins: cfg.transcribeMins,
            image_count: cfg.imageCount,
            monthly_price_usd: breakdown.totalMonthlyPrice,
            yearly_price_usd: breakdown.totalYearlyPrice,
          });
        }}
        onRequestInvoice={(cfg, breakdown, billing) => {
          onNavigate("Contact Sales", {
            plan: "ultra-custom",
            billing,
            message: `Requesting Enterprise Invoice / ACH Wire for Ultra Custom Subscription (${
              billing === "yearly"
                ? `$${breakdown.totalYearlyPrice.toFixed(2)}/yr ($${breakdown.effectiveMonthlyPriceYearly.toFixed(2)}/mo)`
                : `$${breakdown.totalMonthlyPrice.toFixed(2)}/mo`
            }): ${cfg.dubbingMins} mins dubbing, ${cfg.voiceCredits.toLocaleString()} voice credits, ${cfg.textChars.toLocaleString()} text chars, ${cfg.transcribeMins} mins transcribe, ${cfg.imageCount} images.`,
          });
        }}
      />
    </section>
  );
}
