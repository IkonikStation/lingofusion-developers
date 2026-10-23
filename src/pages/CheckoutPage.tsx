import { ArrowLeft, CheckCircle2, CreditCard, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { browserApi, calculateGrossDeposit, getApiBaseUrl, shouldUseBrowserApi } from "../data/browserApi";
import { humanizePlanId, pageQuery, withBasePath } from "../lib/utils";

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

  const [busy, setBusy] = useState(false);
  const [settled, setSettled] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
                  Add ${netUsd.toFixed(2)} {currencyParam} to your balance
                </h1>
                <p className="mt-2.5 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
                  Credits are available immediately after payment and can be used across LingoFusion Text, Image, and Voice models.
                </p>

                <ul className="mt-6 space-y-2.5 text-xs text-neutral-600 dark:text-neutral-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>Full ${netUsd.toFixed(2)} {currencyParam} net credit deposited</span>
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
                <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Order Summary
                </h2>

                {error && (
                  <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3.5 text-xs text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                    {error}
                  </div>
                )}

                <dl className="mt-4 space-y-3 rounded-xl border border-neutral-200/80 bg-white p-4 text-xs dark:border-white/10 dark:bg-neutral-950">
                  <div className="flex items-center justify-between">
                    <dt className="text-neutral-500 dark:text-neutral-400">Credits added to balance</dt>
                    <dd className="font-sans tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                      +${netUsd.toFixed(2)} {currencyParam}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-neutral-500 dark:text-neutral-400">
                      Processing fee
                    </dt>
                    <dd className="font-sans tabular-nums text-neutral-700 dark:text-neutral-300">
                      ${feeUsd.toFixed(2)} {currencyParam}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between border-t border-neutral-200/80 pt-3 text-sm font-semibold text-neutral-950 dark:border-white/10 dark:text-white">
                    <dt>Total due</dt>
                    <dd className="font-sans tabular-nums text-lg font-bold">
                      ${grossUsd.toFixed(2)}{" "}
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
                      {busy ? "Processing..." : `Pay $${grossUsd.toFixed(2)} ${currencyParam}`}
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
        You selected a plan from the subscriptions page. This is a developer testbed demo, so no charges or cards will be billed.
      </p>

      {/* Plan Card */}
      <div className="mt-8 overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm dark:border-white/[0.08] dark:bg-neutral-900/60">
        <div className="border-b border-neutral-200/80 bg-neutral-50/60 px-6 py-4 dark:border-white/[0.08] dark:bg-white/[0.02]">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Order Summary</h2>
        </div>
        <dl className="divide-y divide-neutral-200/80 dark:divide-white/[0.08]">
          <div className="flex items-center justify-between p-5">
            <dt className="text-sm text-neutral-500 dark:text-neutral-400">Plan</dt>
            <dd className="text-sm font-semibold text-neutral-950 dark:text-white">{humanizePlanId(planId)}</dd>
          </div>
          <div className="flex items-center justify-between p-5">
            <dt className="text-sm text-neutral-500 dark:text-neutral-400">Billing Interval</dt>
            <dd className="text-sm font-semibold capitalize text-neutral-950 dark:text-white">{billing}</dd>
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
        </dl>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onNavigate("Playground")}
          className="pressable inline-flex min-h-11 items-center justify-center rounded-xl bg-neutral-950 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
        >
          Continue to Playground
        </button>
        <button
          type="button"
          onClick={() => onNavigate("Subscription Prices")}
          className="pressable inline-flex min-h-11 items-center justify-center rounded-xl border border-neutral-200/90 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-800 shadow-xs transition hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
        >
          Change Plan
        </button>
      </div>

      <div className="mt-8 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
        <ShieldCheck className="h-4 w-4 text-neutral-400" />
        No payment details stored in local simulator mode.
      </div>
    </section>
  );
}
