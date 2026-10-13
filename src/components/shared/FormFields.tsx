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
    <div className="mb-4 rounded-lg border border-neutral-200 bg-neutral-50/40 p-4 dark:border-neutral-800 dark:bg-neutral-900/30 sm:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
          {title}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-neutral-500">{estimateLabel}:</span>
          <span key={estimate} className="font-mono text-sm font-semibold text-neutral-900 dark:text-white">
            {estimate}
          </span>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>
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
      <span className="mb-1 block text-neutral-500">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="clean-select h-9 w-full appearance-none rounded-md border border-neutral-200 bg-white px-3 pr-8 text-xs font-medium text-neutral-900 outline-none transition focus:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-400"
        >
          {children}
        </select>
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400">
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor">
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
      <span className="mb-1 block text-neutral-500">{label}</span>
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
        className="h-9 w-full rounded-md border border-neutral-200 bg-white px-3 font-mono text-xs text-neutral-900 outline-none transition focus:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-400"
      />
      {minuteNotation && (
        <span className="mt-1 block text-[10px] text-neutral-500">
          {minuteHelp}
        </span>
      )}
    </label>
  );
}

export function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 text-xs font-medium text-neutral-600 dark:text-neutral-400">
      <span className="mb-1 block text-neutral-500">{label}</span>
      <div className="flex h-9 items-center truncate rounded-md border border-neutral-200 bg-neutral-100 px-3 text-xs font-medium text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
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
          className={`h-3.5 w-3.5 transition-colors ${
            mark <= value
              ? "text-neutral-900 dark:text-white"
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
  const sizeClass = size === "detail" ? "h-16 w-16 rounded-xl" : "h-10 w-10 rounded-lg";
  const imageScale = presentation?.imageScale ?? 1;
  const resolvedImageScale = size === "detail" && imageScale > 1 ? imageScale - 0.04 : imageScale;
  const imageTransform = size === "detail" && imageScale > 1
    ? `translateY(1.5px) scale(${resolvedImageScale})`
    : `scale(${resolvedImageScale})`;

  return (
    <span
      className={`${sizeClass} relative shrink-0 overflow-hidden border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900`}
      aria-hidden="true"
    >
      <img
        src={`${import.meta.env.BASE_URL}${(presentation?.image ?? "/assets/models/lingofusion.png").replace(/^\/+/, "")}`}
        alt=""
        className={`h-full w-full ${presentation?.imageFit === "contain" ? "object-contain" : "object-cover"}`}
        style={{ transform: imageTransform }}
      />
    </span>
  );
}
