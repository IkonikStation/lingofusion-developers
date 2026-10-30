import { Check, ChevronDown, CreditCard, Gift, HelpCircle, Loader2, ShieldCheck, Wallet, X, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { formatUsd } from "../lib/utils";

type WalletFundingPanelProps = {
  tab: "self" | "gift";
  onTabChange: (tab: "self" | "gift") => void;
  amount: number;
  onAmountChange: (amount: number) => void;
  balance: number;
  credit: number;
  fee: number;
  total: number;
  recipient: string;
  onRecipientChange: (value: string) => void;
  sender: string;
  onSenderChange: (value: string) => void;
  message: string;
  onMessageChange: (value: string) => void;
  busy: boolean;
  status: string | null;
  autoTopUpEnabled: boolean;
  onClose: () => void;
  onFeeDetails: () => void;
  onCheckout: () => void;
  senderEmail?: string;
  gmailReady: boolean;
  gmailConnected: boolean;
  gmailBusy: boolean;
  onConnectGmail: () => void;
  onPreview: () => void;
  children: ReactNode;
};

export function WalletFundingPanel(props: WalletFundingPanelProps) {
  const gift = props.tab === "gift";
  const invalidAmount = !Number.isFinite(props.amount) || props.amount < 1 || props.amount > 50000;

  return (
    <>
      <header className="funding-header">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="funding-eyebrow">LingoFusion wallet</p>
            <h2 id="wallet-funding-title" className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">
              {gift ? "A little credit. A lot of possibility." : "Make room for your next idea."}
            </h2>
            <p className="mt-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
              {gift ? "Give someone a head start on their next project." : "Add credits for translation, voice, images, and more."}
            </p>
          </div>
          <button type="button" aria-label="Close funding dialog" disabled={props.busy} onClick={props.onClose} className="funding-close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="funding-tabs" role="group" aria-label="Credit destination">
          {([
            { id: "self", title: "Add funds", description: "For your own projects", icon: Wallet },
            { id: "gift", title: "Send a gift", description: "For someone else's ideas", icon: Gift },
          ] as const).map(({ id, title, description, icon: Icon }) => (
            <button key={id} type="button" aria-pressed={props.tab === id} onClick={() => props.onTabChange(id)} data-testid={`funding-tab-${id}`}>
              <Icon className="h-5 w-5 shrink-0" />
              <span className="min-w-0 flex-1 text-left"><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block text-xs font-normal opacity-65">{description}</span></span>
              <span className="funding-radio" aria-hidden="true">{props.tab === id && <Check className="h-3 w-3" />}</span>
            </button>
          ))}
        </div>
      </header>

      <div className="funding-grid">
        <div className="funding-form">
          {gift && <div className="funding-sender">
            <p className="funding-label">From your Google account</p>
            <p className="mt-2 break-all text-sm font-semibold">{props.senderEmail || "Sign in with Google"}</p>
            <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{props.gmailConnected ? "Gifts will be emailed from this Gmail account after payment." : "Connect Gmail to allow LingoFusion to send your gift from this email address."}</p>
            {!props.gmailConnected && <button type="button" onClick={props.onConnectGmail} disabled={props.gmailBusy || (!!props.senderEmail && !props.gmailReady)} className="mt-3 min-h-10 rounded-lg border border-neutral-300 px-3 text-xs font-semibold disabled:opacity-50 dark:border-white/15">{props.gmailBusy ? "Connecting…" : props.senderEmail ? "Connect Gmail" : "Sign in with Google"}</button>}
            {props.senderEmail && !props.gmailReady && <p className="mt-2 text-xs text-neutral-500">Gmail sending is being set up. You can preview the recipient experience below.</p>}
          </div>}
          <section aria-labelledby="funding-amount-title">
            <div className="flex items-center justify-between gap-3">
              <h3 id="funding-amount-title" className="text-sm font-semibold text-neutral-950 dark:text-white">Choose {gift ? "a gift" : "an"} amount</h3>
              <span className="funding-currency">USD</span>
            </div>
            <div className="funding-presets mt-4 grid grid-cols-3 gap-2.5" role="group" aria-label="Credit amount">
              {[5, 10, 25, 50, 100, 250].map((amount) => (
                <button key={amount} type="button" aria-pressed={props.amount === amount} onClick={() => props.onAmountChange(amount)}>
                  ${amount}
                  {props.amount === amount && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                </button>
              ))}
            </div>
            <label htmlFor="deposit-amount-input" className="mt-5 block text-xs font-medium text-neutral-600 dark:text-neutral-300">Or enter a custom amount</label>
            <div className="funding-amount-input mt-2">
              <span aria-hidden="true">$</span>
              <input id="deposit-amount-input" type="number" inputMode="decimal" min={1} max={50000} step={1} aria-label="Custom amount in USD" aria-describedby="funding-amount-hint" data-testid="deposit-amount-input" value={props.amount || ""} onChange={(event) => props.onAmountChange(Math.min(50000, Number(event.target.value)))} />
              <span>USD</span>
            </div>
            <p id="funding-amount-hint" className="mt-2 text-xs text-neutral-400">Choose any amount from $1 to $50,000 USD.</p>
          </section>

          {gift ? (
            <section className="funding-recipient" aria-labelledby="funding-recipient-title">
              <h3 id="funding-recipient-title" className="text-sm font-semibold text-neutral-950 dark:text-white">Make it personal</h3>
              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="funding-recipient" className="funding-label">Recipient email <span className="text-neutral-400">(required)</span></label>
                  <input id="funding-recipient" type="email" required placeholder="someone@example.com" value={props.recipient} onChange={(event) => props.onRecipientChange(event.target.value)} className="funding-field" aria-describedby="funding-recipient-hint" />
                  <p id="funding-recipient-hint" className="mt-2 text-xs leading-5 text-neutral-400">The gift email goes to this inbox after payment. They can sign in with this address and claim whenever they like.</p>
                </div>
                <div>
                  <label htmlFor="funding-sender" className="funding-label">Your name <span className="text-neutral-400">(optional)</span></label>
                  <input id="funding-sender" type="text" placeholder="Who is the gift from?" value={props.sender} onChange={(event) => props.onSenderChange(event.target.value)} className="funding-field" />
                </div>
                <div>
                  <label htmlFor="funding-message" className="funding-label">A personal note <span className="text-neutral-400">(optional)</span></label>
                  <textarea id="funding-message" rows={3} maxLength={500} placeholder="Here's to your next great idea…" value={props.message} onChange={(event) => props.onMessageChange(event.target.value.slice(0, 500))} className="funding-field resize-y" />
                  <p className="mt-1.5 text-right text-[11px] tabular-nums text-neutral-400">{props.message.length} / 500</p>
                </div>
              </div>
            </section>
          ) : (
            <div className="funding-balance">
              <Wallet className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="min-w-0 flex-1"><p className="text-xs text-neutral-500 dark:text-neutral-400">Your balance after adding credits</p><p className="mt-1 text-lg font-semibold tabular-nums text-neutral-950 dark:text-white">${formatUsd(props.balance + props.credit)} <span className="text-xs font-normal text-neutral-400">USD</span></p></div>
              <span className="text-xs tabular-nums text-neutral-400">${formatUsd(props.balance)} now</span>
            </div>
          )}
        </div>

        <aside className="funding-summary" aria-label={gift ? "Gift preview and order summary" : "Order summary"}>
          <div className={`funding-credit-card ${gift ? "funding-gift-card" : ""}`}>
            <div className="flex items-center justify-between gap-3"><span className="funding-card-brand">LingoFusion</span>{gift ? <Gift className="h-5 w-5" /> : <Wallet className="h-5 w-5" />}</div>
            <p className="mt-7 text-xs opacity-70">{gift ? "A gift of possibility" : "Credits for your next project"}</p>
            <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">${formatUsd(props.credit)} <span className="text-sm font-normal opacity-60">USD</span></p>
            {gift ? <div className="funding-gift-copy mt-5 border-t border-white/15 pt-4"><p className="text-xs opacity-70">To <span className="font-medium text-white">{props.recipient || "someone special"}</span></p>{(props.senderEmail || props.sender) && <p className="mt-1 text-xs opacity-70">From {props.senderEmail || props.sender}</p>}<p className={`mt-3 whitespace-pre-wrap text-sm leading-6 ${props.message ? "text-white/90" : "text-white/50"}`}>{props.message || "Your personal note will appear here."}</p></div> : <p className="mt-5 text-xs opacity-65">Available in your prepaid wallet after payment.</p>}
          </div>

          <div className="mt-6 flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-neutral-950 dark:text-white">Order summary</h3><button type="button" onClick={props.onFeeDetails} className="funding-fee-link"><HelpCircle className="h-3.5 w-3.5" /> About fees</button></div>
          <dl data-testid="gross-charge-preview" className="funding-receipt mt-4">
            <div><dt>{gift ? "Gift credits" : "Wallet credits"}</dt><dd>${formatUsd(props.credit)}</dd></div>
            <div><dt>Infrastructure & License Surcharge</dt><dd>${formatUsd(props.fee)}</dd></div>
            <div className="funding-total"><dt>Total to pay</dt><dd>${formatUsd(props.total)} <span>USD</span></dd></div>
          </dl>
          <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{gift ? "Your recipient gets the full gift amount. Processing is added to your total." : "The full credit amount goes to your wallet. Processing is added to your total."}</p>
          {props.status && <p role="status" className="mt-4 text-sm text-emerald-700 dark:text-emerald-400">{props.status}</p>}
          {gift && <button type="button" onClick={props.onPreview} className="funding-preview-button mt-5"><Gift className="h-4 w-4" /> Preview recipient experience · Free</button>}
          <button type="button" disabled={props.busy || invalidAmount || (gift && (!props.recipient || !props.gmailConnected || !props.gmailReady))} data-testid="simulate-webhook-btn" onClick={props.onCheckout} className="funding-checkout mt-6">
            {props.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            {props.busy ? "Redirecting to Stripe…" : "Continue to checkout"}
          </button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-neutral-400"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Secure checkout with Stripe</p>
        </aside>
      </div>
      {!gift && <details className="funding-auto" open={props.autoTopUpEnabled || undefined}><summary><Zap className="h-4 w-4 text-neutral-400" /><span className="flex-1">Auto top-up <span className="ml-2 text-xs font-normal text-neutral-400">{props.autoTopUpEnabled ? "Active" : "Optional"}</span></span><ChevronDown className="funding-auto-chevron h-4 w-4 text-neutral-400" /></summary>{props.children}</details>}
    </>
  );
}
