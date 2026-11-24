import { Clock } from "lucide-react";
import type { ModelPromotion } from "../../shared/textPricing.mjs";

export function DiscountBadge({
  promotion,
  compact = false,
}: {
  promotion: ModelPromotion | null | undefined;
  compact?: boolean;
}) {
  if (!promotion) return null;
  const label = promotion.inputOnly
    ? `${promotion.discountPercent}% OFF INPUT`
    : `${promotion.discountPercent}% OFF`;
  return (
    <span
      className={`inline-flex items-center rounded-full bg-emerald-500/15 font-semibold tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 ${
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-[11px]"
      }`}
    >
      {label}
    </span>
  );
}

export function PromoPriceValue({
  price,
  originalPrice,
  discounted,
  layout = "inline",
  size = "sm",
}: {
  price: string;
  originalPrice?: string;
  discounted: boolean;
  layout?: "inline" | "stacked";
  size?: "sm" | "md" | "lg";
}) {
  if (!discounted || !originalPrice || originalPrice === price) {
    return <span className="font-sans tabular-nums">{price}</span>;
  }

  const originalSize =
    size === "lg"
      ? "text-sm sm:text-base"
      : size === "md"
      ? "text-xs"
      : "text-[11px]";
  const activeSize =
    size === "lg"
      ? "text-2xl sm:text-3xl font-bold"
      : size === "md"
      ? "text-base sm:text-xl font-bold"
      : "text-xs sm:text-sm font-semibold";

  if (layout === "stacked") {
    return (
      <span className="inline-flex flex-col leading-tight">
        <s className={`font-sans tabular-nums text-neutral-400 line-through decoration-neutral-400/80 dark:text-neutral-500 ${originalSize}`}>
          {originalPrice}
        </s>
        <span className={`font-sans tabular-nums text-emerald-600 dark:text-emerald-400 ${activeSize}`}>
          {price}
        </span>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-baseline gap-1.5">
      <s className={`font-sans tabular-nums text-neutral-400 line-through decoration-neutral-400/80 dark:text-neutral-500 ${originalSize}`}>
        {originalPrice}
      </s>
      <span className={`font-sans tabular-nums text-emerald-600 dark:text-emerald-400 ${activeSize}`}>
        {price}
      </span>
    </span>
  );
}

export function BlackFridaySpotlightCard({
  modelName,
  promotion,
  formatUsd,
  onClick,
}: {
  modelName: string;
  promotion: ModelPromotion;
  formatUsd: (amount: number) => string;
  onClick?: () => void;
}) {
  const inputDiscounted = promotion.inputDiscountPercent > 0;
  const outputDiscounted = promotion.outputDiscountPercent > 0;

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs transition dark:border-white/[0.1] dark:bg-[#141414] ${
        onClick ? "cursor-pointer hover:border-emerald-500/40 dark:hover:border-emerald-500/40" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-lg">
          {modelName}
        </h3>
        <DiscountBadge promotion={promotion} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Input / 1M tokens</p>
          <div className="mt-1">
            <PromoPriceValue
              price={formatUsd(promotion.inputUsd)}
              originalPrice={formatUsd(promotion.originalInputUsd)}
              discounted={inputDiscounted}
              layout="stacked"
              size="lg"
            />
          </div>
        </div>
        <div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Output / 1M tokens</p>
          <div className="mt-1">
            {outputDiscounted ? (
              <PromoPriceValue
                price={formatUsd(promotion.outputUsd)}
                originalPrice={formatUsd(promotion.originalOutputUsd)}
                discounted
                layout="stacked"
                size="lg"
              />
            ) : (
              <span className="inline-flex flex-col leading-tight">
                <span className="text-xs text-neutral-400 dark:text-neutral-500">Standard rate</span>
                <span className="font-sans text-2xl font-bold tabular-nums text-neutral-900 dark:text-neutral-100 sm:text-3xl">
                  {formatUsd(promotion.outputUsd)}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-1.5 border-t border-neutral-200/80 pt-3 text-xs text-neutral-500 dark:border-white/[0.08] dark:text-neutral-400">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        <span>Limited-time Black Friday pricing</span>
      </div>
    </div>
  );
}
