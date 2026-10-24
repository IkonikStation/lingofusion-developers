import {
  Activity,
  AlertCircle,
  ArrowRightLeft,
  Check,
  ChevronDown,
  Clapperboard,
  ClipboardCopy,
  Copy,
  CreditCard,
  Download,
  FileText,
  Gauge,
  Gift,
  Globe,
  Image as ImageIcon,
  Link2,
  Loader2,
  Mail,
  Music,
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
  syncCloudBalance,
} from "../data/browserApi";
import type { ModelPricingRecord } from "../data/browserApi";
import { dubbingLanguageNameToCode, dubbingLanguagesWithFlags, playgroundLanguages } from "../data/playgroundLanguages";
import { dubbingModels, imageModels, musicModels, textModelPresentations, ttsModels } from "../data/pricing";
import { getCurrentUser, subscribeAuth } from "../data/auth";
import { formatUsd, pageQuery } from "../lib/utils";

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

function formatDuration(seconds: number): string {
  if (!seconds || !Number.isFinite(seconds)) return "0s";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const remM = m % 60;
    return `${h}h ${remM}m`;
  }
  return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
}

function formatFileSize(bytes: number): string {
  if (!bytes || !Number.isFinite(bytes)) return "0 B";
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
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
  const [userInput, setUserInput] = useState<string>("");
  const [translatedOutput, setTranslatedOutput] = useState<string>("");
  const [latestRun, setLatestRun] = useState<TranslationRun | null>(null);

  // Speed / pricing mode for text models: "default" | "fast" | "ultrafast"
  const [speedMode, setSpeedMode] = useState<"default" | "fast" | "ultrafast">("default");
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
  const [currentUserEmail, setCurrentUserEmail] = useState<string>(() => getCurrentUser().email);

  // Deposit & Gift Drawer state
  const [depositModalOpen, setDepositModalOpen] = useState<boolean>(false);
  const [depositTab, setDepositTab] = useState<"self" | "gift">("self");
  const [giftRecipientEmail, setGiftRecipientEmail] = useState<string>("");
  const [giftSenderName, setGiftSenderName] = useState<string>("");
  const [giftMessage, setGiftMessage] = useState<string>("");

  // Claim Gift Modal state
  const [claimModalOpen, setClaimModalOpen] = useState<boolean>(false);
  const [claimEmail, setClaimEmail] = useState<string>("");
  const [claimCode, setClaimCode] = useState<string>("");
  const [claimBusy, setClaimBusy] = useState<boolean>(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState<string | null>(null);
  const [pendingGifts, setPendingGifts] = useState<Array<any>>([]);
  const [checkingGifts, setCheckingGifts] = useState<boolean>(false);
  const [insufficientModalOpen, setInsufficientModalOpen] = useState<boolean>(false);
  const [depositAmount, setDepositAmount] = useState<number>(10);
  const [depositBusy, setDepositBusy] = useState<boolean>(false);
  const [depositStatusMessage, setDepositStatusMessage] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<{
    type: "success" | "cancelled";
    message: string;
    isGift?: boolean;
    giftRecipient?: string;
    giftAmount?: number;
    giftCode?: string;
    claimUrl?: string;
  } | null>(null);
  const [claimCopied, setClaimCopied] = useState<boolean>(false);

  // Auto Top-Up settings state
  const [autoTopUpEnabled, setAutoTopUpEnabled] = useState<boolean>(false);
  const [autoTopUpThreshold, setAutoTopUpThreshold] = useState<number>(10);
  const [autoTopUpTarget, setAutoTopUpTarget] = useState<number>(50);
  const [autoTopUpBusy, setAutoTopUpBusy] = useState<boolean>(false);
  const [autoTopUpMessage, setAutoTopUpMessage] = useState<string | null>(null);
  const [autoTopUpError, setAutoTopUpError] = useState<string | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Playground modality: text translation vs in-image translation vs voice synthesis vs music generation vs dubbing
  const [mode, setMode] = useState<"text" | "image" | "voice" | "music" | "dubbing">(() => {
    const q = pageQuery().get("mode");
    if (q === "dubbing" || q === "dub") return "dubbing";
    if (q === "music") return "music";
    if (q === "voice" || q === "tts") return "voice";
    return q === "image" ? "image" : "text";
  });
  const [modeDropdownOpen, setModeDropdownOpen] = useState<boolean>(false);
  const modeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!modeDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent | PointerEvent) => {
      if (!modeDropdownRef.current?.contains(e.target as Node)) {
        setModeDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModeDropdownOpen(false);
    };
    document.addEventListener("pointerdown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [modeDropdownOpen]);

  const PLAYGROUND_MODES = [
    { id: "text" as const, label: "Text", icon: FileText },
    { id: "image" as const, label: "Image", icon: ImageIcon },
    { id: "voice" as const, label: "Voice", icon: Volume2 },
    { id: "music" as const, label: "Music", icon: Music },
    { id: "dubbing" as const, label: "Dubbing", icon: Clapperboard },
  ];
  const activeModeItem = PLAYGROUND_MODES.find((m) => m.id === mode) ?? PLAYGROUND_MODES[0];
  const ActiveModeIcon = activeModeItem.icon;

  // Dubbing studio state
  const [selectedDubbingModel, setSelectedDubbingModel] = useState<string>("LingoFusion Dubbing");
  const [dubbingFile, setDubbingFile] = useState<File | null>(null);
  const [dubbingFileName, setDubbingFileName] = useState<string>("");
  const [dubbingFileSize, setDubbingFileSize] = useState<number>(0);
  const [dubbingDurationSeconds, setDubbingDurationSeconds] = useState<number>(0);
  const [dubbingMediaType, setDubbingMediaType] = useState<"video" | "audio">("video");
  const [dubbingPreviewUrl, setDubbingPreviewUrl] = useState<string | null>(null);
  const [dubbingTargetLang, setDubbingTargetLang] = useState<string>("Spanish (Spain)");
  const [dubbingRunning, setDubbingRunning] = useState<boolean>(false);
  const [dubbingDragActive, setDubbingDragActive] = useState<boolean>(false);
  const [dubbingValidationError, setDubbingValidationError] = useState<string | null>(null);
  const [dubbedMediaUrl, setDubbedMediaUrl] = useState<string | null>(null);
  const [dubbedRun, setDubbedRun] = useState<{
    id: string;
    model: string;
    targetLang: string;
    durationSeconds: number;
    costUsd: number;
    mediaType: "video" | "audio";
    fileName: string;
  } | null>(null);
  const [selectedMusicModel, setSelectedMusicModel] = useState<string>("LingoFusion Music");
  const [musicDurationSeconds, setMusicDurationSeconds] = useState<number>(30);
  const [musicInstrumental, setMusicInstrumental] = useState<boolean>(false);
  const [musicAudioUrl, setMusicAudioUrl] = useState<string | null>(null);
  const [musicRunning, setMusicRunning] = useState<boolean>(false);
  const [musicPlaying, setMusicPlaying] = useState<boolean>(false);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const [musicRun, setMusicRun] = useState<{
    id: string;
    model: string;
    durationSeconds: number;
    costUsd: number;
  } | null>(null);
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
      let bal = dash.user?.balance_usd ?? dash.account.paidBalance;
      const currentUser = getCurrentUser();
      if (currentUser.email && currentUser.email !== "developer@lingofusion.dev") {
        try {
          const cloudBal = await syncCloudBalance(currentUser.email, currentUser.id);
          if (typeof cloudBal === "number") {
            bal = cloudBal;
          }
        } catch {
          // Keep local cache if offline
        }
      }
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
    const unsub = subscribeAuth((user) => {
      setActiveUserId(user.id);
      setCurrentUserEmail(user.email);
      if (typeof user.balance_usd === "number") {
        updateBalance(user.balance_usd);
      }
      if (user.email && user.email !== "developer@lingofusion.dev") {
        void syncCloudBalance(user.email, user.id).then((cloudBal) => {
          if (typeof cloudBal === "number") {
            updateBalance(cloudBal);
          }
        });
      }
      void loadModelsAndState();
    });

    // Auto-sync balance across devices when returning to or focusing this browser tab
    const handleSyncOnFocus = () => {
      const user = getCurrentUser();
      if (user.email && user.email !== "developer@lingofusion.dev") {
        void syncCloudBalance(user.email, user.id).then((cloudBal) => {
          if (typeof cloudBal === "number") {
            updateBalance(cloudBal);
          }
        });
      }
    };
    window.addEventListener("focus", handleSyncOnFocus);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleSyncOnFocus();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      unsub();
      window.removeEventListener("focus", handleSyncOnFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const claimCodeParam = params.get("claim_gift") || params.get("gift_code");
    const recipientEmailParam = params.get("recipient_email") || params.get("gift_email");

    if (claimCodeParam || recipientEmailParam) {
      if (claimCodeParam) setClaimCode(claimCodeParam);
      if (recipientEmailParam) {
        setClaimEmail(recipientEmailParam);
        void handleCheckGifts(recipientEmailParam);
      }
      setClaimModalOpen(true);
      params.delete("claim_gift");
      params.delete("gift_code");
      params.delete("recipient_email");
      params.delete("gift_email");
      const remainingQuery = params.toString();
      const cleanUrl = `${window.location.pathname}${remainingQuery ? `?${remainingQuery}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", cleanUrl);
    }
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
                isGift?: boolean;
                recipientEmail?: string;
                giftCode?: string;
              }>("/api/verify-checkout-session", {
                method: "POST",
                body: JSON.stringify({ sessionId }),
              });
              if (verified.isGift) {
                const claimUrl = `${window.location.origin}${window.location.pathname}?claim_gift=${encodeURIComponent(
                  verified.giftCode || "",
                )}&gift_email=${encodeURIComponent(verified.recipientEmail || "")}`;
                setPaymentNotice({
                  type: "success",
                  isGift: true,
                  giftRecipient: verified.recipientEmail,
                  giftAmount: verified.net_deposited_usd || 0,
                  giftCode: verified.giftCode,
                  claimUrl,
                  message: `Gift payment successful! +$${formatUsd(verified.net_deposited_usd || 0)} USD in credits was sent to ${verified.recipientEmail}. An email with their claim link has been prepared.`,
                });
              } else {
                if (typeof verified.balance_usd === "number") {
                  updateBalance(verified.balance_usd);
                }
                if (verified.verified && typeof verified.net_deposited_usd === "number") {
                  setPaymentNotice({
                    type: "success",
                    message: `Payment received! +$${formatUsd(verified.net_deposited_usd)} USD added to your credit balance.`,
                  });
                }
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

  const dubbingLanguageItems = useMemo(
    () =>
      dubbingLanguagesWithFlags.map((item) => ({
        id: item.name,
        label: item.name,
        icon: (
          <span className="shrink-0 text-base leading-none select-none" role="img" aria-label={item.name}>
            {item.flag}
          </span>
        ),
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

  const musicModelItems = useMemo(
    () =>
      musicModels.map((model) => ({
        id: model.model,
        label: model.model,
        icon: <Music className="h-3.5 w-3.5 shrink-0 text-neutral-400" />,
        hint: `$${model.priceUsd?.toFixed(2)}/min`,
      })),
    [],
  );

  const dubbingModelItems = useMemo(
    () =>
      dubbingModels
        .filter((model) => !model.model.toLowerCase().includes("video dub"))
        .map((model) => ({
          id: model.model,
          label: model.model,
          icon: <Clapperboard className="h-3.5 w-3.5 shrink-0 text-neutral-400" />,
          hint: `$${(model.priceUsd ?? 3.50).toFixed(2)}/min`,
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

    const effectiveSpeedMode =
      speedMode === "ultrafast" && ["LingoFusion Pro", "LingoFusion Ultra"].includes(activeModel.model_id)
        ? "ultrafast"
        : speedMode === "fast" && ["LingoFusion Nano", "LingoFusion Lite", "LingoFusion", "LingoFusion Pro", "LingoFusion Ultra"].includes(activeModel.model_id)
        ? "fast"
        : "default";

    const payload: Record<string, unknown> = {
      model: activeModel.model_id,
      from_language: fromLanguage,
      to_language: toLanguage,
      input: currentInput,
      messages: [{ role: "user", content: currentInput }],
      stream: streamToggle,
      pricing_mode: effectiveSpeedMode,
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
                const speedMultiplier = effectiveSpeedMode === "ultrafast" ? 4 : effectiveSpeedMode === "fast" ? 1.5 : 1;
                const liveCost = Number(
                  (
                    webSearchFee +
                    promptTokens * ((activeModel.input_per_million * speedMultiplier) / 1_000_000) +
                    completionTokens * ((activeModel.output_per_million * speedMultiplier) / 1_000_000)
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

  const handleRunMusicGeneration = async () => {
    const prompt = userInput.trim() || translatedOutput.trim();
    if (!prompt || musicRunning) return;
    if (liveBalance <= 0) {
      setInsufficientModalOpen(true);
      return;
    }
    setErrorBanner(null);
    setMusicRunning(true);
    setMusicAudioUrl(null);
    setMusicRun(null);

    const runId = `music-${Date.now()}`;
    const payload = {
      model: selectedMusicModel,
      prompt,
      duration_seconds: musicDurationSeconds,
      force_instrumental: musicInstrumental,
    };

    try {
      if (shouldUseBrowserApi()) {
        const response = await callApi<{
          id: string;
          model: string;
          status: string;
          output: {
            prompt: string;
            duration_seconds: number;
            audio_url: string;
          };
          usage: {
            audio_seconds: number;
            audio_minutes: number;
            cost_usd: number;
          };
        }>("/api/playground/music", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        setMusicAudioUrl(response.output.audio_url);
        setMusicRun({
          id: response.id || runId,
          model: response.model || selectedMusicModel,
          durationSeconds: response.output.duration_seconds || musicDurationSeconds,
          costUsd: response.usage?.cost_usd || (0.50 * (musicDurationSeconds / 60)),
        });
      } else {
        const baseUrl = getApiBaseUrl();
        const res = await fetch(`${baseUrl}/api/playground/music`, {
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

        const data = await res.json();
        setMusicAudioUrl(data.audio_url);
        setMusicRun({
          id: data.id || runId,
          model: data.model || selectedMusicModel,
          durationSeconds: data.duration_seconds || musicDurationSeconds,
          costUsd: 0.50 * ((data.duration_seconds || musicDurationSeconds) / 60),
        });
      }

      await loadModelsAndState();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Music generation failed";
      if (message.toLowerCase().includes("insufficient") || message.toLowerCase().includes("deposit")) {
        setInsufficientModalOpen(true);
      } else {
        setErrorBanner(message);
      }
    } finally {
      setMusicRunning(false);
    }
  };

  const handleDubbingFileSelect = async (file?: File | null) => {
    if (!file) return;
    setDubbingValidationError(null);
    setErrorBanner(null);

    // 1. Capacity limit: max 2 GB (2,147,483,648 bytes)
    const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      setDubbingValidationError(
        `File capacity limit exceeded: selected file is ${(file.size / (1024 * 1024 * 1024)).toFixed(2)} GB (maximum allowed is 2 GB).`
      );
      return;
    }

    const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(file.name);
    const isAudio = file.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|flac|ogg|wma)$/i.test(file.name);

    if (!isVideo && !isAudio) {
      setDubbingValidationError("Please upload a valid audio or video file (.mp4, .mov, .mp3, .wav, .m4a, etc.).");
      return;
    }

    const objectUrl = URL.createObjectURL(file);

    // 2. Duration check: minimum 15 seconds, maximum 180 minutes (10,800 seconds)
    try {
      const durationSec = await new Promise<number>((resolve) => {
        const media = document.createElement(isVideo ? "video" : "audio");
        media.preload = "metadata";
        media.src = objectUrl;
        const timer = setTimeout(() => {
          resolve(30);
        }, 10000);
        media.onloadedmetadata = () => {
          clearTimeout(timer);
          resolve(media.duration && Number.isFinite(media.duration) ? media.duration : 30);
        };
        media.onerror = () => {
          clearTimeout(timer);
          resolve(30);
        };
      });

      if (durationSec < 15) {
        setDubbingValidationError(
          `File duration is too short (${Math.round(durationSec)}s). Minimum required duration is 15 seconds.`
        );
        URL.revokeObjectURL(objectUrl);
        return;
      }

      if (durationSec > 180 * 60) {
        setDubbingValidationError(
          `File duration exceeds maximum limit (${Math.round(durationSec / 60)} minutes). Maximum allowed duration is 180 minutes.`
        );
        URL.revokeObjectURL(objectUrl);
        return;
      }

      setDubbingFile(file);
      setDubbingFileName(file.name);
      setDubbingFileSize(file.size);
      setDubbingDurationSeconds(Math.round(durationSec));
      setDubbingMediaType(isVideo ? "video" : "audio");
      setDubbingPreviewUrl(objectUrl);
      setDubbedMediaUrl(null);
      setDubbedRun(null);
    } catch (_err) {
      setDubbingValidationError("Could not parse media metadata. Please ensure the file is a playable audio or video.");
    }
  };

  const handleRunDubbing = async () => {
    if (!dubbingFile || dubbingRunning) return;
    if (liveBalance <= 0) {
      setInsufficientModalOpen(true);
      return;
    }
    setErrorBanner(null);
    setDubbingRunning(true);
    setDubbedMediaUrl(null);
    setDubbedRun(null);

    const runId = `dub-${Date.now()}`;
    const selectedModelRecord = dubbingModels.find((m) => m.model === selectedDubbingModel) ?? dubbingModels[0];
    const durationToUse = Math.max(15, dubbingDurationSeconds || 30);
    const estimatedCostUsd = Number(((durationToUse / 60) * (selectedModelRecord.priceUsd ?? 3.50)).toFixed(4));

    try {
      let fileBase64 = "";
      if (dubbingFile.size < 25 * 1024 * 1024) {
        try {
          fileBase64 = await readFileAsDataUrl(dubbingFile);
        } catch (_err) {
          // ignore if base64 conversion fails
        }
      }

      const payload = {
        model: selectedDubbingModel,
        target_lang: dubbingLanguageNameToCode[dubbingTargetLang] || dubbingTargetLang,
        target_language: dubbingTargetLang,
        source_lang: "auto",
        duration_seconds: durationToUse,
        media_type: dubbingMediaType === "video" ? (dubbingFile.type || "video/mp4") : (dubbingFile.type || "audio/mpeg"),
        file_name: dubbingFileName || "media.mp4",
        file_base64: fileBase64,
      };

      if (shouldUseBrowserApi()) {
        const response = await callApi<{
          id: string;
          model: string;
          status: string;
          media_url: string;
          file_name?: string;
          media_type?: string;
          duration_seconds?: number;
          cost_usd?: number;
        }>("/api/playground/dubbing", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        const resultUrl = response.media_url || dubbingPreviewUrl || fileBase64;
        setDubbedMediaUrl(resultUrl);
        setDubbedRun({
          id: response.id || runId,
          model: response.model || selectedDubbingModel,
          targetLang: dubbingTargetLang,
          durationSeconds: response.duration_seconds || durationToUse,
          costUsd: response.cost_usd ?? estimatedCostUsd,
          mediaType: dubbingMediaType,
          fileName: response.file_name || `dubbed-${dubbingTargetLang.toLowerCase()}-${dubbingFileName}`,
        });
      } else {
        const baseUrl = getApiBaseUrl();
        const res = await fetch(`${baseUrl}/api/playground/dubbing`, {
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

        const data = await res.json().catch(() => ({}));
        const resultUrl = data.media_url || dubbingPreviewUrl || fileBase64;
        setDubbedMediaUrl(resultUrl);
        setDubbedRun({
          id: data.id || runId,
          model: data.model || selectedDubbingModel,
          targetLang: dubbingTargetLang,
          durationSeconds: data.duration_seconds || durationToUse,
          costUsd: data.cost_usd ?? estimatedCostUsd,
          mediaType: dubbingMediaType,
          fileName: data.file_name || `dubbed-${dubbingTargetLang.toLowerCase()}-${dubbingFileName}`,
        });
      }

      await loadModelsAndState();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Dubbing failed";
      if (message.toLowerCase().includes("insufficient") || message.toLowerCase().includes("deposit")) {
        setInsufficientModalOpen(true);
      } else {
        setErrorBanner(message);
      }
    } finally {
      setDubbingRunning(false);
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
      setErrorBanner("Amount must be between $1.00 and $50,000.00 USD.");
      return;
    }
    if (depositTab === "gift") {
      const email = giftRecipientEmail.trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setErrorBanner("Please enter a valid recipient email address for the gift.");
        return;
      }
    }
    setDepositBusy(true);
    try {
      const isGift = depositTab === "gift";
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
          userEmail: currentUserEmail !== "developer@lingofusion.dev" ? currentUserEmail : undefined,
          currency: "usd",
          isGift,
          recipientEmail: isGift ? giftRecipientEmail.trim().toLowerCase() : undefined,
          senderName: isGift ? giftSenderName.trim() : undefined,
          giftMessage: isGift ? giftMessage.trim() : undefined,
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

  const handleCheckGifts = async (emailToCheck: string) => {
    const email = emailToCheck.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    setCheckingGifts(true);
    setClaimError(null);
    try {
      const res = await callApi<{
        email: string;
        gifts: Array<{
          code: string;
          amountUsd: number;
          senderName: string;
          giftMessage: string;
          createdAt: string;
        }>;
        totalAvailableUsd: number;
      }>("/api/gifts/check", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setPendingGifts(res.gifts || []);
    } catch {
      setPendingGifts([]);
    } finally {
      setCheckingGifts(false);
    }
  };

  const handleClaimGift = async () => {
    setClaimError(null);
    setClaimSuccess(null);
    const email = claimEmail.trim().toLowerCase();
    const code = claimCode.trim();

    if (!email && !code) {
      setClaimError("Please enter your email or gift code.");
      return;
    }

    setClaimBusy(true);
    try {
      const res = await callApi<{
        success: boolean;
        claimedAmountUsd: number;
        newBalance?: number;
        gifts: Array<{
          amountUsd: number;
          senderName: string;
          giftMessage: string;
        }>;
      }>("/api/gifts/claim", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });

      if (res.success && typeof res.claimedAmountUsd === "number") {
        if (typeof res.newBalance === "number") {
          updateBalance(res.newBalance);
        } else {
          updateBalance(liveBalance + res.claimedAmountUsd);
        }
        setClaimSuccess(`Successfully claimed +$${formatUsd(res.claimedAmountUsd)} USD in gifted credits!`);
        setPendingGifts([]);
        setClaimCode("");
        await loadModelsAndState();
      }
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : "Failed to claim gift");
    } finally {
      setClaimBusy(false);
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
          ? `Auto top-up enabled: when balance reaches $${formatUsd(autoTopUpThreshold)}, bring it back up to $${formatUsd(autoTopUpTarget)} USD.`
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
                : mode === "voice"
                  ? "Select a voice model, enter text, and generate speech."
                  : mode === "music"
                    ? "Select a music model, enter a prompt, and compose tracks."
                    : mode === "dubbing"
                      ? "Upload an audio or video file, select a language, and generate studio-quality dubbed media."
                      : "Choose a model, enter text, and translate instantly."}
            </p>
          </div>
        </div>

        {/* Right: Modality Dropdown + Live Balance Pill + Add Credits Trigger */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Mode Dropdown (Text, Image, Voice, Music) */}
          <div ref={modeDropdownRef} className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={modeDropdownOpen}
              data-testid="playground-mode-dropdown-btn"
              onClick={() => setModeDropdownOpen((prev) => !prev)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3.5 text-xs font-semibold text-neutral-950 shadow-2xs transition hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 dark:border-white/10 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800 dark:focus-visible:ring-white"
            >
              <ActiveModeIcon className="h-3.5 w-3.5 text-neutral-600 dark:text-neutral-300" />
              <span>{activeModeItem.label}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-neutral-400 transition-transform duration-150 ${
                  modeDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {modeDropdownOpen && (
              <div
                role="menu"
                aria-label="Select mode"
                className="absolute left-0 top-[calc(100%+6px)] z-40 w-44 rounded-xl border border-neutral-200 bg-white p-1.5 shadow-xl dark:border-white/15 dark:bg-neutral-900 sm:left-auto sm:right-0"
              >
                {PLAYGROUND_MODES.map((item) => {
                  const isSelected = mode === item.id;
                  const ItemIcon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      data-testid={`playground-mode-${item.id}`}
                      onClick={() => {
                        setMode(item.id);
                        setModeDropdownOpen(false);
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition ${
                        isSelected
                          ? "bg-neutral-100 font-semibold text-neutral-950 dark:bg-white/10 dark:text-white"
                          : "text-neutral-700 hover:bg-neutral-100/70 dark:text-neutral-300 dark:hover:bg-white/5"
                      }`}
                    >
                      <ItemIcon className="h-3.5 w-3.5 shrink-0 text-neutral-500 dark:text-neutral-400" />
                      <span className="flex-1">{item.label}</span>
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

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
              ${formatUsd(liveBalance)}
            </span>
          </div>

          <button
            type="button"
            data-testid="playground-topup-btn"
            onClick={() => {
              setDepositStatusMessage(null);
              setDepositTab("self");
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
          className={`mt-4 rounded-xl border p-4 text-xs ${
            paymentNotice.type === "success"
              ? paymentNotice.isGift
                ? "border-purple-200 bg-purple-50/90 text-purple-950 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-100"
                : "border-emerald-200 bg-emerald-50/90 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
              : "border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-300"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              {paymentNotice.type === "success" ? (
                paymentNotice.isGift ? (
                  <Gift className="mt-0.5 h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400" />
                ) : (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                )
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500 dark:text-neutral-400" />
              )}
              <div>
                <p className="font-semibold">{paymentNotice.message}</p>
                {paymentNotice.isGift && paymentNotice.claimUrl && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(paymentNotice.claimUrl || "");
                        setClaimCopied(true);
                        setTimeout(() => setClaimCopied(false), 2500);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-purple-300 bg-white px-3 py-1.5 text-xs font-semibold text-purple-900 shadow-2xs transition hover:bg-purple-50 dark:border-purple-500/40 dark:bg-neutral-900 dark:text-purple-200 dark:hover:bg-purple-950/40"
                    >
                      {claimCopied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Copied Claim Link!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                          <span>Copy Claim Link</span>
                        </>
                      )}
                    </button>
                    {paymentNotice.giftRecipient && (
                      <a
                        href={`mailto:${paymentNotice.giftRecipient}?subject=${encodeURIComponent(
                          `🎁 You've received a gift of $${formatUsd(paymentNotice.giftAmount || 0)} USD in LingoFusion credits!`,
                        )}&body=${encodeURIComponent(
                          `Hi,\n\nI just gifted you $${formatUsd(
                            paymentNotice.giftAmount || 0,
                          )} USD in LingoFusion credits!\n\nYou can claim your credits instantly by clicking this link:\n${paymentNotice.claimUrl}\n\nGift Code: ${paymentNotice.giftCode || ""}\n\nEnjoy translating with LingoFusion!`,
                        )}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-purple-700"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        <span>Open Email to Send to {paymentNotice.giftRecipient}</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPaymentNotice(null)}
              className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
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
              className="relative z-10 my-auto max-h-[92vh] w-full max-w-4xl lg:max-w-5xl overflow-y-auto rounded-2xl border border-neutral-200/90 bg-white font-sans shadow-2xl transition-all duration-200 dark:border-white/10 dark:bg-neutral-900"
            >
          {/* Header */}
          <div className="border-b border-neutral-200/80 px-6 py-4 dark:border-white/10 sm:px-7">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 text-neutral-900 dark:bg-white/10 dark:text-white">
                  {depositTab === "gift" ? (
                    <Gift className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  ) : (
                    <Wallet className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-neutral-950 dark:text-white">
                    {depositTab === "gift" ? "Gift LingoFusion Credits" : "Add Funds"}
                  </h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {depositTab === "gift"
                      ? "Send credits directly to any email address"
                      : "Top up your LingoFusion credit balance ($1 – $50,000 USD)"}
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

            {/* Mode Switcher: Top-Up Myself vs Gift to Someone Else */}
            <div className="mt-3.5 inline-flex rounded-xl border border-neutral-200 bg-neutral-100/70 p-0.5 dark:border-white/10 dark:bg-neutral-950">
              <button
                type="button"
                onClick={() => setDepositTab("self")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition ${
                  depositTab === "self"
                    ? "bg-white text-neutral-950 shadow-xs dark:bg-neutral-800 dark:text-white"
                    : "text-neutral-500 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
                }`}
              >
                <Wallet className="h-3 w-3" />
                <span>My Balance</span>
              </button>
              <button
                type="button"
                onClick={() => setDepositTab("gift")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition ${
                  depositTab === "gift"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-neutral-500 hover:text-purple-600 dark:text-neutral-400 dark:hover:text-purple-400"
                }`}
              >
                <Gift className="h-3 w-3" />
                <span>Gift to Someone</span>
              </button>
            </div>
          </div>

          {/* Body: Two-Column Layout on Mac/PC Web */}
            <div
              className="grid divide-y divide-neutral-200/80 dark:divide-white/10 md:grid-cols-[1.25fr_0.95fr] md:divide-x md:divide-y-0"
            >
              {/* Left Column: Presets + Custom Input + Info/Gift fields */}
              <div className="space-y-4 p-6 sm:p-7">
                {depositTab === "gift" && (
                  <div className="space-y-3.5 rounded-2xl border border-purple-200/80 bg-purple-50/50 p-4 sm:p-5 dark:border-purple-500/20 dark:bg-purple-500/[0.05]">
                    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-purple-950 dark:text-purple-200">
                          Recipient Email <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          placeholder="recipient@example.com"
                          value={giftRecipientEmail}
                          onChange={(e) => setGiftRecipientEmail(e.target.value)}
                          className="mt-1 h-10 w-full rounded-xl border border-purple-200 bg-white px-3 text-xs text-neutral-900 outline-none transition focus:border-purple-600 focus:ring-1 focus:ring-purple-600 dark:border-white/15 dark:bg-neutral-950 dark:text-white dark:focus:border-purple-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-purple-950 dark:text-purple-200">
                          Your Name (optional)
                        </label>
                        <input
                          type="text"
                          placeholder="Your name or nickname"
                          value={giftSenderName}
                          onChange={(e) => setGiftSenderName(e.target.value)}
                          className="mt-1 h-10 w-full rounded-xl border border-purple-200 bg-white px-3 text-xs text-neutral-900 outline-none transition focus:border-purple-600 focus:ring-1 focus:ring-purple-600 dark:border-white/15 dark:bg-neutral-950 dark:text-white dark:focus:border-purple-400"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-purple-950 dark:text-purple-200">
                          Personal Gift Message (optional)
                        </label>
                        <span className="font-sans text-[11px] font-medium text-purple-700/70 dark:text-purple-300/70">
                          {giftMessage.length} / 500 characters
                        </span>
                      </div>
                      <textarea
                        rows={4}
                        maxLength={500}
                        placeholder="Write a personalized note to accompany your gift (e.g. 'Enjoy translating your new project with LingoFusion!')..."
                        value={giftMessage}
                        onChange={(e) => setGiftMessage(e.target.value.slice(0, 500))}
                        className="mt-1.5 w-full resize-y rounded-xl border border-purple-200 bg-white p-3 text-xs leading-relaxed text-neutral-900 outline-none transition focus:border-purple-600 focus:ring-1 focus:ring-purple-600 dark:border-white/15 dark:bg-neutral-950 dark:text-white dark:focus:border-purple-400"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <div className="mb-2.5 flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                      {depositTab === "gift" ? "Gift Amount" : "Select Credit Tier"}
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
                              ? depositTab === "gift"
                                ? "border-purple-600 bg-purple-600 text-white shadow-xs"
                                : "border-neutral-950 bg-neutral-950 text-white shadow-xs dark:border-white dark:bg-white dark:text-neutral-950"
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
                      aria-label="Custom amount in USD"
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

                {/* Balance Preview or Gift Notice */}
                {depositTab === "self" ? (
                  <div className="flex items-center justify-between rounded-xl border border-neutral-200/80 bg-neutral-50/80 px-4 py-3 text-xs dark:border-white/10 dark:bg-white/[0.03]">
                    <span className="font-medium text-neutral-600 dark:text-neutral-400">Balance after deposit</span>
                    <div className="flex items-center gap-2 font-sans tabular-nums">
                      <span className="text-neutral-400 dark:text-neutral-500">${formatUsd(liveBalance)}</span>
                      <span className="text-neutral-400">→</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        ${formatUsd(liveBalance + depositBreakdown.netDepositedUsd)} USD
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-purple-200/70 bg-purple-50/40 p-3 text-xs text-purple-900 dark:border-purple-500/20 dark:bg-purple-500/[0.04] dark:text-purple-200">
                    <p className="font-semibold">🎁 Recipient receives 100% of the credits</p>
                    <p className="mt-0.5 text-[11px] opacity-80">
                      You won't receive credits on your account. The recipient can claim them anytime using their email address.
                    </p>
                  </div>
                )}
              </div>

              {/* Right Column: Order Summary & Checkout CTA */}
              <div className="flex flex-col justify-between bg-neutral-50/60 p-6 dark:bg-white/[0.02] sm:p-7">
                <div>
                  {/* Gift Card Preview (for gifting someone - purple gradient) */}
                  {depositTab === "gift" && (
                    <div className="mb-5 overflow-hidden rounded-2xl border border-purple-200/90 bg-gradient-to-br from-purple-900 via-purple-950 to-neutral-950 p-4 text-white shadow-lg dark:border-purple-500/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 backdrop-blur-xs">
                            <Gift className="h-4 w-4 text-purple-300" />
                          </div>
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-200">
                            Gift Card Preview
                          </span>
                        </div>
                        <span className="rounded-full bg-purple-500/25 px-2 py-0.5 text-[10px] font-medium text-purple-200">
                          Recipient View
                        </span>
                      </div>

                      <div className="mt-3.5">
                        <div className="font-sans text-2xl font-extrabold tracking-tight text-white">
                          +${formatUsd(depositBreakdown.netDepositedUsd)} USD
                        </div>
                        <p className="mt-1 text-[11px] text-purple-200/80">
                          To: <span className="font-medium text-white">{giftRecipientEmail || "recipient@example.com"}</span>
                        </p>
                        {giftSenderName && (
                          <p className="text-[11px] text-purple-200/80">
                            From: <span className="font-medium text-white">{giftSenderName}</span>
                          </p>
                        )}
                      </div>

                      {giftMessage ? (
                        <div className="mt-3 max-h-24 overflow-y-auto rounded-xl bg-white/10 p-2.5 text-[11px] italic leading-relaxed text-purple-100 backdrop-blur-xs">
                          "{giftMessage}"
                        </div>
                      ) : (
                        <div className="mt-3 rounded-xl border border-dashed border-white/20 p-2.5 text-center text-[10px] italic text-purple-300/60">
                          Your personalized note will preview here
                        </div>
                      )}
                    </div>
                  )}

                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Summary
                  </h3>

                  <div
                    data-testid="gross-charge-preview"
                    className="mt-4 space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-300">
                      <span>{depositTab === "gift" ? "Gift credit" : "Net credit added"}</span>
                      <span className="font-sans tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                        +${formatUsd(depositBreakdown.netDepositedUsd)} USD
                      </span>
                    </div>
                    {depositTab === "gift" && giftRecipientEmail && (
                      <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
                        <span>Recipient</span>
                        <span className="max-w-[130px] truncate font-medium text-neutral-800 dark:text-neutral-200">
                          {giftRecipientEmail}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
                      <span>Processing fee</span>
                      <span className="font-sans tabular-nums">
                        ${formatUsd(depositBreakdown.estimatedStripeFeeUsd)} USD
                      </span>
                    </div>
                    <div className="border-t border-neutral-200/80 pt-3 dark:border-white/10">
                      <div className="flex items-baseline justify-between">
                        <span className="text-lg font-bold tracking-tight text-neutral-950 dark:text-white">
                          Total
                        </span>
                        <span className="font-sans tabular-nums text-lg font-bold tracking-tight text-neutral-950 dark:text-white">
                          ${formatUsd(depositBreakdown.grossChargedUsd)}{" "}
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
                    disabled={
                      depositBusy ||
                      !Number.isFinite(depositAmount) ||
                      depositAmount < 1 ||
                      depositAmount > 50000 ||
                      (depositTab === "gift" && !giftRecipientEmail)
                    }
                    data-testid="simulate-webhook-btn"
                    onClick={handleDepositCredit}
                    className={`pressable inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 ${
                      depositTab === "gift"
                        ? "bg-purple-600 hover:bg-purple-700"
                        : "bg-neutral-950 hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                    }`}
                  >
                    {depositBusy ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Redirecting to Stripe...
                      </>
                    ) : (
                      <>
                        {depositTab === "gift" ? (
                          <>
                            <Gift className="h-4 w-4" />
                            Send Gift with Stripe
                          </>
                        ) : (
                          <>
                            <CreditCard className="h-4 w-4" />
                            Continue to Checkout
                          </>
                        )}
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

          {/* Auto Top-Up Section (Shown when funding own balance) */}
          {depositTab === "self" && (
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
          )}
            </div>
          </div>,
          document.body,
        )}

      {/* Claim Gift Modal Pop-up with Full-Screen Blurred Dark Backdrop (Portaled to document.body) */}
      {claimModalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm transition-opacity"
              onClick={() => {
                if (!claimBusy) setClaimModalOpen(false);
              }}
            />

            <div
              role="dialog"
              aria-modal="true"
              className="relative z-10 my-auto max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-neutral-200/90 bg-white p-6 font-sans shadow-2xl transition-all animate-in fade-in zoom-in-95 duration-150 dark:border-white/10 dark:bg-neutral-900 sm:p-7"
            >
              <div className="flex items-center justify-between border-b border-neutral-200/80 pb-4 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300">
                    <Gift className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold tracking-tight text-neutral-950 dark:text-white">
                      Claim Gift Credits
                    </h2>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Redeem LingoFusion credits gifted to you
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={claimBusy}
                  onClick={() => setClaimModalOpen(false)}
                  className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Your Email Address
                  </label>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={claimEmail}
                      onChange={(e) => {
                        setClaimEmail(e.target.value);
                        setClaimError(null);
                        setClaimSuccess(null);
                      }}
                      className="h-10 flex-1 rounded-xl border border-neutral-200 bg-white px-3 text-xs text-neutral-900 outline-none focus:border-neutral-900 dark:border-white/15 dark:bg-neutral-950 dark:text-white dark:focus:border-white"
                    />
                    <button
                      type="button"
                      disabled={checkingGifts || !claimEmail.trim()}
                      onClick={() => void handleCheckGifts(claimEmail)}
                      className="pressable inline-flex h-10 items-center justify-center rounded-xl border border-neutral-300 bg-white px-3.5 text-xs font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:opacity-50 dark:border-white/15 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-white/10"
                    >
                      {checkingGifts ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Check"}
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-neutral-400">
                    Enter the email someone gifted credits to.
                  </p>
                </div>

                {pendingGifts.length > 0 && (
                  <div className="space-y-3">
                    {pendingGifts.map((g, idx) => (
                      <div
                        key={idx}
                        className="overflow-hidden rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-900 via-purple-950 to-neutral-950 p-4 text-white shadow-lg dark:border-purple-500/30"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 backdrop-blur-xs">
                              <Gift className="h-4 w-4 text-purple-300" />
                            </div>
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-200">
                              LingoFusion Gift
                            </span>
                          </div>
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                            Ready to Claim
                          </span>
                        </div>

                        <div className="mt-3">
                          <div className="font-sans text-2xl font-extrabold tracking-tight text-white">
                            +${formatUsd(g.amountUsd)} USD
                          </div>
                          <p className="mt-1 text-[11px] text-purple-200/80">
                            From: <span className="font-medium text-white">{g.senderName || "A friend"}</span>
                          </p>
                        </div>

                        {g.giftMessage && (
                          <div className="mt-3 rounded-xl bg-white/10 p-2.5 text-[11px] italic leading-relaxed text-purple-100 backdrop-blur-xs">
                            "{g.giftMessage}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="relative flex items-center py-1">
                  <div className="flex-grow border-t border-neutral-200 dark:border-white/10" />
                  <span className="mx-3 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                    Or enter gift code
                  </span>
                  <div className="flex-grow border-t border-neutral-200 dark:border-white/10" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Gift Code (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="gft_..."
                    value={claimCode}
                    onChange={(e) => {
                      setClaimCode(e.target.value);
                      setClaimError(null);
                      setClaimSuccess(null);
                    }}
                    className="mt-1 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 font-mono text-xs text-neutral-900 outline-none focus:border-neutral-900 dark:border-white/15 dark:bg-neutral-950 dark:text-white dark:focus:border-white"
                  />
                </div>

                {claimError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                    {claimError}
                  </div>
                )}

                {claimSuccess && (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                    <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>{claimSuccess}</span>
                  </div>
                )}

                <button
                  type="button"
                  disabled={claimBusy || (!claimEmail.trim() && !claimCode.trim())}
                  onClick={handleClaimGift}
                  className="pressable mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 text-sm font-semibold text-white shadow-xs transition hover:bg-purple-700 disabled:opacity-50"
                >
                  {claimBusy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Claiming credits...
                    </>
                  ) : (
                    <>
                      <Gift className="h-4 w-4" />
                      Claim Gift Credits
                    </>
                  )}
                </button>
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
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400">
                  <span className="text-2xl font-bold leading-none select-none">
                    $
                  </span>
                </div>
                <div className="flex-1 pr-2">
                  <h3 className="text-base font-semibold text-neutral-950 dark:text-white">
                    Insufficient balance
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                    You don't have enough credits in your balance to complete this request. Please add funds to continue using LingoFusion services.
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
              {(mode === "text" || mode === "image") && (
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

              {/* Model selector + live pricing */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Model Picker (searchable, with icons + live pricing) */}
                <Picker
                  className="w-full sm:w-56"
                  label={
                    mode === "dubbing"
                      ? "Select dubbing model"
                      : mode === "music"
                        ? "Select music model"
                        : mode === "voice"
                          ? "Select voice model"
                          : mode === "image"
                            ? "Select image model"
                            : "Select model"
                  }
                  testId={
                    mode === "dubbing"
                      ? "playground-dubbing-model-select"
                      : mode === "music"
                        ? "playground-music-model-select"
                        : mode === "voice"
                          ? "playground-voice-model-select"
                          : mode === "image"
                            ? "playground-image-model-select"
                            : "playground-model-select"
                  }
                  searchPlaceholder={
                    mode === "dubbing"
                      ? "Search dubbing models…"
                      : mode === "music"
                        ? "Search music models…"
                        : mode === "voice"
                          ? "Search voice models…"
                          : mode === "image"
                            ? "Search image models…"
                            : "Search models…"
                  }
                  items={
                    mode === "dubbing"
                      ? dubbingModelItems
                      : mode === "music"
                        ? musicModelItems
                        : mode === "voice"
                          ? voiceModelItems
                          : mode === "image"
                            ? imageModelItems
                            : modelItems
                  }
                  value={
                    mode === "dubbing"
                      ? selectedDubbingModel
                      : mode === "music"
                        ? selectedMusicModel
                        : mode === "voice"
                          ? selectedVoiceModel
                          : mode === "image"
                            ? selectedImageModel
                            : selectedModelId
                  }
                  onChange={
                    mode === "dubbing"
                      ? setSelectedDubbingModel
                      : mode === "music"
                        ? setSelectedMusicModel
                        : mode === "voice"
                          ? setSelectedVoiceModel
                          : mode === "image"
                            ? setSelectedImageModel
                            : setSelectedModelId
                  }
                  align="left"
                />

                {mode === "dubbing" && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="shrink-0 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                        Dub into:
                      </span>
                      <Picker
                        className="w-56 sm:w-64"
                        panelClassName="w-[min(20rem,calc(100vw-2.5rem))] sm:w-72"
                        label="Dub into"
                        testId="playground-dubbing-target-select"
                        searchPlaceholder="Search languages..."
                        items={dubbingLanguageItems}
                        value={dubbingTargetLang}
                        onChange={setDubbingTargetLang}
                        align="left"
                      />
                    </div>

                    <span className="hidden font-sans tabular-nums text-[11px] text-neutral-500 md:inline dark:text-neutral-400">
                      $3.50 / min
                    </span>
                  </>
                )}

                {mode === "text" && (
                  <>
                    {/* Speed / Tier Dropdown (Standard, Fast & Ultrafast) */}
                    {activeModel.model_id !== "ExplainFusion" && activeModel.model_id !== "LingoFusion Explain" && (
                      <div className="flex items-center gap-1.5">
                        <select
                          value={
                            speedMode === "ultrafast" && !["LingoFusion Pro", "LingoFusion Ultra"].includes(activeModel.model_id)
                              ? "default"
                              : speedMode
                          }
                          onChange={(e) => setSpeedMode(e.target.value as "default" | "fast" | "ultrafast")}
                          aria-label="Processing speed"
                          className="h-8 rounded-xl border border-neutral-200 bg-white px-2.5 text-xs font-semibold text-neutral-900 outline-none transition focus:border-neutral-400 dark:border-white/15 dark:bg-neutral-950 dark:text-white"
                        >
                          <option value="default">Standard speed</option>
                          <option value="fast">Fast (1.5× speed · 1.5× price)</option>
                          {["LingoFusion Pro", "LingoFusion Ultra"].includes(activeModel.model_id) && (
                            <option value="ultrafast">Ultrafast (6× speed · 4× price)</option>
                          )}
                        </select>
                      </div>
                    )}

                    <span className="hidden font-sans tabular-nums text-[11px] text-neutral-500 md:inline dark:text-neutral-400">
                      ${(activeModel.input_per_million * (speedMode === "ultrafast" ? 4 : speedMode === "fast" ? 1.5 : 1)).toFixed(2)}/M in · $
                      {(activeModel.output_per_million * (speedMode === "ultrafast" ? 4 : speedMode === "fast" ? 1.5 : 1)).toFixed(2)}/M out
                    </span>
                  </>
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
                {mode === "music" && (
                  <>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-neutral-500 dark:text-neutral-400">Duration:</label>
                      <select
                        value={musicDurationSeconds}
                        onChange={(e) => setMusicDurationSeconds(Number(e.target.value))}
                        className="h-8 rounded-lg border border-neutral-200 bg-white px-2 text-xs font-semibold text-neutral-900 outline-none dark:border-white/15 dark:bg-neutral-950 dark:text-white"
                      >
                        <option value={30}>30 sec</option>
                        <option value={60}>1 min</option>
                        <option value={120}>2 min</option>
                        <option value={180}>3 min</option>
                        <option value={240}>4 min</option>
                        <option value={300}>5 min</option>
                      </select>
                    </div>

                    <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
                      <input
                        type="checkbox"
                        checked={musicInstrumental}
                        onChange={(e) => setMusicInstrumental(e.target.checked)}
                        className="rounded border-neutral-300 text-neutral-950 focus:ring-0 dark:border-white/15"
                      />
                      <span>Instrumental</span>
                    </label>

                    <span className="hidden font-sans tabular-nums text-[11px] text-neutral-500 md:inline dark:text-neutral-400">
                      $0.50 / min
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

              {mode === "dubbing" ? (
                <button
                  type="button"
                  disabled={dubbingRunning || !dubbingFile || !!dubbingValidationError}
                  onClick={handleRunDubbing}
                  data-testid="playground-dubbing-run-btn"
                  className="pressable inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-neutral-950 px-5 text-xs font-semibold text-white shadow-xs transition hover:bg-neutral-800 disabled:opacity-50 sm:flex-none dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                >
                  {dubbingRunning ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Clapperboard className="h-3 w-3" />
                  )}
                  {dubbingRunning ? "Dubbing media..." : "Dub media"}
                </button>
              ) : mode === "music" ? (
                <button
                  type="button"
                  disabled={musicRunning || (!userInput.trim() && !translatedOutput.trim())}
                  onClick={handleRunMusicGeneration}
                  data-testid="playground-music-run-btn"
                  className="pressable inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-neutral-950 px-5 text-xs font-semibold text-white shadow-xs transition hover:bg-neutral-800 disabled:opacity-50 sm:flex-none dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                >
                  {musicRunning ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Music className="h-3 w-3" />
                  )}
                  {musicRunning ? "Generating music..." : "Generate music"}
                </button>
              ) : mode === "voice" ? (
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
              placeholder="Enter text here"
              className="w-full flex-1 text-base leading-7 text-neutral-950 dark:text-white"
            />
          </div>

          {/* Right Pane: Translated Output (Always Markdown) */}
          <div className="flex flex-col bg-neutral-50/40 p-4 dark:bg-white/[0.01] sm:p-5">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                {toLanguage}
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
                    Image output
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
                </div>
              </div>
            </>
          ) : mode === "music" ? (
            /* Music Generation Layout */
            <>
              {/* Left Pane: Prompt Input */}
              <div className="flex flex-col border-b border-neutral-200/70 p-4 dark:border-white/10 sm:p-5 lg:border-r lg:border-b-0">
                <div className="mb-2.5 flex items-center justify-between">
                  <label
                    htmlFor="playground-music-input"
                    className="text-xs font-semibold text-neutral-600 dark:text-neutral-300"
                  >
                    Music Prompt & Style
                  </label>
                  {userInput && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setUserInput("");
                          setMusicAudioUrl(null);
                          setMusicRun(null);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                      >
                        <Trash2 className="h-3 w-3" />
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col rounded-xl border border-neutral-200 bg-white p-3.5 transition focus-within:border-neutral-400 dark:border-white/10 dark:bg-neutral-950 dark:focus-within:border-white/30">
                  <LiveMarkdownEditor
                    id="playground-music-input"
                    data-testid="playground-music-input"
                    value={userInput}
                    onChange={setUserInput}
                    onSubmit={handleRunMusicGeneration}
                    placeholder="Describe your track"
                    className="w-full flex-1 text-base leading-7 text-neutral-950 dark:text-white"
                  />
                </div>
              </div>

              {/* Right Pane: Audio Player & Result */}
              <div className="flex flex-col bg-neutral-50/40 p-4 dark:bg-white/[0.01] sm:p-5">
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                    Music output
                  </span>
                  {musicAudioUrl && (
                    <a
                      href={musicAudioUrl}
                      download={`lingofusion-music-${Date.now()}.mp3`}
                      className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                    >
                      <Download className="h-3 w-3" />
                      Download audio
                    </a>
                  )}
                </div>

                <div
                  data-testid="playground-music-output"
                  className="flex min-h-[14rem] flex-1 flex-col justify-between"
                >
                  <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8">
                    {musicAudioUrl ? (
                      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-neutral-900">
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Music className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                              Music audio
                            </span>
                          </div>
                          {musicRun && (
                            <span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                              {musicRun.durationSeconds}s track
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                          <button
                            type="button"
                            onClick={() => {
                              if (!musicAudioRef.current) return;
                              if (musicPlaying) {
                                musicAudioRef.current.pause();
                                setMusicPlaying(false);
                              } else {
                                musicAudioRef.current.play().catch(() => {});
                                setMusicPlaying(true);
                              }
                            }}
                            data-testid="playground-music-play-toggle-btn"
                            className="pressable inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-5 text-xs font-semibold text-white shadow-xs transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                          >
                            {musicPlaying ? (
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
                            ref={musicAudioRef}
                            src={musicAudioUrl}
                            controls
                            autoPlay
                            onPlay={() => setMusicPlaying(true)}
                            onPause={() => setMusicPlaying(false)}
                            onEnded={() => setMusicPlaying(false)}
                            className="h-11 flex-1"
                            data-testid="playground-music-audio-player"
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-neutral-400 dark:text-neutral-500">
                        {musicRunning
                          ? "Generating music..."
                          : "Generated music will appear here."}
                      </span>
                    )}
                  </div>

                  {musicRun && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200/70 pt-3 dark:border-white/10">
                      <span
                        data-testid="music-response-usage-badge"
                        className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 font-sans tabular-nums text-xs font-medium text-purple-900 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-200"
                      >
                        <Activity className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                        {musicRun.durationSeconds}s audio • Cost: ${formatCostBadge(musicRun.costUsd)} ($0.50/min)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : mode === "voice" ? (
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
                    Voice output
                  </span>
                  {voiceAudioUrl && (
                    <a
                      href={voiceAudioUrl}
                      download="lingofusion-voice.mp3"
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
                              Voice audio
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
          ) : (
            /* Dubbing Studio Layout */
            <>
              {/* Left Pane: Media Upload & Source Preview */}
              <div className="flex flex-col border-b border-neutral-200/70 p-4 dark:border-white/10 sm:p-5 lg:border-r lg:border-b-0">
                <div className="mb-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="playground-dubbing-file"
                      className="text-xs font-semibold text-neutral-600 dark:text-neutral-300"
                    >
                      Source Media
                    </label>
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-mono text-[10px] text-neutral-500 dark:bg-white/10 dark:text-neutral-400">
                      15s – 180m • Max 2 GB
                    </span>
                  </div>

                  {dubbingFile && (
                    <button
                      type="button"
                      onClick={() => {
                        if (dubbingPreviewUrl) URL.revokeObjectURL(dubbingPreviewUrl);
                        setDubbingFile(null);
                        setDubbingFileName("");
                        setDubbingFileSize(0);
                        setDubbingDurationSeconds(0);
                        setDubbingPreviewUrl(null);
                        setDubbedMediaUrl(null);
                        setDubbedRun(null);
                        setDubbingValidationError(null);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                    >
                      <Trash2 className="h-3 w-3" />
                      Remove
                    </button>
                  )}
                </div>

                {/* Dropzone or Preview */}
                {dubbingPreviewUrl ? (
                  <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-3.5 shadow-2xs dark:border-white/10 dark:bg-neutral-900">
                    <div className="overflow-hidden rounded-xl bg-black">
                      {dubbingMediaType === "video" ? (
                        <video
                          src={dubbingPreviewUrl}
                          controls
                          className="max-h-72 w-full object-contain"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center py-6">
                          <Volume2 className="mb-2 h-8 w-8 text-neutral-400" />
                          <audio src={dubbingPreviewUrl} controls className="w-full max-w-sm" />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3 text-xs dark:border-white/5">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-neutral-900 dark:text-white">
                          {dubbingFileName}
                        </p>
                        <p className="text-[11px] text-neutral-500">
                          {formatFileSize(dubbingFileSize)} • {formatDuration(dubbingDurationSeconds)}
                        </p>
                      </div>

                      <label
                        htmlFor="playground-dubbing-file"
                        className="cursor-pointer text-xs font-semibold text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                      >
                        Change file
                      </label>
                    </div>
                  </div>
                ) : (
                  <label
                    htmlFor="playground-dubbing-file"
                    data-testid="playground-dubbing-dropzone"
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDubbingDragActive(true);
                    }}
                    onDragLeave={() => setDubbingDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDubbingDragActive(false);
                      void handleDubbingFileSelect(e.dataTransfer?.files?.[0]);
                    }}
                    className={`flex min-h-[16rem] flex-1 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition ${
                      dubbingDragActive
                        ? "border-neutral-950 bg-neutral-100/70 dark:border-white dark:bg-white/10"
                        : "border-neutral-300 bg-neutral-50/60 hover:bg-neutral-100/50 dark:border-white/15 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-xs dark:bg-neutral-800">
                      <UploadCloud className="h-6 w-6 text-neutral-600 dark:text-neutral-300" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-100">
                        Click to upload or drag &amp; drop
                      </p>
                      <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                        Audio or video (MP4, MOV, WebM, MP3, WAV, M4A)
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-neutral-400 dark:text-neutral-500">
                        Duration: 15s – 180 min • Capacity: Up to 2 GB
                      </p>
                    </div>
                  </label>
                )}

                <input
                  id="playground-dubbing-file"
                  data-testid="playground-dubbing-file-input"
                  type="file"
                  accept="audio/*,video/*,.mp4,.mov,.avi,.mkv,.webm,.m4v,.mp3,.wav,.m4a,.aac,.flac,.ogg"
                  className="hidden"
                  onChange={(e) => {
                    void handleDubbingFileSelect(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />

                {/* Validation Error Alert */}
                {dubbingValidationError && (
                  <div
                    role="alert"
                    className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200"
                  >
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400" />
                    <span className="flex-1">{dubbingValidationError}</span>
                  </div>
                )}
              </div>

              {/* Right Pane: Dubbed Output & Download */}
              <div className="flex flex-col bg-neutral-50/40 p-4 dark:bg-white/[0.01] sm:p-5">
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                    Dubbed Output
                  </span>
                  {dubbedMediaUrl && (
                    <a
                      href={dubbedMediaUrl}
                      download={dubbedRun?.fileName || `dubbed-${dubbingTargetLang.toLowerCase()}-${dubbingFileName || "media"}`}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-700 hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-white"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </a>
                  )}
                </div>

                <div
                  data-testid="playground-dubbing-output"
                  className="flex min-h-[16rem] flex-1 flex-col justify-between"
                >
                  <div className="flex flex-1 flex-col items-center justify-center gap-4 py-6">
                    {dubbedMediaUrl ? (
                      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-neutral-900">
                        <div className="mb-3.5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clapperboard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                              Dubbed {dubbingMediaType === "video" ? "Video" : "Audio"} • {dubbingTargetLang}
                            </span>
                          </div>
                          {dubbedRun && (
                            <span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                              {formatDuration(dubbedRun.durationSeconds)}
                            </span>
                          )}
                        </div>

                        {dubbingMediaType === "video" ? (
                          <div className="mb-4 overflow-hidden rounded-xl bg-black">
                            <video
                              src={dubbedMediaUrl}
                              controls
                              className="max-h-72 w-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="mb-4">
                            <audio src={dubbedMediaUrl} controls className="w-full" />
                          </div>
                        )}

                        <a
                          href={dubbedMediaUrl}
                          download={dubbedRun?.fileName || `dubbed-${dubbingTargetLang.toLowerCase()}-${dubbingFileName || "media"}`}
                          data-testid="playground-dubbing-download-btn"
                          className="pressable inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-5 text-xs font-semibold text-white shadow-xs transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                        >
                          <Download className="h-4 w-4" />
                          Download Dubbed {dubbingMediaType === "video" ? "Video" : "Audio"}
                        </a>
                      </div>
                    ) : dubbingRunning ? (
                      <div className="flex flex-col items-center gap-3 text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-neutral-950 dark:text-white" />
                        <div>
                          <p className="text-xs font-semibold text-neutral-900 dark:text-white">
                            Dubbing media to {dubbingTargetLang}…
                          </p>
                          <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                            Translating dialog, isolating acoustics, and synthesizing studio speech.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Clapperboard className="mx-auto mb-2 h-7 w-7 text-neutral-300 dark:text-neutral-600" />
                        <span className="text-xs text-neutral-400 dark:text-neutral-500">
                          Dubbed project will appear here
                        </span>
                      </div>
                    )}
                  </div>

                  {dubbedRun && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200/70 pt-3 dark:border-white/10">
                      <span
                        data-testid="dubbing-response-usage-badge"
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-sans tabular-nums text-xs font-medium text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                      >
                        <Activity className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        {formatDuration(dubbedRun.durationSeconds)} • Dubbed to {dubbedRun.targetLang} • Cost: ${formatCostBadge(dubbedRun.costUsd)}
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
