import { ArrowLeft, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { humanizePlanId, pageQuery } from "../lib/utils";

export function CheckoutPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const query = pageQuery();
  const planId = query.get("plan") ?? "pro-350k";
  const billing = query.get("billing") === "yearly" ? "yearly" : "monthly";
  const seats = Math.max(1, Number(query.get("seats")) || 1);

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
            <dd className="font-mono text-sm font-semibold text-neutral-950 dark:text-white">
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
