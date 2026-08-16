import {
  Activity,
  Bell,
  ClipboardCopy,
  CreditCard,
  Download,
  FileText,
  KeyRound,
  Music,
  Plus,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { musicModels, textModelsByPricingMode } from "../data/pricing";
import type { TextPricingMode } from "../data/pricing";
import { playgroundLanguages } from "../data/playgroundLanguages";
import { browserApi, getApiBaseUrl, shouldUseBrowserApi } from "../data/browserApi";
import { isPicoModel, picoLocalBaseUrl, picoLocalRequirements } from "../data/picoLocal";
import { sdkExamples } from "../data/sdkExamples";
import type { SdkLanguage } from "../data/sdkExamples";
import { highlightCode } from "../lib/highlightCode";

type DashboardModalProps = {
  tc: (text: string) => string;
  onClose: () => void;
  onNotify: (message: string) => void;
};

const DashboardTextContext = createContext<(text: string) => string>((text) => text);

function useDashboardText() {
  return useContext(DashboardTextContext);
}

type Project = {
  id: string;
  name: string;
  description: string;
  status: string;
  budgetMicroCents: number;
  createdAt: string;
};

type ApiKey = {
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

type RequestLog = {
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
  reasoningTokens?: number;
  totalTokens?: number;
  cost: number;
  latencyMs: number;
  errorCode: string;
  streaming: boolean;
};

type LedgerEntry = {
  id: string;
  type: string;
  amount: number;
  description: string;
  status: string;
  createdAt: string;
};

type TokenizerResult = {
  model: string;
  tokenizer_model?: string;
  exact: boolean;
  token_count: number;
  token_ids?: number[];
  preview_pieces?: string[];
  truncated: boolean;
};

type DashboardData = {
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
  projects: Project[];
  apiKeys: ApiKey[];
  ledger: LedgerEntry[];
  requestLogs: RequestLog[];
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

const permissionScopes = [
  "Text translation",
  "Image translation",
  "OCR",
  "Text-to-speech",
  "Transcription",
  "Audio dubbing",
  "Video dubbing",
  "Music generation",
  "Usage read access",
  "Logs read access",
  "Project administration",
  "Billing access",
];

const tabs = [
  "Overview",
  "Playground",
  "Tokenizer",
  "Projects",
  "API Keys",
  "Usage",
  "Request Logs",
  "Billing",
  "Auto-Recharge",
  "Rewards",
  "Documentation",
  "SDKs",
  "Notifications",
  "Status",
];

const statusRows = [
  ["API gateway", "Operational", "42 ms", "99.99%"],
  ["Authentication", "Operational", "31 ms", "99.99%"],
  ["Text translation", "Operational", "156 ms", "99.98%"],
  ["Image translation", "Operational", "604 ms", "99.94%"],
  ["OCR", "Operational", "229 ms", "99.96%"],
  ["TTS", "Operational", "390 ms", "99.95%"],
  ["Transcription", "Operational", "244 ms", "99.97%"],
  ["Audio dubbing", "Operational", "1.8 s", "99.91%"],
  ["Video dubbing", "Operational", "2.4 s", "99.90%"],
  ["Billing", "Operational", "64 ms", "99.99%"],
  ["Dashboard", "Operational", "51 ms", "99.98%"],
  ["Documentation", "Operational", "28 ms", "100%"],
];

function dollars(value: number) {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
}

function fullDecimal(value: number) {
  return value
    .toFixed(20)
    .replace(/(?:\.0+|(\.\d+?)0+)$/, "$1");
}

function formatPlaygroundResult(result: Record<string, unknown>) {
  return JSON.stringify(result, null, 2).replace(
    /("cost_usd":\s*)(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/i,
    (_match, prefix, numericValue) => `${prefix}${fullDecimal(Number(numericValue))}`,
  );
}

function microCentsToDollars(value: number) {
  return value / 100_000_000;
}

function idempotencyKey() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  if (shouldUseBrowserApi()) {
    return browserApi<T>(path, options);
  }

  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "Request failed");
  }
  return body;
}

function picoSystemPrompt(fromLanguage: string, toLanguage: string) {
  return `You are LingoFusion Pico, a precise local translation model. Translate from ${fromLanguage} to ${toLanguage}. Preserve meaning, tone, names, code, formatting, punctuation, and line breaks. Output only the translation.`;
}

function tokenEstimate(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

async function localPicoTranslation({ input, fromLanguage, toLanguage, stream }: { input: string; fromLanguage: string; toLanguage: string; stream: boolean }) {
  let modelsResponse: Response;
  try {
    modelsResponse = await fetch(`${picoLocalBaseUrl}/models`);
  } catch {
    throw new Error("LM Studio is not reachable. Start its local server at http://127.0.0.1:1234/v1, load Qwen 1.7B, then try again.");
  }
  if (!modelsResponse.ok) throw new Error("LM Studio could not list local models. Confirm its local server is running.");
  const models = await modelsResponse.json() as { data?: Array<{ id?: string }> };
  const modelId = models.data?.map((model) => model.id || "").find((id) => /qwen.*1\.7b/i.test(id));
  if (!modelId) throw new Error("Qwen 1.7B is not loaded in LM Studio. Download and load it before using LingoFusion Pico.");

  let response: Response;
  try {
    response = await fetch(`${picoLocalBaseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer lm-studio" },
      body: JSON.stringify({
        model: modelId,
        stream,
        messages: [
          { role: "system", content: picoSystemPrompt(fromLanguage, toLanguage) },
          { role: "user", content: input },
        ],
      }),
    });
  } catch {
    throw new Error("LM Studio refused the local translation request. Check that its server is running and allows browser access.");
  }
  if (!response.ok) throw new Error("LM Studio could not run Qwen 1.7B. Confirm the model is fully loaded and try again.");

  let outputText = "";
  let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
  if (stream && response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = "";
    while (true) {
      const { done, value } = await reader.read();
      pending += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = pending.split("\n");
      pending = lines.pop() || "";
      for (const line of lines) {
        const payload = line.replace(/^data:\s*/, "").trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const chunk = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
          outputText += chunk.choices?.[0]?.delta?.content || "";
        } catch { /* Ignore non-data SSE lines. */ }
      }
      if (done) break;
    }
  } else {
    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: typeof usage };
    outputText = body.choices?.[0]?.message?.content || "";
    usage = body.usage;
  }
  if (!outputText.trim()) throw new Error("LM Studio returned no translation. Try again after confirming Qwen 1.7B is ready.");
  const inputTokens = usage?.prompt_tokens ?? tokenEstimate(input);
  const outputTokens = usage?.completion_tokens ?? tokenEstimate(outputText);
  return {
    id: `local_${Date.now().toString(36)}`,
    model: "LingoFusion Pico",
    local: true,
    execution: "local",
    stream,
    output_text: outputText.trim(),
    usage: { input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: usage?.total_tokens ?? inputTokens + outputTokens, cost_usd: 0 },
  };
}

function downloadCsv(filename: string, rows: Record<string, string | number | boolean>[]) {
  const headers = Object.keys(rows[0] ?? {});
  const body = rows.map((row) =>
    headers.map((header) => `"${String(row[header] ?? "").replace(/"/g, '""')}"`).join(","),
  );
  const blob = new Blob([[headers.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function DashboardModal({ tc, onClose, onNotify }: DashboardModalProps) {
  const browserMode = shouldUseBrowserApi();
  const [tab, setTab] = useState("Overview");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [createdSecret, setCreatedSecret] = useState("");
  const [confirmRotate, setConfirmRotate] = useState<ApiKey | null>(null);
  const [confirmRecharge, setConfirmRecharge] = useState(false);
  const [confirmResetLocalData, setConfirmResetLocalData] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [newProject, setNewProject] = useState({ name: "", description: "", budget: 100 });
  const [newKey, setNewKey] = useState({
    name: "",
    projectId: "",
    scopes: ["Text translation", "Music generation"],
    expiresAt: "",
    spendLimit: 50,
  });
  const [rechargeAmount, setRechargeAmount] = useState(25);
  const [autoRecharge, setAutoRecharge] = useState({
    enabled: false,
    threshold: 10,
    amount: 50,
    monthlyLimit: 250,
    notify: true,
    paymentMethod: "Manual invoice",
  });
  const [projectFilter, setProjectFilter] = useState("All projects");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [sdkLanguage, setSdkLanguage] = useState<SdkLanguage>(() => {
    const storedLanguage = window.localStorage.getItem("lingofusion-sdk-language");
    return storedLanguage && storedLanguage in sdkExamples ? storedLanguage as SdkLanguage : "curl";
  });
  const [statusEmail, setStatusEmail] = useState("");
  const [tryKey, setTryKey] = useState("");
  const [playgroundPricingMode, setPlaygroundPricingMode] = useState<TextPricingMode>(() => {
    const storedMode = window.localStorage.getItem("lingofusion-text-pricing-mode");
    return storedMode === "batch" ? "batch" : "instant";
  });
  const [playgroundMode, setPlaygroundMode] = useState<"text" | "music">("text");
  const [tryModel, setTryModel] = useState("LingoFusion Pro");
  const [tryInput, setTryInput] = useState("Hello, how are you?");
  const [tryFromLanguage, setTryFromLanguage] = useState("English");
  const [tryToLanguage, setTryToLanguage] = useState("French");
  const [tryStream, setTryStream] = useState(true);
  const [tryMusicDurationSeconds, setTryMusicDurationSeconds] = useState(30);
  const [tryResult, setTryResult] = useState("");
  const [tryOutput, setTryOutput] = useState("");
  const [picoRequirementsConfirmed, setPicoRequirementsConfirmed] = useState(false);
  const [tokenizerModel, setTokenizerModel] = useState("LingoFusion Pico");
  const [tokenizerInput, setTokenizerInput] = useState("Hello, world!");
  const [tokenizerResult, setTokenizerResult] = useState<TokenizerResult | null>(null);
  const [tokenizerLoading, setTokenizerLoading] = useState(false);

  const playgroundModels = textModelsByPricingMode[playgroundPricingMode];
  const selectedPlaygroundModel =
    playgroundModels.find((model) => model.model === tryModel) ?? playgroundModels[0];
  const selectedMusicPlaygroundModel =
    musicModels.find((model) => model.model === tryModel) ?? musicModels[0];

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem("lingofusion-sdk-language", sdkLanguage);
  }, [sdkLanguage]);

  const refresh = async () => {
    setLoading(true);
    const dashboard = await api<DashboardData>("/api/dashboard");
    setData(dashboard);
    setAutoRecharge(dashboard.autoRecharge);
    if (!newKey.projectId && dashboard.projects[0]) {
      setNewKey((current) => ({ ...current, projectId: dashboard.projects[0].id }));
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh().catch((error) => {
      setLoading(false);
      onNotify(error.message);
    });
  }, []);

  const filteredLogs = useMemo(() => {
    return (data?.requestLogs ?? []).filter((log) => {
      const projectMatch = projectFilter === "All projects" || log.projectId === projectFilter;
      const statusMatch =
        statusFilter === "All statuses" ||
        (statusFilter === "Successful" && log.status < 400) ||
        (statusFilter === "Failed" && log.status >= 400);
      return projectMatch && statusMatch;
    });
  }, [data?.requestLogs, projectFilter, statusFilter]);

  const nextReward = useMemo(() => {
    const lifetimeSpend = data?.account.lifetimeSpend ?? 0;
    const milestones = [
      [100, 5],
      [250, 15],
      [500, 40],
      [1000, 90],
      [2500, 250],
      [5000, 500],
      [10000, 1000],
    ];
    const next = milestones.find(([spend]) => lifetimeSpend < spend) ?? [Math.ceil(lifetimeSpend / 10000) * 10000, 1000];
    return {
      spend: next[0],
      credit: next[1],
      remaining: Math.max(0, next[0] - lifetimeSpend),
      progress: Math.min(100, (lifetimeSpend / next[0]) * 100),
    };
  }, [data?.account.lifetimeSpend]);

  const updateDashboard = (dashboard: DashboardData) => {
    setData(dashboard);
    setAutoRecharge(dashboard.autoRecharge);
    if (!newKey.projectId && dashboard.projects[0]) {
      setNewKey((current) => ({ ...current, projectId: dashboard.projects[0].id }));
    }
  };

  const createProject = async () => {
    const dashboard = await api<DashboardData>("/api/projects", {
      method: "POST",
      body: JSON.stringify(newProject),
    });
    updateDashboard(dashboard);
    setNewProject({ name: "", description: "", budget: 100 });
    onNotify(tc("Project created"));
  };

  const createKey = async () => {
    const result = await api<{ secret: string; dashboard: DashboardData }>("/api/keys", {
      method: "POST",
      body: JSON.stringify(newKey),
    });
    updateDashboard(result.dashboard);
    setCreatedSecret(result.secret);
    setTryKey(result.secret);
    await navigator.clipboard?.writeText(result.secret);
    onNotify(tc("API key created, copied, and shown once"));
  };

  const rotateKey = async (key: ApiKey) => {
    const result = await api<{ secret: string; dashboard: DashboardData }>(`/api/keys/${key.id}/rotate`, {
      method: "POST",
    });
    updateDashboard(result.dashboard);
    setCreatedSecret(result.secret);
    setTryKey(result.secret);
    setConfirmRotate(null);
    await navigator.clipboard?.writeText(result.secret);
    onNotify(tc("API key rotated and copied"));
  };

  const addBalance = async () => {
    if (busyAction) {
      return;
    }

    setBusyAction("recharge");
    try {
      const dashboard = await api<DashboardData>("/api/billing/recharge", {
        method: "POST",
        body: JSON.stringify({ amount: rechargeAmount, confirm: "ADD_LOCAL_TEST_BALANCE" }),
      });
      updateDashboard(dashboard);
      onNotify(tc("Local test balance added"));
    } finally {
      setBusyAction("");
    }
  };

  const resetLocalData = async () => {
    if (busyAction) {
      return;
    }

    setBusyAction("reset-local-data");
    try {
      const dashboard = await api<DashboardData>("/api/billing/reset-local-data", {
        method: "POST",
        body: JSON.stringify({ confirm: "RESET_LOCAL_TEST_DATA" }),
      });
      updateDashboard(dashboard);
      onNotify(tc("Local test data reset"));
    } finally {
      setBusyAction("");
    }
  };

  const saveAutoRecharge = async () => {
    const dashboard = await api<DashboardData>("/api/auto-recharge", {
      method: "POST",
      body: JSON.stringify(autoRecharge),
    });
    updateDashboard(dashboard);
    onNotify(tc("Auto-recharge saved"));
  };

  const sendTryRequest = async () => {
    const isMusic = playgroundMode === "music";
    const isLocalPico = !isMusic && isPicoModel(tryModel);
    if (isLocalPico && !picoRequirementsConfirmed) {
      throw new Error("Review and confirm the LingoFusion Pico system requirements before starting a local translation.");
    }
    const result = isLocalPico
      ? await localPicoTranslation({ input: tryInput, fromLanguage: tryFromLanguage, toLanguage: tryToLanguage, stream: tryStream }) as Record<string, unknown>
      : await api<Record<string, unknown>>(isMusic ? "/v1/music" : "/v1/translate", {
      method: "POST",
      headers: {
        authorization: `Bearer ${tryKey}`,
        "idempotency-key": idempotencyKey(),
      },
      body: JSON.stringify(isMusic
        ? { model: tryModel, prompt: tryInput, duration_seconds: tryMusicDurationSeconds }
        : {
          model: tryModel,
          pricing_mode: playgroundPricingMode === "batch" ? "batch" : "default",
          input: tryInput,
          from_language: tryFromLanguage,
          to_language: tryToLanguage,
          stream: tryStream,
        }),
      });
    setTryResult(formatPlaygroundResult(result));
    setTryOutput(typeof result.output_text === "string" ? result.output_text : isMusic ? "Music generation completed. The audio response is available in the result payload." : "No output text was returned.");
    if (!isLocalPico) await refresh();
    onNotify(isLocalPico ? "Pico translation completed locally. No API credits were used." : tc("Request processed, billed, and logged"));
  };

  const tokenizeInput = async () => {
    if (!tryKey) {
      setTab("API Keys");
      onNotify(tc("Create a key first, then come back to Tokenizer"));
      return;
    }
    setTokenizerLoading(true);
    try {
      const result = await api<TokenizerResult>("/v1/tokenize", {
        method: "POST",
        headers: { authorization: `Bearer ${tryKey}` },
        body: JSON.stringify({ model: tokenizerModel, input: tokenizerInput }),
      });
      setTokenizerResult(result);
    } finally {
      setTokenizerLoading(false);
    }
  };

  const copyText = async (text: string, message: string) => {
    await navigator.clipboard?.writeText(text);
    onNotify(message);
  };

  return (
    <DashboardTextContext.Provider value={tc}>
    <div className="modal-backdrop fixed inset-0 z-50 bg-neutral-950/45 dark:bg-black/70 sm:p-4">
      <section className="modal-panel mx-auto flex h-[100dvh] w-full max-w-7xl flex-col overflow-hidden bg-white shadow-xl dark:bg-[#0d0d0d] sm:h-full sm:max-h-[calc(100vh-2rem)] sm:rounded-xl sm:border sm:border-neutral-200 sm:dark:border-white/10">
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-4 dark:border-white/10 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-500">
              {tc("Developer portal")}
            </p>
            <h2 className="truncate text-xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
              LingoFusion API Dashboard
            </h2>
          </div>
          <button
            type="button"
            aria-label={tc("Close dashboard")}
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-md border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-neutral-950 dark:border-white/15 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-neutral-100"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
          <aside className="border-b border-neutral-200 p-3 dark:border-white/10 lg:border-b-0 lg:border-r">
            <label className="block lg:hidden">
              <span className="sr-only">{tc("Dashboard section")}</span>
              <select
                value={tab}
                onChange={(event) => setTab(event.target.value)}
                className="clean-select h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-base font-medium text-neutral-950 outline-none dark:border-white/15 dark:bg-white/5 dark:text-neutral-100"
              >
                {tabs.map((item) => <option key={item} value={item}>{tc(item)}</option>)}
              </select>
            </label>
            <nav className="hidden gap-1 lg:block lg:space-y-1">
              {tabs.map((item) => (
                <button
                  type="button"
                  key={item}
                  onClick={() => setTab(item)}
                  className={`whitespace-nowrap rounded-md px-3 py-2 text-left text-sm transition lg:w-full ${
                    tab === item
                      ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"
                      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-white/[0.08] dark:hover:text-neutral-100"
                  }`}
                >
                  {tc(item)}
                </button>
              ))}
            </nav>
          </aside>

          <main key={tab} className="page-enter min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 lg:block">
            {loading && <p className="text-sm text-neutral-500 dark:text-neutral-400">{tc("Loading live API platform data...")}</p>}
            {!loading && !data && (
              <EmptyState title="Backend unavailable" detail="Start the API backend with `pnpm api` or run both services with `pnpm dev:all`." />
            )}
            {data && (
              <>
                {createdSecret && (
                  <div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
                    <p className="font-semibold">{tc("Copy this key now. It will not be shown again.")}</p>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <code className="min-w-0 flex-1 break-all rounded-md bg-white px-3 py-2 font-mono text-xs text-neutral-950 dark:bg-black/30 dark:text-amber-50">
                        {createdSecret}
                      </code>
                      <ActionButton onClick={() => copyText(createdSecret, tc("Secret copied"))}>
                        <ClipboardCopy className="h-4 w-4" />
                        {tc("Copy")}
                      </ActionButton>
                    </div>
                  </div>
                )}

                {tab === "Overview" && (
                  <Panel
                    title="Overview"
                    description={browserMode
                      ? "Account, balance, usage, key, and project data for this browser-based API simulation."
                      : "Live account, balance, usage, key, and project data from the local LingoFusion API backend."}
                  >
                    <MetricGrid
                      items={[
                        ["Current balance", dollars(data.account.paidBalance + data.account.rewardBalance), "Paid and reward credit available."],
                        ["Pending charges", dollars(data.account.pendingCharges), "Authorized usage waiting to settle."],
                        ["Lifetime API spend", dollars(data.account.lifetimeSpend), "Qualifying paid API consumption."],
                        ["Total requests", data.usage.totalRequests.toLocaleString(), `${data.usage.successfulRequests} successful, ${data.usage.failedRequests} failed.`],
                        ["Input tokens", data.usage.inputTokens.toLocaleString(), "Across request logs."],
                        ["Output tokens", data.usage.outputTokens.toLocaleString(), "Across request logs."],
                      ]}
                    />
                    <div className="mt-5 grid gap-4 lg:grid-cols-3">
                      <InfoCard icon={ShieldCheck} title={browserMode ? "Browser-owned keys" : "Server-owned keys"}>
                        {browserMode
                          ? "Simulation secrets are generated in this browser, shown once, and masked afterward."
                          : "Secrets are generated by the backend, hashed before storage, shown once, and masked afterward."}
                      </InfoCard>
                      <InfoCard icon={Activity} title="Versioned API">
                        `/v1/translate` authenticates Bearer keys, charges prepaid balance, logs requests, and supports idempotency.
                      </InfoCard>
                      <InfoCard icon={CreditCard} title="Prepaid billing">
                        {browserMode
                          ? "Fake recharges and usage deductions are saved locally in this browser."
                          : "Recharges and usage deductions are written to a persistent ledger in `data/api-platform.json`."}
                      </InfoCard>
                    </div>
                  </Panel>
                )}

                {tab === "Playground" && (
                  <Panel title="API playground" description="Spend local fake balance on simulated text or music model responses. Requests authenticate, bill, and appear in logs.">
                    <div role="group" aria-label="Playground service" className="mb-4 inline-flex w-fit rounded-md border border-neutral-300 bg-neutral-100 p-0.5 dark:border-white/15 dark:bg-white/[0.06]">
                      {(["text", "music"] as const).map((mode) => {
                        const selected = playgroundMode === mode;
                        return (
                          <button
                            key={mode}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => {
                              setPlaygroundMode(mode);
                              setTryModel(mode === "music" ? musicModels[0].model : "LingoFusion Pro");
                              setTryInput(mode === "music" ? "Warm cinematic piano with a hopeful, gentle build." : "Hello, how are you?");
                            }}
                            className={`pressable rounded px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 dark:focus-visible:ring-white dark:focus-visible:ring-offset-[#0d0d0d] ${
                              selected
                                ? "bg-neutral-950 text-white shadow-sm dark:bg-white dark:text-neutral-950"
                                : "text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-neutral-100"
                            }`}
                          >
                            {mode === "text" ? "Text" : "Music"}
                          </button>
                        );
                      })}
                    </div>
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
                      <div className="rounded-lg border border-neutral-200 p-4 dark:border-white/10">
                        <div className="grid gap-3 md:grid-cols-2">
                          <TextInput label="API key" value={tryKey} placeholder="Create a key, then paste or use the copied secret" onChange={setTryKey} />
                          {playgroundMode === "text" ? (
                            <div className="grid gap-2">
                              <div role="group" aria-label="Playground text pricing mode" className="inline-flex w-fit rounded-md border border-neutral-300 bg-neutral-100 p-0.5 dark:border-white/15 dark:bg-white/[0.06]">
                                {(["instant", "batch"] as const).map((mode) => {
                                  const selected = playgroundPricingMode === mode;
                                  return (
                                    <button key={mode} type="button" aria-pressed={selected} onClick={() => {
                                      setPlaygroundPricingMode(mode);
                                      window.localStorage.setItem("lingofusion-text-pricing-mode", mode);
                                    }} className={`pressable rounded px-3 py-1.5 text-sm font-medium ${selected ? "bg-neutral-950 text-white shadow-sm dark:bg-white dark:text-neutral-950" : "text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-neutral-100"}`}>
                                      {mode === "instant" ? "Default" : "Batch"}
                                    </button>
                                  );
                                })}
                              </div>
                              <SelectInput label="Model" value={tryModel} onChange={setTryModel}>
                                {playgroundModels.map((model) => <option key={model.model}>{model.model}</option>)}
                              </SelectInput>
                            </div>
                          ) : (
                            <>
                              <SelectInput label="Model" value={tryModel} onChange={setTryModel}>
                                {musicModels.map((model) => <option key={model.model}>{model.model}</option>)}
                              </SelectInput>
                              <NumberInput label="Duration (seconds)" value={tryMusicDurationSeconds} min={1} max={3600} onChange={setTryMusicDurationSeconds} />
                            </>
                          )}
                          {playgroundMode === "text" && <>
                            <LanguageSelect label="Source language" value={tryFromLanguage} onChange={setTryFromLanguage} />
                            <LanguageSelect label="Target language" value={tryToLanguage} onChange={setTryToLanguage} />
                            <SelectInput label="Streaming" value={tryStream ? "true" : "false"} onChange={(value) => setTryStream(value === "true")}>
                              <option value="true">true</option>
                              <option value="false">false</option>
                            </SelectInput>
                          </>}
                        </div>
                        {playgroundMode === "text" && isPicoModel(tryModel) && (
                          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-50">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="font-semibold">LingoFusion Pico is free and local</p>
                                <p className="mt-1 leading-6 text-emerald-900/80 dark:text-emerald-100/80">It runs Qwen 1.7B through LM Studio on this computer. No LingoFusion API key, credits, subscription, or internet connection is used after the model download.</p>
                              </div>
                              <span className="rounded-full bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white dark:bg-emerald-200 dark:text-emerald-950">$0</span>
                            </div>
                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                              <div><p className="font-semibold">Windows</p><ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5">{picoLocalRequirements.windows.slice(0, 6).map((item) => <li key={item}>{item}</li>)}</ul></div>
                              <div><p className="font-semibold">Mac</p><ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5">{picoLocalRequirements.mac.slice(0, 5).map((item) => <li key={item}>{item}</li>)}</ul></div>
                            </div>
                            <label className="mt-4 flex items-start gap-2 text-xs leading-5">
                              <input type="checkbox" checked={picoRequirementsConfirmed} onChange={(event) => setPicoRequirementsConfirmed(event.target.checked)} className="mt-1 h-4 w-4 rounded border-emerald-500" />
                              <span>I reviewed the requirements and understand Pico uses this device's CPU, GPU, RAM or unified memory, storage, and electricity.</span>
                            </label>
                          </div>
                        )}
                        <div className={`mt-3 grid gap-3 ${playgroundMode === "music" ? "" : "lg:grid-cols-2"}`}>
                          <label className="block text-sm">
                            <span className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">{playgroundMode === "music" ? "Music prompt" : "Input text"}</span>
                            <textarea value={tryInput} onChange={(event) => setTryInput(event.target.value)} rows={7} className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-600 dark:border-white/15 dark:bg-[#111111] dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400" />
                          </label>
                          {playgroundMode === "text" && <label className="block text-sm"><span className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">Translated output</span><textarea readOnly value={tryOutput} placeholder="Your translation will appear here." rows={7} className="w-full resize-none rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-950 outline-none dark:border-white/15 dark:bg-white/[0.04] dark:text-neutral-100 dark:placeholder:text-neutral-500" /></label>}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <ActionButton onClick={sendTryRequest} disabled={playgroundMode === "text" && isPicoModel(tryModel) && !picoRequirementsConfirmed}>
                            {playgroundMode === "music" ? <Music className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                            {playgroundMode === "music" ? "Generate simulated music" : tc("Run API call")}
                          </ActionButton>
                          {!isPicoModel(tryModel) && <button
                            type="button"
                            onClick={() => {
                              setTab("API Keys");
                              onNotify(tc("Create a key first, then come back to Playground"));
                            }}
                            className="rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-950 hover:bg-neutral-50 dark:border-white/15 dark:bg-white/5 dark:text-neutral-100 dark:hover:bg-white/10"
                          >
                            {tc("Create key")}
                          </button>}
                        </div>
                        {tryResult && (
                          <div className="space-y-2">
                            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">Input token totals include the source text, translation instructions, and request formatting. Source-text and instruction estimates are included in the usage object.</p>
                            <CodeBlock
                              code={tryResult}
                              language="JSON"
                              syntax="json"
                              onCopy={() => copyText(tryResult, tc("Result copied"))}
                            />
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="rounded-lg border border-neutral-200 p-4 dark:border-white/10">
                          <p className="text-sm text-neutral-500 dark:text-neutral-500">Selected model pricing</p>
                          <p className="mt-2 font-medium text-neutral-950 dark:text-neutral-50">{playgroundMode === "music" ? selectedMusicPlaygroundModel.model : selectedPlaygroundModel.model}</p>
                          {playgroundMode === "music" ? (
                            <div className="mt-3 text-sm">
                              <p className="text-neutral-500 dark:text-neutral-500">Price / minute</p>
                              <p className="mt-1 font-mono font-semibold text-neutral-950 dark:text-neutral-50">{dollars(selectedMusicPlaygroundModel.priceUsd ?? 0)}</p>
                            </div>
                          ) : isPicoModel(selectedPlaygroundModel.model) ? (
                            <div className="mt-3 text-sm">
                              <p className="font-mono text-lg font-semibold text-emerald-700 dark:text-emerald-300">Free</p>
                              <p className="mt-1 leading-5 text-neutral-500 dark:text-neutral-400">Runs on this device with LM Studio. No token pricing or API credits.</p>
                            </div>
                          ) : (
                            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                              <div><p className="text-neutral-500 dark:text-neutral-500">Input / 1M tokens</p><p className="mt-1 font-mono font-semibold text-neutral-950 dark:text-neutral-50">{dollars(selectedPlaygroundModel.inputUsd)}</p></div>
                              <div><p className="text-neutral-500 dark:text-neutral-500">Output / 1M tokens</p><p className="mt-1 font-mono font-semibold text-neutral-950 dark:text-neutral-50">{dollars(selectedPlaygroundModel.outputUsd)}</p></div>
                            </div>
                          )}
                        </div>
                        {!isPicoModel(tryModel) && <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                          <p className="text-sm text-neutral-500 dark:text-neutral-500">{tc("Available fake balance")}</p>
                          <p className="mt-1 text-3xl font-semibold text-neutral-950 dark:text-neutral-50">
                            {dollars(data.account.paidBalance + data.account.rewardBalance)}
                          </p>
                          <p className="mt-2 text-sm leading-5 text-neutral-600 dark:text-neutral-400">
                            {tc("Simulated calls deduct from this local test balance. No real payment method is charged.")}
                          </p>
                        </div>}
                        <div className="rounded-lg border border-neutral-200 p-4 dark:border-white/10">
                          <h4 className="font-semibold text-neutral-950 dark:text-neutral-50">{tc("What this does")}</h4>
                          <ul className="mt-3 space-y-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                            {isPicoModel(tryModel) ? <>
                              <li>Connects only to LM Studio at `127.0.0.1:1234` on this computer.</li>
                              <li>Uses the loaded Qwen 1.7B model identifier.</li>
                              <li>Does not use LingoFusion API keys, credits, subscriptions, logs, or charges.</li>
                            </> : <>
                              <li>{tc(browserMode ? "Authenticates the simulated Bearer key in this browser." : "Authenticates the Bearer key server-side.")}</li>
                              <li>{playgroundMode === "music" ? "Checks the key has `Music generation` permission." : tc("Checks the key has `Text translation` permission.")}</li>
                              <li>{playgroundMode === "music" ? "Uses the selected duration to calculate the charge." : tc("Estimates input/output tokens.")}</li>
                              <li>{tc("Deducts fake prepaid balance.")}</li>
                              <li>{tc("Adds a request log and ledger charge.")}</li>
                            </>}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </Panel>
                )}

                {tab === "Tokenizer" && (
                  <Panel title="Tokenizer" description="Inspect how text is split into tokens before you send a request.">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                      <div>
                        <label className="block text-sm">
                          <span className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">Text to tokenize</span>
                          <textarea value={tokenizerInput} onChange={(event) => setTokenizerInput(event.target.value)} rows={9} placeholder="Paste text here" className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-600 dark:border-white/15 dark:bg-[#111111] dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400" />
                        </label>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <ActionButton onClick={tokenizeInput} disabled={tokenizerLoading || !tokenizerInput.trim()}>
                            {tokenizerLoading ? "Tokenizing..." : "Tokenize text"}
                          </ActionButton>
                          <button type="button" onClick={() => setTokenizerInput(tryInput)} className="rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-950 hover:bg-neutral-50 dark:border-white/15 dark:bg-white/5 dark:text-neutral-100 dark:hover:bg-white/10">Use Playground input</button>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <SelectInput label="Model" value={tokenizerModel} onChange={setTokenizerModel}>
                          {textModelsByPricingMode.instant.map((model) => <option key={model.model}>{model.model}</option>)}
                        </SelectInput>
                        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                          <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">{tokenizerModel === "LingoFusion Pico" ? "Exact tokenizer" : "Estimated tokenizer"}</p>
                          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">{tokenizerModel === "LingoFusion Pico" ? "Uses the loaded Qwen model's tokenizer in LM Studio." : "This provider does not expose token pieces, so the preview is an estimate."}</p>
                        </div>
                      </div>
                    </div>

                    {tokenizerResult && (
                      <div className="mt-6 rounded-lg border border-neutral-200 p-5 dark:border-white/10">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">Total tokens</p>
                            <p className="mt-1 text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white">{tokenizerResult.token_count.toLocaleString()}</p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tokenizerResult.exact ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"}`}>{tokenizerResult.exact ? `Exact: ${tokenizerResult.tokenizer_model}` : "Estimated tokenization"}</span>
                        </div>
                        <div className="mt-5 rounded-md bg-neutral-50 p-3 dark:bg-white/[0.04]">
                          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">{tokenizerResult.exact ? "Token IDs" : "Token preview"}</p>
                          <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto">
                            {(tokenizerResult.exact ? tokenizerResult.token_ids : tokenizerResult.preview_pieces)?.map((token, index) => <span key={`${token}-${index}`} className="rounded bg-white px-2 py-1 font-mono text-xs text-neutral-800 shadow-sm ring-1 ring-neutral-200 dark:bg-[#151515] dark:text-neutral-200 dark:ring-white/10">{String(token).replace(/\n/g, "↵") || "space"}</span>)}
                          </div>
                        </div>
                        {tokenizerResult.truncated && <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">Showing the first 500 tokens.</p>}
                      </div>
                    )}
                  </Panel>
                )}

                {tab === "Projects" && (
                  <Panel title="Projects" description="Create project containers for keys, request logs, spending, and budgets.">
                    <div className="grid gap-3 md:grid-cols-[1fr_1fr_9rem_auto]">
                      <TextInput label="Name" value={newProject.name} onChange={(value) => setNewProject({ ...newProject, name: value })} />
                      <TextInput label="Description" value={newProject.description} onChange={(value) => setNewProject({ ...newProject, description: value })} />
                      <NumberInput label="Budget" value={newProject.budget} min={1} max={1000000} onChange={(value) => setNewProject({ ...newProject, budget: value })} />
                      <ActionButton onClick={createProject} className="self-end">
                        <Plus className="h-4 w-4" />
                        {tc("Create")}
                      </ActionButton>
                    </div>
                    {data.projects.length ? (
                      <Table
                        headers={["Project", "Description", "Status", "Budget", "Created"]}
                        rows={data.projects.map((project) => [
                          project.name,
                          project.description || "No description",
                          project.status,
                          dollars(microCentsToDollars(project.budgetMicroCents)),
                          new Date(project.createdAt).toLocaleString(),
                        ])}
                      />
                    ) : (
                      <EmptyState title="No projects yet" detail="Create your first project to generate API keys and send requests." />
                    )}
                  </Panel>
                )}

                {tab === "API Keys" && (
                  <Panel title="API Keys" description="Create scoped keys for projects. Full secrets are never returned again after creation or rotation.">
                    <div className="grid gap-3 lg:grid-cols-4">
                      <TextInput label="Key name" value={newKey.name} onChange={(value) => setNewKey({ ...newKey, name: value })} />
                      <SelectInput label="Project" value={newKey.projectId} onChange={(value) => setNewKey({ ...newKey, projectId: value })}>
                        <option value="">{tc("Select project")}</option>
                        {data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                      </SelectInput>
                      <TextInput label="Expiration date" value={newKey.expiresAt} placeholder="YYYY-MM-DD or blank" onChange={(value) => setNewKey({ ...newKey, expiresAt: value })} />
                      <NumberInput label="Spend limit" value={newKey.spendLimit} min={0} max={1000000} onChange={(value) => setNewKey({ ...newKey, spendLimit: value })} />
                    </div>
                    <fieldset className="mt-4">
                      <legend className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">{tc("Permissions")}</legend>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {permissionScopes.map((scope) => (
                          <label key={scope} className="flex items-center gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm dark:border-white/10">
                            <input
                              type="checkbox"
                              checked={newKey.scopes.includes(scope)}
                              onChange={(event) =>
                                setNewKey((current) => ({
                                  ...current,
                                  scopes: event.target.checked
                                    ? [...current.scopes, scope]
                                    : current.scopes.filter((item) => item !== scope),
                                }))
                              }
                            />
                            {tc(scope)}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <ActionButton onClick={createKey} className="mt-4">
                      <KeyRound className="h-4 w-4" />
                      {tc("Create key")}
                    </ActionButton>
                    {data.apiKeys.length ? (
                      <div className="mt-5 space-y-3">
                        {data.apiKeys.map((key) => (
                          <div key={key.id} className="rounded-lg border border-neutral-200 p-4 dark:border-white/10">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div>
                                <p className="font-semibold text-neutral-950 dark:text-neutral-50">{key.name}</p>
                                <p className="mt-1 font-mono text-sm text-neutral-600 dark:text-neutral-400">{key.masked}</p>
                                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-500">
                                  {tc("Project")}: {data.projects.find((project) => project.id === key.projectId)?.name ?? key.projectId} · {tc("Status")}: {tc(key.status)}
                                </p>
                                <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-500">{key.scopes.join(", ")}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setConfirmRotate(key)}
                                className="inline-flex items-center justify-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-50 dark:border-white/15 dark:text-neutral-100 dark:hover:bg-white/10"
                              >
                                <RefreshCw className="h-4 w-4" />
                                {tc("Rotate")}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState title="No API keys yet" detail="Create a project, then create a scoped API key for it." />
                    )}
                  </Panel>
                )}

                {tab === "Billing" && (
                  <Panel
                    title="Billing"
                    description={browserMode
                      ? "Add fake test balance and review the ledger saved in this browser. No real payment provider is connected."
                      : "Add local test balance, see paid versus reward credit, and review the server-side ledger. No real payment provider is connected yet."}
                  >
                    <MetricGrid
                      items={[
                        ["Paid credit", dollars(data.account.paidBalance), "Purchased prepaid credit."],
                        ["Reward credit", dollars(data.account.rewardBalance), "Loyalty rewards, not withdrawable."],
                        ["Total purchased", dollars(data.account.totalPaidCreditPurchased), "Successful paid credit purchases."],
                        ["API spend", dollars(data.account.lifetimeSpend), "Actual paid credit consumed by API requests."],
                      ]}
                    />
                    <div className="mt-5 grid gap-3 lg:grid-cols-[12rem_minmax(13rem,auto)_minmax(13rem,auto)]">
                      <NumberInput label="Add balance" value={rechargeAmount} min={5} max={1000} onChange={setRechargeAmount} />
                      <ActionButton
                        onClick={() => setConfirmRecharge(true)}
                        className="self-end"
                        disabled={busyAction === "recharge"}
                      >
                        <CreditCard className="h-4 w-4" />
                        {tc("Review local test balance")}
                      </ActionButton>
                      <button
                        type="button"
                        onClick={() => setConfirmResetLocalData(true)}
                        disabled={busyAction === "reset-local-data"}
                        className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-md border border-red-300 bg-white px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200 dark:hover:bg-red-400/15"
                      >
                        {tc("Reset all test data")}
                      </button>
                    </div>
                    {data.ledger.length ? (
                      <Table
                        headers={["Date", "Type", "Amount", "Description", "Status"]}
                        rows={data.ledger.map((entry) => [
                          new Date(entry.createdAt).toLocaleString(),
                          entry.type,
                          dollars(entry.amount),
                          entry.description,
                          entry.status || "recorded",
                        ])}
                      />
                    ) : (
                      <EmptyState title="No ledger entries" detail="Balance purchases and usage charges will appear here." />
                    )}
                  </Panel>
                )}

                {tab === "Request Logs" && (
                  <Panel title="Request logs" description="Logs come from real API requests. Request bodies and model outputs are not stored here.">
                    <Toolbar>
                      <SelectInput label="Project" value={projectFilter} onChange={setProjectFilter}>
                        <option value="All projects">{tc("All projects")}</option>
                        {data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                      </SelectInput>
                      <SelectInput label="Status" value={statusFilter} onChange={setStatusFilter}>
                        <option value="All statuses">{tc("All statuses")}</option>
                        <option value="Successful">{tc("Successful")}</option>
                        <option value="Failed">{tc("Failed")}</option>
                      </SelectInput>
                      <ActionButton
                        onClick={() =>
                          downloadCsv("lingofusion-request-logs.csv", filteredLogs.map((log) => ({
                            requestId: log.id,
                            timestamp: log.timestamp,
                            endpoint: log.endpoint,
                            model: log.model,
                            status: log.status,
                            cost: log.cost,
                            latencyMs: log.latencyMs,
                          })))
                        }
                      >
                        <Download className="h-4 w-4" />
                        {tc("Export CSV")}
                      </ActionButton>
                    </Toolbar>
                    {filteredLogs.length ? (
                      <Table
                        headers={["Request", "Project", "Endpoint", "Model", "Status", "Tokens", "Cost", "Latency"]}
                        rows={filteredLogs.map((log) => [
                          log.id,
                          data.projects.find((project) => project.id === log.projectId)?.name ?? log.projectId,
                          log.endpoint,
                          log.model,
                          `${log.status} ${log.errorCode}`,
                          (log.totalTokens ?? log.inputTokens + log.outputTokens).toLocaleString(),
                          dollars(log.cost),
                          `${log.latencyMs} ms`,
                        ])}
                      />
                    ) : (
                      <EmptyState title="No request logs yet" detail="Create a key, add balance, then send a test /v1/translate request." />
                    )}
                  </Panel>
                )}

                {tab === "Usage" && (
                  <Panel title="Usage analytics" description="Usage is aggregated from persisted request logs.">
                    <MetricGrid
                      items={[
                        ["Successful requests", data.usage.successfulRequests.toLocaleString(), "Completed with success status."],
                        ["Failed requests", data.usage.failedRequests.toLocaleString(), "Rejected or errored requests."],
                        ["Total tokens", data.usage.totalTokens.toLocaleString(), "Provider-reported input plus output tokens."],
                        ["Reasoning tokens", data.usage.reasoningTokens.toLocaleString(), "Included within provider-reported output tokens."],
                        ["Words processed", data.usage.words.toLocaleString(), "Where text metrics apply."],
                        ["Average latency", `${data.usage.averageLatencyMs} ms`, "Across logged requests."],
                        ["Streaming split", `${data.usage.streamingRequests} / ${data.usage.nonStreamingRequests}`, "Streaming versus non-streaming."],
                      ]}
                    />
                    <ActionButton
                      onClick={() => downloadCsv("lingofusion-usage.csv", [{
                        requests: data.usage.totalRequests,
                        successful: data.usage.successfulRequests,
                        failed: data.usage.failedRequests,
                        inputTokens: data.usage.inputTokens,
                        outputTokens: data.usage.outputTokens,
                        reasoningTokens: data.usage.reasoningTokens,
                        totalSpend: data.usage.totalSpend,
                      }])}
                      className="mt-5"
                    >
                      <Download className="h-4 w-4" />
                      {tc("Export usage CSV")}
                    </ActionButton>
                  </Panel>
                )}

                {tab === "Auto-Recharge" && (
                  <Panel title="Auto-recharge" description="Configure server-persisted recharge settings with validation. Payment capture still requires a real payment provider integration.">
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      <SelectInput label="Enabled" value={autoRecharge.enabled ? "Enabled" : "Disabled"} onChange={(value) => setAutoRecharge({ ...autoRecharge, enabled: value === "Enabled" })}>
                        <option value="Disabled">{tc("Disabled")}</option>
                        <option value="Enabled">{tc("Enabled")}</option>
                      </SelectInput>
                      <NumberInput label="Threshold" value={autoRecharge.threshold} min={1} max={999} onChange={(value) => setAutoRecharge({ ...autoRecharge, threshold: value })} />
                      <NumberInput label="Recharge amount" value={autoRecharge.amount} min={5} max={1000} onChange={(value) => setAutoRecharge({ ...autoRecharge, amount: value })} />
                      <NumberInput label="Monthly limit" value={autoRecharge.monthlyLimit} min={0} max={10000} onChange={(value) => setAutoRecharge({ ...autoRecharge, monthlyLimit: value })} />
                      <TextInput label="Payment method" value={autoRecharge.paymentMethod} onChange={(value) => setAutoRecharge({ ...autoRecharge, paymentMethod: value })} />
                      <SelectInput label="Notifications" value={autoRecharge.notify ? "Enabled" : "Disabled"} onChange={(value) => setAutoRecharge({ ...autoRecharge, notify: value === "Enabled" })}>
                        <option value="Enabled">{tc("Enabled")}</option>
                        <option value="Disabled">{tc("Disabled")}</option>
                      </SelectInput>
                    </div>
                    <ActionButton onClick={saveAutoRecharge} className="mt-4">{tc("Save auto-recharge")}</ActionButton>
                  </Panel>
                )}

                {tab === "Rewards" && (
                  <Panel title="Rewards" description="Rewards are based on lifetime paid API spend, excluding reward credit and unused deposits.">
                    <MetricGrid
                      items={[
                        ["Lifetime qualifying spend", dollars(data.account.lifetimeSpend), "Paid API usage only."],
                        ["Next reward", dollars(nextReward.credit), `At ${dollars(nextReward.spend)} lifetime spend.`],
                        ["Remaining", dollars(nextReward.remaining), "Until the next milestone."],
                        ["Reward balance", dollars(data.account.rewardBalance), "Available reward credit."],
                      ]}
                    />
                    <div className="mt-5 rounded-lg border border-neutral-200 p-4 dark:border-white/10">
                      <div className="mb-2 flex justify-between text-sm">
                        <span>{tc("Progress to next reward")}</span>
                        <span>{nextReward.progress.toFixed(2)}%</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10">
                        <div className="h-full rounded-full bg-neutral-950 dark:bg-white" style={{ width: `${nextReward.progress}%` }} />
                      </div>
                    </div>
                  </Panel>
                )}

                {tab === "Documentation" && (
                  <Panel title="API documentation" description="Use full branded model names in request bodies. Authentication uses Bearer API keys.">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <InfoCard icon={FileText} title="Versioned endpoint">
                        `POST /v1/translate` accepts `model`, `input`, `from_language`, `to_language`, and optional `stream`.
                      </InfoCard>
                      <InfoCard icon={ShieldCheck} title="Idempotency">
                        Send `Idempotency-Key` to retry safely without duplicate processing or duplicate charging.
                      </InfoCard>
                    </div>
                    <CodeBlock
                      code={sdkExamples.curl.code}
                      filename={sdkExamples.curl.filename}
                      language={sdkExamples.curl.label}
                      syntax={sdkExamples.curl.syntax}
                      showLineNumbers
                      onCopy={() => copyText(sdkExamples.curl.code, tc("cURL copied"))}
                    />
                    <Table
                      headers={["Model", "Input / 1M", "Output / 1M"]}
                      rows={data.models.map((model) => [model.model, dollars(model.input), dollars(model.output)])}
                    />
                  </Panel>
                )}

                {tab === "SDKs" && (
                  <Panel title="SDKs and examples" description="Choose your programming language to see a clean, complete translation request.">
                    <div
                      role="group"
                      aria-label={tc("Programming language")}
                      className="flex gap-1 overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 p-1 dark:border-white/10 dark:bg-white/[0.04]"
                    >
                      {(Object.entries(sdkExamples) as Array<[SdkLanguage, (typeof sdkExamples)[SdkLanguage]]>).map(([id, example]) => (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={sdkLanguage === id}
                          onClick={() => setSdkLanguage(id)}
                          className={`pressable shrink-0 rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 dark:focus-visible:ring-white dark:focus-visible:ring-offset-[#0d0d0d] ${
                            sdkLanguage === id
                              ? "bg-neutral-950 text-white shadow-sm dark:bg-white dark:text-neutral-950"
                              : "text-neutral-600 hover:bg-white hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-white/[0.08] dark:hover:text-neutral-100"
                          }`}
                        >
                          {example.label}
                        </button>
                      ))}
                    </div>
                    <CodeBlock
                      key={sdkLanguage}
                      code={sdkExamples[sdkLanguage].code}
                      filename={sdkExamples[sdkLanguage].filename}
                      language={sdkExamples[sdkLanguage].label}
                      syntax={sdkExamples[sdkLanguage].syntax}
                      showLineNumbers
                      onCopy={() => copyText(sdkExamples[sdkLanguage].code, tc("Example copied"))}
                    />
                    <div className="mt-5 rounded-lg border border-neutral-200 p-4 dark:border-white/10">
                      <h4 className="font-semibold text-neutral-950 dark:text-neutral-50">{tc("Want to spend fake balance?")}</h4>
                      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                        {tc(browserMode
                          ? "Use the Playground tab to run simulated API model calls in this browser."
                          : "Use the Playground tab to run simulated API model calls. Those requests authenticate, bill, and log through the backend.")}
                      </p>
                    </div>
                  </Panel>
                )}

                {tab === "Notifications" && (
                  <Panel title="Notifications" description="Browser notification permission is requested only when you click the button.">
                    <ActionButton
                      onClick={async () => {
                        if (!("Notification" in window)) {
                          onNotify(tc("Browser notifications are not supported here"));
                          return;
                        }
                        const permission = await Notification.requestPermission();
                        onNotify(`${tc("Notification permission")}: ${tc(permission)}`);
                      }}
                    >
                      <Bell className="h-4 w-4" />
                      Request browser permission
                    </ActionButton>
                  </Panel>
                )}

                {tab === "Status" && (
                  <Panel title="Status" description="Public-facing component status and incident subscription UI.">
                    <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                      <TextInput label="Subscribe by email" value={statusEmail} placeholder="you@example.com" onChange={setStatusEmail} />
                      <ActionButton
                        onClick={() => {
                          if (!statusEmail.includes("@")) {
                            onNotify(tc("Enter a valid email address"));
                            return;
                          }
                          onNotify(tc("Subscribed to incident updates"));
                          setStatusEmail("");
                        }}
                        className="self-end"
                      >
                        {tc("Subscribe")}
                      </ActionButton>
                    </div>
                    <Table headers={["Service", "Status", "Latency", "90-day uptime"]} rows={statusRows} />
                  </Panel>
                )}
              </>
            )}
          </main>
        </div>
      </section>

      {confirmRotate && (
        <ConfirmDialog
          title="Rotate API key?"
          body="The current key secret will stop working immediately. A replacement will be generated by the backend, shown once, and copied."
          confirmLabel="Rotate key"
          onCancel={() => setConfirmRotate(null)}
          onConfirm={() => rotateKey(confirmRotate)}
        />
      )}

      {confirmRecharge && (
        <ConfirmDialog
          title="Add local test balance?"
          body={`This adds ${dollars(rechargeAmount)} only to the local development ledger. It does not charge a real payment method.`}
          confirmLabel="Add local test balance"
          onCancel={() => setConfirmRecharge(false)}
          onConfirm={() => {
            setConfirmRecharge(false);
            addBalance();
          }}
        />
      )}

      {confirmResetLocalData && (
        <ConfirmDialog
          title="Reset all local test data?"
          body="This sets all fake money and account totals to $0, clears the ledger, request logs, usage stats, idempotency history, jobs, and reward claims. Projects and API keys stay available."
          confirmLabel="Reset all data"
          onCancel={() => setConfirmResetLocalData(false)}
          onConfirm={() => {
            setConfirmResetLocalData(false);
            resetLocalData();
          }}
        />
      )}
    </div>
    </DashboardTextContext.Provider>
  );
}

function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  const t = useDashboardText();
  return (
    <section>
      <div className="mb-5 max-w-3xl">
        <h3 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">{t(title)}</h3>
        <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">{t(description)}</p>
      </div>
      {children}
    </section>
  );
}

function MetricGrid({ items }: { items: Array<[string, string, string]> }) {
  const t = useDashboardText();
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(([label, value, detail]) => (
        <div key={label} className="surface-lift rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-sm text-neutral-500 dark:text-neutral-500">{t(label)}</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-950 dark:text-neutral-50">{value}</p>
          <p className="mt-2 text-sm leading-5 text-neutral-600 dark:text-neutral-400">{t(detail)}</p>
        </div>
      ))}
    </div>
  );
}

function InfoCard({ icon: Icon, title, children }: { icon: typeof Activity; title: string; children: React.ReactNode }) {
  const t = useDashboardText();
  return (
    <article className="surface-lift rounded-lg border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-[#141414]">
      <Icon className="mb-3 h-5 w-5 text-neutral-500 dark:text-neutral-500" />
      <h4 className="font-semibold text-neutral-950 dark:text-neutral-50">{t(title)}</h4>
      <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
        {typeof children === "string" ? t(children) : children}
      </p>
    </article>
  );
}

function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="mb-5 grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">{children}</div>;
}

function TextInput({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (value: string) => void }) {
  const t = useDashboardText();
  return (
    <label className="text-sm">
      <span className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">{t(label)}</span>
      <input
        value={value}
        placeholder={placeholder ? t(placeholder) : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-600 dark:border-white/15 dark:bg-[#111111] dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400"
      />
    </label>
  );
}

function NumberInput({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  const t = useDashboardText();
  return (
    <label className="text-sm">
      <span className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">{t(label)}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Math.min(max, Math.max(min, Number(event.target.value) || min)))}
        className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-600 dark:border-white/15 dark:bg-[#111111] dark:text-neutral-100 dark:focus:border-neutral-400"
      />
    </label>
  );
}

function SelectInput({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  const t = useDashboardText();
  return (
    <label className="text-sm">
      <span className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">{t(label)}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="clean-select h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-600 dark:border-white/15 dark:bg-[#111111] dark:text-neutral-100 dark:focus:border-neutral-400"
      >
        {children}
      </select>
    </label>
  );
}

function LanguageSelect({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const t = useDashboardText();
  return (
    <label className="text-sm">
      <span className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">{t(label)}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="clean-select h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-600 dark:border-white/15 dark:bg-[#111111] dark:text-neutral-100 dark:focus:border-neutral-400"
      >
        {playgroundLanguages.map((language) => <option key={language.code} value={language.name}>{language.name}</option>)}
      </select>
      <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-500">{playgroundLanguages.length.toLocaleString("en-US")} languages available</span>
    </label>
  );
}

function ActionButton({
  onClick,
  children,
  className = "",
  disabled = false,
}: {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        Promise.resolve(onClick()).catch((error) => alert(error.message));
      }}
      className={`pressable inline-flex h-10 items-center justify-center gap-2 rounded-md bg-neutral-950 px-4 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200 ${className}`}
    >
      {children}
    </button>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: Array<Array<string | number | undefined>> }) {
  const t = useDashboardText();
  return (
    <div className="mt-5 overflow-hidden rounded-lg border border-neutral-200 dark:border-white/10">
      <div className="overflow-x-auto">
        <table className="mobile-record-table w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:border-white/10 dark:bg-white/5 dark:text-neutral-500">
            <tr>{headers.map((header) => <th key={header} className="px-4 py-3 font-medium">{t(header)}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-white/10">
            {rows.map((row, index) => (
              <tr key={`${row[0]}-${index}`} className="hover:bg-neutral-50 dark:hover:bg-white/[0.04]">
                {row.map((cell, cellIndex) => (
                  <td data-label={t(headers[cellIndex] ?? "")} key={`${cell}-${cellIndex}`} className="px-4 py-3.5 text-neutral-700 dark:text-neutral-300">
                    {typeof cell === "string" ? t(cell) : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CodeBlock({
  code,
  filename,
  language,
  syntax,
  showLineNumbers = false,
  onCopy,
}: {
  code: string;
  filename?: string;
  language?: string;
  syntax?: string;
  showLineNumbers?: boolean;
  onCopy: () => void;
}) {
  const t = useDashboardText();
  const lines = code.split("\n");
  const highlightedCode = useMemo(() => highlightCode(code, syntax), [code, syntax]);

  return (
    <div className="pricing-table-change mt-5 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 shadow-sm dark:border-white/15">
      <div className="flex min-h-11 items-center justify-between gap-3 border-b border-white/10 bg-neutral-900 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="truncate font-mono text-xs text-neutral-300">{filename ?? t("Example")}</span>
          {language && (
            <span className="shrink-0 rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
              {language}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="pressable inline-flex shrink-0 items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.06] px-2.5 py-1.5 text-xs font-medium text-neutral-200 hover:bg-white/[0.12]"
        >
          <ClipboardCopy className="h-3.5 w-3.5" />
          {t("Copy")}
        </button>
      </div>
      <div className="flex overflow-hidden bg-neutral-950 text-[13px] leading-6 sm:text-sm">
        {showLineNumbers && (
          <div aria-hidden="true" className="select-none overflow-hidden border-r border-white/10 py-4 pl-3 pr-3 text-right text-neutral-600 sm:pl-4">
            {lines.map((_, index) => (
              <span key={index} className="block">
                {index + 1}
              </span>
            ))}
          </div>
        )}
        <pre className="min-w-0 flex-1 overflow-auto py-4 pl-3 pr-4 sm:pl-4">
          <code
            className="syntax-code block min-w-max text-neutral-100"
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          />
        </pre>
      </div>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  const t = useDashboardText();
  return (
    <div className="mt-5 rounded-lg border border-dashed border-neutral-300 p-6 text-sm dark:border-white/15">
      <p className="font-semibold text-neutral-950 dark:text-neutral-50">{t(title)}</p>
      <p className="mt-1 text-neutral-600 dark:text-neutral-400">{t(detail)}</p>
    </div>
  );
}

function ConfirmDialog({ title, body, confirmLabel, onCancel, onConfirm }: { title: string; body: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void }) {
  const t = useDashboardText();
  return (
    <div className="modal-backdrop fixed inset-0 z-[60] grid place-items-center bg-neutral-950/60 p-4 dark:bg-black/75">
      <section className="modal-panel w-full max-w-md rounded-xl border border-neutral-200 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-[#161616]">
        <h3 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">{t(title)}</h3>
        <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">{t(body)}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-50 dark:border-white/15 dark:bg-white/5 dark:text-neutral-100 dark:hover:bg-white/10"
          >
            {t("Cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
          >
            {t(confirmLabel)}
          </button>
        </div>
      </section>
    </div>
  );
}
