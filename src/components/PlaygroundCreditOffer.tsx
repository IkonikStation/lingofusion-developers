import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { getCurrentUser } from "../data/auth";
import { DEFAULT_EDGE_GATEWAY_URL } from "../data/browserApi";

const offerUrl = `${DEFAULT_EDGE_GATEWAY_URL}/api/account/special-offer/2026-11`;

async function requestOffer(token: string, method: "GET" | "POST", signal?: AbortSignal) {
  const response = await fetch(offerUrl, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "The offer is unavailable. Try signing in again.");
  return data as { claimed: boolean; credited_usd: number; balance_usd: number };
}

export function PlaygroundCreditOffer({ onBalance, onSignIn }: {
  onBalance: (balance: number) => void;
  onSignIn?: () => void;
}) {
  const token = getCurrentUser().sessionToken;
  const [claim, setClaim] = useState<{ token: typeof token; credited: boolean }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    void requestOffer(token, "GET", controller.signal).then(result => {
      if (!controller.signal.aborted && result.claimed) {
        setClaim(previous => previous?.token === token ? previous : { token, credited: false });
      }
    }).catch(() => {});
    return () => controller.abort();
  }, [token]);

  async function claimCredit() {
    if (!token) { onSignIn?.(); return; }
    if (busy || claim?.token === token) return;
    setBusy(true);
    setError("");
    try {
      const result = await requestOffer(token, "POST");
      if (getCurrentUser().sessionToken !== token) return;
      setClaim({ token, credited: result.credited_usd === 1 });
      onBalance(result.balance_usd);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not claim the offer.");
    } finally {
      setBusy(false);
    }
  }

  if (claim && claim.token === token && !claim.credited) return null;
  return (
    <aside aria-label="Playground credit offer" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-400/20 dark:bg-emerald-950/40 dark:text-emerald-100">
      <div className="flex items-start gap-3">
        <Gift className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold">$1.00 Playground credit</p>
          <p className="mt-0.5 text-xs" role="status">{claim?.token === token && claim?.credited ? "$1.00 added to your wallet." : "One claim per account."}</p>
          {error && <p className="mt-1 text-xs" role="alert">{error}</p>}
        </div>
      </div>
      {!(claim && claim.token === token) && <button type="button" disabled={busy} onClick={() => void claimCredit()} className="rounded-lg bg-emerald-800 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-900 disabled:opacity-60">{busy ? "Claiming…" : token ? "Claim $1.00" : "Sign in to claim"}</button>}
    </aside>
  );
}
