import { ArrowRight } from "lucide-react";
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
    { label: "d", value: pad2(countdown.days), name: "days" },
    { label: "h", value: pad2(countdown.hours), name: "hours" },
    { label: "m", value: pad2(countdown.minutes), name: "minutes" },
    { label: "s", value: pad2(countdown.seconds), name: "seconds" },
  ];

  return (
    <div
      role="region"
      aria-label="Black Friday and Cyber Monday Sale"
      className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 dark:border-neutral-800 dark:bg-[#141414] dark:text-neutral-100 sm:px-5"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-sm">
          <span className="font-semibold tracking-tight text-neutral-950 dark:text-white">
            Black Friday &amp; Cyber Monday
          </span>
          <span className="rounded bg-emerald-600/10 px-1.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
            Up to 50% OFF
          </span>
          <span className="text-neutral-600 dark:text-neutral-400">
            {promotion.active
              ? "Temporary discounts are live on eligible API text models."
              : "Starts Nov 24 at 12:00 AM EST across eligible API text models."}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-neutral-500 dark:text-neutral-400">
              {promotion.active ? "Ends in" : "Starts in"}
            </span>
            <div
              role="timer"
              aria-label={promotion.active ? "Sale ends in" : "Sale starts in"}
              className="inline-flex items-center gap-1 font-mono text-xs font-medium tabular-nums text-neutral-900 dark:text-neutral-100"
            >
              {units.map((unit, idx) => (
                <span key={unit.name} className="inline-flex items-baseline">
                  <span className="rounded border border-neutral-200 bg-white px-1.5 py-0.5 dark:border-neutral-800 dark:bg-neutral-900">
                    {unit.value}
                    <span className="ml-0.5 text-[10px] text-neutral-400 dark:text-neutral-500">
                      {unit.label}
                    </span>
                  </span>
                  {idx < units.length - 1 && (
                    <span aria-hidden="true" className="mx-0.5 text-neutral-300 dark:text-neutral-700">
                      :
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>

          {showCta && onViewPricing && (
            <button
              type="button"
              onClick={onViewPricing}
              className="inline-flex items-center gap-1 text-xs font-medium text-neutral-900 underline-offset-4 hover:underline dark:text-white"
            >
              View prices
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
