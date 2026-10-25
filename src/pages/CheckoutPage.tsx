import { ArrowLeft, Building2, CheckCircle2, CreditCard, HelpCircle, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { useState } from "react";
import { browserApi, calculateGrossDeposit, getApiBaseUrl, shouldUseBrowserApi } from "../data/browserApi";
import { formatUsd, humanizePlanId, pageQuery, withBasePath } from "../lib/utils";
import { calculateUltraPrice, ULTRA_BASE_FEE, ULTRA_ENTERPRISE_THRESHOLD } from "../data/ultraConfig";
import { FeeBreakdownModal } from "../components/FeeBreakdownModal";

export function CheckoutPage({
  onNavigate,
  onBalanceChange,
}: {
  onNavigate: (page: string) => void;
  onBalanceChange?: (newBalance: number) => void;
}) {
  const query = pageQuery();
  const stripeSessionId = query.get("stripe_session_id");
  const netUsdParam = query.get("net_usd");
  const grossCentsParam = query.get("gross_cents");
  const userIdParam = query.get("user_id") || "00000000-0000-4000-8000-000000000001";
  const currencyParam = "USD";

  const planId = query.get("plan") ?? "pro-350k";
  const billing = query.get("billing") === "yearly" ? "yearly" : "monthly";
  const seats = Math.max(1, Number(query.get("seats")) || 1);

  const isUltraCustom = planId === "ultra-custom";
  const customDubbing = Number(query.get("dubbing_mins") || 30);
  const customVoice = Number(query.get("voice_credits") || 1200000);
  const customText = Number(query.get("text_chars") || 5000000);
  const customTranscribe = Number(query.get("transcribe_mins") || 120);
  const customImages = Number(query.get("image_count") || 50);
  const ultraBreakdown = calculateUltraPrice({
    dubbingMins: customDubbing,
    voiceCredits: customVoice,
    textChars: customText,
    transcribeMins: customTranscribe,
    imageCount: customImages,
  });
  const ultraMonthlyPrice = Number(query.get("monthly_price_usd")) || ultraBreakdown.totalMonthlyPrice;

  // Plan pricing resolution for standard tiers
  const getStandardPlanPricing = (id: string) => {
    if (id === "pro-max-750k" || id === "pro-max") {
      return { monthly: 39.99, yearly: 408.0, name: "LingoFusion Pro Max" };
    }
    if (id === "pro-350k" || id === "pro") {
      return { monthly: 19.99, yearly: 204.0, name: "LingoFusion Pro" };
    }
    return { monthly: 19.99, yearly: 204.0, name: humanizePlanId(id) };
  };

  const stdPricing = getStandardPlanPricing(planId);
  const planMonthlyPrice = isUltraCustom ? ultraMonthlyPrice : stdPricing.monthly;
  const planYearlyPrice = isUltraCustom ? ultraBreakdown.totalYearlyPrice : stdPricing.yearly;
  const planBilledPrice = billing === "yearly" ? planYearlyPrice : planMonthlyPrice;
  const planDisplayName = isUltraCustom ? "Ultra (Custom Modular Tier)" : stdPricing.name;

  const [busy, setBusy] = useState(false);
  const [settled, setSettled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFeeModal, setShowFeeModal] = useState(false);

  const handleSubscribe = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = isUltraCustom
        ? {
            plan: "ultra-custom",
            billing,
            dubbing_mins: customDubbing,
            voice_credits: customVoice,
            text_chars: customText,
            transcribe_mins: customTranscribe,
            image_count: customImages,
            monthly_price_usd: ultraMonthlyPrice,
            yearly_price_usd: ultraBreakdown.totalYearlyPrice,
            userId: userIdParam,
          }
        : {
            plan: planId,
            billing,
            monthly_price_usd: planMonthlyPrice,
            yearly_price_usd: planYearlyPrice,
            userId: userIdParam,
          };

      let checkoutSessionUrl = "";
      if (shouldUseBrowserApi()) {
        const res = (await browserApi("/api/billing/subscription-checkout", {
          method: "POST",
          body: JSON.stringify(payload),
        })) as { checkoutUrl?: string; url?: string };
        checkoutSessionUrl = res.checkoutUrl || res.url || "";
      } else {
        const res = await fetch(`${getApiBaseUrl()}/api/billing/subscription-checkout`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to activate subscription");
        checkoutSessionUrl = data.checkoutUrl || data.url || "";
      }

      if (checkoutSessionUrl && !checkoutSessionUrl.includes("/checkout?")) {
        window.location.href = checkoutSessionUrl;
        return;
      }

      setSettled(true);
      window.location.href = withBasePath("/playground?subscription=active");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to activate subscription");
    } finally {
      setBusy(false);
    }
  };

  if (stripeSessionId && netUsdParam) {
    const netUsd = Number(netUsdParam) || 5;
    const calc = calculateGrossDeposit(netUsd);
    const grossCents = Number(grossCentsParam) || calc.grossAmountCents;
    const grossUsd = Number((grossCents / 100).toFixed(2));
    const feeUsd = Number((grossUsd - netUsd).toFixed(2));

    const completeStripeCheckout = async () => {
      setBusy(true);
      setError(null);
      try {
        const webhookPayload = {
          id: `evt_${Date.now()}`,
          type: "checkout.session.completed",
          data: {
            object: {
              id: stripeSessionId,
              amount_total: grossCents,
              payment_status: "paid",
              metadata: {
                userId: userIdParam,
                topUpAmount: netUsd.toString(),
                netDepositUsd: netUsd.toString(),
              },
            },
          },
        };

        let result: { balance_usd?: number };
        if (shouldUseBrowserApi()) {
          result = await browserApi("/api/stripe-webhook", {
            method: "POST",
            body: JSON.stringify(webhookPayload),
          });
        } else {
          const res = await fetch(`${getApiBaseUrl()}/api/stripe-webhook`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(webhookPayload),
          });
          result = await res.json();
          if (!res.ok) throw new Error("Failed to settle Stripe webhook");
        }

        if (typeof result.balance_usd === "number") {
          onBalanceChange?.(result.balance_usd);
        }
        setSettled(true);
        window.location.href = withBasePath(`/playground?payment=success&session_id=${encodeURIComponent(stripeSessionId)}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Payment failed");
      } finally {
        setBusy(false);
      }
    };

    const cancelStripeCheckout = () => {
      window.location.href = withBasePath("/playground?payment=cancelled");
    };

    return (
      <section className="mx-auto max-w-4xl py-8 sm:py-14">
        <button
          type="button"
          onClick={cancelStripeCheckout}
          className="pressable inline-flex items-center gap-2 text-xs font-medium text-neutral-500 transition hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Playground
        </button>

        <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-xl dark:border-white/10 dark:bg-neutral-900">
          <div className="grid divide-y divide-neutral-200/80 dark:divide-white/10 md:grid-cols-[1.2fr_1fr] md:divide-x md:divide-y-0">
            {/* Left Column: Product Details */}
            <div className="flex flex-col justify-between p-6 sm:p-8">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <CreditCard className="h-3.5 w-3.5" />
                  Prepaid API & Playground Credits
                </div>

                <h1 className="mt-4 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">
                  Add ${formatUsd(netUsd)} {currencyParam} to your balance
                </h1>
                <p className="mt-2.5 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
                  Credits are available immediately after payment and can be used across LingoFusion Text, Image, and Voice models.
                </p>

                <ul className="mt-6 space-y-2.5 text-xs text-neutral-600 dark:text-neutral-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>Full ${formatUsd(netUsd)} {currencyParam} net credit deposited</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>No expiration on prepaid credits</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>Instant balance activation</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 flex items-center gap-2 border-t border-neutral-200/80 pt-4 text-[11px] text-neutral-400 dark:border-white/10 dark:text-neutral-500">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>256-bit SSL encrypted checkout powered by Stripe</span>
              </div>
            </div>

            {/* Right Column: Payment Receipt & Action */}
            <div className="flex flex-col justify-between bg-neutral-50/60 p-6 dark:bg-white/[0.02] sm:p-8">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Order Summary
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowFeeModal(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 underline transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                  >
                    <HelpCircle className="h-3 w-3" /> Where is the extra cost coming from?
                  </button>
                </div>

                {error && (
                  <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3.5 text-xs text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                    {error}
                  </div>
                )}

                <dl className="mt-4 space-y-3 rounded-xl border border-neutral-200/80 bg-white p-4 text-xs dark:border-white/10 dark:bg-neutral-950">
                  <div className="flex items-center justify-between">
                    <dt className="text-neutral-500 dark:text-neutral-400">Account Credit</dt>
                    <dd className="font-sans tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                      +${formatUsd(netUsd)} {currencyParam}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
                      <span>Card Network Fee</span>
                    </dt>
                    <dd className="font-sans tabular-nums text-neutral-700 dark:text-neutral-300">
                      ${formatUsd(feeUsd)} {currencyParam}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between border-t border-neutral-200/80 pt-3 text-neutral-950 dark:border-white/10 dark:text-white">
                    <dt className="text-lg font-bold">Total Charged</dt>
                    <dd className="font-sans tabular-nums text-lg font-bold">
                      ${formatUsd(grossUsd)}{" "}
                      <span className="text-xs font-medium text-neutral-500">{currencyParam}</span>
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="mt-6 space-y-2.5">
                {!settled ? (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={completeStripeCheckout}
                      className="pressable inline-flex h-11 w-full items-center justify-center rounded-xl bg-neutral-950 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                    >
                      {busy ? "Processing..." : `Pay $${formatUsd(grossUsd)} ${currencyParam}`}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={cancelStripeCheckout}
                      className="pressable inline-flex h-10 w-full items-center justify-center rounded-xl border border-neutral-200/90 bg-white px-5 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-950 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = withBasePath(`/playground?payment=success&session_id=${encodeURIComponent(stripeSessionId)}`);
                    }}
                    className="pressable inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Deposit Complete — Return to Playground
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <FeeBreakdownModal
          isOpen={showFeeModal}
          onClose={() => setShowFeeModal(false)}
          accountCredit={`$${formatUsd(netUsd)} ${currencyParam}`}
          cardNetworkFee={`$${formatUsd(feeUsd)} ${currencyParam}`}
          totalCharged={`$${formatUsd(grossUsd)} ${currencyParam}`}
        />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl py-6 sm:py-12">
      <button
        type="button"
        onClick={() => onNavigate("Subscription Prices")}
        className="pressable inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Subscriptions
      </button>

      <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-neutral-200/80 bg-neutral-100/80 px-3 py-1 text-xs font-semibold text-neutral-800 shadow-xs dark:border-white/10 dark:bg-white/[0.06] dark:text-neutral-200">
        <Sparkles className="h-3.5 w-3.5 text-blue-500" />
        Subscription Setup & Confirmation
      </div>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-4xl">
        Review your plan selection.
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-neutral-600 dark:text-neutral-400">
        All-inclusive transparent pricing with immediate API entitlement and dedicated concurrency.
      </p>

      {/* Plan Card */}
      <div className="mt-8 overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm dark:border-white/[0.08] dark:bg-neutral-900/60">
        <div className="flex items-center justify-between border-b border-neutral-200/80 bg-neutral-50/60 px-6 py-4 dark:border-white/[0.08] dark:bg-white/[0.02]">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Order Summary</h2>
          <button
            type="button"
            onClick={() => setShowFeeModal(true)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 underline transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
          >
            <HelpCircle className="h-3 w-3" /> Fee breakdown
          </button>
        </div>
        <dl className="divide-y divide-neutral-200/80 dark:divide-white/[0.08]">
          <div className="flex items-center justify-between p-5">
            <dt className="text-sm text-neutral-500 dark:text-neutral-400">Plan</dt>
            <dd className="text-sm font-semibold text-neutral-950 dark:text-white">
              {planDisplayName}
            </dd>
          </div>
          <div className="flex items-center justify-between p-5">
            <dt className="text-sm text-neutral-500 dark:text-neutral-400">Billing Interval</dt>
            <dd className="text-sm font-semibold capitalize text-neutral-950 dark:text-white">{billing}</dd>
          </div>

          {isUltraCustom ? (
            <>
              <div className="flex items-center justify-between p-5">
                <dt className="text-sm text-neutral-500 dark:text-neutral-400">Platform Base Fee</dt>
                <dd className="font-sans tabular-nums text-sm font-semibold text-neutral-950 dark:text-white">
                  ${ULTRA_BASE_FEE.toFixed(2)} USD / month
                </dd>
              </div>
              <div className="flex items-center justify-between p-5">
                <dt className="text-sm text-neutral-500 dark:text-neutral-400">
                  Video Dubbing ({customDubbing.toLocaleString()} mins)
                </dt>
                <dd className="font-sans tabular-nums text-sm font-semibold text-neutral-950 dark:text-white">
                  +${formatUsd(ultraBreakdown.dubbingCost)} USD
                </dd>
              </div>
              <div className="flex items-center justify-between p-5">
                <dt className="text-sm text-neutral-500 dark:text-neutral-400">
                  Voice Synthesis ({customVoice.toLocaleString()} credits)
                </dt>
                <dd className="font-sans tabular-nums text-sm font-semibold text-neutral-950 dark:text-white">
                  +${formatUsd(ultraBreakdown.voiceCost)} USD
                </dd>
              </div>
              <div className="flex items-center justify-between p-5">
                <dt className="text-sm text-neutral-500 dark:text-neutral-400">
                  Text Translation ({customText.toLocaleString()} chars)
                </dt>
                <dd className="font-sans tabular-nums text-sm font-semibold text-neutral-950 dark:text-white">
                  +${formatUsd(ultraBreakdown.textCost)} USD
                </dd>
              </div>
              <div className="flex items-center justify-between p-5">
                <dt className="text-sm text-neutral-500 dark:text-neutral-400">
                  Audio Transcription ({customTranscribe.toLocaleString()} mins)
                </dt>
                <dd className="font-sans tabular-nums text-sm font-semibold text-neutral-950 dark:text-white">
                  +${formatUsd(ultraBreakdown.transcribeCost)} USD
                </dd>
              </div>
              <div className="flex items-center justify-between p-5">
                <dt className="text-sm text-neutral-500 dark:text-neutral-400">
                  AI Images ({customImages.toLocaleString()} images)
                </dt>
                <dd className="font-sans tabular-nums text-sm font-semibold text-neutral-950 dark:text-white">
                  +${formatUsd(ultraBreakdown.imagesCost)} USD
                </dd>
              </div>
              <div className="flex items-center justify-between p-5">
                <dt className="text-sm text-neutral-500 dark:text-neutral-400">Card Network Fee</dt>
                <dd className="font-sans tabular-nums text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  $0.00 USD (Included)
                </dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-neutral-200 bg-neutral-50/50 p-5 dark:border-white/10 dark:bg-white/[0.02]">
                <div>
                  <dt className="text-base font-bold text-neutral-950 dark:text-white">
                    {billing === "yearly" ? "Annual Total Charged" : "Total Charged"}
                  </dt>
                  {billing === "yearly" && (
                    <p className="mt-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      Includes 15% Annual Discount (${formatUsd(ultraBreakdown.yearlySavings)} saved)
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <dd className="font-sans tabular-nums text-2xl font-black tracking-tight text-neutral-950 dark:text-white">
                    ${formatUsd(billing === "yearly" ? ultraBreakdown.totalYearlyPrice : ultraMonthlyPrice)}{" "}
                    <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                      USD {billing === "yearly" ? "/ yr" : "/ mo"}
                    </span>
                  </dd>
                  {billing === "yearly" && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      (${formatUsd(ultraBreakdown.effectiveMonthlyPriceYearly)}/mo equivalent)
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between p-5">
                <dt className="text-sm text-neutral-500 dark:text-neutral-400">Sticker Price</dt>
                <dd className="font-sans tabular-nums text-sm font-semibold text-neutral-950 dark:text-white">
                  ${formatUsd(planMonthlyPrice)} USD / month
                </dd>
              </div>
              <div className="flex items-center justify-between p-5">
                <dt className="text-sm text-neutral-500 dark:text-neutral-400">Card Network Fee</dt>
                <dd className="font-sans tabular-nums text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  $0.00 USD (Included)
                </dd>
              </div>
              <div className="flex items-center justify-between p-5">
                <dt className="text-sm text-neutral-500 dark:text-neutral-400">Seats</dt>
                <dd className="font-sans tabular-nums text-sm font-semibold text-neutral-950 dark:text-white">
                  {seats.toLocaleString("en-US")}
                </dd>
              </div>
              <div className="flex items-center justify-between p-5">
                <dt className="text-sm text-neutral-500 dark:text-neutral-400">Access Type</dt>
                <dd className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" /> Immediate API Activation
                </dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-neutral-200 bg-neutral-50/50 p-5 dark:border-white/10 dark:bg-white/[0.02]">
                <div>
                  <dt className="text-base font-bold text-neutral-950 dark:text-white">
                    {billing === "yearly" ? "Annual Total Charged" : "Total Charged"}
                  </dt>
                  <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                    Exact recurring amount billed to invoice. Zero checkout fees.
                  </p>
                </div>
                <div className="text-right">
                  <dd className="font-sans tabular-nums text-2xl font-black tracking-tight text-neutral-950 dark:text-white">
                    ${formatUsd(planBilledPrice)}{" "}
                    <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                      USD {billing === "yearly" ? "/ yr" : "/ mo"}
                    </span>
                  </dd>
                </div>
              </div>
            </>
          )}
        </dl>
      </div>

      {isUltraCustom && ultraBreakdown.isEnterpriseInvoice && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs leading-relaxed text-amber-900 shadow-xs dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          <p className="font-semibold">Enterprise Wire Notice:</p>
          <p className="mt-1">
            Orders exceeding $5,000/month are processed via verified bank wire/ACH to prevent card processing delays and guarantee dedicated concurrency.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        {isUltraCustom && ultraBreakdown.isEnterpriseInvoice ? (
          <button
            type="button"
            onClick={() =>
              onNavigate(
                `Contact Sales?plan=ultra-custom&message=${encodeURIComponent(
                  `Requesting Enterprise Invoice / ACH Wire for Custom Ultra Subscription ($${ultraMonthlyPrice.toFixed(2)}/mo): ${customDubbing} mins dubbing, ${customVoice} voice credits, ${customText} chars, ${customTranscribe} mins transcribe, ${customImages} images.`
                )}`
              )
            }
            className="pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Building2 className="h-4 w-4" /> Request Enterprise Invoice / ACH Wire
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={handleSubscribe}
            className="pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
          >
            <CreditCard className="h-4 w-4" />
            {busy
              ? "Activating..."
              : `Subscribe with Card / Apple Pay ($${formatUsd(planBilledPrice)}${billing === "yearly" ? "/yr" : "/mo"})`}
          </button>
        )}

        <button
          type="button"
          onClick={() => onNavigate("Subscription Prices")}
          className="pressable inline-flex min-h-11 items-center justify-center rounded-xl border border-neutral-200/90 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-800 shadow-xs transition hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
        >
          {isUltraCustom ? "Adjust Quotas" : "Change Plan"}
        </button>
      </div>

      <div className="mt-8 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
        <ShieldCheck className="h-4 w-4 text-neutral-400" />
        <span>
          All-inclusive billing complying with Quebec & Canadian consumer protection laws. Billed amounts match advertised sticker prices with zero hidden checkout surcharges.
        </span>
      </div>

      <FeeBreakdownModal
        isOpen={showFeeModal}
        onClose={() => setShowFeeModal(false)}
        accountCredit={planDisplayName}
        cardNetworkFee="$0.00 USD"
        totalCharged={`$${formatUsd(planBilledPrice)} USD`}
      />
    </section>
  );
}
