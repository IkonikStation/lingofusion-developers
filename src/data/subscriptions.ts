export type ProVariantKey = "350k" | "750k";
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
  estimatedCharacters: number;
  proWords: number;
  ultraWords: number;
  advancedTtsCharacters: number;
  imageTranslations: number;
  liveDictationMinutes: number;
  fileTranscriptionMinutes: number;
  voiceCharacters: number;
  liveWebLookups: number | "Unlimited";
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
  id: "pro-350k" | "pro-max-750k";
  label: "350K" | "750K";
  selectorLabel: "Pro (350K)" | "Pro Max (750K)";
  monthlyPrice: number;
  yearlyPrice: number;
  description: string;
  modelAccess: string;
  ctaLabel: string;
  usageFeatures: string[];
  benefits: string[];
};

export type UltraVariant = SubscriptionAllowances & {
  id: "ultra-1-2m" | "ultra-max-1-8m";
  label: "1.2M" | "1.8M";
  selectorLabel: "Ultra (1.2M)" | "Ultra Max (1.8M)";
  monthlyPrice: number;
  yearlyPrice: number;
  description: string;
  modelAccess: string;
  ctaLabel: string;
  usageFeatures: string[];
  benefits: string[];
};

export const subscriptionPlans = {
  free: {
    id: "free",
    name: "Free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    standardWords: 50_000,
    estimatedCharacters: 300_000,
    proWords: 0,
    ultraWords: 0,
    advancedTtsCharacters: 0,
    imageTranslations: 5,
    liveDictationMinutes: 5,
    fileTranscriptionMinutes: 0,
    voiceCharacters: 0,
    liveWebLookups: 0,
    description: "Generous everyday translation tools for individual exploration.",
    modelAccess: "Access to LingoFusion for fast, natural translations.",
    ctaLabel: "Start Free",
    features: [
      "50,000 words (~300,000 characters) per month",
      "5 Image Translations per month",
      "5 minutes Live Dictation per month",
      "Standard system voice playback",
      "Dubbing Studio access via prepaid wallet ($3.50/min)",
      "Live Web Lookups available on-demand ($0.025/search)",
      "Allowance resets automatically on the 1st of each month",
      "Unused monthly allowance does not roll over",
    ],
  } satisfies SubscriptionPlan,
  pro: {
    name: "Pro",
    variants: {
      "350k": {
        id: "pro-350k",
        label: "350K",
        selectorLabel: "Pro (350K)",
        monthlyPrice: 19.99,
        yearlyPrice: 204,
        standardWords: 0,
        estimatedCharacters: 2_200_000,
        proWords: 350_000,
        ultraWords: 0,
        advancedTtsCharacters: 25_000,
        imageTranslations: 50,
        liveDictationMinutes: 60,
        fileTranscriptionMinutes: 30,
        voiceCharacters: 25_000,
        liveWebLookups: 25,
        description: "For regular professional translation and studio-quality audio.",
        modelAccess: "Access to LingoFusion Pro with standard reasoning.",
        ctaLabel: "Choose Pro",
        usageFeatures: [
          "350,000 words (~2,200,000 characters) per month",
          "50 Image Translations per month",
          "60 min Live Dictation + 30 min File Transcription per month",
          "25,000 voice generation characters per month",
          "25 Live Web Lookups included per month",
        ],
        benefits: [
          "Nuanced phrasing and cultural idiom verification",
          "Full Dubbing Studio access ($3.50/min PAYG)",
          "Automatic overage fallback via prepaid wallet",
          "Allowance refreshes every billing cycle",
        ],
      },
      "750k": {
        id: "pro-max-750k",
        label: "750K",
        selectorLabel: "Pro Max (750K)",
        monthlyPrice: 39.99,
        yearlyPrice: 408,
        standardWords: 0,
        estimatedCharacters: 4_800_000,
        proWords: 750_000,
        ultraWords: 0,
        advancedTtsCharacters: 75_000,
        imageTranslations: 150,
        liveDictationMinutes: 150,
        fileTranscriptionMinutes: 75,
        voiceCharacters: 75_000,
        liveWebLookups: 75,
        description: "For high-volume teams, agencies, and long-form media.",
        modelAccess: "Access to LingoFusion Pro with high reasoning.",
        ctaLabel: "Choose Pro Max",
        usageFeatures: [
          "750,000 words (~4,800,000 characters) per month",
          "150 Image Translations per month",
          "150 min Live Dictation + 75 min File Transcription per month",
          "75,000 voice generation characters per month",
          "75 Live Web Lookups included per month",
        ],
        benefits: [
          "Extended reasoning for complex legal and technical prose",
          "Studio Dubbing access ($3.50/min PAYG)",
          "Priority processing queue for batch files",
          "Automatic overage fallback via prepaid wallet",
        ],
      },
    } satisfies Record<ProVariantKey, ProVariant>,
  },
  ultra: {
    name: "Ultra",
    variants: {
      x1: {
        id: "ultra-1-2m",
        label: "1.2M",
        selectorLabel: "Ultra (1.2M)",
        monthlyPrice: 149.99,
        yearlyPrice: 1_529,
        standardWords: 0,
        estimatedCharacters: 7_500_000,
        proWords: 0,
        ultraWords: 1_200_000,
        advancedTtsCharacters: 150_000,
        imageTranslations: 500,
        liveDictationMinutes: 360,
        fileTranscriptionMinutes: 180,
        voiceCharacters: 150_000,
        liveWebLookups: 250,
        description: "Flagship model accuracy for localization firms and legal publishing.",
        modelAccess: "Access to LingoFusion Ultra with advanced reasoning.",
        ctaLabel: "Choose Ultra",
        usageFeatures: [
          "1,200,000 words (~7,500,000 characters) per month",
          "500 Image Translations per month",
          "360 min Live Dictation (6 hrs) + 180 min File Transcription (3 hrs)",
          "150,000 voice generation characters (~2 hrs)",
          "250 Live Web Lookups included per month",
        ],
        benefits: [
          "Deep terminology research and specialist-source verification",
          "Studio Dubbing access ($3.50/min PAYG)",
          "High-speed priority queue and developer API access",
          "Priority technical support",
        ],
      },
      x2: {
        id: "ultra-max-1-8m",
        label: "1.8M",
        selectorLabel: "Ultra Max (1.8M)",
        monthlyPrice: 199,
        yearlyPrice: 2_029,
        standardWords: 0,
        estimatedCharacters: 11_000_000,
        proWords: 0,
        ultraWords: 1_800_000,
        advancedTtsCharacters: 220_000,
        imageTranslations: 1_000,
        liveDictationMinutes: 500,
        fileTranscriptionMinutes: 250,
        voiceCharacters: 220_000,
        liveWebLookups: "Unlimited",
        description: "Maximum compute, certified nuance verification, and dedicated lanes.",
        modelAccess: "Access to LingoFusion Ultra with maximum reasoning.",
        ctaLabel: "Choose Ultra Max",
        usageFeatures: [
          "1,800,000 words (~11,000,000 characters) per month",
          "1,000 Image Translations per month",
          "500 min Live Dictation (~8.3 hrs) + 250 min File Transcription (~4.1 hrs)",
          "220,000 voice generation characters (~3 hrs)",
          "Unlimited Live Web Lookups included",
        ],
        benefits: [
          "Exhaustive multi-pass nuance and consistency verification",
          "Studio Dubbing access ($3.50/min PAYG)",
          "Dedicated enterprise concurrency and API integrations",
          "Direct engineering escalation",
        ],
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
    { name: "Teams Pro (350K)", planId: "pro-350k" as const, variant: "350k" as const },
    { name: "Teams Pro Max (750K)", planId: "pro-max-750k" as const, variant: "750k" as const },
    { name: "Teams Ultra (1.2M)", planId: "ultra-1-2m" as const, ultraVariant: "x1" as const },
    { name: "Teams Ultra Max (1.8M)", planId: "ultra-max-1-8m" as const, ultraVariant: "x2" as const },
  ],
} as const;

export const subscriptionFaqs = [
  ["What is a source word?", "A source word is a word in the original text you submit for translation. Translated output words are not counted."],
  ["Do unused words roll over?", "No. Included monthly allowances reset each billing cycle and unused monthly allowances do not roll over."],
  ["What happens when I reach my limit?", "Eligible paid plans use automatic overage fallback through your prepaid wallet. You can also purchase additional usage or upgrade your plan."],
  ["Does translating into multiple languages count more than once?", "Yes. Translating the same source into three target languages counts the source words three times."],
  ["What is the difference between Standard, Pro, and Ultra?", "Standard is optimized for fast everyday work, Pro adds stronger reasoning and terminology verification, and Ultra adds maximum reasoning plus a full terminology and consistency audit."],
  ["What is the difference between Pro and Pro Max?", "Pro Max includes 750,000 words per month, higher image, dictation, transcription, voice, and web lookup allowances, and High Reasoning for LingoFusion Pro."],
  ["Can I switch between plan options?", "Plan switching is handled by account billing when checkout integration is connected."],
  ["Can I buy extra usage without upgrading?", "Yes. Additional usage can be purchased separately and paid from a prepaid balance when that billing flow is connected."],
  ["Does purchased additional usage expire?", "No. Purchased additional usage does not expire. Included monthly usage is consumed first."],
  ["Can teams mix different subscription levels?", "Yes. A team can mix Pro and Ultra seat types, with a minimum of two total members."],
  ["Is API usage included in these subscriptions?", "No. Consumer subscription allowances and LingoFusion API usage are separate. API usage uses prepaid API credit and token-based pricing."],
] as const;
