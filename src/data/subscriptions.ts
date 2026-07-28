export type ProVariantKey = "500k" | "1m";
export type UltraVariantKey = "x1" | "x2";
export type BillingInterval = "monthly" | "yearly";

export const billingIntervals = {
  monthly: { label: "Monthly", months: 1, suffix: "/month" },
  yearly: { label: "Yearly", months: 12, suffix: "/year" },
} as const satisfies Record<BillingInterval, { label: string; months: number; suffix: string }>;

export function priceForBillingInterval(monthlyPrice: number, yearlyPrice: number, interval: BillingInterval) {
  return interval === "yearly" ? yearlyPrice : monthlyPrice;
}

export function yearlyDiscountPercent(monthlyPrice: number, yearlyPrice: number) {
  if (monthlyPrice === 0) return 0;
  return Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100);
}

export type SubscriptionAllowances = {
  standardWords: number;
  proWords: number;
  ultraWords: number;
  advancedTtsCharacters: number;
};

export type SubscriptionPlan = SubscriptionAllowances & {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  description: string;
  modelAccess: string;
  ctaLabel: string;
  features: string[];
};

export type ProVariant = SubscriptionAllowances & {
  id: "pro-500k" | "pro-1m";
  label: "500K" | "1M";
  monthlyPrice: number;
  yearlyPrice: number;
  description: string;
  modelAccess: string;
  ctaLabel: string;
  variantFeature?: string;
};

export type UltraVariant = SubscriptionAllowances & {
  id: "ultra-x1" | "ultra-x2";
  label: "X1" | "X2";
  monthlyPrice: number;
  yearlyPrice: number;
  description: string;
  modelAccess: string;
  ctaLabel: string;
};

const proSharedFeatures = [
  "Stronger translation quality",
  "Better handling of context, ambiguity, and tone",
  "Automatic terminology research when needed",
  "Monthly allowance resets automatically",
  "Additional usage available separately",
];

const ultraSharedFeatures = [
  "1,000,000 Pro source words per month",
  "10,000,000 Standard source words per month",
  "100,000 Advanced TTS characters per month",
  "Deep terminology research and specialist-source verification",
  "Live web research for unclear or specialized terms",
  "Full translation, terminology, and consistency audit",
  "Monthly allowance resets automatically",
  "Additional usage available separately",
];

export const subscriptionPlans = {
  free: {
    id: "free",
    name: "Free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    standardWords: 100_000,
    proWords: 0,
    ultraWords: 0,
    advancedTtsCharacters: 1_000,
    description: "A simple starting point for everyday translation.",
    modelAccess: "Access to the standard LingoFusion model for fast, accurate everyday translations.",
    ctaLabel: "Start Free",
    features: [
      "100,000 Standard source words per month",
      "1,000 Advanced TTS characters per month",
      "Monthly allowance resets automatically",
      "Unused monthly words do not roll over",
      "Additional usage available separately",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    sharedFeatures: proSharedFeatures,
    variants: {
      "500k": {
        id: "pro-500k",
        label: "500K",
        monthlyPrice: 15.99,
        yearlyPrice: 134.99,
        standardWords: 5_000_000,
        proWords: 500_000,
        ultraWords: 0,
        advancedTtsCharacters: 25_000,
        description: "Best for regular professional use",
        modelAccess: "Access to the LingoFusion Pro model for more accurate and advanced translations.",
        ctaLabel: "Choose Pro 500K",
        variantFeature: undefined,
      },
      "1m": {
        id: "pro-1m",
        label: "1M",
        monthlyPrice: 21.99,
        yearlyPrice: 184.99,
        standardWords: 5_000_000,
        proWords: 1_000_000,
        ultraWords: 0,
        advancedTtsCharacters: 50_000,
        description: "Best value for frequent use",
        modelAccess: "Access to the LingoFusion Pro model for more accurate and advanced translations.",
        ctaLabel: "Choose Pro 1M",
        variantFeature: "Better value for frequent users",
      },
    } satisfies Record<ProVariantKey, ProVariant>,
  },
  ultra: {
    id: "ultra",
    name: "Ultra",
    sharedFeatures: ultraSharedFeatures,
    variants: {
      x1: {
        id: "ultra-x1",
        label: "X1",
        monthlyPrice: 149.99,
        yearlyPrice: 1_259.99,
        standardWords: 10_000_000,
        proWords: 1_000_000,
        ultraWords: 1_000_000,
        advancedTtsCharacters: 100_000,
        description: "High-accuracy translation and advanced document review.",
        modelAccess: "Access to the LingoFusion Ultra model, built to handle even the hardest translations with the highest accuracy.",
        ctaLabel: "Choose Ultra X1",
      },
      x2: {
        id: "ultra-x2",
        label: "X2",
        monthlyPrice: 199,
        yearlyPrice: 1_669.99,
        standardWords: 10_000_000,
        proWords: 1_000_000,
        ultraWords: 2_000_000,
        advancedTtsCharacters: 100_000,
        description: "The deepest terminology research and document review.",
        modelAccess: "Access to the LingoFusion Ultra model, built to handle even the hardest translations with the highest accuracy.",
        ctaLabel: "Choose Ultra X2",
      },
    } satisfies Record<UltraVariantKey, UltraVariant>,
  },
} as const;

export const advancedTtsAdditionalPrice = {
  usd: 0.25,
  characters: 1_000,
} as const;

export const enterpriseConfiguration = {
  minimumSeats: 1_000,
  maximumSeats: 1_000_000,
  publicScaleMessage: "Built to scale from 1,000 employees to the world's largest organizations.",
  features: [
    "Custom pricing and usage limits",
    "Volume discounts and centralized billing",
    "SSO and advanced admin controls",
    "Audit logs and priority support",
    "Dedicated onboarding",
    "Invoice or purchase-order billing",
  ],
} as const;

export const teamConfiguration = {
  minimumSeats: 2,
  maximumSelfServeSeats: enterpriseConfiguration.minimumSeats - 1,
  maximumSelectableSeats: enterpriseConfiguration.maximumSeats,
  seats: [
    { name: "Teams Pro 500K", planId: "pro-500k" as const, variant: "500k" as const },
    { name: "Teams Pro 1M", planId: "pro-1m" as const, variant: "1m" as const },
    { name: "Teams Ultra", planId: "ultra" as const },
  ],
} as const;

export const subscriptionFaqs = [
  ["What is a source word?", "A source word is a word in the original text you submit for translation. Translated output words are not counted."],
  ["Do unused words roll over?", "No. Included monthly allowances reset each billing cycle and unused monthly words do not roll over."],
  ["What happens when I reach my limit?", "You can use prepaid additional usage, purchase more usage when available, or upgrade your subscription."],
  ["Does translating into multiple languages count more than once?", "Yes. Translating the same source into three target languages counts the source words three times."],
  ["What is the difference between Standard, Pro, and Ultra?", "Standard is optimized for fast everyday work, Pro adds stronger reasoning and terminology verification, and Ultra adds maximum reasoning plus a full terminology and consistency audit."],
  ["What is the difference between Pro 500K and Pro 1M?", "Both use the same Pro quality. Pro 1M includes twice the Pro source-word allowance and 50,000 Advanced TTS characters instead of 25,000."],
  ["Can I switch between the 500K and 1M Pro options?", "Yes. Plan switching will be handled by account billing when checkout integration is connected."],
  ["Can I buy extra usage without upgrading?", "Yes. Additional usage can be purchased separately and paid from a prepaid balance when that billing flow is connected."],
  ["Does purchased additional usage expire?", "No. Purchased additional usage does not expire. Included monthly usage is consumed first."],
  ["Can teams mix different subscription levels?", "Yes. A team can mix Pro 500K, Pro 1M, and Ultra seats, with a minimum of two total members."],
  ["Is API usage included in these subscriptions?", "No. Consumer subscription allowances and LingoFusion API usage are separate. API usage uses prepaid API credit and token-based pricing."],
] as const;
