import { Apple, Loader2, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AuthConfig, AuthUser } from "../data/auth";
import { loadAuthConfig, signInWithApple, signInWithGoogleCredential } from "../data/auth";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            ux_mode?: string;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
};

function waitForGoogleSdk(timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (window.google?.accounts?.id) return resolve(true);
      if (Date.now() - started > timeoutMs) return resolve(false);
      window.setTimeout(tick, 100);
    };
    tick();
  });
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const onSuccessRef = useRef(onSuccess);
  const onCloseRef = useRef(onClose);
  onSuccessRef.current = onSuccess;
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setBusy(false);
    let cancelled = false;
    void loadAuthConfig().then((cfg) => {
      if (!cancelled) setConfig(cfg);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Render Google's official "Sign in with Google" button.
  useEffect(() => {
    if (!isOpen || !config?.googleClientId) return;
    let cancelled = false;
    void waitForGoogleSdk().then((ready) => {
      if (cancelled || !googleButtonRef.current) return;
      if (!ready || !window.google?.accounts?.id) {
        setError("Could not load Google sign-in. Check your connection or ad blocker and try again.");
        return;
      }
      window.google.accounts.id.initialize({
        client_id: config.googleClientId,
        callback: async (response) => {
          if (!response.credential) return;
          setBusy(true);
          setError(null);
          try {
            const user = await signInWithGoogleCredential(response.credential);
            onSuccessRef.current(user);
            onCloseRef.current();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Google sign-in failed.");
          } finally {
            setBusy(false);
          }
        },
      });
      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        logo_alignment: "center",
        width: 336,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, config?.googleClientId]);

  if (!isOpen) return null;

  const handleApple = async () => {
    if (!config?.appleClientId) return;
    setBusy(true);
    setError(null);
    try {
      const user = await signInWithApple(config.appleClientId);
      onSuccess(user);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      // Apple's popup rejects with { error: "popup_closed_by_user" } when dismissed.
      const dismissed = typeof err === "object" && err !== null && "error" in err;
      if (!dismissed) setError(message || "Apple sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  const googleReady = Boolean(config?.googleClientId);
  const appleReady = Boolean(config?.appleClientId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to LingoFusion"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      <div onClick={onClose} className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm" />

      <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-2xl border border-neutral-200/90 bg-white shadow-2xl dark:border-white/10 dark:bg-[#141414]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-white/10 dark:hover:text-neutral-200"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-6 pb-7 pt-8">
          <div className="flex flex-col items-center text-center">
            <img
              src={`${import.meta.env.BASE_URL}assets/lingofusion-logo-square.png`}
              alt="LingoFusion"
              width="48"
              height="48"
              className="h-12 w-12 object-contain drop-shadow-md"
            />
            <h2 className="mt-4 text-xl font-bold tracking-tight text-neutral-950 dark:text-white">
              Sign in to LingoFusion
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
              Your balance, API keys, and spend history are tied to your account.
            </p>
          </div>

          {error && (
            <div className="mt-5 rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="relative mt-6 space-y-3">
            {!config && (
              <div className="flex h-11 items-center justify-center text-xs text-neutral-400">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading sign-in options…
              </div>
            )}

            {config && (
              <>
                {googleReady ? (
                  <div className="flex justify-center">
                    <div ref={googleButtonRef} className="min-h-[44px]" />
                  </div>
                ) : (
                  <p className="rounded-xl border border-amber-300/70 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
                    Google sign-in isn’t set up yet.
                  </p>
                )}

                {appleReady && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleApple}
                    className="flex h-11 w-full items-center justify-center gap-2.5 rounded-[4px] bg-black px-4 text-sm font-medium text-white transition hover:bg-neutral-800 active:scale-[0.99] disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                  >
                    <Apple className="h-4 w-4 fill-current" />
                    <span>Continue with Apple</span>
                  </button>
                )}
              </>
            )}

            {busy && (
              <div className="absolute inset-0 grid place-items-center rounded-xl bg-white/70 backdrop-blur-[1px] dark:bg-[#141414]/70">
                <Loader2 className="h-5 w-5 animate-spin text-neutral-600 dark:text-neutral-300" />
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] text-neutral-400 dark:text-neutral-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>We never see your password.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
