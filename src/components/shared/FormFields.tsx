import type { ReactNode } from "react";
import type { TextModelPresentation } from "../../data/pricing";
import { Zap } from "lucide-react";
import { clampMinuteNotation, clampNumber } from "../../lib/utils";

export function SectionCalculator({
  title,
  estimateLabel,
  estimate,
  children,
}: {
  title: string;
  estimateLabel: string;
  estimate: string;
  children: ReactNode;
}) {
  return (
    <div className="calculator-motion surface-lift relative mb-4 overflow-hidden rounded-xl border border-neutral-200/90 bg-neutral-50/80 p-4 shadow-sm backdrop-blur-sm dark:border-white/[0.08] dark:bg-neutral-900/40 sm:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
          <h3 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">{title}</h3>
        </div>
        <div className="rounded-lg border border-neutral-200/80 bg-white px-3.5 py-2 shadow-xs dark:border-white/[0.08] dark:bg-[#111113] sm:text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            {estimateLabel}
          </div>
          <div key={estimate} className="estimate-pop mt-0.5 break-all font-mono text-base font-bold text-neutral-950 dark:text-white">
            {estimate}
          </div>
        </div>
      </div>
      <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="min-w-0 text-xs font-medium text-neutral-600 dark:text-neutral-400">
      <span className="mb-1.5 block font-medium">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="clean-select h-10 w-full appearance-none rounded-lg border border-neutral-300/80 bg-white px-3 pr-9 text-sm font-medium text-neutral-900 outline-none transition hover:border-neutral-400 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 dark:border-white/10 dark:bg-[#121214] dark:text-neutral-100 dark:hover:border-white/20 dark:focus:border-white/40 dark:focus:ring-white/20"
        >
          {children}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500">
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
            <path d="M5.7 7.5a1 1 0 0 1 1.4 0L10 10.4l2.9-2.9a1 1 0 1 1 1.4 1.4l-3.6 3.6a1 1 0 0 1-1.4 0L5.7 8.9a1 1 0 0 1 0-1.4Z" />
          </svg>
        </span>
      </div>
    </label>
  );
}

export function NumberField({
  label,
  min,
  max,
  step,
  value,
  onChange,
  minuteNotation = false,
  minuteHelp,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  minuteNotation?: boolean;
  minuteHelp?: string;
}) {
  return (
    <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
      <span className="mb-1.5 block font-medium">{label}</span>
      <input
        type="number"
        min={min}
        {...(Number.isFinite(max) ? { max } : {})}
        step={step}
        value={value}
        onChange={(event) =>
          onChange(
            minuteNotation
              ? clampMinuteNotation(Number(event.target.value), min, max)
              : clampNumber(Number(event.target.value), min, max),
          )
        }
        className="h-10 w-full rounded-lg border border-neutral-300/80 bg-white px-3 font-mono text-sm text-neutral-900 outline-none transition hover:border-neutral-400 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 dark:border-white/10 dark:bg-[#121214] dark:text-neutral-100 dark:hover:border-white/20 dark:focus:border-white/40 dark:focus:ring-white/20"
      />
      {minuteNotation && (
        <span className="mt-1 block text-[11px] text-neutral-500 dark:text-neutral-500">
          {minuteHelp}
        </span>
      )}
    </label>
  );
}

export function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 text-xs font-medium text-neutral-600 dark:text-neutral-400">
      <span className="mb-1.5 block font-medium">{label}</span>
      <div className="flex h-10 items-center truncate rounded-lg border border-neutral-200/80 bg-neutral-100/60 px-3 text-sm font-medium text-neutral-800 dark:border-white/10 dark:bg-[#141416] dark:text-neutral-200">
        {value}
      </div>
    </div>
  );
}

export function RatingMarks({ value, icon: Icon = Zap }: { value: number; icon?: typeof Zap }) {
  return (
    <span className="flex items-center justify-center gap-1" aria-label={`${value} out of 4`}>
      {[1, 2, 3, 4].map((mark) => (
        <Icon
          key={mark}
          className={`h-4 w-4 transition-colors ${
            mark <= value
              ? "text-neutral-950 dark:text-white"
              : "text-neutral-200 dark:text-neutral-800"
          }`}
          fill={mark <= value ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

export function ModelIcon({
  presentation,
  size = "catalog",
}: {
  presentation?: TextModelPresentation;
  size?: "catalog" | "detail";
}) {
  const sizeClass = size === "detail" ? "h-20 w-20 sm:h-24 sm:w-24 rounded-2xl" : "h-14 w-14 rounded-xl";
  const imageScale = presentation?.imageScale ?? 1;
  const resolvedImageScale = size === "detail" && imageScale > 1 ? imageScale - 0.04 : imageScale;
  const imageTransform = size === "detail" && imageScale > 1
    ? `translateY(1.5px) scale(${resolvedImageScale})`
    : `scale(${resolvedImageScale})`;

  return (
    <span
      className={`model-icon-motion ${sizeClass} relative shrink-0 overflow-hidden border border-neutral-200/60 bg-neutral-100 p-0.5 shadow-xs dark:border-white/[0.08] dark:bg-white/[0.04]`}
      aria-hidden="true"
    >
      <img
        src={`${import.meta.env.BASE_URL}${(presentation?.image ?? "/assets/models/lingofusion.png").replace(/^\/+/, "")}`}
        alt=""
        className={`h-full w-full rounded-[10px] ${presentation?.imageFit === "contain" ? "object-contain" : "object-cover"} transition-transform duration-300`}
        style={{ transform: imageTransform }}
      />
    </span>
  );
}
