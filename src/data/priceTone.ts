export function priceTone(value: number | null | undefined) {
  if (value === 0) return "text-emerald-700 dark:text-emerald-300";
  if (value === null || value === undefined) return "text-neutral-500 dark:text-neutral-400";
  if (value < 1) return "text-teal-700 dark:text-teal-300";
  if (value < 10) return "text-sky-700 dark:text-sky-300";
  if (value < 50) return "text-violet-700 dark:text-violet-300";
  return "text-amber-700 dark:text-amber-300";
}
