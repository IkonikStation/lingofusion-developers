import { ArrowLeft, Check, Gift, Mail, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { renderGiftEmail } from "../../shared/giftEmail.mjs";
import { formatUsd } from "../lib/utils";

export function GiftClaimCard({ amount, sender, recipient, message, claimed, signedInEmail, busy, error, onClaim, onSignIn, preview = false }: {
  amount?: number; sender?: string; recipient: string; message?: string; claimed: boolean;
  signedInEmail?: string; busy?: boolean; error?: string | null; onClaim: () => void; onSignIn: () => void; preview?: boolean;
}) {
  const matches = signedInEmail?.toLowerCase() === recipient.toLowerCase();
  return <div className="gift-claim-card">
    <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-purple-100 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300">{claimed ? <Check className="h-6 w-6" /> : <Gift className="h-6 w-6" />}</div>
    <p className="funding-eyebrow">{claimed ? (preview ? "Preview complete" : "Gift claimed") : "A gift for you"}</p>
    <h2 id="gift-claim-heading" className="mt-3 text-2xl font-semibold tracking-tight">{claimed ? "Your next idea is ready to go." : "Someone's thinking of your next idea."}</h2>
    <p className="mt-3 text-sm leading-6 text-neutral-500 dark:text-neutral-400">{claimed ? (preview ? "This is how a successful claim will look. Your real balance has not changed." : "Your gift credits have been added to your LingoFusion wallet.") : `${sender || "A friend"} sent you LingoFusion credits.`}</p>
    <div className="funding-credit-card funding-gift-card my-6 text-left">
      <p className="funding-card-brand">LingoFusion gift</p>
      <p className="my-5 text-4xl font-semibold tabular-nums">{amount !== undefined ? `$${formatUsd(amount)}` : "Gift credits"}{amount !== undefined && <span className="ml-2 text-xs font-normal opacity-60">USD</span>}</p>
      <p className="break-all text-xs opacity-75">For {recipient}</p>
      {message && <p className="mt-4 whitespace-pre-wrap break-words border-t border-white/15 pt-4 text-sm leading-6">{message}</p>}
    </div>
    {error && <p role="alert" className="mb-4 text-sm text-red-600 dark:text-red-300">{error}</p>}
    {!claimed && <>
      <p className="mb-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{matches ? `Signed in as ${signedInEmail}` : `Sign in with ${recipient} to add the gift to your wallet.`}</p>
      <button type="button" disabled={busy} onClick={matches ? onClaim : onSignIn} className="funding-checkout !bg-purple-600 !text-white">{busy ? "Claiming…" : matches ? (preview ? "Preview claiming this gift" : "Claim gift credits") : "Sign in to claim your gift"}</button>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-neutral-400"><ShieldCheck className="h-3.5 w-3.5" /> No expiry. Claim whenever you're ready.</p>
    </>}
  </div>;
}

export function GiftReceiverPreview({ amount, senderEmail, senderName, recipientEmail, message, onBack, onClose }: {
  amount: number; senderEmail?: string; senderName?: string; recipientEmail?: string; message?: string; onBack: () => void; onClose: () => void;
}) {
  const [screen, setScreen] = useState<"email" | "claim">("email");
  const [claimed, setClaimed] = useState(false);
  const sender = senderEmail || "alex@gmail.com";
  const recipient = recipientEmail || "jordan@example.com";
  const note = message || "For your next great idea. Enjoy creating!";
  const email = renderGiftEmail({ senderEmail: sender, senderName: senderName || sender, recipientEmail: recipient, amountUsd: amount, giftMessage: note, claimUrl: "#preview", preview: true });
  return <div className="gift-receiver-preview">
    <div className="flex items-center justify-between gap-3 border-b border-neutral-200 p-5 dark:border-white/10">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-xs text-neutral-500"><ArrowLeft className="h-4 w-4" /> Back to gift</button>
      <button type="button" aria-label="Close recipient preview" onClick={onClose} className="funding-close"><X className="h-4 w-4" /></button>
    </div>
    <div className="px-5 pt-6 text-center">
      <p className="funding-eyebrow !text-purple-600">Recipient experience · Preview only</p>
      <h2 id="wallet-funding-title" className="mt-2 text-2xl font-semibold tracking-tight">Here's what they'll receive.</h2>
      <p className="mt-2 text-xs leading-5 text-neutral-500">No purchase, email, gift, or balance change is created by this preview.</p>
      <div className="my-5 inline-flex gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-white/5" role="group" aria-label="Recipient preview screen">
        <button type="button" aria-pressed={screen === "email"} onClick={() => setScreen("email")} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs ${screen === "email" ? "bg-white font-semibold shadow-sm dark:bg-neutral-700" : "text-neutral-500"}`}><Mail className="h-3.5 w-3.5" /> Inbox email</button>
        <button type="button" aria-pressed={screen === "claim"} onClick={() => setScreen("claim")} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs ${screen === "claim" ? "bg-white font-semibold shadow-sm dark:bg-neutral-700" : "text-neutral-500"}`}><Gift className="h-3.5 w-3.5" /> Claim page</button>
      </div>
    </div>
    {screen === "email" ? <>
      <dl className="gift-email-headers"><div><dt>From</dt><dd>{sender}</dd></div><div><dt>To</dt><dd>{recipient}</dd></div><div><dt>Subject</dt><dd>{email.subject}</dd></div></dl>
      <iframe title="Gift email exactly as the recipient sees it" sandbox="" srcDoc={email.html} className="gift-email-frame" />
      <div className="p-5 text-center"><button type="button" onClick={() => setScreen("claim")} className="funding-checkout mx-auto max-w-xs !bg-purple-600 !text-white">Preview the claim page</button></div>
    </> : <GiftClaimCard amount={amount} sender={sender} recipient={recipient} message={note} claimed={claimed} signedInEmail={recipient} onClaim={() => setClaimed(true)} onSignIn={() => {}} preview />}
  </div>;
}
