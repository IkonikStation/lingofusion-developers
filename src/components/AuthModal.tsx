import { Apple, ArrowRight, Check, Mail, ShieldCheck, Sparkles, X } from "lucide-react";
import { useState } from "react";
import type { AuthUser } from "../data/auth";
import {
  getCurrentUser,
  getKnownUsers,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
} from "../data/auth";

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
};

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [emailInput, setEmailInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const currentUser = getCurrentUser();
  const knownUsers = getKnownUsers().filter((u) => u.provider !== "guest");

  if (!isOpen) return null;

  const handleGoogleSignIn = async (customEmail?: string, customName?: string) => {
    setBusy(true);
    try {
      // Simulate quick secure OAuth handshake
      await new Promise((resolve) => setTimeout(resolve, 350));
      const user = signInWithGoogle(customEmail, customName);
      onSuccess(user);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleAppleSignIn = async (customEmail?: string, customName?: string) => {
    setBusy(true);
    try {
      // Simulate quick secure Apple ID handshake
      await new Promise((resolve) => setTimeout(resolve, 350));
      const user = signInWithApple(customEmail, customName);
      onSuccess(user);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !emailInput.includes("@")) return;
    setBusy(true);
    setTimeout(() => {
      const user = signInWithEmail(emailInput, nameInput);
      setBusy(false);
      onSuccess(user);
      onClose();
    }, 300);
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
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-4 top-4 z-10 grid h-8 w-8 place-items-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-white/10 dark:hover:text-neutral-200"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6 sm:p-8">
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
              Access your personal prepaid balance, custom API keys, and spend tracking analytics.
            </p>
          </div>

          {/* Quick Switch if previously used accounts exist */}
          {knownUsers.length > 0 && (
            <div className="mt-6 border-b border-neutral-200/80 pb-5 dark:border-white/10">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                Continue as
              </p>
              <div className="mt-2.5 space-y-2">
                {knownUsers.slice(0, 2).map((u) => {
                  const isActive = currentUser.id === u.id;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (u.provider === "apple") {
                          handleAppleSignIn(u.email, u.name);
                        } else {
                          handleGoogleSignIn(u.email, u.name);
                        }
                      }}
                      className={`flex w-full items-center justify-between rounded-xl border p-2.5 text-left transition ${
                        isActive
                          ? "border-emerald-500/40 bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                          : "border-neutral-200 bg-neutral-50/60 hover:bg-neutral-100 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-neutral-900 text-xs font-semibold text-white dark:bg-white dark:text-neutral-900">
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
                        {isActive && <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Social Auth Buttons */}
          <div className="mt-6 space-y-3">
            {/* Google Button */}
            <button
              type="button"
              disabled={busy}
              onClick={() => handleGoogleSignIn()}
              className="group relative flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-neutral-300/90 bg-white px-4 text-xs font-semibold text-neutral-800 shadow-2xs transition hover:bg-neutral-50 hover:border-neutral-400 active:scale-[0.99] disabled:opacity-50 dark:border-neutral-700 dark:bg-[#1a1a1a] dark:text-neutral-100 dark:hover:bg-[#222]"
            >
              {/* Google 4-Color SVG Icon */}
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
              disabled={busy}
              onClick={() => handleAppleSignIn()}
              className="group relative flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-neutral-900 bg-neutral-950 px-4 text-xs font-semibold text-white shadow-2xs transition hover:bg-neutral-800 active:scale-[0.99] disabled:opacity-50 dark:border-white/20 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100"
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

          {/* Email Option Toggle / Form */}
          {!showEmailForm ? (
            <button
              type="button"
              onClick={() => setShowEmailForm(true)}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-neutral-200/90 bg-neutral-50/70 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-300 dark:hover:bg-white/[0.08]"
            >
              <Mail className="h-3.5 w-3.5 text-neutral-400" />
              <span>Use work or personal email</span>
            </button>
          ) : (
            <form onSubmit={handleEmailSubmit} className="space-y-3">
              <div>
                <input
                  type="text"
                  placeholder="Your Name (optional)"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="h-10 w-full rounded-xl border border-neutral-200 bg-neutral-50/60 px-3.5 text-xs text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:focus:border-white"
                />
              </div>
              <div>
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="h-10 w-full rounded-xl border border-neutral-200 bg-neutral-50/60 px-3.5 text-xs text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:focus:border-white"
                />
              </div>
              <button
                type="submit"
                disabled={busy || !emailInput.trim()}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
              >
                <span>Continue</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </form>
          )}

          {/* Privacy & Security Footnote */}
          <div className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] text-neutral-400 dark:text-neutral-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Encrypted per-account ledger · Instant session activation</span>
          </div>
        </div>
      </div>
    </div>
  );
}
