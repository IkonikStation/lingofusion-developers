import { ArrowLeft, ArrowRight, Shield, Users } from "lucide-react";
import { useState } from "react";
import { priceForBillingInterval, subscriptionPlans, teamConfiguration } from "../data/subscriptions";
import type { BillingInterval } from "../data/subscriptions";
import { pageQuery } from "../lib/utils";

export function TeamsPage({
  onNavigate,
}: {
  onNavigate: (page: string, query?: Record<string, string | number | undefined>) => void;
}) {
  const requestedBilling = pageQuery().get("billing");
  const [billing, setBilling] = useState<BillingInterval>(
    requestedBilling === "yearly" ? "yearly" : "monthly",
  );
  type TeamSeatPlanId = (typeof teamConfiguration.seats)[number]["planId"];
  const [planId, setPlanId] = useState<TeamSeatPlanId>(() => {
    const requestedPlan = pageQuery().get("plan");
    return (
      teamConfiguration.seats.find((seat) => seat.planId === requestedPlan)?.planId ??
      teamConfiguration.seats[0].planId
    );
  });
  const [seats, setSeats] = useState(5);
  const selectedSeat = teamConfiguration.seats.find((seat) => seat.planId === planId) ?? teamConfiguration.seats[0];
  const plan = "variant" in selectedSeat
    ? subscriptionPlans.pro.variants[selectedSeat.variant]
    : subscriptionPlans.ultra.variants[selectedSeat.ultraVariant];
  const price = priceForBillingInterval(plan.monthlyPrice, plan.yearlyPrice, billing);
  const total = price * seats;

  return (
    <section className="mx-auto max-w-4xl py-6 sm:py-12">
      <button
        type="button"
        onClick={() => onNavigate("Subscription Prices")}
        className="pressable inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Subscriptions
      </button>

      <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-neutral-200/80 bg-neutral-100/80 px-3 py-1 text-xs font-semibold text-neutral-800 shadow-xs dark:border-white/10 dark:bg-white/[0.06] dark:text-neutral-200">
        <Users className="h-3.5 w-3.5 text-blue-500" />
        LingoFusion Teams Configurator
      </div>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-5xl">
        Configure seats for your team.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-600 dark:text-neutral-400">
        Empower your organization with shared workspaces, centralized billing, and custom seat allocations for 2 to 999 members.
      </p>

      {/* Configuration Grid */}
      <div className="mt-8 grid gap-5 rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-sm dark:border-white/[0.08] dark:bg-neutral-900/60 sm:grid-cols-2 sm:p-8">
        <label className="grid gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">
          <span>Seat Type</span>
          <select
            value={planId}
            onChange={(event) => setPlanId(event.target.value as TeamSeatPlanId)}
            className="clean-select h-11 rounded-xl border border-neutral-300/80 bg-white px-3.5 text-sm font-medium text-neutral-950 outline-none transition focus:border-neutral-900 dark:border-white/10 dark:bg-[#121214] dark:text-white dark:focus:border-white/40"
          >
            {teamConfiguration.seats.map((seat) => (
              <option key={seat.planId} value={seat.planId}>
                {seat.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">
          <span>Billing Schedule</span>
          <select
            value={billing}
            onChange={(event) => setBilling(event.target.value as BillingInterval)}
            className="clean-select h-11 rounded-xl border border-neutral-300/80 bg-white px-3.5 text-sm font-medium text-neutral-950 outline-none transition focus:border-neutral-900 dark:border-white/10 dark:bg-[#121214] dark:text-white dark:focus:border-white/40"
          >
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly (Save 20%)</option>
          </select>
        </label>

        <label className="grid gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 sm:col-span-2">
          <div className="flex items-center justify-between">
            <span>Seat Count</span>
            <span className="font-mono text-neutral-500">2 – 999 seats</span>
          </div>
          <input
            type="number"
            min="2"
            max="999"
            value={seats}
            onChange={(event) =>
              setSeats(Math.min(999, Math.max(2, Number(event.target.value) || 2)))
            }
            className="h-11 rounded-xl border border-neutral-300/80 bg-white px-3.5 font-mono text-sm text-neutral-950 outline-none transition focus:border-neutral-900 dark:border-white/10 dark:bg-[#121214] dark:text-white dark:focus:border-white/40"
          />
        </label>
      </div>

      {/* Summary Box */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-neutral-900 bg-neutral-950 p-6 text-white shadow-md dark:border-white/10 dark:bg-white dark:text-neutral-950 sm:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider opacity-70">
            Total {billing === "yearly" ? "Annual" : "Monthly"} Commitment
          </p>
          <p className="mt-1.5 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(total)}
            <span className="font-sans text-sm font-normal opacity-70">
              {" "}/{billing === "yearly" ? "year" : "month"}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate("Checkout", { plan: planId, billing, seats })}
          className="pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-neutral-950 shadow-sm transition hover:bg-neutral-100 dark:bg-neutral-950 dark:text-white dark:hover:bg-neutral-800"
        >
          Review Team Plan <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-6 flex items-center justify-between rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-4 text-xs text-neutral-600 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-neutral-400">
        <span>Need 1,000+ seats with custom SLA and security reviews?</span>
        <button
          type="button"
          onClick={() => onNavigate("Contact Sales", { seats: 1000, plan: planId, billing })}
          className="font-semibold text-neutral-950 underline underline-offset-4 dark:text-white"
        >
          Contact Enterprise Sales &rarr;
        </button>
      </div>
    </section>
  );
}
