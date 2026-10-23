import {
  Activity,
  AlertCircle,
  ArrowRightLeft,
  Check,
  ClipboardCopy,
  CreditCard,
  Download,
  Gauge,
  Globe,
  Image as ImageIcon,
  Link2,
  Loader2,
  Play,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  UploadCloud,
  Volume2,
  Wallet,
  Waves,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LiveMarkdownEditor } from "../components/LiveMarkdownEditor";
import { MarkdownView } from "../components/MarkdownView";
import { ModelThumb } from "../components/shared/FormFields";
import { Picker, Popover, SwitchRow } from "../components/shared/Picker";
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
import { imageModels, textModelPresentations, ttsModels } from "../data/pricing";
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

type ImageRun = {
  id: string;
  model: string;
  provider?: string;
  fromLanguage: string;
  toLanguage: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  createdAt: string;
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });
}

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
  const [activeUserId, setActiveUserId] = useState<string>("00000000-0000-4000-8000-000000000001");

  // Deposit Drawer / Popover state
  const [depositModalOpen, setDepositModalOpen] = useState<boolean>(false);
  const [insufficientModalOpen, setInsufficientModalOpen] = useState<boolean>(false);
  const [depositAmount, setDepositAmount] = useState<number>(10);
  const [depositBusy, setDepositBusy] = useState<boolean>(false);
  const [depositStatusMessage, setDepositStatusMessage] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<{
    type: "success" | "cancelled";
    message: string;
  } | null>(null);

  // Auto Top-Up settings state
  const [autoTopUpEnabled, setAutoTopUpEnabled] = useState<boolean>(false);
  const [autoTopUpThreshold, setAutoTopUpThreshold] = useState<number>(10);
  const [autoTopUpTarget, setAutoTopUpTarget] = useState<number>(50);
  const [autoTopUpBusy, setAutoTopUpBusy] = useState<boolean>(false);
  const [autoTopUpMessage, setAutoTopUpMessage] = useState<string | null>(null);
  const [autoTopUpError, setAutoTopUpError] = useState<string | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Playground modality: text translation vs in-image translation vs voice synthesis
  const [mode, setMode] = useState<"text" | "image" | "voice">(() => {
    const q = pageQuery().get("mode");
    if (q === "voice" || q === "tts") return "voice";
    return q === "image" ? "image" : "text";
  });
  const [selectedVoiceModel, setSelectedVoiceModel] = useState<string>(() => {
    const requested = pageQuery().get("model");
    const match = ttsModels.find(
      (m) => m.model.toLowerCase() === requested?.toLowerCase(),
    );
    return match?.model ?? "LingoFusion Voice";
  });
  const [selectedVoiceGender, setSelectedVoiceGender] = useState<"female" | "male">("female");
  const [voiceAudioUrl, setVoiceAudioUrl] = useState<string | null>(null);
  const [voiceRunning, setVoiceRunning] = useState<boolean>(false);
  const [voicePlaying, setVoicePlaying] = useState<boolean>(false);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const [voiceRun, setVoiceRun] = useState<{
    id: string;
    model: string;
    chars: number;
    costUsd: number;
  } | null>(null);
  const [selectedImageModel, setSelectedImageModel] = useState<string>(() => {
    const requested = pageQuery().get("model");
    const match = imageModels.find(
      (model) =>
        model.label === requested ||
        model.model === requested ||
        model.size === requested,
    );
    return match?.label ?? imageModels[0].label;
  });
  const [imageSource, setImageSource] = useState<string | null>(null);
  const [imageSourceName, setImageSourceName] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageOutput, setImageOutput] = useState<string>("");
  const [imageRun, setImageRun] = useState<ImageRun | null>(null);
  const [imageRunning, setImageRunning] = useState<boolean>(false);
  const [imageDragActive, setImageDragActive] = useState<boolean>(false);

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
        user?: { id?: string; balance_usd: number };
        account: { paidBalance: number; rewardBalance: number };
        autoRecharge?: {
          enabled: boolean;
          threshold: number;
          amount: number;
        };
      }>("/api/dashboard");
      if (dash.user?.id) {
        setActiveUserId(dash.user.id);
      }
      const bal = dash.user?.balance_usd ?? dash.account.paidBalance;
      updateBalance(bal);
      if (dash.autoRecharge) {
        setAutoTopUpEnabled(Boolean(dash.autoRecharge.enabled));
        if (typeof dash.autoRecharge.threshold === "number" && dash.autoRecharge.threshold > 0) {
          setAutoTopUpThreshold(dash.autoRecharge.threshold);
        }
        if (typeof dash.autoRecharge.amount === "number" && dash.autoRecharge.amount >= 5) {
          setAutoTopUpTarget(dash.autoRecharge.amount);
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadModelsAndState();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get("payment") || params.get("deposit");
    const sessionId = params.get("session_id");
    if (paymentStatus === "success" || paymentStatus === "cancelled") {
      if (paymentStatus === "success") {
        setPaymentNotice({
          type: "success",
          message: "Payment received! Updating balance...",
        });
        void (async () => {
          if (sessionId) {
            try {
              const verified = await callApi<{
                verified?: boolean;
                balance_usd?: number;
                net_deposited_usd?: number;
              }>("/api/verify-checkout-session", {
                method: "POST",
                body: JSON.stringify({ sessionId }),
              });
              if (typeof verified.balance_usd === "number") {
                updateBalance(verified.balance_usd);
              }
              if (verified.verified && typeof verified.net_deposited_usd === "number") {
                setPaymentNotice({
                  type: "success",
                  message: `Payment received! +$${verified.net_deposited_usd.toFixed(2)} USD added to your credit balance.`,
                });
              }
            } catch {
              // Fall back to dashboard balance refresh
            }
          }
          await loadModelsAndState();
        })();
      } else {
        setPaymentNotice({
          type: "cancelled",
          message: "Checkout was cancelled. No charges were made to your account.",
        });
      }
      params.delete("payment");
      params.delete("deposit");
      params.delete("session_id");
      const remainingQuery = params.toString();
      const cleanUrl = `${window.location.pathname}${remainingQuery ? `?${remainingQuery}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", cleanUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeModel = useMemo(
    () =>
      models.find((m) => m.model_id === selectedModelId) ??
      models[0] ??
      defaultBrowserModelPricing[2],
    [models, selectedModelId],
  );

  const activeImageModel = useMemo(
    () => imageModels.find((model) => model.label === selectedImageModel) ?? imageModels[0],
    [selectedImageModel],
  );

  const depositBreakdown = useMemo(
    () => calculateGrossDeposit(Math.max(0, Number(depositAmount) || 0)),
    [depositAmount],
  );

  const languageItems = useMemo(
    () =>
      playgroundLanguages.map((language) => ({
        id: language.name,
        label: language.name,
      })),
    [],
  );

  const modelItems = useMemo(
    () =>
      models.map((m) => ({
        id: m.model_id,
        label: m.model_id,
        icon: <ModelThumb presentation={textModelPresentations[m.model_id]} />,
        hint: `$${m.input_per_million.toFixed(2)}/M · $${m.output_per_million.toFixed(2)}/M out`,
      })),
    [models],
  );

  const imageModelItems = useMemo(
    () =>
      imageModels.map((model) => ({
        id: model.label,
        label: model.label,
        icon: <ImageIcon className="h-3.5 w-3.5 shrink-0 text-neutral-400" />,
        hint: `$${model.inputUsd.toFixed(2)}/M · $${model.outputUsd.toFixed(2)}/M out`,
      })),
    [],
  );

  const voiceModelItems = useMemo(
    () =>
      ttsModels.map((model) => ({
        id: model.model,
        label: model.model,
        icon: <Volume2 className="h-3.5 w-3.5 shrink-0 text-neutral-400" />,
        hint: `$${model.priceUsd?.toFixed(2)}/1K chars`,
      })),
    [],
  );

  const handleRunTranslation = async () => {
    if (!userInput.trim() || isRunning) return;
    if (liveBalance <= 0) {
      setInsufficientModalOpen(true);
      return;
    }
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
        if (message.toLowerCase().includes("insufficient") || message.toLowerCase().includes("deposit")) {
          setInsufficientModalOpen(true);
        } else {
          setErrorBanner(message);
        }
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
        if (message.toLowerCase().includes("insufficient") || message.toLowerCase().includes("deposit")) {
          setInsufficientModalOpen(true);
        } else {
          setErrorBanner(message);
        }
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

  const handleImageFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorBanner("Please choose an image file (PNG, JPG, or WEBP).");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setErrorBanner("The source image exceeds the 20 MB limit.");
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setImageSource(dataUrl);
      setImageSourceName(file.name);
      setImageUrl("");
      setImageOutput("");
      setImageRun(null);
      setErrorBanner(null);
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : "Could not read the selected image.",
      );
    }
  };

  useEffect(() => {
    if (mode !== "image") return;
    const onPaste = (event: ClipboardEvent) => {
      const item = Array.from(event.clipboardData?.items || []).find((entry) =>
        entry.type.startsWith("image/"),
      );
      const file = item?.getAsFile();
      if (file) void handleImageFile(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handleRunImageTranslation = async () => {
    if (imageRunning) return;
    if (liveBalance <= 0) {
      setInsufficientModalOpen(true);
      return;
    }
    const trimmedUrl = imageUrl.trim();
    if (!imageSource && !trimmedUrl) {
      setErrorBanner("Upload an image or paste an image URL to translate.");
      return;
    }
    if (!imageSource && trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) {
      setErrorBanner("Enter a valid http(s) image URL.");
      return;
    }

    setErrorBanner(null);
    setImageRunning(true);
    setImageOutput("");
    setImageRun(null);

    const runId = `img-${Date.now()}`;
    const payload: Record<string, unknown> = {
      model: activeImageModel.label,
      resolution: activeImageModel.resolution,
      from_language: fromLanguage,
      to_language: toLanguage,
      ...(imageSource ? { image: imageSource } : { image_url: trimmedUrl }),
    };

    try {
      const response = await callApi<{
        id: string;
        model: string;
        label?: string;
        resolution: string;
        provider?: string;
        image: string;
        usage: {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
          cost_usd: number;
          balance_usd?: number;
        };
      }>("/api/playground/image", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setImageOutput(response.image);
      setImageRun({
        id: runId,
        model: response.label || activeImageModel.label,
        provider: response.provider,
        fromLanguage,
        toLanguage,
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        costUsd: response.usage?.cost_usd ?? 0,
        createdAt: new Date().toISOString(),
      });
      if (typeof response.usage?.balance_usd === "number") {
        updateBalance(response.usage.balance_usd);
      }
      await loadModelsAndState();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Image translation failed";
      if (message.toLowerCase().includes("insufficient") || message.toLowerCase().includes("deposit")) {
        setInsufficientModalOpen(true);
      } else {
        setErrorBanner(message);
      }
      setImageRun(null);
    } finally {
      setImageRunning(false);
    }
  };

  const handleRunVoiceSynthesis = async () => {
    const textToSpeak = userInput.trim() || translatedOutput.trim();
    if (!textToSpeak || voiceRunning) return;
    if (liveBalance <= 0) {
      setInsufficientModalOpen(true);
      return;
    }
    setErrorBanner(null);
    setVoiceRunning(true);
    setVoiceAudioUrl(null);
    setVoiceRun(null);

    const runId = `voice-${Date.now()}`;
    const payload = {
      model: selectedVoiceModel,
      input: textToSpeak,
      voice: selectedVoiceGender,
      gender: selectedVoiceGender,
      voice_id:
        selectedVoiceGender === "male"
          ? "1SM7GgM6IMuvQlz2BwM3"
          : "BZgkqPqms7Kj9ulSkVzn",
    };

    try {
      if (shouldUseBrowserApi()) {
        const response = await callApi<{
          id: string;
          model: string;
          status: string;
          audio_url: string;
          chars: number;
          cost_usd: number;
        }>("/api/playground/speech", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        setVoiceAudioUrl(response.audio_url);
        setVoiceRun({
          id: response.id || runId,
          model: response.model || selectedVoiceModel,
          chars: response.chars || textToSpeak.length,
          costUsd: response.cost_usd || 0,
        });
      } else {
        const baseUrl = getApiBaseUrl();
        const res = await fetch(`${baseUrl}/api/playground/speech`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const msg =
            typeof errData?.error === "object" && errData?.error?.message
              ? errData.error.message
              : errData?.message || `HTTP ${res.status}`;
          throw new Error(msg);
        }

        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const chars = Number(res.headers.get("x-lingofusion-chars") || textToSpeak.length);
        const costUsd = Number(res.headers.get("x-lingofusion-cost-usd") || 0);

        setVoiceAudioUrl(objectUrl);
        setVoiceRun({
          id: res.headers.get("x-lingofusion-request-id") || runId,
          model: res.headers.get("x-lingofusion-model") || selectedVoiceModel,
          chars,
          costUsd,
        });
      }

      await loadModelsAndState();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Voice synthesis failed";
      if (message.toLowerCase().includes("insufficient") || message.toLowerCase().includes("deposit")) {
        setInsufficientModalOpen(true);
      } else {
        setErrorBanner(message);
      }
    } finally {
      setVoiceRunning(false);
    }
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
    setPaymentNotice(null);
    if (!Number.isFinite(depositAmount) || depositAmount < 1 || depositAmount > 50000) {
      setErrorBanner("Top-up amount must be between $1.00 and $50,000.00 USD.");
      return;
    }
    setDepositBusy(true);
    try {
      const data = await callApi<{
        url?: string;
        checkoutUrl?: string;
        sessionId: string;
        netDepositUsd: number;
        grossAmountCents: number;
        grossChargedUsd: number;
        estimatedStripeFeeUsd: number;
      }>("/api/create-checkout-session", {
        method: "POST",
        body: JSON.stringify({
          amount: depositAmount,
          userId: activeUserId,
          currency: "usd",
        }),
      });

      const redirectUrl = data.url || data.checkoutUrl;
      if (redirectUrl) {
        window.location.href = redirectUrl;
        return;
      }
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Failed to create Stripe Checkout session");
    } finally {
      setDepositBusy(false);
    }
  };

  const handleSaveAutoTopUp = async (overrideEnabled?: boolean) => {
    const enabledVal = overrideEnabled !== undefined ? overrideEnabled : autoTopUpEnabled;
    setAutoTopUpError(null);
    setAutoTopUpMessage(null);

    if (!Number.isFinite(autoTopUpThreshold) || autoTopUpThreshold < 1 || autoTopUpThreshold > 999) {
      setAutoTopUpError("'When my balance reaches' must be between $1.00 and $999.00 USD.");
      return;
    }
    if (!Number.isFinite(autoTopUpTarget) || autoTopUpTarget < 1 || autoTopUpTarget > 50000) {
      setAutoTopUpError("'Bring my balance back up to' must be between $1.00 and $50,000.00 USD.");
      return;
    }
    if (autoTopUpThreshold >= autoTopUpTarget) {
      setAutoTopUpError("'Bring my balance back up to' must be greater than 'When my balance reaches'.");
      return;
    }

    setAutoTopUpBusy(true);
    try {
      await callApi("/api/auto-recharge", {
        method: "POST",
        body: JSON.stringify({
          enabled: enabledVal,
          threshold: Number(autoTopUpThreshold.toFixed(2)),
          amount: Number(autoTopUpTarget.toFixed(2)),
          targetBalance: Number(autoTopUpTarget.toFixed(2)),
          monthlyLimit: 1000,
          notify: true,
          paymentMethod: "Stripe Checkout",
        }),
      });
      setAutoTopUpEnabled(enabledVal);
      setAutoTopUpMessage(
        enabledVal
          ? `Auto top-up enabled: when balance reaches $${autoTopUpThreshold.toFixed(2)}, bring it back up to $${autoTopUpTarget.toFixed(2)} USD.`
          : "Auto top-up disabled.",
      );
    } catch (err) {
      setAutoTopUpError(err instanceof Error ? err.message : "Failed to save Auto Top-Up settings.");
    } finally {
      setAutoTopUpBusy(false);
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
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">
              Playground
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {mode === "image"
                ? "Upload an image or paste a URL, then translate the text inside it."
                : "Choose a model, enter text, and translate instantly."}
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
              className="font-sans tabular-nums text-sm font-semibold text-neutral-950 dark:text-white"
            >
              ${liveBalance.toFixed(2)}
            </span>
          </div>

          <button
            type="button"
            data-testid="playground-topup-btn"
            onClick={() => {
              setDepositStatusMessage(null);
              setDepositModalOpen((v) => !v);
            }}
            className="pressable inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-neutral-950 px-3.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200 sm:flex-none"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Funds
          </button>
        </div>
      </div>

      {/* Payment Return Status Banner (payment=success | payment=cancelled) */}
      {paymentNotice && (
        <div
          role="status"
          data-testid="payment-status-banner"
          className={`mt-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs ${
            paymentNotice.type === "success"
              ? "border-emerald-200 bg-emerald-50/90 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
              : "border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {paymentNotice.type === "success" ? (
              <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-neutral-500 dark:text-neutral-400" />
            )}
            <span className="font-medium">{paymentNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setPaymentNotice(null)}
            className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Add Funds Modal Pop-up with Full-Screen Blurred Dark Backdrop (Portaled to document.body) */}
      {depositModalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Full viewport dark out-of-focus backdrop covering Header, Sidebar and entire browser page */}
            <div
              className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm transition-opacity"
              onClick={() => {
                if (!depositBusy) setDepositModalOpen(false);
              }}
            />

            {/* Modal Box Centered in the Middle */}
            <div
              role="dialog"
              aria-modal="true"
              className="relative z-10 my-auto max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-neutral-200/90 bg-white font-sans shadow-2xl transition-all animate-in fade-in zoom-in-95 duration-150 dark:border-white/10 dark:bg-neutral-900"
            >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-200/80 px-6 py-4 dark:border-white/10 sm:px-7">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 text-neutral-900 dark:bg-white/10 dark:text-white">
                <Wallet className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold tracking-tight text-neutral-950 dark:text-white">
                  Add Funds
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Top up your LingoFusion credit balance ($1 – $50,000 USD)
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={depositBusy}
              onClick={() => setDepositModalOpen(false)}
              className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body: Two-Column Layout on Mac/PC Web */}
            <div className="grid divide-y divide-neutral-200/80 dark:divide-white/10 md:grid-cols-[1.15fr_0.85fr] md:divide-x md:divide-y-0">
              {/* Left Column: Presets + Custom Input */}
              <div className="space-y-5 p-6 sm:p-7">
                <div>
                  <div className="mb-2.5 flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                      Select Credit Tier
                    </label>
                    <span className="font-sans text-[11px] font-medium text-neutral-400">USD</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[5, 10, 25, 50, 100, 250].map((preset) => {
                      const selected = depositAmount === preset;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setDepositAmount(preset)}
                          className={`flex h-12 flex-col items-center justify-center rounded-xl border font-sans tabular-nums text-sm font-semibold transition ${
                            selected
                              ? "border-neutral-950 bg-neutral-950 text-white shadow-xs dark:border-white dark:bg-white dark:text-neutral-950"
                              : "border-neutral-200 bg-neutral-50/50 text-neutral-800 hover:border-neutral-300 hover:bg-neutral-100/80 dark:border-white/10 dark:bg-white/[0.02] dark:text-neutral-200 dark:hover:bg-white/[0.06]"
                          }`}
                        >
                          <span>${preset}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Amount Input */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label
                      htmlFor="deposit-amount-input"
                      className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
                    >
                      Custom Amount
                    </label>
                    <span className="text-[11px] text-neutral-400">Min $1 • Max $50,000 USD</span>
                  </div>
                  <div className="relative flex items-center">
                    <span className="pointer-events-none absolute left-4 font-sans text-base font-medium text-neutral-400">
                      $
                    </span>
                    <input
                      id="deposit-amount-input"
                      type="number"
                      min={1}
                      max={50000}
                      step={1}
                      aria-label="Custom top-up amount in USD"
                      data-testid="deposit-amount-input"
                      value={depositAmount || ""}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setDepositAmount(val > 50000 ? 50000 : val);
                      }}
                      className="h-12 w-full rounded-xl border border-neutral-200 bg-white pl-8 pr-16 font-sans tabular-nums text-base font-semibold text-neutral-950 outline-none transition focus:border-neutral-950 dark:border-white/15 dark:bg-neutral-950 dark:text-white dark:focus:border-white"
                    />
                    <span className="pointer-events-none absolute right-4 font-sans text-xs font-semibold text-neutral-400">
                      USD
                    </span>
                  </div>
                </div>

                {/* Current vs Updated Balance Preview */}
                <div className="flex items-center justify-between rounded-xl border border-neutral-200/70 bg-neutral-50/50 px-4 py-3 text-xs dark:border-white/10 dark:bg-white/[0.02]">
                  <span className="text-neutral-500 dark:text-neutral-400">Balance after top-up</span>
                  <div className="flex items-center gap-2 font-sans tabular-nums">
                    <span className="text-neutral-400">${liveBalance.toFixed(2)}</span>
                    <span className="text-neutral-400">→</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      ${(liveBalance + depositBreakdown.netDepositedUsd).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Order Summary & Checkout CTA */}
              <div className="flex flex-col justify-between bg-neutral-50/60 p-6 dark:bg-white/[0.02] sm:p-7">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Summary
                  </h3>

                  <div
                    data-testid="gross-charge-preview"
                    className="mt-4 space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-300">
                      <span>Net credit added</span>
                      <span className="font-sans tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                        +${depositBreakdown.netDepositedUsd.toFixed(2)} USD
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
                      <span>Stripe fee (2.9% + $0.30)</span>
                      <span className="font-sans tabular-nums">
                        ${depositBreakdown.estimatedStripeFeeUsd.toFixed(2)} USD
                      </span>
                    </div>
                    <div className="border-t border-neutral-200/80 pt-3 dark:border-white/10">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs font-semibold text-neutral-950 dark:text-white">
                          Total due
                        </span>
                        <span className="font-sans tabular-nums text-lg font-bold tracking-tight text-neutral-950 dark:text-white">
                          ${depositBreakdown.grossChargedUsd.toFixed(2)}{" "}
                          <span className="text-xs font-medium text-neutral-500">USD</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {depositStatusMessage && (
                    <p className="text-center text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      {depositStatusMessage}
                    </p>
                  )}

                  <button
                    type="button"
                    disabled={depositBusy || !Number.isFinite(depositAmount) || depositAmount < 1 || depositAmount > 50000}
                    data-testid="simulate-webhook-btn"
                    onClick={handleDepositCredit}
                    className="pressable inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                  >
                    {depositBusy ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Redirecting to Stripe...
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4" />
                        Continue to Checkout
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-neutral-400 dark:text-neutral-500">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Secured by Stripe • Instant credit</span>
                  </div>
                </div>
              </div>
            </div>

          {/* Auto Top-Up Section */}
          <div
            data-testid="auto-topup-section"
            className="border-t border-neutral-200/80 bg-neutral-50/30 px-6 py-5 dark:border-white/10 dark:bg-white/[0.01] sm:px-7"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
                    Auto top-up
                  </h3>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      autoTopUpEnabled
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
                        : "bg-neutral-200/80 text-neutral-600 dark:bg-white/10 dark:text-neutral-400"
                    }`}
                  >
                    {autoTopUpEnabled ? "Active" : "Off"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                  Automatically charge your payment method and restore your balance when your credit runs low.
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={autoTopUpEnabled}
                data-testid="auto-topup-toggle"
                disabled={autoTopUpBusy}
                onClick={() => {
                  const next = !autoTopUpEnabled;
                  setAutoTopUpEnabled(next);
                  void handleSaveAutoTopUp(next);
                }}
                style={{
                  width: 51,
                  height: 31,
                  minWidth: 51,
                  minHeight: 31,
                  maxWidth: 51,
                  maxHeight: 31,
                  padding: 2,
                }}
                className={`relative inline-flex shrink-0 cursor-pointer items-center rounded-full border-0 transition-colors duration-200 ease-in-out focus:outline-none ${
                  autoTopUpEnabled
                    ? "bg-[#34C759]"
                    : "bg-[#E9E9EA] dark:bg-[#39393D]"
                }`}
              >
                <span
                  style={{
                    width: 27,
                    height: 27,
                    minWidth: 27,
                    minHeight: 27,
                    transform: autoTopUpEnabled ? "translateX(20px)" : "translateX(0px)",
                  }}
                  className="pointer-events-none block rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)] transition-transform duration-200 ease-in-out"
                />
              </button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              {/* When my balance reaches */}
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label
                    htmlFor="auto-topup-threshold-input"
                    className="text-xs font-medium text-neutral-700 dark:text-neutral-200"
                  >
                    When my balance reaches:
                  </label>
                  <span className="text-[11px] text-neutral-400">($1 to $999)</span>
                </div>
                <div className="relative flex items-center">
                  <span className="pointer-events-none absolute left-3.5 font-sans text-sm font-medium text-neutral-400">
                    $
                  </span>
                  <input
                    id="auto-topup-threshold-input"
                    data-testid="auto-topup-threshold-input"
                    type="number"
                    min={1}
                    max={999}
                    step="1"
                    value={autoTopUpThreshold}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") {
                        setAutoTopUpThreshold(1);
                        return;
                      }
                      const val = Number(raw);
                      if (!Number.isFinite(val)) return;
                      setAutoTopUpThreshold(Math.min(999, Math.max(1, val)));
                    }}
                    onBlur={() => {
                      setAutoTopUpThreshold((prev) =>
                        Number(Math.min(999, Math.max(1, Number(prev) || 1)).toFixed(2)),
                      );
                    }}
                    className="h-10 w-full rounded-xl border border-neutral-200 bg-white pl-7 pr-12 font-sans tabular-nums text-sm font-semibold text-neutral-950 outline-none transition focus:border-neutral-950 dark:border-white/15 dark:bg-neutral-950 dark:text-white dark:focus:border-white"
                  />
                  <span className="pointer-events-none absolute right-3.5 font-sans text-[11px] font-semibold text-neutral-400">
                    USD
                  </span>
                </div>
              </div>

              {/* Bring my balance back up to */}
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label
                    htmlFor="auto-topup-target-input"
                    className="text-xs font-medium text-neutral-700 dark:text-neutral-200"
                  >
                    Bring my balance back up to:
                  </label>
                  <span className="text-[11px] text-neutral-400">($1 to $50,000)</span>
                </div>
                <div className="relative flex items-center">
                  <span className="pointer-events-none absolute left-3.5 font-sans text-sm font-medium text-neutral-400">
                    $
                  </span>
                  <input
                    id="auto-topup-target-input"
                    data-testid="auto-topup-target-input"
                    type="number"
                    min={1}
                    max={50000}
                    step="1"
                    value={autoTopUpTarget}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") {
                        setAutoTopUpTarget(1);
                        return;
                      }
                      const val = Number(raw);
                      if (!Number.isFinite(val)) return;
                      setAutoTopUpTarget(Math.min(50000, Math.max(1, val)));
                    }}
                    onBlur={() => {
                      setAutoTopUpTarget((prev) =>
                        Math.min(50000, Math.max(1, Number(prev) || 1)),
                      );
                    }}
                    className="h-10 w-full rounded-xl border border-neutral-200 bg-white pl-7 pr-12 font-sans tabular-nums text-sm font-semibold text-neutral-950 outline-none transition focus:border-neutral-950 dark:border-white/15 dark:bg-neutral-950 dark:text-white dark:focus:border-white"
                  />
                  <span className="pointer-events-none absolute right-3.5 font-sans text-[11px] font-semibold text-neutral-400">
                    USD
                  </span>
                </div>
              </div>

              {/* Save Auto Top-Up button */}
              <button
                type="button"
                data-testid="save-auto-topup-btn"
                disabled={autoTopUpBusy}
                onClick={() => void handleSaveAutoTopUp()}
                className="pressable inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-4 text-xs font-semibold text-neutral-900 shadow-2xs transition hover:bg-neutral-50 disabled:opacity-50 dark:border-white/15 dark:bg-neutral-950 dark:text-white dark:hover:bg-white/10"
              >
                {autoTopUpBusy ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save settings"
                )}
              </button>
            </div>

            {autoTopUpError && (
              <p className="mt-2.5 text-xs font-medium text-red-600 dark:text-red-400">
                {autoTopUpError}
              </p>
            )}
            {autoTopUpMessage && !autoTopUpError && (
              <p className="mt-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                {autoTopUpMessage}
              </p>
            )}
          </div>
            </div>
          </div>,
          document.body,
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

      {/* Insufficient Balance Modal Dialog with Full-Screen Dark Out-of-Focus Backdrop (Portaled to document.body) */}
      {insufficientModalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Full viewport dark out-of-focus backdrop covering Header, Sidebar and entire browser page */}
            <div
              className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm transition-opacity"
              onClick={() => setInsufficientModalOpen(false)}
            />

            {/* Modal box centered in the middle */}
            <div
              role="dialog"
              aria-modal="true"
              className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-2xl transition-all animate-in fade-in zoom-in-95 duration-150 dark:border-white/10 dark:bg-neutral-900"
            >
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div className="flex-1 pr-2">
                  <h3 className="text-base font-semibold text-neutral-950 dark:text-white">
                    Insufficient balance
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                    Please deposit credits to continue translating and using LingoFusion services.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInsufficientModalOpen(false)}
                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setInsufficientModalOpen(false)}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-neutral-200 px-4 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 dark:border-white/10 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInsufficientModalOpen(false);
                    setDepositStatusMessage(null);
                    setDepositModalOpen(true);
                  }}
                  className="pressable inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-neutral-950 px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Funds
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Main Minimal Translation Card */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-xs dark:border-white/10 dark:bg-neutral-900/70">
        {/* Control Bar: Language Pair → Modality & Model → Options & Run */}
        <div className="border-b border-neutral-200/80 bg-neutral-50/60 px-4 py-4 dark:border-white/10 dark:bg-white/[0.02] sm:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
            {/* Left column: language pair on top (text/image only), mode + model below */}
            <div className="flex min-w-0 flex-col gap-3">
              {/* Language pair: source ⇄ target (only shown for text & image modes) */}
              {mode !== "voice" && (
                <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-1.5 lg:w-[24rem]">
                  <Picker
                    label="Source language"
                    testId="playground-source-language"
                    items={languageItems}
                    value={fromLanguage}
                    onChange={setFromLanguage}
                    align="left"
                    searchPlaceholder="Search languages…"
                  />

                  <button
                    type="button"
                    onClick={swapLanguages}
                    title="Swap languages"
                    data-testid="playground-swap-languages"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-300 bg-white text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950 dark:border-white/15 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-white/10"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                  </button>

                  <Picker
                    label="Target language"
                    testId="playground-target-language"
                    items={languageItems}
                    value={toLanguage}
                    onChange={setToLanguage}
                    align="right"
                    searchPlaceholder="Search languages…"
                  />
                </div>
              )}

              {/* Modality + model selector + live pricing */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Modality Toggle: Text vs Image vs Voice */}
                <div
                  role="group"
                  aria-label="Playground mode"
                  className="inline-flex rounded-xl border border-neutral-200 bg-white p-0.5 dark:border-white/15 dark:bg-neutral-950"
                >
                  {([
                    ["text", "Text"],
                    ["image", "Image"],
                    ["voice", "Voice"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={mode === value}
                      data-testid={`playground-mode-${value}`}
                      onClick={() => setMode(value)}
                      className={`inline-flex h-8 items-center gap-1 rounded-lg px-3 text-xs font-semibold transition ${
                        mode === value
                          ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"
                          : "text-neutral-500 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
                      }`}
                    >
                      {value === "image" && <ImageIcon className="h-3.5 w-3.5" />}
                      {value === "voice" && <Volume2 className="h-3.5 w-3.5" />}
                      {label}
                    </button>
                  ))}
                </div>

                {/* Model Picker (searchable, with icons + live pricing) */}
                <Picker
                  className="w-full sm:w-56"
                  label={
                    mode === "voice"
                      ? "Select voice model"
                      : mode === "image"
                        ? "Select image model"
                        : "Select model"
                  }
                  testId={
                    mode === "voice"
                      ? "playground-voice-model-select"
                      : mode === "image"
                        ? "playground-image-model-select"
                        : "playground-model-select"
                  }
                  searchPlaceholder={
                    mode === "voice"
                      ? "Search voice models…"
                      : mode === "image"
                        ? "Search image models…"
                        : "Search models…"
                  }
                  items={
                    mode === "voice"
                      ? voiceModelItems
                      : mode === "image"
                        ? imageModelItems
                        : modelItems
                  }
                  value={
                    mode === "voice"
                      ? selectedVoiceModel
                      : mode === "image"
                        ? selectedImageModel
                        : selectedModelId
                  }
                  onChange={
                    mode === "voice"
                      ? setSelectedVoiceModel
                      : mode === "image"
                        ? setSelectedImageModel
                        : setSelectedModelId
                  }
                  align="left"
                />

                {mode === "text" && (
                  <span className="hidden font-sans tabular-nums text-[11px] text-neutral-500 md:inline dark:text-neutral-400">
                    ${activeModel.input_per_million.toFixed(2)}/M in · $
                    {activeModel.output_per_million.toFixed(2)}/M out
                  </span>
                )}
                {mode === "voice" && (
                  <>
                    {/* Voice Gender Toggle: Female vs Male */}
                    <div
                      role="group"
                      aria-label="Voice gender"
                      className="inline-flex rounded-xl border border-neutral-200 bg-white p-0.5 dark:border-white/15 dark:bg-neutral-950"
                    >
                      {([
                        ["female", "Female"],
                        ["male", "Male"],
                      ] as const).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={selectedVoiceGender === value}
                          data-testid={`playground-voice-gender-${value}`}
                          onClick={() => setSelectedVoiceGender(value)}
                          className={`inline-flex h-8 items-center rounded-lg px-3 text-xs font-semibold transition ${
                            selectedVoiceGender === value
                              ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"
                              : "text-neutral-500 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <span className="hidden font-sans tabular-nums text-[11px] text-neutral-500 md:inline dark:text-neutral-400">
                      ${selectedVoiceModel.toLowerCase().includes("flash") ? "0.08" : "0.15"} / 1K chars
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Right: Text-mode options popover, or the run/stop action */}
            <div className="flex w-full items-center gap-2.5 sm:w-auto">
              {mode === "text" && (
                <Popover
                  trigger={
                    <>
                      <SlidersHorizontal className="h-3.5 w-3.5 text-neutral-400" />
                      Options
                    </>
                  }
                  badge={
                    (allowWebSearch ? 1 : 0) +
                    (proReasoningEnabled ? 1 : 0) +
                    (ultraMaxEnabled ? 1 : 0)
                  }
                >
                  {() => (
                    <>
                      <SwitchRow
                        icon={Waves}
                        label="Stream responses"
                        checked={streamToggle}
                        onChange={setStreamToggle}
                        testId="playground-stream-toggle"
                      />
                      <SwitchRow
                        icon={Globe}
                        label="Allow web search"
                        checked={allowWebSearch}
                        onChange={setAllowWebSearch}
                        testId="playground-web-search-toggle"
                      />
                      {activeModel.model_id === "LingoFusion Pro" && (
                        <SwitchRow
                          icon={Sparkles}
                          label="Reasoning"
                          checked={proReasoningEnabled}
                          onChange={setProReasoningEnabled}
                          testId="playground-pro-reasoning-toggle"
                        />
                      )}
                      {activeModel.model_id === "LingoFusion Ultra" && (
                        <SwitchRow
                          icon={Gauge}
                          label="Max effort"
                          checked={ultraMaxEnabled}
                          onChange={setUltraMaxEnabled}
                          testId="playground-ultra-max-toggle"
                        />
                      )}
                    </>
                  )}
                </Popover>
              )}

              {mode === "voice" ? (
                <button
                  type="button"
                  disabled={voiceRunning || (!userInput.trim() && !translatedOutput.trim())}
                  onClick={handleRunVoiceSynthesis}
                  data-testid="playground-voice-run-btn"
                  className="pressable inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-neutral-950 px-5 text-xs font-semibold text-white shadow-xs transition hover:bg-neutral-800 disabled:opacity-50 sm:flex-none dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                >
                  {voiceRunning ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Volume2 className="h-3 w-3" />
                  )}
                  {voiceRunning ? "Synthesizing..." : "Generate speech"}
                </button>
              ) : mode === "image" ? (
                <button
                  type="button"
                  disabled={imageRunning || (!imageSource && !imageUrl.trim())}
                  onClick={handleRunImageTranslation}
                  data-testid="playground-image-run-btn"
                  className="pressable inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-neutral-950 px-5 text-xs font-semibold text-white shadow-xs transition hover:bg-neutral-800 disabled:opacity-50 sm:flex-none dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                >
                  {imageRunning ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3 fill-current" />
                  )}
                  {imageRunning ? "Translating..." : "Translate image"}
                </button>
              ) : isRunning && streamToggle ? (
                <button
                  type="button"
                  onClick={handleStopStream}
                  data-testid="playground-stop-btn"
                  className="pressable inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-5 text-xs font-semibold text-white shadow-xs transition hover:bg-red-700 sm:flex-none"
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
                  className="pressable inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-neutral-950 px-5 text-xs font-semibold text-white shadow-xs transition hover:bg-neutral-800 disabled:opacity-50 sm:flex-none dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                >
                  <Play className="h-3 w-3 fill-current" />
                  {isRunning ? "Translating..." : "Translate"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Clean Side-by-Side Input & Output Panes */}
        <div className="grid divide-y divide-neutral-200/80 dark:divide-white/10 md:grid-cols-2 md:divide-x md:divide-y-0">
          {mode === "text" ? (
            <>
          {/* Left Pane: Input Text with Live Markdown */}
          <div className="flex flex-col p-4 sm:p-5">
            <div className="mb-2.5 flex items-center justify-between">
              <label
                htmlFor="playground-user-input"
                className="text-xs font-semibold text-neutral-600 dark:text-neutral-300"
              >
                {fromLanguage}
              </label>

              {userInput && (
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-neutral-400 dark:text-neutral-500">
                    {userInput.length.toLocaleString()} chars
                  </span>
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
                </div>
              )}
            </div>

            <LiveMarkdownEditor
              id="playground-user-input"
              data-testid="playground-user-input"
              value={userInput}
              onChange={setUserInput}
              onSubmit={handleRunTranslation}
              placeholder="Enter text to translate (supports Live Markdown & HTML)..."
              className="w-full flex-1 text-base leading-7 text-neutral-950 dark:text-white"
            />
          </div>

          {/* Right Pane: Translated Output (Always Markdown) */}
          <div className="flex flex-col bg-neutral-50/40 p-4 dark:bg-white/[0.01] sm:p-5">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
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
              <div>
                {translatedOutput ? (
                  <MarkdownView
                    content={translatedOutput}
                    streaming={Boolean(latestRun?.streaming)}
                  />
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
                    className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-sans tabular-nums text-xs font-medium text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                  >
                    <Activity className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    Tokens: {latestRun.promptTokens} in / {latestRun.completionTokens} out • Cost: $
                    {formatCostBadge(latestRun.costUsd)}
                  </span>
                </div>
              )}
            </div>
          </div>
            </>
          ) : mode === "image" ? (
            <>
              {/* Left Pane: Source Image (upload / drag & drop / paste / URL) */}
              <div className="flex flex-col p-4 sm:p-5">
                <div className="mb-2.5 flex items-center justify-between">
                  <label
                    htmlFor="playground-image-file"
                    className="text-xs font-semibold text-neutral-600 dark:text-neutral-300"
                  >
                    Source image
                  </label>

                  {(imageSource || imageUrl || imageOutput || imageRun) && (
                    <button
                      type="button"
                      onClick={() => {
                        setImageSource(null);
                        setImageSourceName("");
                        setImageUrl("");
                        setImageOutput("");
                        setImageRun(null);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                    >
                      <Trash2 className="h-3 w-3" />
                      Clear
                    </button>
                  )}
                </div>

                {imageSource || imageUrl.trim() ? (
                  <div
                    data-testid="playground-image-input"
                    onDragOver={(e) => {
                      e.preventDefault();
                      setImageDragActive(true);
                    }}
                    onDragLeave={() => setImageDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setImageDragActive(false);
                      void handleImageFile(e.dataTransfer?.files?.[0]);
                    }}
                    className={`flex min-h-[14rem] flex-1 items-center justify-center rounded-xl border border-dashed p-3 transition ${
                      imageDragActive
                        ? "border-neutral-950 bg-neutral-100/70 dark:border-white dark:bg-white/10"
                        : "border-neutral-300 bg-neutral-50/60 dark:border-white/15 dark:bg-white/[0.02]"
                    }`}
                  >
                    <img
                      src={imageSource || imageUrl.trim()}
                      alt="Source for translation"
                      className="max-h-80 w-full rounded-lg object-contain"
                    />
                  </div>
                ) : (
                  <label
                    htmlFor="playground-image-file"
                    data-testid="playground-image-input"
                    onDragOver={(e) => {
                      e.preventDefault();
                      setImageDragActive(true);
                    }}
                    onDragLeave={() => setImageDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setImageDragActive(false);
                      void handleImageFile(e.dataTransfer?.files?.[0]);
                    }}
                    className={`flex min-h-[14rem] flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center transition ${
                      imageDragActive
                        ? "border-neutral-950 bg-neutral-100/70 dark:border-white dark:bg-white/10"
                        : "border-neutral-300 bg-neutral-50/60 hover:bg-neutral-100/70 dark:border-white/15 dark:bg-white/[0.02] dark:hover:bg-white/[0.05]"
                    }`}
                  >
                    <UploadCloud className="h-7 w-7 text-neutral-400 dark:text-neutral-500" />
                    <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">
                      Drag &amp; drop an image, click to upload, or paste from clipboard
                    </span>
                    <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
                      PNG, JPG, or WEBP • up to 20 MB
                    </span>
                  </label>
                )}
                <input
                  id="playground-image-file"
                  data-testid="playground-image-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    void handleImageFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />

                <div className="mt-3 flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 dark:border-white/15 dark:bg-neutral-950">
                  <Link2 className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                  <input
                    type="url"
                    data-testid="playground-image-url"
                    value={imageUrl}
                    onChange={(e) => {
                      setImageUrl(e.target.value);
                      if (e.target.value.trim()) {
                        setImageSource(null);
                        setImageSourceName("");
                        setImageOutput("");
                        setImageRun(null);
                      }
                    }}
                    placeholder="...or paste an image URL (https://...)"
                    className="h-9 w-full bg-transparent text-xs text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-white"
                  />
                </div>

                {imageSourceName && (
                  <p className="mt-2 truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                    {imageSourceName}
                  </p>
                )}
              </div>

              {/* Right Pane: Translated Image */}
              <div className="flex flex-col bg-neutral-50/40 p-4 dark:bg-white/[0.01] sm:p-5">
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                    {toLanguage} ({activeImageModel.label})
                  </span>

                  {imageOutput && (
                    <a
                      href={imageOutput}
                      download={`lingofusion-${activeImageModel.resolution}.png`}
                      className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </a>
                  )}
                </div>

                <div
                  data-testid="playground-image-output"
                  className="flex min-h-[14rem] flex-1 flex-col justify-between"
                >
                  <div className="flex flex-1 items-center justify-center">
                    {imageOutput ? (
                      <img
                        src={imageOutput}
                        alt="Translated result"
                        className="max-h-80 w-full rounded-lg object-contain"
                      />
                    ) : (
                      <span className="text-sm text-neutral-400 dark:text-neutral-500">
                        {imageRunning
                          ? "Translating..."
                          : "Translated image will appear here."}
                      </span>
                    )}
                  </div>

                  {imageRun && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200/70 pt-3 dark:border-white/10">
                      <span
                        data-testid="image-response-usage-badge"
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-sans tabular-nums text-xs font-medium text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                      >
                        <Activity className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        Tokens: {imageRun.promptTokens} in / {imageRun.completionTokens} out • Cost: $
                        {formatCostBadge(imageRun.costUsd)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Voice Synthesis Layout */
            <>
              {/* Left Pane: Text input for speech */}
              <div className="flex flex-col p-4 sm:p-5">
                <div className="mb-2.5 flex items-center justify-between">
                  <label
                    htmlFor="playground-voice-input"
                    className="text-xs font-semibold text-neutral-600 dark:text-neutral-300"
                  >
                    Text to synthesize
                  </label>
                  {userInput && (
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] text-neutral-400 dark:text-neutral-500">
                        {userInput.length.toLocaleString()} chars
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setUserInput("");
                          setVoiceAudioUrl(null);
                          setVoiceRun(null);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                      >
                        <Trash2 className="h-3 w-3" />
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col rounded-xl border border-neutral-200 bg-white p-3.5 transition focus-within:border-neutral-400 dark:border-white/10 dark:bg-neutral-950 dark:focus-within:border-white/30">
                  <LiveMarkdownEditor
                    id="playground-voice-input"
                    data-testid="playground-voice-input"
                    value={userInput}
                    onChange={setUserInput}
                    onSubmit={handleRunVoiceSynthesis}
                    placeholder="Enter text to speak with LingoFusion Voice (use [Laughing], [Whispering], etc.)..."
                    className="w-full flex-1 text-base leading-7 text-neutral-950 dark:text-white"
                  />
                </div>
              </div>

              {/* Right Pane: Audio Player & Result */}
              <div className="flex flex-col bg-neutral-50/40 p-4 dark:bg-white/[0.01] sm:p-5">
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                    Audio Output ({selectedVoiceModel})
                  </span>
                  {voiceAudioUrl && (
                    <a
                      href={voiceAudioUrl}
                      download={`${selectedVoiceModel.toLowerCase().replace(/\s+/g, "-")}.mp3`}
                      className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                    >
                      <Download className="h-3 w-3" />
                      Download audio
                    </a>
                  )}
                </div>

                <div
                  data-testid="playground-voice-output"
                  className="flex min-h-[14rem] flex-1 flex-col justify-between"
                >
                  <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8">
                    {voiceAudioUrl ? (
                      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-neutral-900">
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Volume2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                              {selectedVoiceModel}
                            </span>
                          </div>
                          {voiceRun && (
                            <span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                              {voiceRun.chars.toLocaleString()} chars
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                          <button
                            type="button"
                            onClick={() => {
                              if (!voiceAudioRef.current) return;
                              if (voicePlaying) {
                                voiceAudioRef.current.pause();
                                setVoicePlaying(false);
                              } else {
                                voiceAudioRef.current.play().catch(() => {});
                                setVoicePlaying(true);
                              }
                            }}
                            data-testid="playground-voice-play-toggle-btn"
                            className="pressable inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-5 text-xs font-semibold text-white shadow-xs transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                          >
                            {voicePlaying ? (
                              <>
                                <Square className="h-3.5 w-3.5 fill-current" />
                                Pause
                              </>
                            ) : (
                              <>
                                <Play className="h-3.5 w-3.5 fill-current" />
                                Listen
                              </>
                            )}
                          </button>

                          <audio
                            ref={voiceAudioRef}
                            src={voiceAudioUrl}
                            controls
                            autoPlay
                            onPlay={() => setVoicePlaying(true)}
                            onPause={() => setVoicePlaying(false)}
                            onEnded={() => setVoicePlaying(false)}
                            className="h-11 flex-1"
                            data-testid="playground-voice-audio-player"
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-neutral-400 dark:text-neutral-500">
                        {voiceRunning
                          ? "Generating speech..."
                          : "Synthesized audio will appear here."}
                      </span>
                    )}
                  </div>

                  {voiceRun && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200/70 pt-3 dark:border-white/10">
                      <span
                        data-testid="voice-response-usage-badge"
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-sans tabular-nums text-xs font-medium text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                      >
                        <Activity className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        {voiceRun.chars} characters • Cost: ${formatCostBadge(voiceRun.costUsd)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
