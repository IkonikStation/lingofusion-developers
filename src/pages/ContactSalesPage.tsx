import { ArrowLeft, Building2, CheckCircle2, Mail, ShieldAlert, Sparkles } from "lucide-react";
import { useState } from "react";
import { submitSalesRequest } from "../data/sales";
import { pageQuery } from "../lib/utils";

export function ContactSalesPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const query = pageQuery();
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const seats = Math.max(1_000, Number(query.get("seats")) || 1_000);
  const planId = query.get("plan") ?? "";
  const billingInterval = query.get("billing") === "yearly" ? "yearly" : "monthly";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await submitSalesRequest({
        email: String(form.get("email") || ""),
        organization: String(form.get("organization") || ""),
        message: String(form.get("message") || ""),
        seats,
        planId,
        billingInterval,
      });
      setSent(true);
    } catch {
      setError("We could not send the acknowledgement email. Please try again shortly.");
    } finally {
      setSubmitting(false);
    }
  };

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
        <Building2 className="h-3.5 w-3.5 text-blue-500" />
        LingoFusion Enterprise Solutions
      </div>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-5xl">
        Talk to Sales for {seats.toLocaleString("en-US")} seats.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-600 dark:text-neutral-400">
        Custom enterprise pricing, volume commitments, SOC2 compliance reports, dedicated VPC peering, SSO, audit logs, and priority 24/7 SLAs.
      </p>

      {sent ? (
        <div className="mt-8 rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-8 text-left dark:border-emerald-500/20 dark:bg-emerald-950/20">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-xl font-semibold text-neutral-950 dark:text-white">Request Received</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
            We have sent an automatic confirmation to your work email. A dedicated solutions engineer from our team will follow up within one business day.
          </p>
          <button
            type="button"
            onClick={() => onNavigate("Subscription Prices")}
            className="pressable mt-6 min-h-11 rounded-xl bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
          >
            Return to Subscriptions
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mt-8 grid gap-5 rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-sm dark:border-white/[0.08] dark:bg-neutral-900/60 sm:grid-cols-2 sm:p-8"
        >
          <label className="grid gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">
            <span>Work Email</span>
            <input
              required
              name="email"
              type="email"
              placeholder="you@company.com"
              className="h-11 rounded-xl border border-neutral-300/80 bg-white px-3.5 text-sm text-neutral-950 outline-none transition focus:border-neutral-900 dark:border-white/10 dark:bg-[#121214] dark:text-white dark:focus:border-white/40"
            />
          </label>

          <label className="grid gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">
            <span>Organization / Company</span>
            <input
              required
              name="organization"
              type="text"
              placeholder="Company name"
              className="h-11 rounded-xl border border-neutral-300/80 bg-white px-3.5 text-sm text-neutral-950 outline-none transition focus:border-neutral-900 dark:border-white/10 dark:bg-[#121214] dark:text-white dark:focus:border-white/40"
            />
          </label>

          <label className="grid gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 sm:col-span-2">
            <span>How can we help?</span>
            <textarea
              required
              name="message"
              rows={4}
              defaultValue={
                query.get("message") ||
                `Interested in Enterprise for ${seats.toLocaleString("en-US")} seats with custom throughput limits.`
              }
              className="rounded-xl border border-neutral-300/80 bg-white p-3.5 text-sm text-neutral-950 outline-none transition focus:border-neutral-900 dark:border-white/10 dark:bg-[#121214] dark:text-white dark:focus:border-white/40"
            />
          </label>

          {error && (
            <p className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 sm:col-span-2" role="alert">
              <ShieldAlert className="h-4 w-4" /> {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="pressable min-h-12 rounded-xl bg-neutral-950 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200 sm:col-span-2"
          >
            {submitting ? "Submitting Request..." : "Send Enterprise Inquiry"}
          </button>
        </form>
      )}
    </section>
  );
}
