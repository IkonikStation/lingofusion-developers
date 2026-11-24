export type ModelPromotion = {
  id: string;
  model: string;
  discountPercent: number;
  inputDiscountPercent: number;
  outputDiscountPercent: number;
  inputOnly: boolean;
  originalRi: number;
  originalRo: number;
  ri: number;
  ro: number;
  originalInputUsd: number;
  originalOutputUsd: number;
  inputUsd: number;
  outputUsd: number;
};

export type PromotionState = {
  id: string;
  name: string;
  headline: string;
  startsAt: string;
  endsAt: string;
  startMs: number;
  endMs: number;
  durationHours: number;
  maxDiscountPercent: number;
  eligibleModes: readonly string[];
  active: boolean;
  upcoming: boolean;
  expired: boolean;
  remainingMs: number;
  serverTimeMs: number;
  serverTimeUtc: string;
  models: Record<
    string,
    {
      discountPercent: number;
      inputDiscountPercent: number;
      outputDiscountPercent: number;
      inputOnly: boolean;
      originalInputUsd: number;
      originalOutputUsd: number;
      inputUsd: number;
      outputUsd: number;
    }
  >;
};

export declare const TEXT_PRICING_VERSION: string;
export declare const BLACK_FRIDAY_PROMOTION: {
  readonly id: string;
  readonly name: string;
  readonly headline: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly startMs: number;
  readonly endMs: number;
  readonly durationHours: number;
  readonly maxDiscountPercent: number;
  readonly eligibleModes: readonly string[];
  readonly discounts: Record<
    string,
    {
      readonly discountPercent: number;
      readonly inputDiscountPercent: number;
      readonly outputDiscountPercent: number;
      readonly ri: number;
      readonly ro: number;
      readonly inputOnly: boolean;
    }
  >;
};

export declare function isPromotionActive(nowMs?: number): boolean;
export declare function isPromotionUpcoming(nowMs?: number): boolean;
export declare function getModelPromotion(
  modelName: string,
  options?: { nowMs?: number; mode?: string; longContext?: boolean },
): ModelPromotion | null;
export declare function getPromotionState(nowMs?: number): PromotionState;
