import { billing } from "./billing.mjs";
import { assertCharge, retrieveCheckout } from "../shared/billing.mjs";
import { sendGiftFromGmail } from "./gmail.mjs";
import { giftClaimUrl, renderGiftEmail } from "../shared/giftEmail.mjs";

export async function fulfillPaidGift(session, env) {
  if (session.payment_status !== "paid" || session.currency !== "usd" || session.metadata?.isGift !== "true") return null;
  const evidence = assertCharge(session);
  if (evidence.amount_refunded) throw new Error("Refunded gift requires review.");
  if (!env.GIFTS) throw new Error("Gift storage is not configured.");
  const metadata = session.metadata;
  const recipientEmail = String(metadata.recipientEmail || "").trim().toLowerCase();
  const senderEmail = String(metadata.senderEmail || metadata.userEmail || session.customer_details?.email || "").trim().toLowerCase();
  const amountUsd = Number(metadata.netDepositUsd || metadata.topUpAmount);
  if (!recipientEmail || !senderEmail || !Number.isFinite(amountUsd) || amountUsd < 1) throw new Error("Gift payment is missing sender, recipient, or credit amount.");
  // A stable, unguessable code makes webhook retries resolve to the same gift.
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${session.id}:${env.SESSION_SECRET}`));
  const listKey = `gifts_for:${recipientEmail}`;
  const list = JSON.parse(await env.GIFTS.get(listKey) || "[]");
  const legacy = list.find((gift) => gift.stripeSessionId === session.id);
  const code = legacy?.code || `gft_${Array.from(new Uint8Array(digest)).map((v) => v.toString(16).padStart(2, "0")).join("").slice(0, 32)}`;
  const existing = await env.GIFTS.get(`gift:${code}`);
  const gift = existing ? JSON.parse(existing) : legacy || {
    code, stripeSessionId: session.id, senderEmail, recipientEmail, amountUsd,
    senderName: String(metadata.senderName || senderEmail).slice(0, 100),
    giftMessage: String(metadata.giftMessage || "").slice(0, 500),
    claimed: false, createdAt: new Date().toISOString(), emailStatus: "pending",
  };
  if (!existing) await env.GIFTS.put(`gift:${code}`, JSON.stringify(gift)); // No expiration: claim whenever.
  gift.senderEmail ||= senderEmail;
  if (!list.some((entry) => entry.stripeSessionId === session.id)) {
    list.unshift(gift);
    await env.GIFTS.put(listKey, JSON.stringify(list));
  }
  if (gift.claimed || gift.emailStatus === "sent") return gift;
  const email = renderGiftEmail({ ...gift, claimUrl: giftClaimUrl(env.APP_URL, code, recipientEmail) });
  const result = await sendGiftFromGmail(gift, email, env);
  gift.emailStatus = "sent";
  gift.emailId = result.id;
  await env.GIFTS.put(`gift:${code}`, JSON.stringify(gift));
  return gift;
}

export async function verifyGiftWebhook(raw, signature, secret, now = Date.now()) {
  if (!secret) return false;
  const parts = String(signature || "").split(",").map(part => part.trim());
  const timestamp = Number(parts.find((part) => part.startsWith("t="))?.slice(2));
  if (!Number.isFinite(timestamp) || Math.abs(now / 1000 - timestamp) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  for (const entry of parts.filter((part) => /^v1=[a-f0-9]{64}$/.test(part))) {
    const bytes = Uint8Array.from(entry.slice(3).match(/../g), (part) => parseInt(part, 16));
    if (await crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(`${timestamp}.${raw}`))) return true;
  }
  return false;
}

// Serialize claims for each recipient and keep claimed codes in strongly consistent
// Durable Object storage, so simultaneous clicks cannot redeem a gift twice.
export class GiftClaims {
  constructor(state, env) { this.state = state; this.env = env; }
  async fetch(request) {
    return this.state.blockConcurrencyWhile(async () => {
      const { email, code, action, session } = await request.json();
      if (action === "fulfill") {
        const delivered = await this.state.storage.get(`delivered:${session.id}`);
        if (delivered) return Response.json(delivered);
        const gift = await fulfillPaidGift(session, this.env);
        if (gift) await this.state.storage.put(`delivered:${session.id}`, gift);
        return Response.json(gift);
      }
      const previous = await this.state.storage.get("pending");
      if (previous) {
        await this.project(previous);
        if (!code || previous.gifts.some((gift) => gift.code === code)) return Response.json(previous.result);
      }
      const kv = this.env.GIFTS;
      const gifts = code ? [JSON.parse(await kv.get(`gift:${code}`) || "null")].filter(Boolean) : JSON.parse(await kv.get(`gifts_for:${email}`) || "[]");
      if (gifts.some((gift) => gift.recipientEmail !== email)) return Response.json({ message: "Sign in with the gift recipient's email address." }, { status: 403 });
      const unclaimed = [];
      for (const gift of gifts) {
        if (!gift.claimed && !await this.state.storage.get(`claimed:${gift.code}`)) unclaimed.push(gift);
      }
      if (!unclaimed.length) return Response.json({ message: "No unclaimed gift was found for this account." }, { status: 404 });
      const amount = Number(unclaimed.reduce((sum, gift) => sum + Number(gift.amountUsd), 0).toFixed(2));
      for (const gift of unclaimed) {
        const evidence = await retrieveCheckout(gift.stripeSessionId, this.env.STRIPE_SECRET_KEY);
        if (evidence.livemode !== /^(sk|rk)_live_/.test(this.env.STRIPE_SECRET_KEY || "")) throw new Error("Wrong Stripe mode.");
        await billing(this.env, { action: "adoptGift", email, gift, session: evidence });
      }
      const credited = await billing(this.env, { action: "giftCredit", email, gifts: unclaimed });
      const balance = credited.balance_usd;
      const now = new Date().toISOString();
      const result = { success: true, claimedAmountUsd: amount, newBalance: balance, claimedCount: unclaimed.length, gifts: unclaimed };
      // Persist a projection job with the claim markers. Retrying a failed KV write
      // can complete it without adding the amount to the balance a second time.
      const pending = { email, balance, result, gifts: unclaimed.map((gift) => ({ ...gift, claimed: true, claimedAt: now })) };
      await this.state.storage.transaction(async (storage) => {
        for (const gift of unclaimed) await storage.put(`claimed:${gift.code}`, true);
        await storage.put("pending", pending);
      });
      await this.state.storage.setAlarm(Date.now() + 10000);
      await this.project(pending);
      return Response.json(result);
    });
  }
  async alarm() {
    const pending = await this.state.storage.get("pending");
    if (pending) await this.project(pending);
  }
  async project(pending) {
    const kv = this.env.GIFTS;
    // Balance is committed by the billing ledger before this gift projection.
    for (const gift of pending.gifts) await kv.put(`gift:${gift.code}`, JSON.stringify(gift));
    const listKey = `gifts_for:${pending.email}`;
    const list = JSON.parse(await kv.get(listKey) || "[]");
    await kv.put(listKey, JSON.stringify(list.map((gift) => pending.gifts.find((claimed) => claimed.code === gift.code) || gift)));
    await this.state.storage.delete("pending");
    await this.state.storage.deleteAlarm();
  }
}

export async function fulfillGiftThroughVault(session, env) {
  const email = String(session.metadata?.recipientEmail || "").trim().toLowerCase();
  if (!env.GIFT_CLAIMS || !email) throw new Error("Gift processing is not configured.");
  const vault = env.GIFT_CLAIMS.get(env.GIFT_CLAIMS.idFromName(email));
  const response = await vault.fetch("https://gift-claims/fulfill", { method: "POST", body: JSON.stringify({ action: "fulfill", session }) });
  if (!response.ok) throw new Error("Gift delivery could not complete. The payment notification will be retried.");
  return response.json();
}
