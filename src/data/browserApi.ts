import { dubbingModels, musicModels, resolveImageModel, textModelsByPricingMode } from "./pricing";
import type { TextPricingMode } from "./pricing";
import { buildImageTranslationInstruction, buildModelSystemPrompt } from "./systemPrompts";
import { getCurrentUser } from "./auth";

export type ModelPricingRecord = {
  id: string;
  model_id: string;
  object?: string;
  provider: string;
  upstream_model_name: string;
  input_per_million: number;
  output_per_million: number;
  is_active: boolean;
};

export type UsageLedgerRecord = {
  id: string;
  user_id: string;
  api_key_id: string | null;
  model_id: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  source: "playground" | "api";
  created_at: string;
};

export type DepositLedgerRecord = {
  id: string;
  user_id: string;
  stripe_session_id: string;
  net_deposited_usd: number;
  gross_charged_usd: number;
  status: string;
  created_at: string;
};

type BrowserProject = {
  id: string;
  name: string;
  description: string;
  status: string;
  budgetMicroCents: number;
  createdAt: string;
};

type BrowserApiKey = {
  id: string;
  name: string;
  projectId: string;
  masked: string;
  key_prefix?: string;
  scopes: string[];
  createdAt: string;
  expiresAt: string | null;
  spendLimitMicroCents: number;
  status: string;
  is_active?: boolean;
};

type BrowserRequestLog = {
  id: string;
  timestamp: string;
  projectId: string;
  keyId: string;
  endpoint: string;
  model: string;
  feature: string;
  status: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens?: number;
  words: number;
  cost: number;
  latencyMs: number;
  errorCode: string;
  streaming: boolean;
};

type BrowserLedgerEntry = {
  id: string;
  type: string;
  amount: number;
  description: string;
  status: string;
  createdAt: string;
};

type BrowserDashboard = {
  user?: {
    id: string;
    email: string;
    balance_usd: number;
    created_at: string;
  };
  modelPricing?: ModelPricingRecord[];
  usageLedger?: UsageLedgerRecord[];
  depositLedger?: DepositLedgerRecord[];
  account: {
    paidBalance: number;
    rewardBalance: number;
    pendingCharges: number;
    lifetimeSpend: number;
    totalPaidCreditPurchased: number;
    totalRewardCreditEarned: number;
  };
  autoRecharge: {
    enabled: boolean;
    threshold: number;
    amount: number;
    monthlyLimit: number;
    notify: boolean;
    paymentMethod: string;
  };
  projects: BrowserProject[];
  apiKeys: BrowserApiKey[];
  ledger: BrowserLedgerEntry[];
  requestLogs: BrowserRequestLog[];
  usage: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    inputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    totalTokens: number;
    words: number;
    streamingRequests: number;
    nonStreamingRequests: number;
    totalSpend: number;
    averageLatencyMs: number;
  };
  models: Array<{ model: string; input: number; output: number }>;
};

type BrowserState = {
  dashboard: BrowserDashboard;
  secrets: Record<string, string>;
};

const storageKey = "lingofusion-browser-api-v3";

export const defaultBrowserModelPricing: ModelPricingRecord[] = [
  { id: "LingoFusion Nano", model_id: "LingoFusion Nano", object: "model", provider: "lingofusion", upstream_model_name: "gpt-5-nano", input_per_million: 0.08, output_per_million: 0.60, is_active: true },
  { id: "LingoFusion Lite", model_id: "LingoFusion Lite", object: "model", provider: "lingofusion", upstream_model_name: "gpt-5.6-luna", input_per_million: 0.5, output_per_million: 2.0, is_active: true },
  { id: "LingoFusion", model_id: "LingoFusion", object: "model", provider: "lingofusion", upstream_model_name: "gpt-6-luna", input_per_million: 1.0, output_per_million: 5.0, is_active: true },
  { id: "LingoFusion Pro", model_id: "LingoFusion Pro", object: "model", provider: "lingofusion", upstream_model_name: "gpt-6-sol", input_per_million: 3.5, output_per_million: 20.0, is_active: true },
  { id: "ExplainFusion", model_id: "ExplainFusion", object: "model", provider: "lingofusion", upstream_model_name: "gpt-6-luna", input_per_million: 2.0, output_per_million: 0.5, is_active: true },
  { id: "LingoFusion Ultra", model_id: "LingoFusion Ultra", object: "model", provider: "lingofusion", upstream_model_name: "gpt-6-astra", input_per_million: 20.0, output_per_million: 120.0, is_active: true },
];

export function getWebSearchCallRateUsd(modelName: string): number {
  const name = String(modelName || "LingoFusion").trim();
  if (name === "LingoFusion Pro") return 0.04;
  if (name === "LingoFusion Ultra") return 0.15;
  return 0.015;
}

export function resolveBackendModelRouting(
  modelName: string,
  options?: {
    reasoning?: boolean | string;
    reasoning_enabled?: boolean;
    reasoning_effort?: string;
    max?: boolean;
    max_reasoning?: boolean;
    allow_web_search?: boolean;
    web_search?: boolean;
  },
) {
  const name = String(modelName || "LingoFusion").trim();
  const webSearchEnabled = Boolean(options?.allow_web_search || options?.web_search);
  const reasoningEnabled = Boolean(
    options?.reasoning ||
      options?.reasoning_enabled ||
      options?.reasoning_effort === "medium" ||
      options?.reasoning === "medium",
  );
  const maxEnabled = Boolean(
    options?.max ||
      options?.max_reasoning ||
      String(options?.reasoning_effort || "").toLowerCase() === "max",
  );

  if (webSearchEnabled) {
    return {
      upstreamModel: "gpt-5-search-api",
      displayModel: "GPT-5 Search API",
      reasoning: undefined,
      reasoningEffort: undefined,
      webSearch: true,
      webSearchCallFeeUsd: getWebSearchCallRateUsd(name),
    };
  }

  if (name === "LingoFusion Nano") {
    return {
      upstreamModel: "gpt-5-nano",
      displayModel: "GPT-5 nano",
      reasoning: "none" as const,
      reasoningEffort: "minimal" as const,
      webSearch: false,
      webSearchCallFeeUsd: 0,
    };
  }
  if (name === "LingoFusion Lite") {
    return {
      upstreamModel: "gpt-5.6-luna",
      displayModel: "GPT-5.6 Luna",
      reasoning: "none" as const,
      reasoningEffort: "none" as const,
      webSearch: false,
      webSearchCallFeeUsd: 0,
    };
  }
  if (name === "LingoFusion") {
    return {
      upstreamModel: "gpt-6-luna",
      displayModel: "GPT-6 Luna",
      reasoning: "none" as const,
      reasoningEffort: "none" as const,
      webSearch: false,
      webSearchCallFeeUsd: 0,
    };
  }
  if (name === "ExplainFusion" || name === "LingoFusion Explain") {
    return {
      upstreamModel: "gpt-6-luna",
      displayModel: "GPT-6 Luna",
      reasoning: "low" as const,
      reasoningEffort: "low" as const,
      webSearch: false,
      webSearchCallFeeUsd: 0,
    };
  }
  if (name === "LingoFusion Pro") {
    if (reasoningEnabled) {
      return {
        upstreamModel: "gpt-6.1-sol",
        displayModel: "GPT-6.1 Sol",
        reasoning: "medium" as const,
        reasoningEffort: "medium" as const,
        webSearch: false,
        webSearchCallFeeUsd: 0,
      };
    }
    return {
      upstreamModel: "gpt-6-sol",
      displayModel: "GPT-6 Sol",
      reasoning: undefined,
      reasoningEffort: undefined,
      webSearch: false,
      webSearchCallFeeUsd: 0,
    };
  }
  if (name === "LingoFusion Ultra") {
    return {
      upstreamModel: "gpt-6-astra",
      displayModel: "GPT-6 Astra",
      reasoning: "pro" as const,
      reasoningEffort: (maxEnabled ? "max" : "high") as "high" | "max",
      webSearch: false,
      webSearchCallFeeUsd: 0,
    };
  }
  return {
    upstreamModel: "gpt-6-luna",
    displayModel: "GPT-6 Luna",
    reasoning: undefined,
    reasoningEffort: undefined,
    webSearch: false,
    webSearchCallFeeUsd: 0,
  };
}

export function calculateGrossDeposit(depositAmountUsd: number) {
  const net = Number(depositAmountUsd);
  const grossDollars = (net + 0.30) / (1 - 0.029);
  const grossAmountCents = Math.ceil(grossDollars * 100);
  const grossChargedUsd = Number((grossAmountCents / 100).toFixed(2));
  const estimatedStripeFeeUsd = Number((grossChargedUsd - net).toFixed(2));
  return {
    netDepositedUsd: Number(net.toFixed(2)),
    grossAmountCents,
    grossChargedUsd,
    estimatedStripeFeeUsd,
  };
}

export function calculateTokenCost(promptTokens: number, completionTokens: number, inputPerMillion: number, outputPerMillion: number) {
  const cost = (promptTokens * (inputPerMillion / 1_000_000)) + (completionTokens * (outputPerMillion / 1_000_000));
  return Number(cost.toFixed(6));
}

function emptyUsage(): BrowserDashboard["usage"] {
  return {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
    words: 0,
    streamingRequests: 0,
    nonStreamingRequests: 0,
    totalSpend: 0,
    averageLatencyMs: 0,
  };
}

function createInitialState(): BrowserState {
  return {
    dashboard: {
      user: {
        id: "00000000-0000-4000-8000-000000000001",
        email: "developer@lingofusion.dev",
        balance_usd: 0.0,
        created_at: new Date().toISOString(),
      },
      modelPricing: defaultBrowserModelPricing,
      usageLedger: [],
      depositLedger: [],
      account: {
        paidBalance: 0.0,
        rewardBalance: 0,
        pendingCharges: 0,
        lifetimeSpend: 0,
        totalPaidCreditPurchased: 0.0,
        totalRewardCreditEarned: 0,
      },
      autoRecharge: {
        enabled: false,
        threshold: 10,
        amount: 50,
        monthlyLimit: 250,
        notify: true,
        paymentMethod: "Stripe Checkout",
      },
      projects: [
        {
          id: "proj_default",
          name: "Default Project",
          description: "Prepaid LLM Proxy & Playground workspace",
          status: "active",
          budgetMicroCents: 500 * 100_000_000,
          createdAt: new Date().toISOString(),
        },
      ],
      apiKeys: [],
      ledger: [],
      requestLogs: [],
      usage: emptyUsage(),
      models: textModelsByPricingMode.instant.map((model) => ({
        model: model.model,
        input: model.inputUsd,
        output: model.outputUsd,
      })),
    },
    secrets: {},
  };
}

function getUserStorageKey(userId: string) {
  if (!userId || userId === "00000000-0000-4000-8000-000000000001") {
    return storageKey;
  }
  return `lingofusion-browser-api-user-${userId}`;
}

function loadState(targetUserId?: string): BrowserState {
  const currentUser = getCurrentUser();
  const userId = targetUserId || currentUser.id;
  const key = getUserStorageKey(userId);
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) {
      const initial = createInitialState();
      initial.dashboard.user = {
        id: userId,
        email: targetUserId ? (targetUserId === currentUser.id ? currentUser.email : "user@lingofusion.dev") : currentUser.email,
        balance_usd: 0.0,
        created_at: currentUser.createdAt || new Date().toISOString(),
      };
      return initial;
    }
    const parsed = JSON.parse(stored) as BrowserState;
    parsed.dashboard.modelPricing = defaultBrowserModelPricing;
    parsed.dashboard.models = textModelsByPricingMode.instant.map((model) => ({
      model: model.model,
      input: model.inputUsd,
      output: model.outputUsd,
    }));
    if (!parsed.dashboard.usageLedger) parsed.dashboard.usageLedger = [];
    if (!parsed.dashboard.depositLedger) parsed.dashboard.depositLedger = [];
    if (!parsed.dashboard.user || parsed.dashboard.user.id !== userId) {
      parsed.dashboard.user = {
        id: userId,
        email: currentUser.email,
        balance_usd: parsed.dashboard.account?.paidBalance ?? 0,
        created_at: currentUser.createdAt || new Date().toISOString(),
      };
    }
    return parsed;
  } catch {
    return createInitialState();
  }
}

function saveState(state: BrowserState, targetUserId?: string) {
  const userId = targetUserId || state.dashboard.user?.id || getCurrentUser().id;
  const key = getUserStorageKey(userId);
  window.localStorage.setItem(key, JSON.stringify(state));
}

function randomId(prefix: string) {
  const random = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${random.replace(/-/g, "").slice(0, 16)}`;
}

function createSecret() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return `sk_live_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function maskSecret(secret: string) {
  return `${secret.slice(0, 11)}••••••••${secret.slice(-4).toUpperCase()}`;
}

function requestBody(options?: RequestInit) {
  if (!options?.body || typeof options.body !== "string") return {};
  return JSON.parse(options.body) as Record<string, unknown>;
}

function requestSecret(options?: RequestInit) {
  return new Headers(options?.headers).get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
}

function recalculateUsage(dashboard: BrowserDashboard) {
  const usage = dashboard.requestLogs.reduce((total, log) => {
    total.totalRequests += 1;
    total.successfulRequests += log.status < 400 ? 1 : 0;
    total.failedRequests += log.status >= 400 ? 1 : 0;
    total.inputTokens += log.inputTokens;
    total.outputTokens += log.outputTokens;
    total.reasoningTokens += log.reasoningTokens || 0;
    total.words += log.words;
    total.streamingRequests += log.streaming ? 1 : 0;
    total.nonStreamingRequests += log.streaming ? 0 : 1;
    total.totalSpend += log.cost;
    total.averageLatencyMs += log.latencyMs;
    return total;
  }, emptyUsage());
  usage.totalTokens = dashboard.requestLogs.reduce((total, log) => total + (log.totalTokens ?? log.inputTokens + log.outputTokens), 0);
  usage.averageLatencyMs = usage.totalRequests ? Math.round(usage.averageLatencyMs / usage.totalRequests) : 0;
  dashboard.usage = usage;
}

function fail(message: string): never {
  throw new Error(message);
}

function authorize(state: BrowserState, options?: RequestInit) {
  const secret = requestSecret(options);
  if (!secret) fail("missing_api_key");
  const keyId = Object.keys(state.secrets).find((id) => state.secrets[id] === secret);
  const key = state.dashboard.apiKeys.find((candidate) => candidate.id === keyId && candidate.status === "active");
  if (!key) fail("invalid_api_key");
  const project = state.dashboard.projects.find((candidate) => candidate.id === key.projectId && candidate.status === "active") || state.dashboard.projects[0];
  if (!project) fail("project_not_active");
  return { key, project };
}

function tokenEstimate(text: unknown) {
  return Math.max(1, Math.ceil(String(text ?? "").length / 4));
}

function translatePhrase(input: string, fromLanguage: string, toLanguage: string, modelId = "LingoFusion") {
  const normalizedInput = input.trim().toLowerCase().replace(/\s+/g, " ");
  const key = `${fromLanguage.toLowerCase()}:${toLanguage.toLowerCase()}:${normalizedInput}`;
  const phrases: Record<string, string> = {
    "english:french:hello": "Bonjour",
    "english:french:hello, how are you?": "Bonjour, comment allez-vous ?",
    "english:french:how are you?": "Comment allez-vous ?",
    "english:french:good morning": "Bonjour",
    "english:french:thank you": "Merci",
    "english:french:thank you very much": "Merci beaucoup",
    "english:french:welcome": "Bienvenue",
    "english:french:yes": "Oui",
    "english:french:no": "Non",
    "english:french:goodbye": "Au revoir",
    "english:french:i love this": "J’adore ça.",
    "english:spanish:hello": "Hola",
    "english:spanish:hello, how are you?": "Hola, ¿cómo estás?",
    "english:spanish:how are you?": "¿Cómo estás?",
    "english:spanish:good morning": "Buenos días",
    "english:spanish:thank you": "Gracias",
    "english:spanish:yes": "Sí",
    "english:spanish:no": "No",
    "english:spanish:goodbye": "Adiós",
    "english:german:hello": "Hallo",
    "english:german:hello, how are you?": "Hallo, wie geht es dir?",
    "english:german:how are you?": "Wie geht es dir?",
    "english:german:good morning": "Guten Morgen",
    "english:german:thank you": "Danke",
    "english:german:yes": "Ja",
    "english:german:no": "Nein",
    "english:german:goodbye": "Auf Wiedersehen",
  };

  if (phrases[key]) {
    if (modelId === "ExplainFusion" || modelId === "LingoFusion Explain") {
      return `${phrases[key]}\n\n— Literal & Contextual Note (${fromLanguage} → ${toLanguage}): Natural idiomatic rendering produced by ${modelId}.`;
    }
    return phrases[key];
  }

  const targetLower = toLanguage.toLowerCase();
  const dictionaryMap: Record<string, string> = {
    french: `Traduction (${modelId}) : « ${input.trim()} »`,
    spanish: `Traducción (${modelId}): "${input.trim()}"`,
    german: `Übersetzung (${modelId}): „${input.trim()}“`,
    italian: `Traduzione (${modelId}): "${input.trim()}"`,
    portuguese: `Tradução (${modelId}): "${input.trim()}"`,
    japanese: `翻訳 (${modelId}): 「${input.trim()}」`,
    chinese: `翻译 (${modelId})：“${input.trim()}”`,
  };
  return dictionaryMap[targetLower] ?? `[${toLanguage} — ${modelId}] ${input.trim()}`;
}

// In-memory cache for network whitelisting status (e.g. user's home Wi-Fi)
let isNetworkWhitelistedCache: boolean | null = null;
let networkWhitelistedCheckPromise: Promise<boolean> | null = null;

export async function checkNetworkWhitelisted(): Promise<boolean> {
  if (isNetworkWhitelistedCache !== null) {
    return isNetworkWhitelistedCache;
  }
  if (networkWhitelistedCheckPromise) {
    return networkWhitelistedCheckPromise;
  }
  networkWhitelistedCheckPromise = (async () => {
    try {
      const res = await fetch(`${DEFAULT_EDGE_GATEWAY_URL}/api/network-status`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        isNetworkWhitelistedCache = Boolean(data.is_free_access || data.is_whitelisted);
        return isNetworkWhitelistedCache;
      }
    } catch {
      // Offline or network error
    }
    isNetworkWhitelistedCache = false;
    return false;
  })();
  return networkWhitelistedCheckPromise;
}

export function isCurrentNetworkWhitelistedSync(): boolean {
  return Boolean(isNetworkWhitelistedCache);
}

function applyCharge(state: BrowserState, cost: number) {
  // If the user's device is connected via their whitelisted home Wi-Fi network,
  // all usage is completely free of charge and does not require or deduct balance.
  if (isCurrentNetworkWhitelistedSync()) {
    return;
  }
  const account = state.dashboard.account;
  if (account.paidBalance + account.rewardBalance < cost || account.paidBalance + account.rewardBalance <= 0) {
    fail("Insufficient balance. Please deposit credits.");
  }
  const rewardCharge = Math.min(account.rewardBalance, cost);
  const paidCharge = cost - rewardCharge;
  account.rewardBalance = Number((account.rewardBalance - rewardCharge).toFixed(6));
  account.paidBalance = Number((account.paidBalance - paidCharge).toFixed(6));
  account.lifetimeSpend = Number((account.lifetimeSpend + paidCharge).toFixed(6));
  if (state.dashboard.user) {
    state.dashboard.user.balance_usd = account.paidBalance;
  }
  syncCloudBalanceUpdate(account.paidBalance, -paidCharge);

  // Check Auto Top-Up trigger when balance drops to or below threshold
  const auto = state.dashboard.autoRecharge;
  if (
    auto?.enabled &&
    Number.isFinite(auto.threshold) &&
    auto.threshold >= 1 &&
    auto.threshold <= 999 &&
    Number.isFinite(auto.amount) &&
    auto.amount >= 1 &&
    auto.amount <= 50000 &&
    auto.amount > auto.threshold &&
    account.paidBalance <= auto.threshold
  ) {
    const neededUsd = Number((auto.amount - account.paidBalance).toFixed(2));
    if (neededUsd > 0) {
      const { grossChargedUsd } = calculateGrossDeposit(neededUsd);
      account.paidBalance = Number((account.paidBalance + neededUsd).toFixed(6));
      account.totalPaidCreditPurchased = Number(
        (account.totalPaidCreditPurchased + neededUsd).toFixed(6),
      );
      if (state.dashboard.user) {
        state.dashboard.user.balance_usd = account.paidBalance;
      }
      const now = new Date().toISOString();
      const autoSessionId = randomId("cs_auto");
      state.dashboard.depositLedger?.unshift({
        id: randomId("dep"),
        user_id: state.dashboard.user?.id || "00000000-0000-4000-8000-000000000001",
        stripe_session_id: autoSessionId,
        net_deposited_usd: neededUsd,
        gross_charged_usd: grossChargedUsd,
        status: "auto_top_up",
        created_at: now,
      });
      state.dashboard.ledger.unshift({
        id: randomId("auto"),
        type: "auto_top_up",
        amount: neededUsd,
        description: `Auto Top-Up (+$${neededUsd.toFixed(2)} USD to bring balance to $${auto.amount.toFixed(2)} USD / Gross charged $${grossChargedUsd.toFixed(2)} USD)`,
        status: "completed",
        createdAt: now,
      });
    }
  }
}

function logRequest(state: BrowserState, log: BrowserRequestLog) {
  state.dashboard.requestLogs.unshift(log);
  recalculateUsage(state.dashboard);
}

function createChargeEntry(state: BrowserState, amount: number, description: string) {
  state.dashboard.ledger.unshift({
    id: randomId("ch"),
    type: "api_usage_charge",
    amount: -amount,
    description,
    status: "succeeded",
    createdAt: new Date().toISOString(),
  });
}

export const DEFAULT_EDGE_GATEWAY_URL = String(
  import.meta.env.VITE_LINGOFUSION_GATEWAY_URL ||
    import.meta.env.VITE_LINGOFUSION_API_URL ||
    "https://lingofusion-gateway.lingofusion-api.workers.dev",
).replace(/\/$/, "");

export async function syncCloudBalance(targetEmail?: string, targetUserId?: string): Promise<number | null> {
  const currentUser = getCurrentUser();
  const email = (targetEmail || currentUser.email || "").trim().toLowerCase();
  const userId = targetUserId || currentUser.id;
  if (!email || email === "developer@lingofusion.dev") return null;

  try {
    const res = await fetch(`${DEFAULT_EDGE_GATEWAY_URL}/api/user/balance?email=${encodeURIComponent(email)}&userId=${encodeURIComponent(userId)}`, {
      headers: currentUser.sessionToken ? { Authorization: `Bearer ${currentUser.sessionToken}` } : {},
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.balance_usd === "number") {
      const state = loadState(userId);
      state.dashboard.account.paidBalance = data.balance_usd;
      if (state.dashboard.user) {
        state.dashboard.user.balance_usd = data.balance_usd;
      }
      saveState(state, userId);
      return data.balance_usd;
    }
  } catch {
    // Offline fallback
  }
  return null;
}

export function syncCloudBalanceUpdate(newBalance: number, deltaUsd?: number) {
  const currentUser = getCurrentUser();
  const email = (currentUser.email || "").trim().toLowerCase();
  if (!email || email === "developer@lingofusion.dev") return;
  void fetch(`${DEFAULT_EDGE_GATEWAY_URL}/api/user/balance`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(currentUser.sessionToken ? { Authorization: `Bearer ${currentUser.sessionToken}` } : {}),
    },
    body: JSON.stringify({
      email,
      userId: currentUser.id,
      balance_usd: newBalance,
      delta_usd: deltaUsd,
    }),
  }).catch(() => {});
}

function decodeUpstreamGateway() {
  return {
    endpoint: `${DEFAULT_EDGE_GATEWAY_URL}/api/playground/chat`,
    editsEndpoint: `${DEFAULT_EDGE_GATEWAY_URL}/api/playground/image`,
  };
}

function buildBrowserTranslationPrompt(fromLanguage: string, toLanguage: string, modelId: string, tone?: string) {
  return buildModelSystemPrompt({
    modelName: modelId,
    fromLanguage,
    toLanguage,
    tone,
  });
}

async function runChatCompletionBrowser(state: BrowserState, options?: RequestInit, source: "api" | "playground" = "playground") {
  const started = Date.now();
  let keyId: string | null = null;
  let projectId = state.dashboard.projects[0]?.id || "proj_default";

  if (source === "api") {
    const auth = authorize(state, options);
    keyId = auth.key.id;
    projectId = auth.project.id;
  }

  if (!isCurrentNetworkWhitelistedSync() && (state.dashboard.user?.balance_usd ?? state.dashboard.account.paidBalance) <= 0) {
    fail("Insufficient balance. Please deposit credits.");
  }

  const body = requestBody(options);
  const rawModelId = String(body.model || "LingoFusion");
  const normalizedModelId = rawModelId.toLowerCase() === "lingofusion explain" ? "ExplainFusion" : rawModelId;
  const modelPricing = defaultBrowserModelPricing.find(
    (m) => m.model_id.toLowerCase() === normalizedModelId.toLowerCase()
  ) ?? defaultBrowserModelPricing[2];

  const routing = resolveBackendModelRouting(modelPricing.model_id, {
    reasoning: body.reasoning as boolean | string | undefined,
    reasoning_enabled: Boolean(body.reasoning_enabled),
    reasoning_effort: typeof body.reasoning_effort === "string" ? body.reasoning_effort : undefined,
    max: Boolean(body.max),
    max_reasoning: Boolean(body.max_reasoning),
    allow_web_search: Boolean(body.allow_web_search),
    web_search: Boolean(body.web_search),
  });

  const messages = Array.isArray(body.messages) ? body.messages as Array<{ role: string; content: string }> : [];
  const lastUser = String(messages.filter((m) => m.role === "user").pop()?.content || body.input || "Hello, how are you?").trim();
  const fromLanguage = String(body.from_language || "English");
  const toLanguage = String(body.to_language || "French");

  let promptTokens = tokenEstimate(lastUser);
  let replyText = "";
  let completionTokens = 0;

  // Attempt live behind-the-scenes model call via secure edge gateway
  try {
    const { endpoint } = decodeUpstreamGateway();
    const effort = routing.reasoningEffort === "max" ? "xhigh" : routing.reasoningEffort;
    const pricingMode = String(body.pricing_mode || "default").toLowerCase();
    const isUltrafast = pricingMode === "ultrafast" && ["LingoFusion Pro", "LingoFusion Ultra"].includes(modelPricing.model_id);
    const isFast = pricingMode === "fast" && ["LingoFusion Nano", "LingoFusion Lite", "LingoFusion", "LingoFusion Pro", "LingoFusion Ultra"].includes(modelPricing.model_id);
    const serviceTier = isUltrafast ? "ultrafast" : isFast ? "fast" : undefined;

    const upstreamRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-LingoFusion-Client-Token": "lf_play_secure_649f7",
      },
      body: JSON.stringify({
        model: routing.upstreamModel,
        messages: [
          {
            role: "system",
            content: buildBrowserTranslationPrompt(
              fromLanguage,
              toLanguage,
              modelPricing.model_id,
              body.tone as string | undefined,
            ),
          },
          {
            role: "user",
            content: lastUser,
          },
        ],
        ...(effort ? { reasoning_effort: effort } : {}),
        ...(serviceTier ? { service_tier: serviceTier } : {}),
        stream: false,
      }),
    });

    if (upstreamRes.ok) {
      const upstreamData = await upstreamRes.json();
      const content = String(upstreamData.choices?.[0]?.message?.content || "").trim();
      if (content) {
        replyText = content;
        promptTokens = Number(upstreamData.usage?.prompt_tokens) || promptTokens;
        completionTokens = Number(upstreamData.usage?.completion_tokens) || Math.max(1, tokenEstimate(replyText));
      }
    } else {
      const errorData = (await upstreamRes.json().catch(() => ({}))) as Record<string, any>;
      const upstreamMsg = errorData?.error?.message || `Translation upstream returned HTTP ${upstreamRes.status}`;
      console.error("Translation upstream error:", upstreamRes.status, upstreamMsg);
      throw new Error(upstreamMsg);
    }
  } catch (err) {
    if (err instanceof Error && err.message && !err.message.includes("Failed to fetch")) {
      throw err;
    }
    // Fallback to deterministic local translation if completely offline
  }

  if (!replyText) {
    replyText = translatePhrase(lastUser, fromLanguage, toLanguage, modelPricing.model_id);
    completionTokens = Math.max(1, tokenEstimate(replyText));
  }

  const pricingMode = String(body.pricing_mode || "default").toLowerCase();
  const priceMultiplier = pricingMode === "ultrafast" ? 4 : pricingMode === "fast" ? 1.5 : 1;
  const tokenCostUsd = calculateTokenCost(promptTokens, completionTokens, modelPricing.input_per_million * priceMultiplier, modelPricing.output_per_million * priceMultiplier);
  const costUsd = Number((tokenCostUsd + (routing.webSearchCallFeeUsd || 0)).toFixed(6));

  applyCharge(state, costUsd);
  const requestId = `chatcmpl-${randomId("browser")}`;
  const now = new Date().toISOString();

  state.dashboard.usageLedger?.unshift({
    id: randomId("ulg"),
    user_id: state.dashboard.user?.id || "00000000-0000-4000-8000-000000000001",
    api_key_id: keyId,
    model_id: modelPricing.model_id,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    cost_usd: costUsd,
    source,
    created_at: now,
  });

  createChargeEntry(state, costUsd, `${modelPricing.model_id}${routing.webSearch ? " + Web Search" : ""} (${promptTokens} in / ${completionTokens} out) via ${source}`);
  logRequest(state, {
    id: requestId,
    timestamp: now,
    projectId,
    keyId: keyId || "playground_session",
    endpoint: source === "api" ? "/v1/chat/completions" : "/api/playground/chat",
    model: modelPricing.model_id,
    feature: routing.webSearch ? "Web search translation" : "Chat completions",
    status: 200,
    inputTokens: promptTokens,
    outputTokens: completionTokens,
    reasoningTokens: 0,
    totalTokens: promptTokens + completionTokens,
    words: replyText.split(/\s+/).length,
    cost: costUsd,
    latencyMs: Math.max(20, Date.now() - started),
    errorCode: "",
    streaming: Boolean(body.stream),
  });

  return {
    id: requestId,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: modelPricing.model_id,
    provider: modelPricing.provider,
    upstream_model: routing.upstreamModel,
    upstream_display_model: routing.displayModel,
    allow_web_search: routing.webSearch,
    ...(routing.reasoning ? { reasoning: routing.reasoning } : {}),
    ...(routing.reasoningEffort ? { reasoning_effort: routing.reasoningEffort } : {}),
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: replyText,
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
      cost_usd: costUsd,
      balance_usd: state.dashboard.user?.balance_usd ?? state.dashboard.account.paidBalance,
    },
  };
}

export function recordBrowserStreamUsage({
  modelId,
  promptTokens,
  completionTokens,
  costUsd,
  source = "playground",
}: {
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  source?: "api" | "playground";
}): number {
  const state = loadState();
  applyCharge(state, costUsd);
  const now = new Date().toISOString();
  state.dashboard.usageLedger?.unshift({
    id: randomId("ulg"),
    user_id: state.dashboard.user?.id || "00000000-0000-4000-8000-000000000001",
    api_key_id: null,
    model_id: modelId,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    cost_usd: costUsd,
    source,
    created_at: now,
  });
  createChargeEntry(
    state,
    costUsd,
    `${modelId} (${promptTokens} in / ${completionTokens} out) via ${source}`,
  );
  logRequest(state, {
    id: `chatcmpl-${randomId("browser")}`,
    timestamp: now,
    projectId: state.dashboard.projects[0]?.id || "proj_default",
    keyId: "playground_session",
    endpoint: source === "api" ? "/v1/chat/completions" : "/api/playground/chat",
    model: modelId,
    feature: "Chat completions (streaming)",
    status: 200,
    inputTokens: promptTokens,
    outputTokens: completionTokens,
    reasoningTokens: 0,
    totalTokens: promptTokens + completionTokens,
    words: 0,
    cost: costUsd,
    latencyMs: 120,
    errorCode: "",
    streaming: true,
  });
  saveState(state);
  return state.dashboard.user?.balance_usd ?? state.dashboard.account.paidBalance;
}

export function recordBrowserMusicUsage({
  modelId,
  costUsd = 0.10,
  durationSeconds = 60,
  prompt = "",
  source = "playground",
}: {
  modelId: string;
  costUsd?: number;
  durationSeconds?: number;
  prompt?: string;
  source?: "api" | "playground";
}): number {
  const state = loadState();
  applyCharge(state, costUsd);
  const now = new Date().toISOString();
  state.dashboard.usageLedger?.unshift({
    id: randomId("ulg"),
    user_id: state.dashboard.user?.id || "00000000-0000-4000-8000-000000000001",
    api_key_id: null,
    model_id: modelId,
    prompt_tokens: 0,
    completion_tokens: 0,
    cost_usd: costUsd,
    source,
    created_at: now,
  });
  createChargeEntry(
    state,
    costUsd,
    `${modelId} (${durationSeconds}s) via ${source}`,
  );
  logRequest(state, {
    id: `music-${randomId("browser")}`,
    timestamp: now,
    projectId: state.dashboard.projects[0]?.id || "proj_default",
    keyId: "playground_session",
    endpoint: source === "api" ? "/v1/music" : "/api/playground/music",
    model: modelId,
    feature: "Music generation",
    status: 200,
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
    words: prompt.split(/\s+/).length,
    cost: costUsd,
    latencyMs: 120,
    errorCode: "",
    streaming: false,
  });
  saveState(state);
  return state.dashboard.user?.balance_usd ?? state.dashboard.account.paidBalance;
}

export async function streamChatCompletionBrowser(
  body: Record<string, any>,
  signal?: AbortSignal,
): Promise<Response> {
  const state = loadState();
  if (!isCurrentNetworkWhitelistedSync() && (state.dashboard.user?.balance_usd ?? state.dashboard.account.paidBalance) <= 0) {
    fail("Insufficient balance. Please deposit credits.");
  }

  const rawModelId = String(body.model || "LingoFusion");
  const normalizedModelId =
    rawModelId.toLowerCase() === "lingofusion explain" ? "ExplainFusion" : rawModelId;
  const modelPricing =
    defaultBrowserModelPricing.find(
      (m) => m.model_id.toLowerCase() === normalizedModelId.toLowerCase(),
    ) ?? defaultBrowserModelPricing[2];

  const routing = resolveBackendModelRouting(modelPricing.model_id, {
    reasoning: body.reasoning as boolean | string | undefined,
    reasoning_enabled: Boolean(body.reasoning_enabled),
    reasoning_effort: typeof body.reasoning_effort === "string" ? body.reasoning_effort : undefined,
    max: Boolean(body.max),
    max_reasoning: Boolean(body.max_reasoning),
    allow_web_search: Boolean(body.allow_web_search),
    web_search: Boolean(body.web_search),
  });

  const messages = Array.isArray(body.messages)
    ? (body.messages as Array<{ role: string; content: string }>)
    : [];
  const lastUser = String(
    messages.filter((m) => m.role === "user").pop()?.content ||
      body.input ||
      "Hello, how are you?",
  ).trim();
  const fromLanguage = String(body.from_language || "English");
  const toLanguage = String(body.to_language || "French");

  const { endpoint } = decodeUpstreamGateway();
  const effort = routing.reasoningEffort === "max" ? "xhigh" : routing.reasoningEffort;
  const pricingMode = String(body.pricing_mode || "default").toLowerCase();
  const isUltrafast = pricingMode === "ultrafast" && ["LingoFusion Pro", "LingoFusion Ultra"].includes(modelPricing.model_id);
  const isFast = pricingMode === "fast" && ["LingoFusion Nano", "LingoFusion Lite", "LingoFusion", "LingoFusion Pro", "LingoFusion Ultra"].includes(modelPricing.model_id);
  const serviceTier = isUltrafast ? "ultrafast" : isFast ? "fast" : undefined;

  const upstreamRes = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-LingoFusion-Client-Token": "lf_play_secure_649f7",
    },
    body: JSON.stringify({
      model: routing.upstreamModel,
      messages: [
        {
          role: "system",
          content: buildBrowserTranslationPrompt(
            fromLanguage,
            toLanguage,
            modelPricing.model_id,
            body.tone as string | undefined,
          ),
        },
        {
          role: "user",
          content: lastUser,
        },
      ],
      stream: true,
      stream_options: { include_usage: true },
      ...(effort ? { reasoning_effort: effort } : {}),
      ...(serviceTier ? { service_tier: serviceTier } : {}),
    }),
    signal,
  });

  if (!upstreamRes.ok) {
    const errorData = (await upstreamRes.json().catch(() => ({}))) as Record<string, any>;
    const upstreamMsg =
      errorData?.error?.message || `Translation upstream returned HTTP ${upstreamRes.status}`;
    throw new Error(upstreamMsg);
  }

  return upstreamRes;
}

async function runImageTranslationBrowser(
  state: BrowserState,
  options?: RequestInit,
  source: "api" | "playground" = "playground",
) {
  const started = Date.now();
  if (!isCurrentNetworkWhitelistedSync() && (state.dashboard.user?.balance_usd ?? state.dashboard.account.paidBalance) <= 0) {
    fail("Insufficient balance. Please deposit credits.");
  }

  const body = requestBody(options);
  const model = resolveImageModel(String(body.model || ""), String(body.resolution || ""));
  const fromLanguage = String(body.from_language || "English") || "English";
  const toLanguage = String(body.to_language || "French") || "French";

  const inlineImage = typeof body.image === "string" ? body.image : "";
  const imageUrl = typeof body.image_url === "string" ? body.image_url : "";

  let blob: Blob | null = null;
  try {
    if (inlineImage.startsWith("data:")) {
      blob = await (await fetch(inlineImage)).blob();
    } else if (/^https?:\/\//i.test(imageUrl)) {
      blob = await (await fetch(imageUrl)).blob();
    } else if (/^https?:\/\//i.test(inlineImage)) {
      blob = await (await fetch(inlineImage)).blob();
    }
  } catch {
    blob = null;
  }
  if (!blob) fail("Could not read the supplied image.");

  const { editsEndpoint } = decodeUpstreamGateway();
  const prompt = buildImageTranslationInstruction({ fromLanguage, toLanguage });
  const size = model.resolution === "4k" ? "3840x2160" : "1024x1024";
  const quality = model.quality || (model.resolution === "4k" ? "max" : "high");

  const form = new FormData();
  form.append("model", model.upstreamModel);
  form.append("prompt", prompt);
  form.append("size", size);
  form.append("quality", quality);
  form.append("n", "1");
  form.append("image", blob, "source.png");

  const upstreamRes = await fetch(editsEndpoint, {
    method: "POST",
    headers: {
      "X-LingoFusion-Client-Token": "lf_play_secure_649f7",
    },
    body: form,
  });

  if (!upstreamRes.ok) {
    const errorData = (await upstreamRes.json().catch(() => ({}))) as Record<string, any>;
    throw new Error(
      errorData?.error?.message || `Image upstream returned HTTP ${upstreamRes.status}`,
    );
  }

  const payload = (await upstreamRes.json()) as Record<string, any>;
  const first = Array.isArray(payload?.data) ? payload.data[0] : null;
  const imageResult = first?.b64_json
    ? `data:image/png;base64,${first.b64_json}`
    : String(first?.url || "");
  if (!imageResult) fail("The image provider returned no image.");

  const usage = payload?.usage && typeof payload.usage === "object" ? payload.usage : {};
  const promptTokens =
    Number(usage.input_tokens) || Number(usage.prompt_tokens) || tokenEstimate(prompt);
  const completionTokens = Number(usage.output_tokens) || Number(usage.completion_tokens) || 0;
  const costUsd = calculateTokenCost(
    promptTokens,
    completionTokens,
    model.inputUsd,
    model.outputUsd,
  );

  applyCharge(state, costUsd);
  const requestId = `img-${randomId("browser")}`;
  const now = new Date().toISOString();

  state.dashboard.usageLedger?.unshift({
    id: randomId("ulg"),
    user_id: state.dashboard.user?.id || "00000000-0000-4000-8000-000000000001",
    api_key_id: null,
    model_id: model.label,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    cost_usd: costUsd,
    source,
    created_at: now,
  });
  createChargeEntry(
    state,
    costUsd,
    `${model.label} image translation (${promptTokens} in / ${completionTokens} out) via ${source}`,
  );
  logRequest(state, {
    id: requestId,
    timestamp: now,
    projectId: state.dashboard.projects[0]?.id || "proj_default",
    keyId: "playground_session",
    endpoint: "/api/playground/image",
    model: model.label,
    feature: "Image translation",
    status: 200,
    inputTokens: promptTokens,
    outputTokens: completionTokens,
    reasoningTokens: 0,
    totalTokens: promptTokens + completionTokens,
    words: 0,
    cost: costUsd,
    latencyMs: Math.max(20, Date.now() - started),
    errorCode: "",
    streaming: false,
  });

  return {
    id: requestId,
    object: "image.translation",
    model: model.model,
    label: model.label,
    resolution: model.resolution,
    provider: "lingofusion",
    upstream_model: model.upstreamModel,
    from_language: fromLanguage,
    to_language: toLanguage,
    image: imageResult,
    image_mime_type: first?.b64_json ? "image/png" : undefined,
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
      cost_usd: costUsd,
      balance_usd: state.dashboard.user?.balance_usd ?? state.dashboard.account.paidBalance,
    },
  };
}

function runTranslation(state: BrowserState, options?: RequestInit) {
  const started = Date.now();
  const { key, project } = authorize(state, options);
  if (!key.scopes.includes("Text translation")) fail("missing_scope");
  const body = requestBody(options);
  const pricingMode: TextPricingMode = body.pricing_mode === "ultrafast" ? "ultrafast" : body.pricing_mode === "fast" ? "fast" : body.pricing_mode === "batch" ? "batch" : "instant";
  const model = textModelsByPricingMode[pricingMode].find((candidate) => candidate.model === body.model);
  if (!model) fail("unsupported_model");
  const input = String(body.input ?? "").trim();
  const fromLanguage = String(body.from_language ?? "").trim();
  const toLanguage = String(body.to_language ?? "").trim();
  if (!input || !fromLanguage || !toLanguage) fail("invalid_request");

  const outputText = translatePhrase(input, fromLanguage, toLanguage);
  const inputTokens = tokenEstimate(input);
  const outputTokens = tokenEstimate(outputText);
  const cost = Number(((inputTokens / 1_000_000) * model.inputUsd + (outputTokens / 1_000_000) * model.outputUsd).toFixed(6));
  const requestId = randomId("req");
  applyCharge(state, cost);
  createChargeEntry(state, cost, `${model.model}${pricingMode === "batch" ? " Batch" : pricingMode === "fast" ? " Fast" : pricingMode === "ultrafast" ? " Ultrafast" : ""} /v1/translate`);
  logRequest(state, {
    id: requestId,
    timestamp: new Date().toISOString(),
    projectId: project.id,
    keyId: key.id,
    endpoint: "/v1/translate",
    model: model.model,
    feature: "Text translation",
    status: 200,
    inputTokens,
    outputTokens,
    reasoningTokens: 0,
    totalTokens: inputTokens + outputTokens,
    words: input.split(/\s+/).length,
    cost,
    latencyMs: Math.max(18, Date.now() - started),
    errorCode: "",
    streaming: Boolean(body.stream),
  });
  return {
    id: requestId,
    model: model.model,
    pricing_mode: pricingMode === "ultrafast" ? "ultrafast" : pricingMode === "fast" ? "fast" : pricingMode === "batch" ? "batch" : "default",
    output_text: outputText,
    stream: Boolean(body.stream),
    usage: {
      input_tokens: inputTokens,
      source_text_tokens_estimate: inputTokens,
      instruction_tokens_estimate: 0,
      output_tokens: outputTokens,
      reasoning_tokens: 0,
      visible_output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
      cost_usd: cost,
    },
  };
}

async function runSpeechBrowser(state: BrowserState, options?: RequestInit) {
  const started = Date.now();
  const body = requestBody(options);
  const requestedModel = String(body.model || "LingoFusion Voice");
  const input = String(body.input || body.text || "").trim();
  if (!input) fail("Missing required parameter 'input'");

  const voiceGender = String(body.voice || body.gender || "female").toLowerCase();
  const voiceId =
    voiceGender === "male" || body.voice_id === "1SM7GgM6IMuvQlz2BwM3"
      ? "1SM7GgM6IMuvQlz2BwM3"
      : "BZgkqPqms7Kj9ulSkVzn";

  const isFlash = requestedModel.toLowerCase().includes("flash");
  const rate = isFlash ? 0.08 : 0.15;
  const modelName = isFlash ? "LingoFusion Voice Flash" : "LingoFusion Voice";
  const cost = Number(((input.length / 1000) * rate).toFixed(6));

  if (!isCurrentNetworkWhitelistedSync() && (state.dashboard.user?.balance_usd ?? state.dashboard.account.paidBalance) < cost) {
    fail("Insufficient balance. Please deposit credits.");
  }

  const gatewayUrl = DEFAULT_EDGE_GATEWAY_URL;
  if (!gatewayUrl) {
    fail("Voice synthesis requires the private edge gateway (VITE_LINGOFUSION_GATEWAY_URL).");
  }

  let audioUrl = "";
  try {
    const upstreamRes = await fetch(`${gatewayUrl}/api/playground/speech`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-LingoFusion-Client-Token": "lf_play_secure_649f7",
      },
      body: JSON.stringify({
        input,
        model: modelName,
        voice: voiceId,
      }),
    });

    const data = (await upstreamRes.json().catch(() => ({}))) as Record<string, any>;
    if (!upstreamRes.ok || !data.audio_url) {
      throw new Error(data?.message || data?.error || `Voice synthesis failed (HTTP ${upstreamRes.status})`);
    }
    audioUrl = String(data.audio_url);
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }

  applyCharge(state, cost);
  createChargeEntry(state, cost, `${modelName} /v1/audio/speech`);
  const requestId = randomId("req");
  logRequest(state, {
    id: requestId,
    timestamp: new Date().toISOString(),
    projectId: state.dashboard.projects[0]?.id || "proj_default",
    keyId: "playground_session",
    endpoint: "/api/playground/speech",
    model: modelName,
    feature: "Voice synthesis",
    status: 200,
    inputTokens: input.length,
    outputTokens: 0,
    reasoningTokens: 0,
    totalTokens: input.length,
    words: input.split(/\s+/).filter(Boolean).length,
    cost,
    latencyMs: Math.max(80, Date.now() - started),
    errorCode: "",
    streaming: false,
  });

  return {
    id: requestId,
    model: modelName,
    status: "completed",
    audio_url: audioUrl,
    chars: input.length,
    cost_usd: cost,
  };
}

async function runMusic(state: BrowserState, options?: RequestInit) {
  const started = Date.now();
  let keyId = "playground_session";
  let projectId = state.dashboard.projects[0]?.id || "proj_default";

  const secret = requestSecret(options);
  if (secret) {
    const auth = authorize(state, options);
    if (!auth.key.scopes.includes("Music generation")) fail("missing_scope");
    keyId = auth.key.id;
    projectId = auth.project.id;
  }

  const body = requestBody(options);
  const model = musicModels.find((candidate) => candidate.model === body.model) ?? musicModels[0];
  const prompt = String(body.prompt ?? "").trim();
  const durationSeconds = Math.round(Number(body.duration_seconds || 30));
  if (!prompt || !Number.isFinite(durationSeconds) || durationSeconds < 1 || durationSeconds > 3600) fail("invalid_request");

  // Rate: $0.10 per song
  const durationMinutes = durationSeconds / 60;
  const cost = Number((model.priceUsd ?? 0.10).toFixed(4));

  if (!isCurrentNetworkWhitelistedSync() && (state.dashboard.user?.balance_usd ?? state.dashboard.account.paidBalance) < cost) {
    fail("Insufficient balance. Please deposit credits.");
  }

  let audioUrl = "";
  try {
    const upstreamRes = await fetch(`${DEFAULT_EDGE_GATEWAY_URL}/api/playground/music`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-LingoFusion-Client-Token": "lf_play_secure_649f7",
      },
      body: JSON.stringify({
        prompt,
        duration_seconds: durationSeconds,
        force_instrumental: Boolean(body.force_instrumental),
      }),
    });

    let data = (await upstreamRes.json().catch(() => ({}))) as Record<string, any>;
    if (!upstreamRes.ok) {
      throw new Error(data?.message || data?.error || `Music generation failed (HTTP ${upstreamRes.status})`);
    }

    if (data.status === "processing" && (data.id || data.task_id)) {
      const taskId = String(data.id || data.task_id);
      const pollStart = Date.now();
      while (!data.audio_url && Date.now() - pollStart < 360000) {
        await new Promise((r) => setTimeout(r, 2500));
        const pollRes = await fetch(`${DEFAULT_EDGE_GATEWAY_URL}/api/playground/music?id=${encodeURIComponent(taskId)}`, {
          headers: { "X-LingoFusion-Client-Token": "lf_play_secure_649f7" },
        });
        if (pollRes.ok) {
          const pollData = (await pollRes.json().catch(() => ({}))) as Record<string, any>;
          if (pollData.status === "completed" && pollData.audio_url) {
            data = pollData;
            break;
          } else if (pollData.status === "failed") {
            throw new Error(pollData.error || "Music generation failed upstream");
          }
        } else if (pollRes.status >= 400 && pollRes.status !== 404) {
          const errData = (await pollRes.json().catch(() => ({}))) as Record<string, any>;
          throw new Error(errData?.message || errData?.error || `Polling failed (HTTP ${pollRes.status})`);
        }
      }
    }

    if (!data.audio_url) {
      throw new Error(data?.message || data?.error || `Music generation timed out. Please try again.`);
    }
    audioUrl = String(data.audio_url);
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }

  const requestId = randomId("req");
  if (cost > 0) {
    applyCharge(state, cost);
    createChargeEntry(state, cost, `${model.model} /v1/music (${durationSeconds}s)`);
  }
  logRequest(state, {
    id: requestId,
    timestamp: new Date().toISOString(),
    projectId,
    keyId,
    endpoint: "/v1/music",
    model: model.model,
    feature: "Music generation",
    status: 200,
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
    words: prompt.split(/\s+/).length,
    cost,
    latencyMs: Math.max(24, Date.now() - started),
    errorCode: "",
    streaming: false,
  });
  return {
    id: requestId,
    model: model.model,
    upstream_model: "treblo_v3",
    status: "completed",
    output: {
      prompt,
      duration_seconds: durationSeconds,
      audio_url: audioUrl,
    },
    usage: {
      audio_seconds: durationSeconds,
      audio_minutes: durationMinutes,
      cost_usd: cost,
    },
  };
}

async function runDubbingBrowser(state: BrowserState, options?: RequestInit) {
  const started = Date.now();
  let keyId = "playground_session";
  let projectId = state.dashboard.projects[0]?.id || "proj_default";

  const secret = requestSecret(options);
  if (secret) {
    const auth = authorize(state, options);
    keyId = auth.key.id;
    projectId = auth.project.id;
  }

  const body = requestBody(options);
  const model = dubbingModels.find((candidate) => candidate.model === body.model) ?? dubbingModels[0];
  const targetLang = String(body.target_lang || body.target_language || "Spanish").trim();
  const sourceLang = String(body.source_lang || body.source_language || "Auto-detect").trim();
  const durationSeconds = Math.max(15, Math.min(10800, Math.round(Number(body.duration_seconds || 30))));
  const mediaType = String(body.media_type || "video/mp4");
  const fileName = String(body.file_name || (mediaType.startsWith("video") ? "dubbed_video.mp4" : "dubbed_audio.mp3"));
  const fileBase64 = String(body.file_base64 || "");

  const durationMinutes = durationSeconds / 60;
  const cost = Number(((model.priceUsd ?? 3.50) * durationMinutes).toFixed(6));

  if (!isCurrentNetworkWhitelistedSync() && (state.dashboard.user?.balance_usd ?? state.dashboard.account.paidBalance) < cost) {
    fail("Insufficient balance. Please deposit credits.");
  }

  let mediaUrl = "";
  try {
    const upstreamRes = await fetch(`${DEFAULT_EDGE_GATEWAY_URL}/api/playground/dubbing`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-LingoFusion-Client-Token": "lf_play_secure_649f7",
      },
      body: JSON.stringify({
        model: model.model,
        target_lang: targetLang,
        source_lang: sourceLang,
        duration_seconds: durationSeconds,
        media_type: mediaType,
        file_name: fileName,
        file_base64: fileBase64,
      }),
    });

    const data = (await upstreamRes.json().catch(() => ({}))) as Record<string, any>;
    if (upstreamRes.ok && data.media_url) {
      mediaUrl = String(data.media_url);
    }
  } catch (_err) {
    // Fallback if network/gateway unavailable
  }

  if (!mediaUrl) {
    if (fileBase64) {
      mediaUrl = fileBase64.startsWith("data:") ? fileBase64 : `data:${mediaType};base64,${fileBase64}`;
    } else {
      mediaUrl = mediaType.startsWith("video")
        ? "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
        : "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
    }
  }

  const requestId = randomId("req");
  applyCharge(state, cost);
  createChargeEntry(state, cost, `${model.model} /v1/dubbing (${durationSeconds}s, ${targetLang})`);
  logRequest(state, {
    id: requestId,
    timestamp: new Date().toISOString(),
    projectId,
    keyId,
    endpoint: "/v1/dubbing",
    model: model.model,
    feature: "Dubbing",
    status: 200,
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
    words: 0,
    cost,
    latencyMs: Math.max(120, Date.now() - started),
    errorCode: "",
    streaming: false,
  });

  return {
    id: requestId,
    model: model.model,
    upstream_model: "dubbing_v2",
    status: "dubbed",
    media_url: mediaUrl,
    file_name: fileName.startsWith("dubbed-") ? fileName : `dubbed-${targetLang.toLowerCase()}-${fileName}`,
    media_type: mediaType,
    target_lang: targetLang,
    source_lang: sourceLang,
    duration_seconds: durationSeconds,
    cost_usd: cost,
  };
}

export function getApiBaseUrl() {
  const configuredApiUrl = String(import.meta.env.VITE_LINGOFUSION_API_URL || "").replace(/\/$/, "");
  return configuredApiUrl;
}

export function shouldUseBrowserApi() {
  return !getApiBaseUrl()
    && (window.location.hostname.endsWith(".github.io")
      || new URLSearchParams(window.location.search).has("browser-api"));
}

export async function browserApi<T>(path: string, options?: RequestInit): Promise<T> {
  await Promise.resolve();
  const state = loadState();
  const method = options?.method ?? "GET";
  let result: unknown;

  if (method === "GET" && path === "/api/dashboard") {
    result = state.dashboard;
  } else if (method === "GET" && path === "/v1/models") {
    result = {
      object: "list",
      data: state.dashboard.modelPricing ?? defaultBrowserModelPricing,
    };
  } else if (method === "POST" && path === "/api/playground/chat") {
    result = await runChatCompletionBrowser(state, options, "playground");
  } else if (method === "POST" && path === "/api/playground/image") {
    result = await runImageTranslationBrowser(state, options, "playground");
  } else if (method === "POST" && path === "/v1/chat/completions") {
    result = await runChatCompletionBrowser(state, options, "api");
  } else if (method === "POST" && (path === "/api/create-checkout-session" || path === "/api/billing/deposit")) {
    const body = requestBody(options);
    const depositAmount = Number(body.amount ?? body.depositAmount ?? body.topUpAmount);
    if (!Number.isFinite(depositAmount) || depositAmount < 1 || depositAmount > 50000) {
      fail("Top-up amount must be between $1.00 and $50,000.00 USD.");
    }
    const currency = "usd";
    const { netDepositedUsd, grossAmountCents, grossChargedUsd, estimatedStripeFeeUsd } = calculateGrossDeposit(depositAmount);
    const userId = String(body.userId || state.dashboard.user?.id || "00000000-0000-4000-8000-000000000001");
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
    const returnPlaygroundUrl = `${window.location.origin}${basePath}/playground`;

    if (DEFAULT_EDGE_GATEWAY_URL) {
      try {
        const edgeRes = await fetch(`${DEFAULT_EDGE_GATEWAY_URL}/api/create-checkout-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: depositAmount,
            userId,
            userEmail: body.userEmail || state.dashboard.user?.email || getCurrentUser().email,
            currency,
            isGift: body.isGift,
            recipientEmail: body.recipientEmail,
            giftMessage: body.giftMessage,
            senderName: body.senderName,
            returnUrl: body.returnUrl || returnPlaygroundUrl,
          }),
        });
        if (edgeRes.ok) {
          const edgeSession = (await edgeRes.json()) as { id?: string; sessionId?: string; url?: string; checkoutUrl?: string };
          const sessionUrl = edgeSession.url || edgeSession.checkoutUrl;
          if (sessionUrl) {
            result = {
              url: sessionUrl,
              checkoutUrl: sessionUrl,
              sessionId: edgeSession.sessionId || edgeSession.id || randomId("cs_live"),
              currency,
              netDepositUsd: netDepositedUsd,
              grossAmountCents,
              grossChargedUsd,
              estimatedStripeFeeUsd,
              metadata: {
                userId,
                topUpAmount: netDepositedUsd.toString(),
                netDepositUsd: netDepositedUsd.toString(),
                currency,
              },
            };
          }
        }
      } catch {
        // Fallback to local checkout simulator if offline
      }
    }

    if (!result) {
      const sessionId = randomId("cs_test");
      const checkoutUrl = `${basePath}/checkout?stripe_session_id=${sessionId}&net_usd=${netDepositedUsd.toFixed(2)}&gross_cents=${grossAmountCents}&user_id=${encodeURIComponent(userId)}&currency=${encodeURIComponent(currency)}`;
      result = {
        url: checkoutUrl,
        checkoutUrl,
        sessionId,
        currency,
        netDepositUsd: netDepositedUsd,
        grossAmountCents,
        grossChargedUsd,
        estimatedStripeFeeUsd,
        metadata: {
          userId,
          topUpAmount: netDepositedUsd.toString(),
          netDepositUsd: netDepositedUsd.toString(),
          currency,
        },
      };
    }
  } else if (method === "POST" && (path === "/api/stripe-webhook" || path === "/api/webhooks/stripe")) {
    const body = requestBody(options);
    const sessionObj = ((body.data as Record<string, unknown>)?.object as Record<string, unknown>) || {};
    const metadata =
      ((sessionObj.metadata as Record<string, string>) ||
      (sessionObj.subscription_details as Record<string, unknown>)?.metadata as Record<string, string> ||
      ((sessionObj.lines as Record<string, unknown>)?.data as Array<Record<string, unknown>>)?.[0]?.metadata as Record<string, string>) ||
      {};
    const planId = metadata.planId;
    const userId = String(metadata.userId || state.dashboard.user?.id || "00000000-0000-4000-8000-000000000001");

    if (planId) {
      let dubbingMins = Number(metadata.dubbing_mins || 0);
      let voiceCredits = Number(metadata.voice_credits || 25000);
      let textChars = Number(metadata.text_chars || 2200000);
      let transcribeMins = Number(metadata.transcribe_mins || 30);
      let imageCount = Number(metadata.image_count || 50);
      let monthlyPriceUsd = 19.99;
      let yearlyPriceUsd = 204.0;

      if (planId === "pro-max-750k" || planId === "pro-max") {
        monthlyPriceUsd = 39.99;
        yearlyPriceUsd = 408.0;
        voiceCredits = Number(metadata.voice_credits || 75000);
        textChars = Number(metadata.text_chars || 4800000);
        transcribeMins = Number(metadata.transcribe_mins || 75);
        imageCount = Number(metadata.image_count || 150);
      } else if (planId === "ultra-custom") {
        monthlyPriceUsd = Number(metadata.monthly_price_usd || 256.04);
        yearlyPriceUsd = Number(metadata.yearly_price_usd || Math.round(monthlyPriceUsd * 12 * 0.85 * 100) / 100);
        dubbingMins = Number(metadata.dubbing_mins || 30);
        voiceCredits = Number(metadata.voice_credits || 1200000);
        textChars = Number(metadata.text_chars || 5000000);
        transcribeMins = Number(metadata.transcribe_mins || 120);
        imageCount = Number(metadata.image_count || 50);
      }

      const billing = String(metadata.billing || "monthly").toLowerCase();
      const isYearly = billing === "yearly";
      const billedAmountUsd = isYearly ? yearlyPriceUsd : monthlyPriceUsd;

      (state.dashboard as any).workspaceSubscription = {
        id: randomId("sub"),
        planId,
        status: "active",
        billing,
        monthlyPriceUsd,
        yearlyPriceUsd,
        billedAmountUsd,
        dubbingMinsAllocated: dubbingMins,
        dubbingMinsUsed: 0,
        voiceCreditsAllocated: voiceCredits,
        voiceCreditsUsed: 0,
        textCharsAllocated: textChars,
        textCharsUsed: 0,
        transcribeMinsAllocated: transcribeMins,
        transcribeMinsUsed: 0,
        imagesAllocated: imageCount,
        imagesUsed: 0,
        currentPeriodEnd: new Date(Date.now() + (isYearly ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString(),
      };

      result = {
        received: true,
        type: "subscription_provisioned",
        subscription: (state.dashboard as any).workspaceSubscription,
      };
    } else {
      const netDepositUsd = Number(metadata.topUpAmount ?? metadata.netDepositUsd ?? 0);
      const stripeSessionId = String(sessionObj.id || randomId("cs_test"));
      const { grossChargedUsd } = calculateGrossDeposit(netDepositUsd);

      const alreadyProcessed = state.dashboard.depositLedger?.some(
        (entry) => entry.stripe_session_id === stripeSessionId,
      );

      if (alreadyProcessed) {
        result = {
          received: true,
          duplicate: true,
          balance_usd: state.dashboard.account.paidBalance,
          net_deposited_usd: netDepositUsd,
          gross_charged_usd: grossChargedUsd,
        };
      } else {
        state.dashboard.account.paidBalance = Number((state.dashboard.account.paidBalance + netDepositUsd).toFixed(6));
        state.dashboard.account.totalPaidCreditPurchased = Number((state.dashboard.account.totalPaidCreditPurchased + netDepositUsd).toFixed(6));
        if (state.dashboard.user) {
          state.dashboard.user.balance_usd = state.dashboard.account.paidBalance;
        }
        state.dashboard.depositLedger?.unshift({
          id: randomId("dep"),
          user_id: userId,
          stripe_session_id: stripeSessionId,
          net_deposited_usd: netDepositUsd,
          gross_charged_usd: grossChargedUsd,
          status: "completed",
          created_at: new Date().toISOString(),
        });
        state.dashboard.ledger.unshift({
          id: randomId("dep"),
          type: "stripe_deposit",
          amount: netDepositUsd,
          description: `Stripe Deposit (Net $${netDepositUsd.toFixed(2)} / Gross charged $${grossChargedUsd.toFixed(2)})`,
          status: "completed",
          createdAt: new Date().toISOString(),
        });
        result = {
          received: true,
          duplicate: false,
          balance_usd: state.dashboard.account.paidBalance,
          net_deposited_usd: netDepositUsd,
          gross_charged_usd: grossChargedUsd,
        };
      }
    }
  } else if (method === "POST" && path === "/api/verify-checkout-session") {
    const body = requestBody(options);
    const sessionId = String(body.sessionId || body.session_id || "").trim();
    if (sessionId && /^cs_(live|test)_/.test(sessionId) && DEFAULT_EDGE_GATEWAY_URL) {
      try {
        const stripeRes = await fetch(`${DEFAULT_EDGE_GATEWAY_URL}/api/verify-checkout-session`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionId }),
        });
        if (stripeRes.ok) {
          const verifiedData = (await stripeRes.json()) as {
            verified?: boolean;
            sessionId?: string;
            payment_status?: string;
            net_deposited_usd?: number;
            gross_charged_usd?: number;
            balance_usd?: number;
            isGift?: boolean;
            recipientEmail?: string;
            giftCode?: string;
          };
          if (verifiedData.verified && verifiedData.payment_status === "paid") {
            const userId = String(state.dashboard.user?.id || "00000000-0000-4000-8000-000000000001");
            const netDepositUsd = Number(verifiedData.net_deposited_usd ?? 0);
            const grossChargedUsd = Number(
              verifiedData.gross_charged_usd ?? calculateGrossDeposit(netDepositUsd).grossChargedUsd,
            );
            const isGift = Boolean(verifiedData.isGift);

            const alreadyProcessed = state.dashboard.depositLedger?.some(
              (entry) => entry.stripe_session_id === sessionId,
            );

            if (!alreadyProcessed && Number.isFinite(netDepositUsd) && netDepositUsd > 0) {
              if (isGift) {
                // The purchaser does NOT get the credits; they gifted it!
                state.dashboard.ledger.unshift({
                  id: randomId("gft"),
                  type: "stripe_deposit",
                  amount: 0,
                  description: `Gifted +$${netDepositUsd.toFixed(2)} USD in credits to ${verifiedData.recipientEmail || "recipient"}`,
                  status: "completed",
                  createdAt: new Date().toISOString(),
                });
              } else {
                const updatedBalance = typeof verifiedData.balance_usd === "number" && Number.isFinite(verifiedData.balance_usd)
                  ? verifiedData.balance_usd
                  : Number((state.dashboard.account.paidBalance + netDepositUsd).toFixed(6));
                state.dashboard.account.paidBalance = updatedBalance;
                state.dashboard.account.totalPaidCreditPurchased = Number((state.dashboard.account.totalPaidCreditPurchased + netDepositUsd).toFixed(6));
                if (state.dashboard.user) {
                  state.dashboard.user.balance_usd = state.dashboard.account.paidBalance;
                }
                state.dashboard.depositLedger?.unshift({
                  id: randomId("dep"),
                  user_id: userId,
                  stripe_session_id: sessionId,
                  net_deposited_usd: netDepositUsd,
                  gross_charged_usd: grossChargedUsd,
                  status: "completed",
                  created_at: new Date().toISOString(),
                });
                state.dashboard.ledger.unshift({
                  id: randomId("dep"),
                  type: "stripe_deposit",
                  amount: netDepositUsd,
                  description: `Stripe Deposit (Net $${netDepositUsd.toFixed(2)} / Gross charged $${grossChargedUsd.toFixed(2)})`,
                  status: "completed",
                  createdAt: new Date().toISOString(),
                });
              }
            }

            result = {
              verified: true,
              payment_status: verifiedData.payment_status,
              alreadyProcessed: Boolean(alreadyProcessed),
              balance_usd: state.dashboard.account.paidBalance,
              net_deposited_usd: netDepositUsd,
              gross_charged_usd: grossChargedUsd,
              isGift,
              recipientEmail: verifiedData.recipientEmail,
              giftCode: verifiedData.giftCode,
            };
          } else {
            result = {
              verified: false,
              payment_status: verifiedData.payment_status,
              balance_usd: state.dashboard.account.paidBalance,
            };
          }
        }
      } catch {
        // Ignore network error
      }
    }
    if (!result) {
      result = {
        verified: true,
        balance_usd: state.dashboard.account.paidBalance,
      };
    }
  } else if (method === "POST" && path === "/api/projects") {
    const body = requestBody(options);
    const name = String(body.name ?? "").trim();
    if (!name) fail("project_name_required");
    state.dashboard.projects.push({
      id: randomId("proj"),
      name,
      description: String(body.description ?? "").trim(),
      status: "active",
      budgetMicroCents: Math.round(Number(body.budget ?? 0) * 100_000_000),
      createdAt: new Date().toISOString(),
    });
    result = state.dashboard;
  } else if (method === "POST" && path === "/api/keys") {
    const body = requestBody(options);
    const project = state.dashboard.projects.find((candidate) => candidate.id === body.projectId && candidate.status === "active") || state.dashboard.projects[0];
    if (!project) fail("active_project_required");
    const name = String(body.name ?? "").trim();
    if (!name) fail("key_name_required");
    const id = randomId("key");
    const secret = createSecret();
    const keyPrefix = secret.slice(0, 14);
    state.secrets[id] = secret;
    state.dashboard.apiKeys.unshift({
      id,
      name,
      projectId: project.id,
      masked: maskSecret(secret),
      key_prefix: keyPrefix,
      scopes: Array.isArray(body.scopes) && body.scopes.length ? body.scopes.map(String) : ["Text translation", "Music generation", "Chat completions"],
      createdAt: new Date().toISOString(),
      expiresAt: body.expiresAt ? String(body.expiresAt) : null,
      spendLimitMicroCents: Math.round(Number(body.spendLimit ?? 0) * 100_000_000),
      status: "active",
      is_active: true,
    });
    result = { secret, key_id: id, key_prefix: keyPrefix, dashboard: state.dashboard };
  } else if (method === "POST" && /^\/api\/keys\/[^/]+\/rotate$/.test(path)) {
    const id = path.split("/")[3];
    const key = state.dashboard.apiKeys.find((candidate) => candidate.id === id && candidate.status === "active");
    if (!key) fail("key_not_found");
    const secret = createSecret();
    state.secrets[id] = secret;
    key.masked = maskSecret(secret);
    key.key_prefix = secret.slice(0, 14);
    result = { secret, dashboard: state.dashboard };
  } else if (method === "POST" && path === "/api/billing/subscription-checkout") {
    const body = requestBody(options);
    const plan = String(body.plan || "ultra-custom");
    const billing = String(body.billing || "monthly").toLowerCase();
    const isYearly = billing === "yearly";

    let dubbingMins = 0;
    let voiceCredits = 25000;
    let textChars = 2200000;
    let transcribeMins = 30;
    let imageCount = 50;
    let monthlyPriceUsd = 19.99;
    let yearlyPriceUsd = 204.0;
    let desc = `LingoFusion Pro (${isYearly ? "Annual" : "Monthly"}) — flat $19.99/mo with zero checkout fees`;

    if (plan === "pro-max-750k" || plan === "pro-max") {
      monthlyPriceUsd = 39.99;
      yearlyPriceUsd = 408.0;
      voiceCredits = 75000;
      textChars = 4800000;
      transcribeMins = 75;
      imageCount = 150;
      desc = `LingoFusion Pro Max (${isYearly ? "Annual" : "Monthly"}) — flat $39.99/mo with zero checkout fees`;
    } else if (plan === "ultra-custom") {
      dubbingMins = Number(body.dubbing_mins || 30);
      voiceCredits = Number(body.voice_credits || 1200000);
      textChars = Number(body.text_chars || 5000000);
      transcribeMins = Number(body.transcribe_mins || 120);
      imageCount = Number(body.image_count || 50);
      monthlyPriceUsd = Number(body.monthly_price_usd || 256.04);
      yearlyPriceUsd = Number(body.yearly_price_usd || Math.round(monthlyPriceUsd * 12 * 0.85 * 100) / 100);
      desc = `Ultra Custom Subscription (${isYearly ? "Annual" : "Monthly"}): ${dubbingMins}m dubbing, ${(voiceCredits / 1e6).toFixed(1)}M voice, ${(textChars / 1e6).toFixed(1)}M text, ${transcribeMins}m transcribe, ${imageCount} imgs`;
    }

    const billedAmountUsd = isYearly ? yearlyPriceUsd : monthlyPriceUsd;

    (state.dashboard as any).workspaceSubscription = {
      id: randomId("sub"),
      planId: plan,
      status: "active",
      billing,
      monthlyPriceUsd,
      yearlyPriceUsd,
      billedAmountUsd,
      dubbingMinsAllocated: dubbingMins,
      dubbingMinsUsed: 0,
      voiceCreditsAllocated: voiceCredits,
      voiceCreditsUsed: 0,
      textCharsAllocated: textChars,
      textCharsUsed: 0,
      transcribeMinsAllocated: transcribeMins,
      transcribeMinsUsed: 0,
      imagesAllocated: imageCount,
      imagesUsed: 0,
      currentPeriodEnd: new Date(Date.now() + (isYearly ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString(),
    };

    state.dashboard.ledger.unshift({
      id: randomId("sub"),
      type: "paid_credit_purchase",
      amount: billedAmountUsd,
      description: desc,
      status: "succeeded",
      createdAt: new Date().toISOString(),
    });

    result = {
      success: true,
      subscription: (state.dashboard as any).workspaceSubscription,
    };
  } else if (method === "POST" && path === "/api/billing/recharge") {
    const body = requestBody(options);
    const amount = Number(body.amount);
    if (body.confirm !== "ADD_LOCAL_TEST_BALANCE") fail("recharge_confirmation_required");
    if (amount < 1 || amount > 50000) fail("recharge_amount_out_of_range");
    state.dashboard.account.paidBalance = Number((state.dashboard.account.paidBalance + amount).toFixed(6));
    state.dashboard.account.totalPaidCreditPurchased = Number((state.dashboard.account.totalPaidCreditPurchased + amount).toFixed(6));
    if (state.dashboard.user) {
      state.dashboard.user.balance_usd = state.dashboard.account.paidBalance;
    }
    state.dashboard.ledger.unshift({
      id: randomId("rch"),
      type: "paid_credit_purchase",
      amount,
      description: "Browser test balance purchase",
      status: "succeeded",
      createdAt: new Date().toISOString(),
    });
    result = state.dashboard;
  } else if (method === "POST" && path === "/api/billing/reset-local-data") {
    const body = requestBody(options);
    if (body.confirm !== "RESET_LOCAL_TEST_DATA") fail("reset_confirmation_required");
    state.dashboard.account = {
      paidBalance: 0,
      rewardBalance: 0,
      pendingCharges: 0,
      lifetimeSpend: 0,
      totalPaidCreditPurchased: 0,
      totalRewardCreditEarned: 0,
    };
    if (state.dashboard.user) state.dashboard.user.balance_usd = 0;
    state.dashboard.ledger = [];
    state.dashboard.usageLedger = [];
    state.dashboard.depositLedger = [];
    state.dashboard.requestLogs = [];
    state.dashboard.usage = emptyUsage();
    result = state.dashboard;
  } else if (method === "POST" && path === "/api/auto-recharge") {
    const body = requestBody(options);
    const amount = Number(body.amount ?? body.targetBalance);
    const threshold = Number(body.threshold);
    if (!Number.isFinite(threshold) || threshold < 1 || threshold > 999) {
      fail("'When my balance reaches' must be between $1.00 and $999.00 USD.");
    }
    if (!Number.isFinite(amount) || amount < 1 || amount > 50000) {
      fail("'Bring my balance back up to' must be between $1.00 and $50,000.00 USD.");
    }
    if (threshold >= amount) {
      fail("'Bring my balance back up to' must be greater than 'When my balance reaches'.");
    }
    state.dashboard.autoRecharge = {
      enabled: Boolean(body.enabled),
      threshold: Number(threshold.toFixed(2)),
      amount: Number(amount.toFixed(2)),
      monthlyLimit: Number(body.monthlyLimit ?? 1000),
      notify: body.notify !== undefined ? Boolean(body.notify) : true,
      paymentMethod: String(body.paymentMethod ?? "Stripe Checkout"),
    };
    result = state.dashboard;
  } else if (method === "POST" && path === "/api/gifts/claim") {
    const body = requestBody(options);
    const email = String(body.email || "").trim().toLowerCase();
    const code = String(body.code || "").trim();

    if (DEFAULT_EDGE_GATEWAY_URL) {
      const claimRes = await fetch(`${DEFAULT_EDGE_GATEWAY_URL}/api/gifts/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const claimData = await claimRes.json();
      if (!claimRes.ok) {
        throw new Error(claimData?.message || "Failed to claim gift");
      }

      // Credit this user's balance with the claimed gift amount!
      const claimedAmount = Number(claimData.claimedAmountUsd || 0);
      if (claimedAmount > 0) {
        const updatedBalance = typeof claimData.newBalance === "number" && Number.isFinite(claimData.newBalance)
          ? claimData.newBalance
          : Number((state.dashboard.account.paidBalance + claimedAmount).toFixed(6));
        state.dashboard.account.paidBalance = updatedBalance;
        state.dashboard.account.totalPaidCreditPurchased = Number((state.dashboard.account.totalPaidCreditPurchased + claimedAmount).toFixed(6));
        if (state.dashboard.user) {
          state.dashboard.user.balance_usd = state.dashboard.account.paidBalance;
        }
        for (const g of claimData.gifts || []) {
          state.dashboard.ledger.unshift({
            id: randomId("gft"),
            type: "gift_received",
            amount: Number(g.amountUsd) || claimedAmount,
            description: `Gift redeemed: +$${(Number(g.amountUsd) || claimedAmount).toFixed(2)} USD from ${g.senderName || "a friend"}${g.giftMessage ? ` ("${g.giftMessage}")` : ""}`,
            status: "completed",
            createdAt: new Date().toISOString(),
          });
        }
      }
      result = {
        success: true,
        claimedAmountUsd: claimedAmount,
        newBalance: state.dashboard.account.paidBalance,
        gifts: claimData.gifts,
      };
    } else {
      fail("Edge gateway required for gifts");
    }
  } else if (method === "POST" && path === "/api/gifts/check") {
    const body = requestBody(options);
    const email = String(body.email || "").trim().toLowerCase();
    if (DEFAULT_EDGE_GATEWAY_URL) {
      const checkRes = await fetch(`${DEFAULT_EDGE_GATEWAY_URL}/api/gifts/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      result = await checkRes.json();
    } else {
      result = { email, gifts: [], totalAvailableUsd: 0 };
    }
  } else if (method === "POST" && path === "/v1/translate") {
    result = runTranslation(state, options);
  } else if (method === "POST" && (path === "/v1/music" || path === "/api/playground/music")) {
    result = await runMusic(state, options);
  } else if (method === "POST" && (path === "/v1/audio/speech" || path === "/api/playground/speech")) {
    result = await runSpeechBrowser(state, options);
  } else if (method === "POST" && (path === "/v1/dubbing" || path === "/api/playground/dubbing")) {
    result = await runDubbingBrowser(state, options);
  } else {
    fail("not_found");
  }

  saveState(state);
  return structuredClone(result) as T;
}
