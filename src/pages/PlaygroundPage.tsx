import {
  Activity,
  AlertCircle,
  ArrowRightLeft,
  Check,
  ClipboardCopy,
  Code2,
  CreditCard,
  KeyRound,
  Play,
  Plus,
  RefreshCw,
  Sliders,
  Sparkles,
  Square,
  Terminal,
  Trash2,
  Wallet,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ModelIcon } from "../components/shared/FormFields";
import {
  browserApi,
  calculateGrossDeposit,
  defaultBrowserModelPricing,
  getApiBaseUrl,
  shouldUseBrowserApi,
} from "../data/browserApi";
import type {
  DepositLedgerRecord,
  ModelPricingRecord,
  UsageLedgerRecord,
} from "../data/browserApi";
import { playgroundLanguages } from "../data/playgroundLanguages";
import { textModelPresentations } from "../data/pricing";
import { pageQuery } from "../lib/utils";

type TranslationRun = {
  id: string;
  model: string;
  provider?: string;
  fromLanguage: string;
  toLanguage: string;
  inputText: string;
  outputText: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  streaming?: boolean;
  aborted?: boolean;
  createdAt: string;
};

type ApiKeyItem = {
  id: string;
  name: string;
  masked: string;
  key_prefix?: string;
  status: string;
  createdAt: string;
};

const ALLOWED_LINGOFUSION_MODELS = [
  "LingoFusion Nano",
  "LingoFusion Lite",
  "LingoFusion",
  "LingoFusion Pro",
  "LingoFusion Explain",
  "LingoFusion Ultra",
];

async function callApi<T>(path: string, options?: RequestInit): Promise<T> {
  if (shouldUseBrowserApi()) {
    return browserApi<T>(path, options);
  }
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMessage =
      typeof data?.error === "object" && data?.error?.message
        ? data.error.message
        : data?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(errMessage);
  }
  return data as T;
}

function formatCostBadge(costUsd: number): string {
  const fixed6 = Number(costUsd || 0).toFixed(6);
  const trimmed = fixed6.replace(/0+$/, "").replace(/\.$/, "");
  const parts = trimmed.split(".");
  if (!parts[1] || parts[1].length < 2) {
    return Number(costUsd || 0).toFixed(5);
  }
  return trimmed;
}

export function PlaygroundPage({
  onOpenDashboard,
  onNavigate,
  balanceUsd,
  onBalanceChange,
}: {
  onOpenDashboard: () => void;
  onNavigate: (page: string) => void;
  balanceUsd?: number;
  onBalanceChange?: (newBalance: number) => void;
}) {
  const requestedModel = pageQuery().get("model");
  const [models, setModels] = useState<ModelPricingRecord[]>(defaultBrowserModelPricing);
  const [selectedModelId, setSelectedModelId] = useState<string>(() => {
    if (requestedModel && ALLOWED_LINGOFUSION_MODELS.includes(requestedModel)) {
      return requestedModel;
    }
    return "LingoFusion";
  });

  const [fromLanguage, setFromLanguage] = useState<string>("English");
  const [toLanguage, setToLanguage] = useState<string>("French");
  const [userInput, setUserInput] = useState<string>("Hello, how are you?");
  const [translatedOutput, setTranslatedOutput] = useState<string>("");
  const [latestRun, setLatestRun] = useState<TranslationRun | null>(null);
  const [history, setHistory] = useState<TranslationRun[]>([]);

  // Model-specific reasoning toggles (for LingoFusion Pro & LingoFusion Ultra)
  const [proReasoningEnabled, setProReasoningEnabled] = useState<boolean>(false);
  const [ultraMaxEnabled, setUltraMaxEnabled] = useState<boolean>(false);
  const [streamToggle, setStreamToggle] = useState<boolean>(true);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Balance & Ledger state (starts at $0.00)
  const [liveBalance, setLiveBalance] = useState<number>(balanceUsd ?? 0.0);
  const [usageLedger, setUsageLedger] = useState<UsageLedgerRecord[]>([]);
  const [depositLedger, setDepositLedger] = useState<DepositLedgerRecord[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);

  // Stripe Deposit state
  const [depositAmount, setDepositAmount] = useState<number>(10);
  const [depositBusy, setDepositBusy] = useState<boolean>(false);
  const [lastCheckoutSession, setLastCheckoutSession] = useState<{
    checkoutUrl: string;
    sessionId: string;
    netDepositUsd: number;
    grossAmountCents: number;
    grossChargedUsd: number;
    estimatedStripeFeeUsd: number;
  } | null>(null);
  const [depositStatusMessage, setDepositStatusMessage] = useState<string | null>(null);

  // API Key Quick Generator state
  const [newKeyName, setNewKeyName] = useState<string>("LingoFusion API Key");
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof balanceUsd === "number" && Number.isFinite(balanceUsd)) {
      setLiveBalance(balanceUsd);
    }
  }, [balanceUsd]);

  const updateBalance = (val: number) => {
    const clean = Number(Number(val).toFixed(6));
    setLiveBalance(clean);
    onBalanceChange?.(clean);
  };

  const loadModelsAndState = async () => {
    try {
      const modelsResp = await callApi<{ object: string; data: ModelPricingRecord[] }>("/v1/models");
      if (Array.isArray(modelsResp.data) && modelsResp.data.length > 0) {
        const filteredModels = modelsResp.data.filter((m) =>
          ALLOWED_LINGOFUSION_MODELS.includes(m.model_id),
        );
        const list = filteredModels.length > 0 ? filteredModels : defaultBrowserModelPricing;
        setModels(list);
        if (
          requestedModel &&
          list.some((m) => m.model_id.toLowerCase() === requestedModel.toLowerCase())
        ) {
          const match = list.find(
            (m) => m.model_id.toLowerCase() === requestedModel.toLowerCase(),
          );
          if (match) setSelectedModelId(match.model_id);
        } else if (!list.some((m) => m.model_id === selectedModelId)) {
          setSelectedModelId(list[0].model_id);
        }
      }
    } catch {
      // Keep default LingoFusion Nano to Ultra models
    }

    try {
      const dash = await callApi<{
        user?: { balance_usd: number };
        account: { paidBalance: number; rewardBalance: number };
        usageLedger?: UsageLedgerRecord[];
        depositLedger?: DepositLedgerRecord[];
        apiKeys?: ApiKeyItem[];
      }>("/api/dashboard");
      const bal = dash.user?.balance_usd ?? dash.account.paidBalance;
      updateBalance(bal);
      if (dash.usageLedger) setUsageLedger(dash.usageLedger);
      if (dash.depositLedger) setDepositLedger(dash.depositLedger);
      if (dash.apiKeys) setApiKeys(dash.apiKeys);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadModelsAndState();
  }, []);

  const activeModel = useMemo(
    () =>
      models.find((m) => m.model_id === selectedModelId) ??
      models[0] ??
      defaultBrowserModelPricing[2],
    [models, selectedModelId],
  );

  const presentation = textModelPresentations[activeModel.model_id];

  const depositBreakdown = useMemo(
    () => calculateGrossDeposit(Math.max(0, Number(depositAmount) || 0)),
    [depositAmount],
  );

  const handleRunTranslation = async () => {
    if (!userInput.trim() || isRunning) return;
    setErrorBanner(null);
    setIsRunning(true);
    setTranslatedOutput("");

    const runId = `run-${Date.now()}`;
    const currentInput = userInput.trim();

    const payload: Record<string, unknown> = {
      model: activeModel.model_id,
      from_language: fromLanguage,
      to_language: toLanguage,
      input: currentInput,
      messages: [{ role: "user", content: currentInput }],
      stream: streamToggle,
      ...(activeModel.model_id === "LingoFusion Pro" && proReasoningEnabled
        ? { reasoning_enabled: true, reasoning_effort: "medium" }
        : {}),
      ...(activeModel.model_id === "LingoFusion Ultra"
        ? {
            reasoning: "pro",
            reasoning_effort: ultraMaxEnabled ? "max" : "high",
            max: ultraMaxEnabled,
          }
        : {}),
    };

    const initialRun: TranslationRun = {
      id: runId,
      model: activeModel.model_id,
      provider: activeModel.provider,
      fromLanguage,
      toLanguage,
      inputText: currentInput,
      outputText: "",
      promptTokens: Math.max(1, Math.ceil(currentInput.length / 4)),
      completionTokens: 0,
      costUsd: 0,
      streaming: streamToggle,
      createdAt: new Date().toISOString(),
    };
    setLatestRun(initialRun);

    if (shouldUseBrowserApi() || !streamToggle) {
      try {
        const response = await callApi<{
          id: string;
          model: string;
          provider?: string;
          choices: Array<{ message: { content: string } }>;
          usage: {
            prompt_tokens: number;
            completion_tokens: number;
            total_tokens: number;
            cost_usd: number;
            balance_usd?: number;
          };
        }>("/api/playground/chat", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        const fullContent = response.choices?.[0]?.message?.content || "";
        const pTokens = response.usage?.prompt_tokens ?? 1;
        const cTokens = response.usage?.completion_tokens ?? 1;
        const costUsd = response.usage?.cost_usd ?? 0;

        if (streamToggle && fullContent) {
          const pieces = fullContent.match(/\S+\s*/g) || [fullContent];
          let acc = "";
          for (let i = 0; i < pieces.length; i++) {
            acc += pieces[i];
            const partialCompletionTokens = i + 1;
            const partialCost = Number(
              (
                pTokens * (activeModel.input_per_million / 1_000_000) +
                partialCompletionTokens * (activeModel.output_per_million / 1_000_000)
              ).toFixed(6),
            );
            setTranslatedOutput(acc);
            setLatestRun({
              ...initialRun,
              outputText: acc,
              promptTokens: pTokens,
              completionTokens: partialCompletionTokens,
              costUsd: partialCost,
              streaming: i < pieces.length - 1,
            });
            await new Promise((r) => setTimeout(r, 15));
          }
        }

        const completedRun: TranslationRun = {
          ...initialRun,
          outputText: fullContent,
          promptTokens: pTokens,
          completionTokens: cTokens,
          costUsd,
          streaming: false,
        };
        setTranslatedOutput(fullContent);
        setLatestRun(completedRun);
        setHistory((prev) => [completedRun, ...prev.slice(0, 9)]);

        if (typeof response.usage?.balance_usd === "number") {
          updateBalance(response.usage.balance_usd);
        }
        await loadModelsAndState();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Request failed";
        setErrorBanner(message);
        setLatestRun(null);
      } finally {
        setIsRunning(false);
      }
      return;
    }

    // Streaming SSE fetch to POST /api/playground/chat
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/playground/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const errMsg =
          errBody?.error?.message || errBody?.message || `HTTP ${response.status}`;
        throw new Error(errMsg);
      }

      if (!response.body) {
        throw new Error("Streaming body unavailable");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedText = "";
      let promptTokens = Math.max(1, Math.ceil(currentInput.length / 4));
      let completionTokens = 0;
      let finalCostUsd: number | undefined;

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const evt of events) {
          const lines = evt.split("\n");
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const rawData = line.slice(5).trim();
            if (!rawData || rawData === "[DONE]") continue;
            try {
              const parsed = JSON.parse(rawData);
              const deltaContent = parsed.choices?.[0]?.delta?.content;
              if (typeof deltaContent === "string" && deltaContent.length > 0) {
                accumulatedText += deltaContent;
                completionTokens += 1;
                const liveCost = Number(
                  (
                    promptTokens * (activeModel.input_per_million / 1_000_000) +
                    completionTokens * (activeModel.output_per_million / 1_000_000)
                  ).toFixed(6),
                );
                setTranslatedOutput(accumulatedText);
                setLatestRun({
                  ...initialRun,
                  outputText: accumulatedText,
                  promptTokens,
                  completionTokens,
                  costUsd: liveCost,
                  streaming: true,
                });
              }
              if (parsed.usage) {
                if (typeof parsed.usage.prompt_tokens === "number") {
                  promptTokens = parsed.usage.prompt_tokens;
                }
                if (typeof parsed.usage.completion_tokens === "number") {
                  completionTokens = parsed.usage.completion_tokens;
                }
                if (typeof parsed.usage.cost_usd === "number") {
                  finalCostUsd = parsed.usage.cost_usd;
                }
                if (typeof parsed.usage.balance_usd === "number") {
                  updateBalance(parsed.usage.balance_usd);
                }
              }
            } catch {
              // ignore malformed SSE line
            }
          }
        }
        if (done) break;
      }

      const computedCost =
        finalCostUsd ??
        Number(
          (
            promptTokens * (activeModel.input_per_million / 1_000_000) +
            completionTokens * (activeModel.output_per_million / 1_000_000)
          ).toFixed(6),
        );

      const completedRun: TranslationRun = {
        ...initialRun,
        outputText: accumulatedText,
        promptTokens,
        completionTokens,
        costUsd: computedCost,
        streaming: false,
      };
      setTranslatedOutput(accumulatedText);
      setLatestRun(completedRun);
      setHistory((prev) => [completedRun, ...prev.slice(0, 9)]);
      await loadModelsAndState();
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        setLatestRun((prev) =>
          prev ? { ...prev, streaming: false, aborted: true } : null,
        );
        await loadModelsAndState();
      } else {
        const message = err instanceof Error ? err.message : "Stream failed";
        setErrorBanner(message);
        setLatestRun(null);
      }
    } finally {
      abortControllerRef.current = null;
      setIsRunning(false);
    }
  };

  const handleStopStream = () => {
    abortControllerRef.current?.abort();
  };

  const swapLanguages = () => {
    setFromLanguage(toLanguage);
    setToLanguage(fromLanguage);
    if (translatedOutput) {
      setUserInput(translatedOutput);
      setTranslatedOutput(userInput);
    }
  };

  const handleCreateStripeDeposit = async () => {
    setErrorBanner(null);
    setDepositStatusMessage(null);
    if (!Number.isFinite(depositAmount) || depositAmount < 5) {
      setErrorBanner("Minimum deposit amount is $5.00 USD.");
      return;
    }
    setDepositBusy(true);
    try {
      const session = await callApi<{
        checkoutUrl: string;
        sessionId: string;
        netDepositUsd: number;
        grossAmountCents: number;
        grossChargedUsd: number;
        estimatedStripeFeeUsd: number;
      }>("/api/billing/deposit", {
        method: "POST",
        body: JSON.stringify({ depositAmount }),
      });
      setLastCheckoutSession(session);
      setDepositStatusMessage(
        `Stripe Checkout session created: Charging $${session.grossChargedUsd.toFixed(2)} (${session.grossAmountCents} cents) to net exact $${session.netDepositUsd.toFixed(2)} credit.`,
      );
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Failed to create deposit session");
    } finally {
      setDepositBusy(false);
    }
  };

  const handleSimulateStripeWebhook = async (sessionToComplete?: {
    sessionId: string;
    netDepositUsd: number;
    grossAmountCents: number;
  }) => {
    const target = sessionToComplete ?? {
      sessionId: lastCheckoutSession?.sessionId || `cs_test_${Date.now()}`,
      netDepositUsd: lastCheckoutSession?.netDepositUsd || depositBreakdown.netDepositedUsd,
      grossAmountCents: lastCheckoutSession?.grossAmountCents || depositBreakdown.grossAmountCents,
    };
    setDepositBusy(true);
    setErrorBanner(null);
    try {
      const res = await callApi<{
        received: boolean;
        balance_usd: number;
        net_deposited_usd: number;
        gross_charged_usd: number;
      }>("/api/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify({
          id: `evt_${Date.now()}`,
          type: "checkout.session.completed",
          data: {
            object: {
              id: target.sessionId,
              amount_total: target.grossAmountCents,
              payment_status: "paid",
              metadata: {
                userId: "00000000-0000-4000-8000-000000000001",
                netDepositUsd: target.netDepositUsd.toString(),
              },
            },
          },
        }),
      });
      if (typeof res.balance_usd === "number") {
        updateBalance(res.balance_usd);
      }
      setDepositStatusMessage(
        `Webhook checkout.session.completed settled! Net +$${target.netDepositUsd.toFixed(2)} credited to balance (Gross charged: $${(target.grossAmountCents / 100).toFixed(2)}).`,
      );
      setLastCheckoutSession(null);
      await loadModelsAndState();
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Webhook settlement failed");
    } finally {
      setDepositBusy(false);
    }
  };

  const handleGenerateApiKey = async () => {
    if (!newKeyName.trim()) return;
    try {
      const res = await callApi<{
        secret: string;
        key_id: string;
        key_prefix: string;
      }>("/api/keys", {
        method: "POST",
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      setGeneratedSecret(res.secret);
      await loadModelsAndState();
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Could not generate API key");
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore
    }
  };

  const curlSnippet = `curl ${window.location.origin}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${generatedSecret || "sk_live_YOUR_API_KEY"}" \\
  -d '{
    "model": "${activeModel.model_id}",
    "from_language": "${fromLanguage}",
    "to_language": "${toLanguage}",
    "messages": [
      {"role": "user", "content": ${JSON.stringify(userInput)}}
    ],
    "stream": ${streamToggle}
  }'`;

  return (
    <section className="mx-auto max-w-7xl py-4 sm:py-8">
      {/* Top Playground Header Bar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-neutral-200/90 bg-neutral-50/70 p-5 shadow-xs backdrop-blur-sm dark:border-white/10 dark:bg-neutral-900/60 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <ModelIcon presentation={presentation} size="catalog" />
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200/80 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-neutral-800 shadow-2xs dark:border-white/10 dark:bg-white/[0.06] dark:text-neutral-200">
              <Sparkles className="h-3 w-3 text-amber-500" />
              LingoFusion Playground
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">
              {activeModel.model_id}
            </h1>
            <p className="mt-0.5 text-sm text-neutral-600 dark:text-neutral-400">
              {presentation?.capability ?? "Select a LingoFusion model, enter source text, and generate translated output."}
            </p>
          </div>
        </div>

        {/* Live Balance Indicator Card in Playground Header */}
        <div className="flex flex-wrap items-center gap-3">
          <div
            data-testid="playground-live-balance"
            className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-2.5 dark:border-emerald-500/30 dark:bg-emerald-500/10"
          >
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-600 text-white dark:bg-emerald-500 dark:text-neutral-950">
              <Wallet className="h-4 w-4" />
            </div>
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Live Balance
              </span>
              <span
                data-testid="live-balance-value"
                className="font-mono text-lg font-bold tracking-tight text-emerald-950 dark:text-emerald-100"
              >
                ${liveBalance.toFixed(2)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenDashboard}
            className="pressable inline-flex h-11 items-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 text-xs font-semibold text-neutral-900 shadow-2xs transition hover:bg-neutral-50 dark:border-white/15 dark:bg-neutral-800 dark:text-white dark:hover:bg-neutral-700"
          >
            <Terminal className="h-4 w-4" />
            API Dashboard
          </button>
        </div>
      </div>

      {errorBanner && (
        <div
          role="alert"
          className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            <span>{errorBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="text-xs font-semibold underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main 2-Column Playground Layout */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[21rem_minmax(0,1fr)]">
        {/* Left Column: Model Selector (LingoFusion Nano to Ultra) & Stripe Deposit */}
        <div className="space-y-5">
          {/* Model & Settings Card */}
          <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-neutral-900/70">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                <Sliders className="h-4 w-4 text-neutral-500" />
                Model & Settings
              </h2>
              <button
                type="button"
                onClick={() => onNavigate("Models")}
                className="text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
              >
                All Models →
              </button>
            </div>

            {/* Model Selector Dropdown (Strictly LingoFusion Nano to Ultra) */}
            <label className="mt-4 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Model
              <select
                aria-label="Select Model"
                data-testid="playground-model-select"
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-950 outline-none focus:border-neutral-900 dark:border-white/15 dark:bg-neutral-950 dark:text-white"
              >
                {models.map((m) => (
                  <option key={m.model_id} value={m.model_id}>
                    {m.model_id} — ${m.input_per_million.toFixed(2)} in / $
                    {m.output_per_million.toFixed(2)} out per 1M
                  </option>
                ))}
              </select>
            </label>

            {/* Selected Model Rate Pill */}
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-neutral-200/80 bg-neutral-50 p-3 text-xs dark:border-white/10 dark:bg-white/[0.03]">
              <div>
                <span className="text-neutral-500 dark:text-neutral-400">Input / 1M tokens</span>
                <p className="mt-0.5 font-mono text-sm font-semibold text-neutral-950 dark:text-white">
                  ${activeModel.input_per_million.toFixed(2)}
                </p>
              </div>
              <div>
                <span className="text-neutral-500 dark:text-neutral-400">Output / 1M tokens</span>
                <p className="mt-0.5 font-mono text-sm font-semibold text-neutral-950 dark:text-white">
                  ${activeModel.output_per_million.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Optional Reasoning Toggle for LingoFusion Pro */}
            {activeModel.model_id === "LingoFusion Pro" && (
              <div className="mt-4 flex items-center justify-between rounded-xl border border-neutral-200/80 bg-neutral-50/70 px-3.5 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
                <div>
                  <span className="block text-xs font-semibold text-neutral-900 dark:text-white">
                    Reasoning (Medium)
                  </span>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Enable medium reasoning depth
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={proReasoningEnabled}
                  data-testid="playground-pro-reasoning-toggle"
                  onClick={() => setProReasoningEnabled((v) => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    proReasoningEnabled
                      ? "bg-neutral-950 dark:bg-white"
                      : "bg-neutral-300 dark:bg-neutral-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition dark:bg-neutral-950 ${
                      proReasoningEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            )}

            {/* Optional Max Reasoning Toggle for LingoFusion Ultra */}
            {activeModel.model_id === "LingoFusion Ultra" && (
              <div className="mt-4 flex items-center justify-between rounded-xl border border-neutral-200/80 bg-neutral-50/70 px-3.5 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
                <div>
                  <span className="block text-xs font-semibold text-neutral-900 dark:text-white">
                    Max Reasoning Effort
                  </span>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {ultraMaxEnabled ? "Pro reasoning (Max effort)" : "Pro reasoning (High effort)"}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={ultraMaxEnabled}
                  data-testid="playground-ultra-max-toggle"
                  onClick={() => setUltraMaxEnabled((v) => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    ultraMaxEnabled
                      ? "bg-neutral-950 dark:bg-white"
                      : "bg-neutral-300 dark:bg-neutral-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition dark:bg-neutral-950 ${
                      ultraMaxEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            )}

            {/* Stream Toggle */}
            <div className="mt-4 flex items-center justify-between rounded-xl border border-neutral-200/80 bg-neutral-50/70 px-3.5 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
              <div>
                <span className="block text-xs font-semibold text-neutral-900 dark:text-white">
                  Stream Output
                </span>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Real-time token streaming
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={streamToggle}
                data-testid="playground-stream-toggle"
                onClick={() => setStreamToggle((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  streamToggle
                    ? "bg-neutral-950 dark:bg-white"
                    : "bg-neutral-300 dark:bg-neutral-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition dark:bg-neutral-950 ${
                    streamToggle ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Stripe Deposit Card with Fee Gross-Up Calculator */}
          <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-neutral-900/70">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                <CreditCard className="h-4 w-4 text-neutral-500" />
                Deposit Credits (Stripe)
              </h2>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                Min $5.00
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
              Stripe fees (2.9% + $0.30) are automatically grossed up so your balance receives the exact net deposit.
            </p>

            <div className="mt-3">
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Net Deposit Amount (USD)
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="number"
                    min={5}
                    step={1}
                    data-testid="deposit-amount-input"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(Number(e.target.value))}
                    className="h-10 flex-1 rounded-lg border border-neutral-300 bg-white px-3 font-mono text-sm text-neutral-950 outline-none dark:border-white/15 dark:bg-neutral-950 dark:text-white"
                  />
                  {[5, 10, 25, 50].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDepositAmount(preset)}
                      className={`rounded-lg border px-2.5 text-xs font-semibold transition ${
                        depositAmount === preset
                          ? "border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950"
                          : "border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300"
                      }`}
                    >
                      ${preset}
                    </button>
                  ))}
                </div>
              </label>
            </div>

            {/* Live Gross-Up Breakdown Box */}
            <div className="mt-3 space-y-1.5 rounded-xl border border-neutral-200/80 bg-neutral-50 p-3 text-xs dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex justify-between">
                <span className="text-neutral-500 dark:text-neutral-400">Net Credit Added:</span>
                <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                  +${depositBreakdown.netDepositedUsd.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500 dark:text-neutral-400">
                  Stripe Fee (2.9% + $0.30):
                </span>
                <span className="font-mono text-neutral-700 dark:text-neutral-300">
                  ${depositBreakdown.estimatedStripeFeeUsd.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between border-t border-neutral-200/80 pt-1.5 font-semibold text-neutral-950 dark:border-white/10 dark:text-white">
                <span>Gross Charge:</span>
                <span className="font-mono" data-testid="gross-charge-preview">
                  ${depositBreakdown.grossChargedUsd.toFixed(2)} ({depositBreakdown.grossAmountCents}{" "}
                  ¢)
                </span>
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                disabled={depositBusy}
                data-testid="create-deposit-btn"
                onClick={handleCreateStripeDeposit}
                className="pressable inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
              >
                <CreditCard className="h-3.5 w-3.5" />
                {depositBusy
                  ? "Processing..."
                  : `Deposit $${depositBreakdown.netDepositedUsd.toFixed(2)} (Charged $${depositBreakdown.grossChargedUsd.toFixed(2)})`}
              </button>

              <button
                type="button"
                disabled={depositBusy || depositAmount < 5}
                data-testid="simulate-webhook-btn"
                onClick={() => handleSimulateStripeWebhook()}
                className="pressable inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50/80 px-3 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
              >
                <Zap className="h-3.5 w-3.5" />
                Instant Credit +${depositBreakdown.netDepositedUsd.toFixed(2)}
              </button>
            </div>

            {depositStatusMessage && (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/70 p-2.5 text-xs text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                {depositStatusMessage}
              </div>
            )}
          </div>

          {/* API Keys Card */}
          <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-neutral-900/70">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
              <KeyRound className="h-4 w-4 text-neutral-500" />
              API Keys
            </h2>
            <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
              Create a key to call <code>/v1/chat/completions</code> directly.
            </p>

            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Key name..."
                className="h-9 flex-1 rounded-lg border border-neutral-300 bg-white px-2.5 text-xs text-neutral-950 outline-none dark:border-white/15 dark:bg-neutral-950 dark:text-white"
              />
              <button
                type="button"
                onClick={handleGenerateApiKey}
                data-testid="generate-api-key-btn"
                className="pressable inline-flex h-9 items-center gap-1 rounded-lg bg-neutral-950 px-3 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950"
              >
                <Plus className="h-3.5 w-3.5" />
                Create
              </button>
            </div>

            {generatedSecret && (
              <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
                <div className="flex items-center justify-between font-semibold">
                  <span>Secret Key (shown once):</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(generatedSecret, "secret")}
                    className="inline-flex items-center gap-1 rounded bg-amber-900/10 px-2 py-0.5 text-[11px] hover:bg-amber-900/20 dark:bg-white/10"
                  >
                    {copiedId === "secret" ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <ClipboardCopy className="h-3 w-3" />
                    )}
                    {copiedId === "secret" ? "Copied" : "Copy"}
                  </button>
                </div>
                <code
                  data-testid="generated-api-key-secret"
                  className="mt-1.5 block break-all rounded bg-white/90 p-2 font-mono text-[11px] text-neutral-900 dark:bg-black/40 dark:text-amber-100"
                >
                  {generatedSecret}
                </code>
              </div>
            )}

            {apiKeys.length > 0 && (
              <div className="mt-3 max-h-32 space-y-1.5 overflow-y-auto">
                {apiKeys.slice(0, 4).map((k) => (
                  <div
                    key={k.id}
                    className="flex items-center justify-between rounded-lg border border-neutral-200/70 bg-neutral-50/70 px-2.5 py-1.5 text-xs dark:border-white/10 dark:bg-white/[0.02]"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-neutral-900 dark:text-white">
                        {k.name}
                      </p>
                      <p className="font-mono text-[11px] text-neutral-500">
                        {k.key_prefix ? `${k.key_prefix}...` : k.masked}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                      {k.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Clean Input -> Translated Output Box (No System Prompt) */}
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-neutral-900/70">
            {/* Language Pair Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/80 pb-4 dark:border-white/10">
              <div className="flex flex-1 flex-wrap items-center gap-2 sm:gap-3">
                <label className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  <span>From</span>
                  <select
                    aria-label="Source language"
                    value={fromLanguage}
                    onChange={(e) => setFromLanguage(e.target.value)}
                    className="h-9 rounded-lg border border-neutral-300 bg-white px-3 text-xs font-semibold text-neutral-950 outline-none dark:border-white/15 dark:bg-neutral-950 dark:text-white"
                  >
                    {playgroundLanguages.map((lang) => (
                      <option key={lang.code} value={lang.name}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={swapLanguages}
                  title="Swap languages"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10"
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                </button>

                <label className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  <span>To</span>
                  <select
                    aria-label="Target language"
                    value={toLanguage}
                    onChange={(e) => setToLanguage(e.target.value)}
                    className="h-9 rounded-lg border border-neutral-300 bg-white px-3 text-xs font-semibold text-neutral-950 outline-none dark:border-white/15 dark:bg-neutral-950 dark:text-white"
                  >
                    {playgroundLanguages.map((lang) => (
                      <option key={lang.code} value={lang.name}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex items-center gap-2">
                {isRunning && streamToggle ? (
                  <button
                    type="button"
                    onClick={handleStopStream}
                    data-testid="playground-stop-btn"
                    className="pressable inline-flex h-10 items-center gap-2 rounded-xl bg-red-600 px-5 text-xs font-semibold text-white shadow-xs hover:bg-red-700"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                    Stop
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isRunning || !userInput.trim()}
                    onClick={handleRunTranslation}
                    data-testid="playground-run-btn"
                    className="pressable inline-flex h-10 items-center gap-2 rounded-xl bg-neutral-950 px-5 text-xs font-semibold text-white shadow-xs transition hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    {isRunning ? "Translating..." : "Translate"}
                  </button>
                )}
              </div>
            </div>

            {/* Side-by-Side Input Text and Translated Output Text */}
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {/* Input Box */}
              <div className="flex flex-col">
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="playground-user-input"
                    className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
                  >
                    Input Text ({fromLanguage})
                  </label>
                  {userInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setUserInput("");
                        setTranslatedOutput("");
                        setLatestRun(null);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                    >
                      <Trash2 className="h-3 w-3" />
                      Clear
                    </button>
                  )}
                </div>
                <textarea
                  id="playground-user-input"
                  data-testid="playground-user-input"
                  rows={8}
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      handleRunTranslation();
                    }
                  }}
                  placeholder="Type or paste text to translate..."
                  className="w-full flex-1 rounded-xl border border-neutral-300 bg-white p-3.5 text-sm leading-6 text-neutral-950 outline-none transition focus:border-neutral-900 dark:border-white/15 dark:bg-neutral-950 dark:text-white"
                />
              </div>

              {/* Translated Output Box */}
              <div className="flex flex-col">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Translated Output ({toLanguage} • {activeModel.model_id})
                  </span>
                  {translatedOutput && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(translatedOutput, "output")}
                      className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                    >
                      {copiedId === "output" ? (
                        <Check className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <ClipboardCopy className="h-3 w-3" />
                      )}
                      {copiedId === "output" ? "Copied" : "Copy"}
                    </button>
                  )}
                </div>
                <div
                  data-testid="playground-output-box"
                  className="flex min-h-[12.5rem] flex-1 flex-col justify-between rounded-xl border border-neutral-200/90 bg-neutral-50/70 p-3.5 text-sm leading-6 text-neutral-950 dark:border-white/10 dark:bg-white/[0.03] dark:text-neutral-100"
                >
                  <div className="whitespace-pre-wrap">
                    {translatedOutput ? (
                      <>
                        {translatedOutput}
                        {latestRun?.streaming && " ▋"}
                      </>
                    ) : (
                      <span className="text-neutral-400 dark:text-neutral-500">
                        {isRunning
                          ? "Generating translation..."
                          : `Translated output from ${activeModel.model_id} will appear here.`}
                      </span>
                    )}
                  </div>

                  {/* Real-time token usage and cost breakdown badge shown below output */}
                  {latestRun && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200/80 pt-3 dark:border-white/10">
                      <span
                        data-testid="response-usage-badge"
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-mono text-xs font-semibold text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                      >
                        <Activity className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        Tokens: {latestRun.promptTokens} in / {latestRun.completionTokens} out • Cost: $
                        {formatCostBadge(latestRun.costUsd)}
                      </span>
                      <span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                        {latestRun.model} (${latestRun.costUsd.toFixed(6)} USD)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Translations List */}
          {history.length > 0 && (
            <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-neutral-900/70">
              <div className="flex items-center justify-between pb-3">
                <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Recent Playground Runs
                </h3>
                <button
                  type="button"
                  onClick={() => setHistory([])}
                  className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                >
                  Clear history
                </button>
              </div>
              <div className="space-y-3">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-3.5 text-xs dark:border-white/10 dark:bg-white/[0.02]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-neutral-900 dark:text-white">
                        {item.model} ({item.fromLanguage} → {item.toLanguage})
                      </span>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                        Tokens: {item.promptTokens} in / {item.completionTokens} out • Cost: $
                        {formatCostBadge(item.costUsd)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-neutral-600 dark:text-neutral-400">
                      <strong className="text-neutral-800 dark:text-neutral-200">Input:</strong>{" "}
                      {item.inputText}
                    </p>
                    <p className="mt-1 text-neutral-900 dark:text-neutral-100">
                      <strong className="text-neutral-800 dark:text-neutral-200">Output:</strong>{" "}
                      {item.outputText}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Direct API Call Quickstart */}
          <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-neutral-900/70">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-neutral-500" />
                <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Direct API Call (<code>POST /v1/chat/completions</code>)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(curlSnippet, "curl")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:border-white/10 dark:text-neutral-300 dark:hover:bg-white/10"
              >
                {copiedId === "curl" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <ClipboardCopy className="h-3.5 w-3.5" />
                )}
                {copiedId === "curl" ? "Copied" : "Copy cURL"}
              </button>
            </div>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-neutral-950 p-4 font-mono text-xs leading-5 text-neutral-100">
              <code>{curlSnippet}</code>
            </pre>
          </div>

          {/* Live SQL Usage & Deposit Ledgers */}
          <div className="grid gap-5 xl:grid-cols-2">
            {/* Usage Ledger */}
            <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-neutral-900/70">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Usage Ledger (<code>usage_ledger</code>)
                </h3>
                <button
                  type="button"
                  onClick={loadModelsAndState}
                  className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                >
                  <RefreshCw className="h-3 w-3" /> Refresh
                </button>
              </div>
              {usageLedger.length === 0 ? (
                <p className="mt-3 text-xs text-neutral-500">
                  No token deductions recorded yet.
                </p>
              ) : (
                <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                  {usageLedger.slice(0, 8).map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between rounded-lg border border-neutral-200/70 bg-neutral-50/60 px-3 py-2 text-xs dark:border-white/10 dark:bg-white/[0.02]"
                    >
                      <div>
                        <span className="font-semibold text-neutral-900 dark:text-white">
                          {u.model_id}
                        </span>{" "}
                        <span className="rounded bg-neutral-200/80 px-1.5 py-0.5 font-mono text-[10px] dark:bg-white/10">
                          {u.source}
                        </span>
                        <p className="mt-0.5 font-mono text-[11px] text-neutral-500">
                          {u.prompt_tokens} in / {u.completion_tokens} out
                        </p>
                      </div>
                      <span className="font-mono font-semibold text-red-600 dark:text-red-400">
                        -${Number(u.cost_usd).toFixed(6)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Deposit Ledger */}
            <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-neutral-900/70">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Deposit Ledger (<code>deposit_ledger</code>)
                </h3>
                <span className="font-mono text-[11px] text-neutral-500">Stripe Gross-Up</span>
              </div>
              {depositLedger.length === 0 ? (
                <p className="mt-3 text-xs text-neutral-500">
                  No Stripe deposits settled yet.
                </p>
              ) : (
                <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                  {depositLedger.slice(0, 8).map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between rounded-lg border border-neutral-200/70 bg-neutral-50/60 px-3 py-2 text-xs dark:border-white/10 dark:bg-white/[0.02]"
                    >
                      <div>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                          Net +${Number(d.net_deposited_usd).toFixed(2)}
                        </span>
                        <p className="mt-0.5 font-mono text-[11px] text-neutral-500">
                          Gross charged: ${Number(d.gross_charged_usd).toFixed(2)} • {d.status}
                        </p>
                      </div>
                      <span className="font-mono text-[10px] text-neutral-400">
                        {d.stripe_session_id.slice(0, 14)}...
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
