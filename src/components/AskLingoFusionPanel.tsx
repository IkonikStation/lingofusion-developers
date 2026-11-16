import { useEffect, useRef, useState } from "react";
import { getCurrentUser } from "../data/auth";
import { DEFAULT_EDGE_GATEWAY_URL } from "../data/browserApi";

type Message = { role: "user" | "assistant"; content: string };
const model = "Ask LingoFusion";

export function AskLingoFusionPanel({ onBalance, onSignIn }: {
  onBalance: (balance: number) => void;
  onSignIn?: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [quote, setQuote] = useState<{ body: string; maximum: number }>();
  const [quoteError, setQuoteError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const retry = useRef<{ body: string; id: string } | undefined>(undefined);
  const token = getCurrentUser().sessionToken;
  const draft = input.trim();
  const nextMessages: Message[] = [...messages, { role: "user", content: draft }];
  const body = draft ? JSON.stringify({ model, messages: nextMessages, max_completion_tokens: 4096 }) : "";
  const maximum = quote?.body === body ? quote.maximum : undefined;

  useEffect(() => {
    setQuoteError("");
    if (!body || !token) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`${DEFAULT_EDGE_GATEWAY_URL}/api/pricing/text`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body,
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok || !Number.isFinite(data.maximum_cost_usd)) {
          throw new Error(data.message || "Price estimate unavailable.");
        }
        if (!controller.signal.aborted) setQuote({ body, maximum: data.maximum_cost_usd });
      } catch (cause) {
        if (!controller.signal.aborted) setQuoteError(cause instanceof Error ? cause.message : "Price estimate unavailable.");
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [body, token]);

  async function send() {
    if (!token) { onSignIn?.(); return; }
    if (!body || maximum === undefined || busy) return;
    const operation = retry.current?.body === body ? retry.current : { body, id: crypto.randomUUID() };
    retry.current = operation;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${DEFAULT_EDGE_GATEWAY_URL}/api/playground/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": operation.id,
          "X-LingoFusion-Billing-Version": "full-input-tokens-v2",
          "X-LingoFusion-Client-Token": "lf_play_secure_649f7",
        },
        body: JSON.stringify({ ...JSON.parse(body), max_cost_usd: maximum }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error?.message || data.error || "Ask LingoFusion is unavailable.");
      const answer = data.choices?.[0]?.message?.content;
      if (typeof answer !== "string") throw new Error("The response did not contain an answer.");
      setMessages([...nextMessages, { role: "assistant", content: answer }]);
      setInput("");
      retry.current = undefined;
      if (Number.isFinite(data.balance_usd)) onBalance(data.balance_usd);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to send your message.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-white/10 dark:bg-neutral-900" aria-label={model}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 p-5 dark:border-white/10">
        <div>
          <h2 className="font-semibold">{model}</h2>
          <p className="mt-1 text-xs text-neutral-500">$5.00 input / $20.00 output per million tokens</p>
        </div>
        {messages.length > 0 && <button type="button" disabled={busy} className="text-sm text-neutral-500 hover:underline" onClick={() => { setMessages([]); setError(""); }}>New chat</button>}
      </div>
      {messages.length > 0 && (
        <div role="log" aria-label="Conversation" className="max-h-[32rem] space-y-4 overflow-auto p-5">
          {messages.map((message, index) => (
            <div key={index} className="rounded-lg bg-neutral-50 p-3 dark:bg-white/5">
              <p className="mb-1 text-xs font-semibold text-neutral-500">{message.role === "user" ? "You" : model}</p>
              <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>
            </div>
          ))}
        </div>
      )}
      <form className="space-y-3 p-5" onSubmit={event => { event.preventDefault(); void send(); }}>
        <label className="block text-sm font-medium" htmlFor="ask-lingofusion-message">Your message</label>
        <textarea id="ask-lingofusion-message" rows={4} disabled={busy} value={input} onChange={event => setInput(event.target.value)} placeholder="Ask a question…" className="w-full rounded-xl border border-neutral-200 bg-transparent p-3 text-sm dark:border-white/15" />
        {(error || quoteError) && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error || quoteError}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span aria-live="polite" className="text-xs text-neutral-500">{maximum !== undefined ? `Maximum cost: $${maximum.toFixed(6)}` : draft && token && !quoteError ? "Estimating cost…" : ""}</span>
          <button type="submit" disabled={busy || (!!token && maximum === undefined)} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
            {busy ? "Waiting for answer…" : token ? "Send" : "Sign in"}
          </button>
        </div>
      </form>
    </section>
  );
}
