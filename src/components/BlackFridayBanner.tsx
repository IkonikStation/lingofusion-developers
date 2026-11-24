import { ArrowRight, Clock, Sparkles } from "lucide-react";
import { usePromotion } from "../data/promotion";

function pad2(n: number) {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

export function BlackFridayBanner({
  onViewPricing,
  showCta = true,
}: {
  onViewPricing?: () => void;
  showCta?: boolean;
}) {
  const { promotion, countdown } = usePromotion();

  // Automatically remove banner once the promotion expires (countdown reaches zero).
  if (promotion.expired || (!promotion.active && !promotion.upcoming)) {
    return null;
  }

  const units = [
    { label: "Days", value: pad2(countdown.days) },
    { label: "Hrs", value: pad2(countdown.hours) },
    { label: "Min", value: pad2(countdown.minutes) },
    { label: "Sec", value: pad2(countdown.seconds) },
  ];

  return (
    <div
      role="region"
      aria-label="Black Friday and Cyber Monday Sale"
      className="relative overflow-hidden rounded-2xl border border-neutral-900/15 bg-gradient-to-r from-neutral-950 via-neutral-900 to-emerald-950 px-5 py-4 text-white shadow-sm dark:border-emerald-500/25 dark:from-[#0b0f0d] dark:via-[#111513] dark:to-[#0c2117] sm:px-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-emerald-500/15 blur-3xl"
      />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  promotion.active ? "animate-pulse bg-emerald-400" : "bg-amber-400"
                }`}
              />
              {promotion.active ? "Black Friday & Cyber Monday" : "Upcoming · Black Friday & Cyber Monday"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-white">
              <Sparkles className="h-3 w-3 text-emerald-400" />
              Up to 50% OFF
            </span>
          </div>

          <p className="text-sm font-medium text-neutral-100 sm:text-[15px]">
            {promotion.active
              ? "Limited-time API token discounts applied automatically across eligible LingoFusion text models."
              : "6-day API sale starts Nov 25 at 05:00 UTC — up to 50% off eligible LingoFusion text models."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2" aria-live="off">
            <span className="hidden items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-neutral-400 sm:inline-flex">
              <Clock className="h-3.5 w-3.5 text-emerald-400" />
              {promotion.active ? "Ends in" : "Starts in"}
            </span>
            <div className="flex items-center gap-1.5" role="timer" aria-label={promotion.active ? "Sale ends in" : "Sale starts in"}>
              {units.map((unit) => (
                <div
                  key={unit.label}
                  className="flex min-w-[3.1rem] flex-col items-center rounded-lg border border-white/10 bg-white/[0.06] px-2 py-1 text-center backdrop-blur-xs"
                >
                  <span className="font-sans text-sm font-bold tabular-nums leading-tight text-white sm:text-base">
                    {unit.value}
                  </span>
                  <span className="text-[9px] font-medium uppercase tracking-wider text-neutral-400">
                    {unit.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {showCta && onViewPricing && (
            <button
              type="button"
              onClick={onViewPricing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-neutral-950 transition hover:bg-emerald-400"
            >
              View API Prices
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
