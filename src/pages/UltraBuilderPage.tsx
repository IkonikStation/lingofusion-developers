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
    <section className="mx-auto max-w-6xl py-2 sm:py-6">
      {/* Builder Component */}
      <UltraSubscriptionBuilder
        initialBilling={initialBilling}
        initialConfig={initialConfig}
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
