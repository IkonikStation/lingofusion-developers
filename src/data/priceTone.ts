export function modelPriceTone(modelName: string) {
  const tones: Record<string, string> = {
    "LingoFusion Native-1.7B": "text-emerald-700 dark:text-emerald-300",
    "LingoFusion Native-9B": "text-emerald-700 dark:text-emerald-300",
    "LingoFusion Native-35B": "text-emerald-700 dark:text-emerald-300",
    "LingoFusion Nano": "text-slate-600 dark:text-slate-300",
    "LingoFusion Lite": "text-lime-700 dark:text-lime-300",
    LingoFusion: "text-blue-700 dark:text-blue-300",
    "LingoFusion Pro": "text-violet-700 dark:text-violet-300",
    ExplainFusion: "text-sky-700 dark:text-sky-300",
    "LingoFusion Ultra": "text-yellow-500 dark:text-yellow-300",
  };

  return tones[modelName] ?? "text-neutral-950 dark:text-white";
}
