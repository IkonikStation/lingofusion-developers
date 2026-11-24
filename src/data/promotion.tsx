import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  BLACK_FRIDAY_PROMOTION,
  getModelPromotion,
  getPromotionState,
} from "../../shared/textPricing.mjs";
import type { ModelPromotion, PromotionState } from "../../shared/textPricing.mjs";
import { DEFAULT_EDGE_GATEWAY_URL, getApiBaseUrl } from "./browserApi";
import { textModelsByPricingMode } from "./pricing";
import type { TextModel, TextPricingMode } from "./pricing";

export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
};

export function splitCountdown(remainingMs: number): CountdownParts {
  const safe = Math.max(0, Math.floor(remainingMs));
  const totalSeconds = Math.floor(safe / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds, totalMs: safe };
}

export type EffectiveTextModel = TextModel & {
  originalInputUsd: number;
  originalOutputUsd: number;
  promotion: ModelPromotion | null;
};

type PromotionContextValue = {
  nowMs: number;
  promotion: PromotionState;
  countdown: CountdownParts;
  getModelOffer: (modelName: string, mode?: TextPricingMode | string) => ModelPromotion | null;
  getEffectiveTextModels: (mode: TextPricingMode) => EffectiveTextModel[];
};

const PromotionContext = createContext<PromotionContextValue | null>(null);

function computeSyncedNow(offsetMs: number): number {
  return Date.now() + offsetMs;
}

export function PromotionProvider({
  children,
  initialNowMs,
}: {
  children: ReactNode;
  initialNowMs?: number;
}) {
  const [serverOffsetMs, setServerOffsetMs] = useState<number>(() =>
    typeof initialNowMs === "number" ? initialNowMs - Date.now() : 0,
  );
  const [nowMs, setNowMs] = useState<number>(() =>
    typeof initialNowMs === "number" ? initialNowMs : Date.now(),
  );

  // Sync with server-side UTC clock so client clock skew cannot misreport the sale window.
  useEffect(() => {
    if (typeof initialNowMs === "number") return;
    let cancelled = false;
    const base = getApiBaseUrl() || DEFAULT_EDGE_GATEWAY_URL;
    if (!base) return;

    const syncServerClock = async () => {
      try {
        const startedAt = Date.now();
        const res = await fetch(`${base.replace(/\/$/, "")}/api/promotion`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { serverTimeMs?: number };
        if (cancelled || typeof data.serverTimeMs !== "number" || !Number.isFinite(data.serverTimeMs)) {
          return;
        }
        const finishedAt = Date.now();
        const estimatedNow = data.serverTimeMs + Math.round((finishedAt - startedAt) / 2);
        const nextOffset = estimatedNow - finishedAt;
        setServerOffsetMs(nextOffset);
        setNowMs(computeSyncedNow(nextOffset));
      } catch {
        // Offline or static-only mode falls back cleanly to local UTC clock.
      }
    };

    void syncServerClock();
    return () => {
      cancelled = true;
    };
  }, [initialNowMs]);

  useEffect(() => {
    const tick = () => setNowMs(computeSyncedNow(serverOffsetMs));
    tick();
    const timer = window.setInterval(tick, 1000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [serverOffsetMs]);

  const value = useMemo<PromotionContextValue>(() => {
    const promotion = getPromotionState(nowMs);
    const countdown = splitCountdown(promotion.remainingMs);

    const getModelOffer = (modelName: string, mode: TextPricingMode | string = "instant") =>
      getModelPromotion(modelName, { nowMs, mode, longContext: false });

    const getEffectiveTextModels = (mode: TextPricingMode): EffectiveTextModel[] =>
      textModelsByPricingMode[mode].map((model) => {
        const promo = model.local ? null : getModelPromotion(model.model, { nowMs, mode, longContext: false });
        return {
          ...model,
          originalInputUsd: model.inputUsd,
          originalOutputUsd: model.outputUsd,
          inputUsd: promo ? promo.inputUsd : model.inputUsd,
          outputUsd: promo ? promo.outputUsd : model.outputUsd,
          promotion: promo,
        };
      });

    return { nowMs, promotion, countdown, getModelOffer, getEffectiveTextModels };
  }, [nowMs]);

  return <PromotionContext.Provider value={value}>{children}</PromotionContext.Provider>;
}

export function usePromotion(): PromotionContextValue {
  const ctx = useContext(PromotionContext);
  if (ctx) return ctx;
  const nowMs = Date.now();
  const promotion = getPromotionState(nowMs);
  return {
    nowMs,
    promotion,
    countdown: splitCountdown(promotion.remainingMs),
    getModelOffer: (modelName: string, mode: TextPricingMode | string = "instant") =>
      getModelPromotion(modelName, { nowMs, mode, longContext: false }),
    getEffectiveTextModels: (mode: TextPricingMode) =>
      textModelsByPricingMode[mode].map((model) => {
        const promo = model.local ? null : getModelPromotion(model.model, { nowMs, mode, longContext: false });
        return {
          ...model,
          originalInputUsd: model.inputUsd,
          originalOutputUsd: model.outputUsd,
          inputUsd: promo ? promo.inputUsd : model.inputUsd,
          outputUsd: promo ? promo.outputUsd : model.outputUsd,
          promotion: promo,
        };
      }),
  };
}

export { BLACK_FRIDAY_PROMOTION };
