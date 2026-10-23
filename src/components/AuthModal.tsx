import { Apple, ArrowLeft, ArrowRight, Check, ChevronRight, Mail, ShieldCheck, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AuthUser } from "../data/auth";
import {
  getCurrentUser,
  getKnownUsers,
  signInWithAppleAccount,
  signInWithEmail,
  signInWithGoogleAccount,
  signInWithGoogleCredential,
} from "../data/auth";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
          prompt: () => void;
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

type ViewMode = "select" | "google" | "apple" | "email";

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [view, setView] = useState<ViewMode>("select");
  const [emailInput, setEmailInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const googleButtonContainerRef = useRef<HTMLDivElement>(null);

  const currentUser = getCurrentUser();
  const knownUsers = getKnownUsers();

  useEffect(() => {
    if (isOpen) {
      setView("select");
      setEmailInput("");
      setNameInput("");
      setError(null);
      setBusy(false);
    }
  }, [isOpen]);

  // Try to initialize real Google Identity Services if a Client ID is configured
  useEffect(() => {
    if (!isOpen) return;

    const googleClientId =
      (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) ||
      window.localStorage.getItem("lingofusion_google_client_id") ||
      "";

    if (googleClientId && window.google?.accounts?.id && googleButtonContainerRef.current) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (response: { credential?: string }) => {
            if (response?.credential) {
              try {
                const user = signInWithGoogleCredential(response.credential);
                onSuccess(user);
                onClose();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to sign in with Google credential");
              }
            }
          },
        });

        window.google.accounts.id.renderButton(googleButtonContainerRef.current, {
          theme: "outline",
          size: "large",
          width: "100%",
          text: "continue_with",
          shape: "rectangular",
        });
      } catch {
        // Fallback to interactive Google sign-in
      }
    }
  }, [isOpen, view]);

  if (!isOpen) return null;

  const handleSelectKnownUser = (u: AuthUser) => {
    try {
      if (u.provider === "apple") {
        const user = signInWithAppleAccount(u.email, u.name);
        onSuccess(user);
      } else if (u.provider === "google") {
        const user = signInWithGoogleAccount(u.email, u.name, u.avatar);
        onSuccess(user);
      } else {
        const user = signInWithEmail(u.email, u.name);
        onSuccess(user);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
    }
  };

  const handleGoogleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const email = emailInput.trim();
    if (!email || !email.includes("@")) {
      setError("Please enter a valid Google email address.");
      return;
    }
    setBusy(true);
    try {
      const user = signInWithGoogleAccount(email, nameInput);
      onSuccess(user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in with Google");
    } finally {
      setBusy(false);
    }
  };

  const handleAppleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const email = emailInput.trim();
    if (!email || !email.includes("@")) {
      setError("Please enter a valid Apple ID email.");
      return;
    }
    setBusy(true);
    try {
      const user = signInWithAppleAccount(email, nameInput);
      onSuccess(user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in with Apple ID");
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const email = emailInput.trim();
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const user = signInWithEmail(email, nameInput);
      onSuccess(user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to LingoFusion"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Blurred Dim Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm transition-opacity"
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-2xl transition-all dark:border-white/10 dark:bg-[#141414]">
        {/* Top bar controls */}
        <div className="flex items-center justify-between p-4 pb-0">
          {view !== "select" ? (
            <button
              type="button"
              onClick={() => {
                setView("select");
                setError(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="grid h-8 w-8 place-items-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-white/10 dark:hover:text-neutral-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 pb-6 pt-2 sm:px-8 sm:pb-8">
          {/* VIEW: SELECT PROVIDER */}
          {view === "select" && (
            <div>
              {/* Header Brand */}
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
                  Use your actual Google or Apple account to access your personal prepaid balance, custom API keys, and spend tracking.
                </p>
              </div>

              {/* Previously used accounts on this browser */}
              {knownUsers.length > 0 && (
                <div className="mt-6 border-b border-neutral-200/80 pb-5 dark:border-white/10">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                    Your Saved Accounts
                  </p>
                  <div className="mt-2.5 space-y-2">
                    {knownUsers.slice(0, 3).map((u) => {
                      const isActive = currentUser.id === u.id;
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleSelectKnownUser(u)}
                          className={`flex w-full items-center justify-between rounded-xl border p-2.5 text-left transition ${
                            isActive
                              ? "border-emerald-500/40 bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                              : "border-neutral-200 bg-neutral-50/60 hover:bg-neutral-100 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-neutral-900 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 truncate">
                              <p className="truncate text-xs font-semibold text-neutral-900 dark:text-white">
                                {u.name}
                              </p>
                              <p className="truncate text-[11px] text-neutral-500">
                                {u.email}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 pl-2">
                            <span className="rounded-full bg-neutral-200/80 px-2 py-0.5 text-[10px] font-medium capitalize text-neutral-700 dark:bg-white/10 dark:text-neutral-300">
                              {u.provider}
                            </span>
                            {isActive ? (
                              <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Main Provider Buttons */}
              <div className="mt-6 space-y-3">
                {/* Real Google Button Container (if GIS active) */}
                <div ref={googleButtonContainerRef} className="empty:hidden" />

                {/* Google Button */}
                <button
                  type="button"
                  onClick={() => {
                    setView("google");
                    setEmailInput("");
                    setNameInput("");
                  }}
                  className="group relative flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-neutral-300/90 bg-white px-4 text-xs font-semibold text-neutral-800 shadow-2xs transition hover:bg-neutral-50 hover:border-neutral-400 active:scale-[0.99] dark:border-neutral-700 dark:bg-[#1a1a1a] dark:text-neutral-100 dark:hover:bg-[#222]"
                >
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>

                {/* Apple Button */}
                <button
                  type="button"
                  onClick={() => {
                    setView("apple");
                    setEmailInput("");
                    setNameInput("");
                  }}
                  className="group relative flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-neutral-900 bg-neutral-950 px-4 text-xs font-semibold text-white shadow-2xs transition hover:bg-neutral-800 active:scale-[0.99] dark:border-white/20 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100"
                >
                  <Apple className="h-4 w-4 shrink-0 fill-current" />
                  <span>Continue with Apple</span>
                </button>
              </div>

              {/* Divider */}
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-200 dark:border-white/10" />
                </div>
                <div className="relative flex justify-center text-[11px] font-medium text-neutral-400">
                  <span className="bg-white px-3 dark:bg-[#141414]">or continue with email</span>
                </div>
              </div>

              {/* Email Option */}
              <button
                type="button"
                onClick={() => {
                  setView("email");
                  setEmailInput("");
                  setNameInput("");
                }}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-neutral-200/90 bg-neutral-50/70 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-300 dark:hover:bg-white/[0.08]"
              >
                <Mail className="h-3.5 w-3.5 text-neutral-400" />
                <span>Use work or personal email</span>
              </button>
            </div>
          )}

          {/* VIEW: GOOGLE ACCOUNT PROMPT */}
          {view === "google" && (
            <div>
              <div className="flex flex-col items-center text-center">
                <div className="grid h-12 w-12 place-items-center rounded-2xl border border-neutral-200 bg-neutral-50 shadow-2xs dark:border-white/10 dark:bg-white/5">
                  <svg className="h-6 w-6" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                </div>
                <h3 className="mt-3.5 text-lg font-bold tracking-tight text-neutral-950 dark:text-white">
                  Sign in with Google
                </h3>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  Enter your Google Account email to link your personal API keys and prepaid balance.
                </p>
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                  {error}
                </div>
              )}

              <form onSubmit={handleGoogleSubmit} className="mt-5 space-y-3.5">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Google Email Address
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    placeholder="you@gmail.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="h-10 w-full rounded-xl border border-neutral-300 bg-white px-3.5 text-xs text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 dark:border-white/10 dark:bg-neutral-900 dark:text-white dark:focus:border-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Your Name (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. John Doe"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="h-10 w-full rounded-xl border border-neutral-300 bg-white px-3.5 text-xs text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 dark:border-white/10 dark:bg-neutral-900 dark:text-white dark:focus:border-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy || !emailInput.trim()}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 text-xs font-semibold text-white shadow-sm transition hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                >
                  <span>Sign In with Google Account</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          )}

          {/* VIEW: APPLE ID PROMPT */}
          {view === "apple" && (
            <div>
              <div className="flex flex-col items-center text-center">
                <div className="grid h-12 w-12 place-items-center rounded-2xl border border-neutral-200 bg-neutral-950 text-white shadow-2xs dark:border-white/10 dark:bg-white dark:text-neutral-950">
                  <Apple className="h-6 w-6 fill-current" />
                </div>
                <h3 className="mt-3.5 text-lg font-bold tracking-tight text-neutral-950 dark:text-white">
                  Sign in with Apple ID
                </h3>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  Enter your Apple ID or iCloud email to link your personal API keys and prepaid balance.
                </p>
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                  {error}
                </div>
              )}

              <form onSubmit={handleAppleSubmit} className="mt-5 space-y-3.5">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Apple ID Email
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    placeholder="you@icloud.com or your Apple ID"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="h-10 w-full rounded-xl border border-neutral-300 bg-white px-3.5 text-xs text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 dark:border-white/10 dark:bg-neutral-900 dark:text-white dark:focus:border-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Your Name (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Jane Apple"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="h-10 w-full rounded-xl border border-neutral-300 bg-white px-3.5 text-xs text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 dark:border-white/10 dark:bg-neutral-900 dark:text-white dark:focus:border-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy || !emailInput.trim()}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 text-xs font-semibold text-white shadow-sm transition hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                >
                  <span>Sign In with Apple ID</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          )}

          {/* VIEW: WORK OR PERSONAL EMAIL */}
          {view === "email" && (
            <div>
              <div className="flex flex-col items-center text-center">
                <div className="grid h-12 w-12 place-items-center rounded-2xl border border-neutral-200 bg-neutral-50 shadow-2xs dark:border-white/10 dark:bg-white/5">
                  <Mail className="h-6 w-6 text-neutral-700 dark:text-neutral-200" />
                </div>
                <h3 className="mt-3.5 text-lg font-bold tracking-tight text-neutral-950 dark:text-white">
                  Continue with Email
                </h3>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  Enter your email address to access or create your LingoFusion account.
                </p>
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                  {error}
                </div>
              )}

              <form onSubmit={handleEmailSubmit} className="mt-5 space-y-3.5">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    placeholder="name@company.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="h-10 w-full rounded-xl border border-neutral-300 bg-white px-3.5 text-xs text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 dark:border-white/10 dark:bg-neutral-900 dark:text-white dark:focus:border-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Your Name (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Your Full Name"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="h-10 w-full rounded-xl border border-neutral-300 bg-white px-3.5 text-xs text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 dark:border-white/10 dark:bg-neutral-900 dark:text-white dark:focus:border-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy || !emailInput.trim()}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 text-xs font-semibold text-white shadow-sm transition hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                >
                  <span>Continue with Email</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          )}

          {/* Footnote */}
          <div className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] text-neutral-400 dark:text-neutral-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Isolated per-user balance and ledger · End-to-end encrypted</span>
          </div>
        </div>
      </div>
    </div>
  );
}
