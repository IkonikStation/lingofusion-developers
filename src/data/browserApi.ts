import { musicModels, textModelsByPricingMode } from "./pricing";
import type { TextPricingMode } from "./pricing";

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
  scopes: string[];
  createdAt: string;
  expiresAt: string | null;
  spendLimitMicroCents: number;
  status: string;
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
      account: {
        paidBalance: 0,
        rewardBalance: 0,
        pendingCharges: 0,
        lifetimeSpend: 0,
        totalPaidCreditPurchased: 0,
        totalRewardCreditEarned: 0,
      },
      autoRecharge: {
        enabled: false,
        threshold: 10,
        amount: 50,
        monthlyLimit: 250,
        notify: true,
        paymentMethod: "Manual invoice",
      },
      projects: [],
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
    return stored ? JSON.parse(stored) as BrowserState : createInitialState();
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
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `lf_live_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function maskSecret(secret: string) {
  return `${secret.slice(0, 8)}••••••••${secret.slice(-4).toUpperCase()}`;
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
  const project = state.dashboard.projects.find((candidate) => candidate.id === key.projectId && candidate.status === "active");
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
  if (account.paidBalance + account.rewardBalance < cost) fail("insufficient_balance");
  const rewardCharge = Math.min(account.rewardBalance, cost);
  const paidCharge = cost - rewardCharge;
  account.rewardBalance -= rewardCharge;
  account.paidBalance -= paidCharge;
  account.lifetimeSpend += paidCharge;
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

function runTranslation(state: BrowserState, options?: RequestInit) {
  const started = Date.now();
  const { key, project } = authorize(state, options);
  if (!key.scopes.includes("Text translation")) fail("missing_scope");
  const body = requestBody(options);
  const pricingMode: TextPricingMode = body.pricing_mode === "batch" ? "batch" : "instant";
  const model = textModelsByPricingMode[pricingMode].find((candidate) => candidate.model === body.model);
  if (!model) fail("unsupported_model");
  const input = String(body.input ?? "").trim();
  const fromLanguage = String(body.from_language ?? "").trim();
  const toLanguage = String(body.to_language ?? "").trim();
  if (!input || !fromLanguage || !toLanguage) fail("invalid_request");

  const outputText = translatePhrase(input, fromLanguage, toLanguage);
  const inputTokens = tokenEstimate(input);
  const outputTokens = tokenEstimate(outputText);
  const cost = (inputTokens / 1_000_000) * model.inputUsd + (outputTokens / 1_000_000) * model.outputUsd;
  const requestId = randomId("req");
  applyCharge(state, cost);
  createChargeEntry(state, cost, `${model.model}${pricingMode === "batch" ? " Batch" : ""} /v1/translate`);
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
    pricing_mode: pricingMode === "batch" ? "batch" : "default",
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

  const cost = (durationSeconds / 60) * (model.priceUsd ?? 0);
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
      audio_url: `browser://aurora/${requestId}.wav`,
      note: "Simulated Aurora music generation. No audio file is created.",
    },
    usage: {
      audio_seconds: durationSeconds,
      audio_minutes: durationSeconds / 60,
      cost_usd: cost,
    },
  };
}

export function shouldUseBrowserApi() {
  return !import.meta.env.VITE_LINGOFUSION_API_URL
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
    const project = state.dashboard.projects.find((candidate) => candidate.id === body.projectId && candidate.status === "active");
    if (!project) fail("active_project_required");
    const name = String(body.name ?? "").trim();
    if (!name) fail("key_name_required");
    const id = randomId("key");
    const secret = createSecret();
    state.secrets[id] = secret;
    state.dashboard.apiKeys.push({
      id,
      name,
      projectId: project.id,
      masked: maskSecret(secret),
      scopes: Array.isArray(body.scopes) && body.scopes.length ? body.scopes.map(String) : ["Text translation", "Music generation"],
      createdAt: new Date().toISOString(),
      expiresAt: body.expiresAt ? String(body.expiresAt) : null,
      spendLimitMicroCents: Math.round(Number(body.spendLimit ?? 0) * 100_000_000),
      status: "active",
    });
    result = { secret, dashboard: state.dashboard };
  } else if (method === "POST" && /^\/api\/keys\/[^/]+\/rotate$/.test(path)) {
    const id = path.split("/")[3];
    const key = state.dashboard.apiKeys.find((candidate) => candidate.id === id && candidate.status === "active");
    if (!key) fail("key_not_found");
    const secret = createSecret();
    state.secrets[id] = secret;
    key.masked = maskSecret(secret);
    result = { secret, dashboard: state.dashboard };
  } else if (method === "POST" && path === "/api/billing/recharge") {
    const body = requestBody(options);
    const amount = Number(body.amount);
    if (body.confirm !== "ADD_LOCAL_TEST_BALANCE") fail("recharge_confirmation_required");
    if (amount < 5 || amount > 1000) fail("recharge_amount_out_of_range");
    state.dashboard.account.paidBalance += amount;
    state.dashboard.account.totalPaidCreditPurchased += amount;
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
    state.dashboard.account = createInitialState().dashboard.account;
    state.dashboard.ledger = [];
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
      paymentMethod: String(body.paymentMethod ?? "Manual invoice"),
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
