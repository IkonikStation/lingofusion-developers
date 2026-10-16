import { musicModels, textModelsByPricingMode } from "./pricing";
import type { TextPricingMode } from "./pricing";

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

const storageKey = "lingofusion-browser-api-v1";

export const defaultBrowserModelPricing: ModelPricingRecord[] = [
  { id: "gpt-4o", model_id: "gpt-4o", object: "model", provider: "openai", upstream_model_name: "gpt-4o", input_per_million: 2.5, output_per_million: 10.0, is_active: true },
  { id: "claude-sonnet-4", model_id: "claude-sonnet-4", object: "model", provider: "anthropic", upstream_model_name: "claude-sonnet-4-20250514", input_per_million: 3.0, output_per_million: 15.0, is_active: true },
  { id: "llama-3.3-70b", model_id: "llama-3.3-70b", object: "model", provider: "together", upstream_model_name: "meta-llama/Llama-3.3-70B-Instruct-Turbo", input_per_million: 0.88, output_per_million: 0.88, is_active: true },
  { id: "LingoFusion", model_id: "LingoFusion", object: "model", provider: "deepseek", upstream_model_name: "deepseek-v4-flash", input_per_million: 1.0, output_per_million: 5.0, is_active: true },
  { id: "LingoFusion Pro", model_id: "LingoFusion Pro", object: "model", provider: "deepseek", upstream_model_name: "deepseek-v4-pro", input_per_million: 3.5, output_per_million: 18.0, is_active: true },
  { id: "LingoFusion Ultra", model_id: "LingoFusion Ultra", object: "model", provider: "deepseek", upstream_model_name: "deepseek-v4-pro", input_per_million: 20.0, output_per_million: 120.0, is_active: true },
  { id: "LingoFusion Lite", model_id: "LingoFusion Lite", object: "model", provider: "openai", upstream_model_name: "gpt-5-mini", input_per_million: 0.5, output_per_million: 2.0, is_active: true },
  { id: "LingoFusion Nano", model_id: "LingoFusion Nano", object: "model", provider: "openai", upstream_model_name: "gpt-5-nano", input_per_million: 0.05, output_per_million: 0.5, is_active: true },
  { id: "LingoFusion Explain", model_id: "LingoFusion Explain", object: "model", provider: "deepseek", upstream_model_name: "deepseek-v4-flash", input_per_million: 3.0, output_per_million: 2.0, is_active: true },
];

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
        balance_usd: 10.0,
        created_at: new Date().toISOString(),
      },
      modelPricing: defaultBrowserModelPricing,
      usageLedger: [],
      depositLedger: [],
      account: {
        paidBalance: 10.0,
        rewardBalance: 0,
        pendingCharges: 0,
        lifetimeSpend: 0,
        totalPaidCreditPurchased: 10.0,
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
    if (!parsed.dashboard.modelPricing) parsed.dashboard.modelPricing = defaultBrowserModelPricing;
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

function translatePhrase(input: string, fromLanguage: string, toLanguage: string) {
  const key = `${fromLanguage.toLowerCase()}:${toLanguage.toLowerCase()}:${input.trim().toLowerCase()}`;
  const phrases: Record<string, string> = {
    "english:french:hello": "Bonjour",
    "english:french:hello, how are you?": "Bonjour, comment allez-vous ?",
    "english:french:thank you": "Merci",
    "english:spanish:hello": "Hola",
    "english:spanish:thank you": "Gracias",
    "english:german:hello": "Hallo",
    "english:german:thank you": "Danke",
  };
  return phrases[key] ?? input.trim();
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

function runChatCompletionBrowser(state: BrowserState, options?: RequestInit, source: "api" | "playground" = "playground") {
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
  const modelId = String(body.model || "gpt-4o");
  const modelPricing = (state.dashboard.modelPricing ?? defaultBrowserModelPricing).find(
    (m) => m.model_id.toLowerCase() === modelId.toLowerCase()
  ) ?? defaultBrowserModelPricing[0];

  const messages = Array.isArray(body.messages) ? body.messages as Array<{ role: string; content: string }> : [];
  const promptText = messages.map((m) => m.content || "").join(" ");
  const promptTokens = tokenEstimate(promptText) + messages.length * 4;
  const lastUser = messages.filter((m) => m.role === "user").pop()?.content || "Hello!";
  const replyText = `[${modelPricing.model_id} • ${modelPricing.provider}] Response to "${lastUser.slice(0, 100)}":\n\nProcessed via prepaid LLM proxy. Input rate: $${modelPricing.input_per_million}/1M tokens, Output rate: $${modelPricing.output_per_million}/1M tokens.`;
  const completionTokens = Math.max(1, (replyText.match(/\S+\s*/g) || [replyText]).length);
  const costUsd = calculateTokenCost(promptTokens, completionTokens, modelPricing.input_per_million, modelPricing.output_per_million);

  applyCharge(state, costUsd);
  const requestId = `chatcmpl-${randomId(" browser")}`;
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

  createChargeEntry(state, costUsd, `${modelPricing.model_id} (${promptTokens} in / ${completionTokens} out) via ${source}`);
  logRequest(state, {
    id: requestId,
    timestamp: now,
    projectId,
    keyId: keyId || "playground_session",
    endpoint: source === "api" ? "/v1/chat/completions" : "/api/playground/chat",
    model: modelPricing.model_id,
    feature: "Chat completions",
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
    upstream_model: modelPricing.upstream_model_name,
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
    result = runChatCompletionBrowser(state, options, "playground");
  } else if (method === "POST" && path === "/v1/chat/completions") {
    result = runChatCompletionBrowser(state, options, "api");
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
