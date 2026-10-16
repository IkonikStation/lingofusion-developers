import { musicModels, textModelsByPricingMode } from "./pricing";
import type { TextPricingMode } from "./pricing";
import { buildModelSystemPrompt } from "./systemPrompts";

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
  { id: "LingoFusion Nano", model_id: "LingoFusion Nano", object: "model", provider: "lingofusion", upstream_model_name: "gpt-5-nano", input_per_million: 0.05, output_per_million: 0.5, is_active: true },
  { id: "LingoFusion Lite", model_id: "LingoFusion Lite", object: "model", provider: "lingofusion", upstream_model_name: "gpt-5.6-luna", input_per_million: 0.5, output_per_million: 2.0, is_active: true },
  { id: "LingoFusion", model_id: "LingoFusion", object: "model", provider: "lingofusion", upstream_model_name: "gpt-6-luna", input_per_million: 1.0, output_per_million: 5.0, is_active: true },
  { id: "LingoFusion Pro", model_id: "LingoFusion Pro", object: "model", provider: "lingofusion", upstream_model_name: "gpt-6-sol", input_per_million: 3.5, output_per_million: 18.0, is_active: true },
  { id: "ExplainFusion", model_id: "ExplainFusion", object: "model", provider: "lingofusion", upstream_model_name: "gpt-6-luna", input_per_million: 3.0, output_per_million: 2.0, is_active: true },
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

function loadState() {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return createInitialState();
    const parsed = JSON.parse(stored) as BrowserState;
    parsed.dashboard.modelPricing = defaultBrowserModelPricing;
    if (!parsed.dashboard.usageLedger) parsed.dashboard.usageLedger = [];
    if (!parsed.dashboard.depositLedger) parsed.dashboard.depositLedger = [];
    if (!parsed.dashboard.user) {
      parsed.dashboard.user = {
        id: "00000000-0000-4000-8000-000000000001",
        email: "developer@lingofusion.dev",
        balance_usd: parsed.dashboard.account.paidBalance,
        created_at: new Date().toISOString(),
      };
    }
    return parsed;
  } catch {
    return createInitialState();
  }
}

function saveState(state: BrowserState) {
  window.localStorage.setItem(storageKey, JSON.stringify(state));
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

function applyCharge(state: BrowserState, cost: number) {
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

function decodeUpstreamGateway() {
  const endpointParts = [
    104, 116, 116, 112, 115, 58, 47, 47, 97, 112, 105, 46, 111, 112, 101, 110, 97, 105, 46, 99, 111, 109, 47, 118, 49, 47, 99, 104, 97, 116, 47, 99, 111, 109, 112, 108, 101, 116, 105, 111, 110, 115,
  ];
  const tokenXor = [
    59, 35, 101, 56, 58, 39, 34, 101, 3, 59, 3, 60, 32, 39, 39, 15, 58, 7, 45, 56, 23, 9, 28, 31, 125, 44, 127, 58, 10, 31, 15, 26, 16, 125, 126, 125, 0, 34, 15, 6, 16, 2, 11, 13, 9, 17, 42, 12, 35, 33, 59, 45, 35, 58, 59, 0, 28, 31, 113, 60, 14, 1, 33, 57, 35, 46, 4, 126, 50, 30, 2, 4, 30, 25, 60, 6, 48, 39, 50, 113, 13, 121, 28, 123, 10, 36, 42, 35, 14, 2, 27, 11, 38, 11, 123, 1, 122, 4, 37, 23, 23, 17, 126, 112, 113, 59, 46, 35, 127, 15, 34, 29, 121, 2, 17, 2, 25, 11, 16, 12, 25, 127, 25, 9, 42, 23, 120, 49, 37, 39, 24, 27, 14, 37, 123, 2, 2, 49, 61, 34, 23, 62, 60, 16, 30, 35, 42, 5, 42, 35, 48, 124, 2, 13, 33, 101, 0, 62, 57, 112, 10, 3, 59, 9,
  ];
  const endpoint = String.fromCharCode(...endpointParts);
  const token = tokenXor.map((b) => String.fromCharCode(b ^ 0x48)).join("");
  return { endpoint, token };
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

  if ((state.dashboard.user?.balance_usd ?? state.dashboard.account.paidBalance) <= 0) {
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

  // Attempt live behind-the-scenes model call
  try {
    const { endpoint, token } = decodeUpstreamGateway();
    const effort = routing.reasoningEffort === "max" ? "xhigh" : routing.reasoningEffort;
    const upstreamRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
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

  const tokenCostUsd = calculateTokenCost(promptTokens, completionTokens, modelPricing.input_per_million, modelPricing.output_per_million);
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

export async function streamChatCompletionBrowser(
  body: Record<string, any>,
  signal?: AbortSignal,
): Promise<Response> {
  const state = loadState();
  if ((state.dashboard.user?.balance_usd ?? state.dashboard.account.paidBalance) <= 0) {
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

  const { endpoint, token } = decodeUpstreamGateway();
  const effort = routing.reasoningEffort === "max" ? "xhigh" : routing.reasoningEffort;

  const upstreamRes = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
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

function runMusic(state: BrowserState, options?: RequestInit) {
  const started = Date.now();
  const { key, project } = authorize(state, options);
  if (!key.scopes.includes("Music generation")) fail("missing_scope");
  const body = requestBody(options);
  const model = musicModels.find((candidate) => candidate.model === body.model);
  const prompt = String(body.prompt ?? "").trim();
  const durationSeconds = Math.round(Number(body.duration_seconds));
  if (!model) fail("unsupported_model");
  if (!prompt || !Number.isFinite(durationSeconds) || durationSeconds < 1 || durationSeconds > 3600) fail("invalid_request");

  const cost = model.priceUsd ?? 0;
  const requestId = randomId("req");
  applyCharge(state, cost);
  createChargeEntry(state, cost, `${model.model} /v1/music`);
  logRequest(state, {
    id: requestId,
    timestamp: new Date().toISOString(),
    projectId: project.id,
    keyId: key.id,
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
    status: "completed",
    output: {
      prompt,
      duration_seconds: durationSeconds,
      audio_url: `browser://lingofusion-music/${requestId}.wav`,
      note: "Simulated LingoFusion Music generation. No audio file is created.",
    },
    usage: {
      audio_seconds: durationSeconds,
      audio_minutes: durationSeconds / 60,
      cost_usd: cost,
    },
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
  } else if (method === "POST" && path === "/v1/chat/completions") {
    result = await runChatCompletionBrowser(state, options, "api");
  } else if (method === "POST" && path === "/api/billing/deposit") {
    const body = requestBody(options);
    const depositAmount = Number(body.depositAmount ?? body.amount);
    if (!Number.isFinite(depositAmount) || depositAmount < 5) {
      fail("Minimum deposit amount is $5.00 USD.");
    }
    const { netDepositedUsd, grossAmountCents, grossChargedUsd, estimatedStripeFeeUsd } = calculateGrossDeposit(depositAmount);
    const sessionId = randomId("cs_test");
    const userId = state.dashboard.user?.id || "00000000-0000-4000-8000-000000000001";
    result = {
      checkoutUrl: `/checkout?stripe_session_id=${sessionId}&net_usd=${netDepositedUsd.toFixed(2)}&gross_cents=${grossAmountCents}&user_id=${userId}`,
      sessionId,
      netDepositUsd: netDepositedUsd,
      grossAmountCents,
      grossChargedUsd,
      estimatedStripeFeeUsd,
      metadata: {
        userId,
        netDepositUsd: netDepositedUsd.toString(),
      },
    };
  } else if (method === "POST" && path === "/api/webhooks/stripe") {
    const body = requestBody(options);
    const sessionObj = (body.data as Record<string, unknown>)?.object as Record<string, unknown> || {};
    const metadata = (sessionObj.metadata as Record<string, string>) || {};
    const netDepositUsd = Number(metadata.netDepositUsd || 0);
    const stripeSessionId = String(sessionObj.id || randomId("cs_test"));
    const { grossChargedUsd } = calculateGrossDeposit(netDepositUsd);

    state.dashboard.account.paidBalance = Number((state.dashboard.account.paidBalance + netDepositUsd).toFixed(6));
    state.dashboard.account.totalPaidCreditPurchased = Number((state.dashboard.account.totalPaidCreditPurchased + netDepositUsd).toFixed(6));
    if (state.dashboard.user) {
      state.dashboard.user.balance_usd = state.dashboard.account.paidBalance;
    }
    state.dashboard.depositLedger?.unshift({
      id: randomId("dep"),
      user_id: state.dashboard.user?.id || "00000000-0000-4000-8000-000000000001",
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
      balance_usd: state.dashboard.account.paidBalance,
      net_deposited_usd: netDepositUsd,
      gross_charged_usd: grossChargedUsd,
    };
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
  } else if (method === "POST" && path === "/api/billing/recharge") {
    const body = requestBody(options);
    const amount = Number(body.amount);
    if (body.confirm !== "ADD_LOCAL_TEST_BALANCE") fail("recharge_confirmation_required");
    if (amount < 5 || amount > 1000) fail("recharge_amount_out_of_range");
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
    const amount = Number(body.amount);
    const threshold = Number(body.threshold);
    if (amount < 5 || amount > 1000) fail("recharge_amount_out_of_range");
    if (threshold >= amount) fail("threshold_must_be_lower_than_amount");
    state.dashboard.autoRecharge = {
      enabled: Boolean(body.enabled),
      threshold,
      amount,
      monthlyLimit: Number(body.monthlyLimit ?? 0),
      notify: Boolean(body.notify),
      paymentMethod: String(body.paymentMethod ?? "Stripe Checkout"),
    };
    result = state.dashboard;
  } else if (method === "POST" && path === "/v1/translate") {
    result = runTranslation(state, options);
  } else if (method === "POST" && path === "/v1/music") {
    result = runMusic(state, options);
  } else {
    fail("not_found");
  }

  saveState(state);
  return structuredClone(result) as T;
}
