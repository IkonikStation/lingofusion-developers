import { sidebarSections, textModels } from "../data/pricing";

export function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

export function clampMinuteNotation(value: number, min: number, max: number) {
  const clamped = clampNumber(value, min, max);
  const wholeMinutes = Math.trunc(clamped);
  const seconds = Math.min(59, Math.round((clamped - wholeMinutes) * 100));
  return Number((wholeMinutes + seconds / 100).toFixed(2));
}

export function minuteNotationToMinutes(value: number) {
  const wholeMinutes = Math.trunc(value);
  const seconds = Math.round((value - wholeMinutes) * 100);
  return wholeMinutes + seconds / 60;
}

export function modelSlug(modelName: string) {
  return modelName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export const documentationPages = sidebarSections.flatMap((section) => section.items);

export const appBasePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function stripBasePath(pathname: string) {
  if (!appBasePath || !pathname.startsWith(appBasePath)) return pathname;
  return pathname.slice(appBasePath.length) || "/";
}

export function withBasePath(pathname: string) {
  return `${appBasePath}${pathname}`;
}

export function modelNameFromPath(pathname: string) {
  const slug = stripBasePath(pathname).match(/^\/models\/([^/]+)\/?$/)?.[1];
  return slug ? textModels.find((model) => modelSlug(model.model) === slug)?.model : undefined;
}

export function pageFromPath(pathname: string) {
  const appPath = stripBasePath(pathname);
  const normalized = appPath.replace(/\/+$/, "") || "/";
  if (normalized === "/subscriptions") return "Subscription Prices";
  if (normalized === "/subscriptions/ultra" || normalized === "/ultra") return "Ultra Builder";
  if (normalized === "/models") return "Models";
  if (normalized === "/playground") return "Playground";
  if (normalized === "/checkout") return "Checkout";
  if (normalized === "/teams") return "Teams";
  if (normalized === "/contact-sales") return "Contact Sales";
  const documentationSlug = normalized.match(/^\/docs\/([^/]+)$/)?.[1];
  if (documentationSlug) return documentationPages.find((page) => modelSlug(page) === documentationSlug) ?? "Overview";
  return modelNameFromPath(pathname) ?? "Pricing";
}

export function pageQuery() {
  return new URLSearchParams(window.location.search);
}

export function humanizePlanId(planId: string) {
  const names: Record<string, string> = {
    free: "LingoFusion Free",
    "pro-350k": "LingoFusion Pro",
    "pro-max-750k": "LingoFusion Pro Max",
    "ultra-1-2m": "LingoFusion Ultra",
    "ultra-max-1-8m": "LingoFusion Ultra Max",
    ultra: "LingoFusion Ultra",
    "pro-500k": "LingoFusion Pro 500K",
    "pro-1m": "LingoFusion Pro 1M",
    "ultra-x1": "LingoFusion Ultra X1",
    "ultra-x2": "LingoFusion Ultra X2",
  };
  return names[planId] ?? planId;
}

export function formatUsd(amount: number): string {
  if (!Number.isFinite(amount)) return "0.00";
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

