import {
  Activity,
  AlertCircle,
  ArrowRightLeft,
  Check,
  ChevronDown,
  ClipboardCopy,
  CreditCard,
  Play,
  Plus,
  Square,
  Trash2,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ModelIcon } from "../components/shared/FormFields";
import {
  browserApi,
  calculateGrossDeposit,
  defaultBrowserModelPricing,
  getApiBaseUrl,
  getWebSearchCallRateUsd,
  recordBrowserStreamUsage,
  shouldUseBrowserApi,
  streamChatCompletionBrowser,
} from "../data/browserApi";
import type { ModelPricingRecord } from "../data/browserApi";
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

const ALLOWED_LINGOFUSION_MODELS = [
  "LingoFusion Nano",
  "LingoFusion Lite",
  "LingoFusion",
  "LingoFusion Pro",
  "ExplainFusion",
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
  balanceUsd,
  onBalanceChange,
}: {
  onOpenDashboard?: () => void;
  onNavigate?: (page: string) => void;
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

  // Model-specific reasoning toggles (for LingoFusion Pro & LingoFusion Ultra) & Web Search
  const [proReasoningEnabled, setProReasoningEnabled] = useState<boolean>(false);
  const [ultraMaxEnabled, setUltraMaxEnabled] = useState<boolean>(false);
  const [allowWebSearch, setAllowWebSearch] = useState<boolean>(false);
  const [streamToggle, setStreamToggle] = useState<boolean>(true);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Balance state (starts at $0.00)
  const [liveBalance, setLiveBalance] = useState<number>(balanceUsd ?? 0.0);

  // Deposit Drawer / Popover state
  const [depositModalOpen, setDepositModalOpen] = useState<boolean>(false);
  const [depositAmount, setDepositAmount] = useState<number>(10);
  const [depositBusy, setDepositBusy] = useState<boolean>(false);
  const [depositStatusMessage, setDepositStatusMessage] = useState<string | null>(null);

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
      }>("/api/dashboard");
      const bal = dash.user?.balance_usd ?? dash.account.paidBalance;
      updateBalance(bal);
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

    const webSearchFee = allowWebSearch ? getWebSearchCallRateUsd(activeModel.model_id) : 0;

    const payload: Record<string, unknown> = {
      model: activeModel.model_id,
      from_language: fromLanguage,
      to_language: toLanguage,
      input: currentInput,
      messages: [{ role: "user", content: currentInput }],
      stream: streamToggle,
      ...(allowWebSearch ? { allow_web_search: true } : {}),
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

    if (!streamToggle) {
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

    // Real-time streaming SSE fetch
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      let response: Response;
      if (shouldUseBrowserApi()) {
        response = await streamChatCompletionBrowser(payload, controller.signal);
      } else {
        const baseUrl = getApiBaseUrl();
        response = await fetch(`${baseUrl}/api/playground/chat`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      }

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
                    webSearchFee +
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
            webSearchFee +
            promptTokens * (activeModel.input_per_million / 1_000_000) +
            completionTokens * (activeModel.output_per_million / 1_000_000)
          ).toFixed(6),
        );

      if (shouldUseBrowserApi()) {
        const remaining = recordBrowserStreamUsage({
          modelId: activeModel.model_id,
          promptTokens,
          completionTokens,
          costUsd: computedCost,
          source: "playground",
        });
        updateBalance(remaining);
      }

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

  const handleDepositCredit = async () => {
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
              id: session.sessionId,
              amount_total: session.grossAmountCents,
              payment_status: "paid",
              metadata: {
                userId: "00000000-0000-4000-8000-000000000001",
                netDepositUsd: session.netDepositUsd.toString(),
              },
            },
          },
        }),
      });

      if (typeof res.balance_usd === "number") {
        updateBalance(res.balance_usd);
      }
      setDepositStatusMessage(
        `+$${session.netDepositUsd.toFixed(2)} added to your balance ($${session.grossChargedUsd.toFixed(2)} gross with Stripe fee).`,
      );
      await loadModelsAndState();
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Failed to process deposit");
    } finally {
      setDepositBusy(false);
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

  return (
    <section className="mx-auto max-w-5xl py-6 sm:py-10">
      {/* Minimal Top Bar: Title + Model Selector + Live Balance */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <ModelIcon presentation={presentation} size="catalog" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">
              Playground
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Choose a model, enter text, and translate instantly.
            </p>
          </div>
        </div>

        {/* Right: Live Balance Pill + Add Credits Trigger */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div
            data-testid="playground-live-balance"
            className="inline-flex h-10 items-center gap-2.5 rounded-xl border border-neutral-200 bg-neutral-50/90 px-3.5 text-xs dark:border-white/10 dark:bg-neutral-900"
          >
            <Wallet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-neutral-500 dark:text-neutral-400">Balance:</span>
            <span
              data-testid="live-balance-value"
              className="font-mono text-sm font-semibold text-neutral-950 dark:text-white"
            >
              ${liveBalance.toFixed(2)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setDepositStatusMessage(null);
              setDepositModalOpen((v) => !v);
            }}
            className="pressable inline-flex h-10 items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-3.5 text-xs font-semibold text-neutral-900 shadow-2xs transition hover:bg-neutral-50 dark:border-white/15 dark:bg-neutral-800 dark:text-white dark:hover:bg-neutral-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Credits
          </button>
        </div>
      </div>

      {/* Collapsible Minimal Stripe Deposit Drawer */}
      {depositModalOpen && (
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 shadow-xs dark:border-white/10 dark:bg-neutral-900/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
              <span className="text-xs font-semibold text-neutral-950 dark:text-white">
                Add Prepaid Credits (Min $5.00)
              </span>
              <span className="text-[11px] text-neutral-500">
                • Stripe fee (2.9% + $0.30) grossed up automatically
              </span>
            </div>
            <button
              type="button"
              onClick={() => setDepositModalOpen(false)}
              className="rounded-lg p-1 text-neutral-400 hover:text-neutral-800 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {[5, 10, 25, 50].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDepositAmount(preset)}
                  className={`h-9 rounded-lg border px-3 text-xs font-semibold transition ${
                    depositAmount === preset
                      ? "border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950"
                      : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-300"
                  }`}
                >
                  ${preset}
                </button>
              ))}
              <input
                type="number"
                min={5}
                step={1}
                data-testid="deposit-amount-input"
                value={depositAmount}
                onChange={(e) => setDepositAmount(Number(e.target.value))}
                className="h-9 w-24 rounded-lg border border-neutral-300 bg-white px-2.5 font-mono text-xs text-neutral-950 outline-none dark:border-white/15 dark:bg-neutral-950 dark:text-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-xs text-neutral-600 dark:text-neutral-400" data-testid="gross-charge-preview">
                Net: <strong>+${depositBreakdown.netDepositedUsd.toFixed(2)}</strong> • Total charged:{" "}
                <strong>${depositBreakdown.grossChargedUsd.toFixed(2)}</strong>
              </span>
              <button
                type="button"
                disabled={depositBusy || depositAmount < 5}
                data-testid="simulate-webhook-btn"
                onClick={handleDepositCredit}
                className="pressable inline-flex h-9 items-center gap-1.5 rounded-xl bg-neutral-950 px-4 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
              >
                <Zap className="h-3.5 w-3.5" />
                {depositBusy
                  ? "Adding..."
                  : `Deposit +$${depositBreakdown.netDepositedUsd.toFixed(2)}`}
              </button>
            </div>
          </div>

          {depositStatusMessage && (
            <p className="mt-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              {depositStatusMessage}
            </p>
          )}
        </div>
      )}

      {/* Error Alert */}
      {errorBanner && (
        <div
          role="alert"
          className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            <span>{errorBanner}</span>
          </div>
          <div className="flex items-center gap-3">
            {liveBalance <= 0 && (
              <button
                type="button"
                onClick={() => setDepositModalOpen(true)}
                className="font-semibold underline"
              >
                Add Credits
              </button>
            )}
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              className="font-semibold underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Minimal Translation Card */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-xs dark:border-white/10 dark:bg-neutral-900/70">
        {/* Control Bar: Model Dropdown + Language Pair + Reasoning/Web Search/Stream Toggles + Translate Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/80 bg-neutral-50/60 px-4 py-3.5 dark:border-white/10 dark:bg-white/[0.02] sm:px-5">
          {/* Left: Model Selector + Language Pair */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Model Dropdown (Strictly LingoFusion Nano to Ultra, showing only the name) */}
            <div className="relative">
              <select
                aria-label="Select Model"
                data-testid="playground-model-select"
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
                className="h-9 appearance-none rounded-xl border border-neutral-300 bg-white pl-3 pr-8 text-xs font-semibold text-neutral-950 outline-none transition focus:border-neutral-900 dark:border-white/15 dark:bg-neutral-950 dark:text-white"
              >
                {models.map((m) => (
                  <option key={m.model_id} value={m.model_id}>
                    {m.model_id}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            </div>

            <span className="hidden h-4 w-px bg-neutral-200 sm:inline-block dark:bg-white/10" />

            {/* Source Language */}
            <select
              aria-label="Source language"
              value={fromLanguage}
              onChange={(e) => setFromLanguage(e.target.value)}
              className="h-9 rounded-xl border border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-900 outline-none dark:border-white/15 dark:bg-neutral-950 dark:text-white"
            >
              {playgroundLanguages.map((lang) => (
                <option key={lang.code} value={lang.name}>
                  {lang.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={swapLanguages}
              title="Swap languages"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950 dark:border-white/15 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-white/10"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
            </button>

            {/* Target Language */}
            <select
              aria-label="Target language"
              value={toLanguage}
              onChange={(e) => setToLanguage(e.target.value)}
              className="h-9 rounded-xl border border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-900 outline-none dark:border-white/15 dark:bg-neutral-950 dark:text-white"
            >
              {playgroundLanguages.map((lang) => (
                <option key={lang.code} value={lang.name}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          {/* Right: Allow Web Search + Reasoning Option (if Pro/Ultra) + Stream Toggle + Translate Button */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300">
              <input
                type="checkbox"
                data-testid="playground-web-search-toggle"
                checked={allowWebSearch}
                onChange={(e) => setAllowWebSearch(e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-neutral-950 dark:accent-white"
              />
              <span>Allow Web Search</span>
            </label>

            {activeModel.model_id === "LingoFusion Pro" && (
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                <input
                  type="checkbox"
                  data-testid="playground-pro-reasoning-toggle"
                  checked={proReasoningEnabled}
                  onChange={(e) => setProReasoningEnabled(e.target.checked)}
                  className="h-3.5 w-3.5 rounded accent-neutral-950 dark:accent-white"
                />
                <span>Reasoning</span>
              </label>
            )}

            {activeModel.model_id === "LingoFusion Ultra" && (
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                <input
                  type="checkbox"
                  data-testid="playground-ultra-max-toggle"
                  checked={ultraMaxEnabled}
                  onChange={(e) => setUltraMaxEnabled(e.target.checked)}
                  className="h-3.5 w-3.5 rounded accent-neutral-950 dark:accent-white"
                />
                <span>Max Effort</span>
              </label>
            )}

            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400">
              <input
                type="checkbox"
                data-testid="playground-stream-toggle"
                checked={streamToggle}
                onChange={(e) => setStreamToggle(e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-neutral-950 dark:accent-white"
              />
              <span>Stream</span>
            </label>

            {isRunning && streamToggle ? (
              <button
                type="button"
                onClick={handleStopStream}
                data-testid="playground-stop-btn"
                className="pressable inline-flex h-9 items-center gap-1.5 rounded-xl bg-red-600 px-4 text-xs font-semibold text-white shadow-xs hover:bg-red-700"
              >
                <Square className="h-3 w-3 fill-current" />
                Stop
              </button>
            ) : (
              <button
                type="button"
                disabled={isRunning || !userInput.trim()}
                onClick={handleRunTranslation}
                data-testid="playground-run-btn"
                className="pressable inline-flex h-9 items-center gap-1.5 rounded-xl bg-neutral-950 px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
              >
                <Play className="h-3 w-3 fill-current" />
                {isRunning ? "Translating..." : "Translate"}
              </button>
            )}
          </div>
        </div>

        {/* Clean Side-by-Side Input & Output Panes */}
        <div className="grid divide-y divide-neutral-200/80 dark:divide-white/10 md:grid-cols-2 md:divide-x md:divide-y-0">
          {/* Left Pane: Input Text */}
          <div className="flex flex-col p-4 sm:p-5">
            <div className="mb-2 flex items-center justify-between">
              <label
                htmlFor="playground-user-input"
                className="text-xs font-medium text-neutral-500 dark:text-neutral-400"
              >
                {fromLanguage}
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
              rows={9}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  handleRunTranslation();
                }
              }}
              placeholder="Enter text to translate..."
              className="w-full flex-1 resize-none bg-transparent text-base leading-7 text-neutral-950 outline-none placeholder:text-neutral-400 dark:text-white"
            />
          </div>

          {/* Right Pane: Translated Output */}
          <div className="flex flex-col bg-neutral-50/40 p-4 dark:bg-white/[0.01] sm:p-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                {toLanguage} ({activeModel.model_id})
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
              className="flex min-h-[14rem] flex-1 flex-col justify-between text-base leading-7 text-neutral-950 dark:text-neutral-100"
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
                      ? "Translating..."
                      : "Translation will appear here."}
                  </span>
                )}
              </div>

              {/* Real-time token usage and cost breakdown badge */}
              {latestRun && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200/70 pt-3 dark:border-white/10">
                  <span
                    data-testid="response-usage-badge"
                    className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-mono text-xs font-medium text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                  >
                    <Activity className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    Tokens: {latestRun.promptTokens} in / {latestRun.completionTokens} out • Cost: $
                    {formatCostBadge(latestRun.costUsd)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
