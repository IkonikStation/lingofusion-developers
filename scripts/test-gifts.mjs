// All provider requests are mocked. This suite cannot purchase, email, or modify a live account.
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import worker from "../cloudflare-worker/worker.mjs";
import { harness } from "./billing-test-harness.mjs";
import { billing } from "../cloudflare-worker/billing.mjs";
import { depositQuote } from "../shared/billing.mjs";
import { encryptGmailToken, decryptGmailToken } from "../cloudflare-worker/gmail.mjs";
import { giftClaimUrl, renderGiftEmail } from "../shared/giftEmail.mjs";

const originalFetch = globalThis.fetch;
const testEnv = harness();
const { env, records } = testEnv;
env.GOOGLE_CLIENT_ID = "mock-client"; env.GOOGLE_CLIENT_SECRET = "mock-client-secret";
const providerCalls = [];
const giftWrites = [];
const originalPut = env.GIFTS.put;
env.GIFTS.put = async (key, value, options) => { giftWrites.push({ key, options }); return originalPut(key, value, options); };
let emailFailure = false;
const b64 = (value) => Buffer.from(value).toString("base64url");
function auth(email, provider = "google") {
  const payload = b64(JSON.stringify({ email, provider, id: `user:${email}`, exp: Math.floor(Date.now() / 1000) + 3600 }));
  return `${payload}.${createHmac("sha256", env.SESSION_SECRET).update(payload).digest("base64url")}`;
}
function api(path, body, email) {
  return worker.fetch(new Request(`https://gateway.example${path}`, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", ...(email ? { Authorization: `Bearer ${auth(email)}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }), env);
}
const session = { id: "cs_test_mockgift", currency: "usd", status: "complete", mode: "payment", amount_total: depositQuote(25).grossAmountCents, livemode: false, payment_intent: { status: "succeeded", currency: "usd", amount_received: depositQuote(25).grossAmountCents, latest_charge: { id: "ch_gift", paid: true, status: "succeeded", currency: "usd", amount: depositQuote(25).grossAmountCents, amount_refunded: 0 } }, payment_status: "paid", metadata: { userEmail: "alex@gmail.com", billingPolicy: "usd-v1", isGift: "true", senderEmail: "alex@gmail.com", recipientEmail: "jordan@example.com", senderName: "Alex", giftMessage: "For your next idea <3", netDepositUsd: "25" } };
const legacySession = structuredClone(session);
legacySession.id = "cs_test_legacygift";
legacySession.metadata.recipientEmail = "legacy@example.com";
delete legacySession.metadata.billingPolicy;
legacySession.payment_intent.latest_charge.id = "ch_legacygift";
function webhook(object = session, valid = true) {
  const raw = JSON.stringify({ livemode: false, type: "checkout.session.completed", data: { object } });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", env.STRIPE_GIFT_WEBHOOK_SECRET).update(`${timestamp}.${raw}`).digest("hex");
  return worker.fetch(new Request("https://gateway.example/api/gifts/stripe-webhook", { method: "POST", headers: { "stripe-signature": valid ? `t=${timestamp},v1=${signature}` : "invalid" }, body: raw }), env);
}
try {
  globalThis.fetch = async (url, options) => {
    const target = String(url);
    providerCalls.push({ target, options });
    if (target === "https://oauth2.googleapis.com/token") return Response.json({ access_token: "mock-access" });
    if (target === "https://gmail.googleapis.com/gmail/v1/users/me/messages/send") return emailFailure ? Response.json({ error: "mock-unavailable" }, { status: 503 }) : Response.json({ id: "mock-message-id" });
    if (target === "https://api.stripe.com/v1/checkout/sessions") return Response.json({ currency: "usd", id: "cs_test_mock", url: "https://checkout.stripe.com/mock" });
    if (target.startsWith("https://api.stripe.com/v1/checkout/sessions/cs_test_legacygift")) return Response.json(legacySession);
    if (target.startsWith("https://api.stripe.com/v1/charges/ch_gift")) return Response.json(session.payment_intent.latest_charge);
    if (target.startsWith("https://api.stripe.com/v1/checkout/sessions/cs_test_mockgift")) return Response.json(session);
    throw new Error(`Unmocked network request blocked: ${target}`);
  };
  const encrypted = await encryptGmailToken("mock-refresh", "alex@gmail.com", env.SESSION_SECRET);
  assert.equal(await decryptGmailToken(encrypted, "alex@gmail.com", env.SESSION_SECRET), "mock-refresh");
  await assert.rejects(decryptGmailToken(encrypted, "other@gmail.com", env.SESSION_SECRET));
  records.set("gmail:alex@gmail.com", JSON.stringify(encrypted));
  assert.equal((await webhook(session, false)).status, 400);
  assert.equal((await webhook({ ...session, payment_status: "unpaid" })).status, 200);
  assert.equal(providerCalls.length, 0, "Unsigned and unpaid events cannot send email");
  assert.equal((await api("/api/create-checkout-session", { amount: 25, isGift: true, recipientEmail: "jordan@example.com" })).status, 401);
  const checkout = await api("/api/create-checkout-session", { amount: 25, isGift: true, recipientEmail: "jordan@example.com", userEmail: "spoof@gmail.com" }, "alex@gmail.com");
  assert.equal(checkout.status, 200);
  const checkoutParams = providerCalls.find((call) => call.target.includes("stripe.com")).options.body;
  assert.equal(new URLSearchParams(checkoutParams).get("metadata[senderEmail]"), "alex@gmail.com");
  await billing(env, { action: "order", order: { id: session.id, policy: "usd-v1", mode: "payment", email: "alex@gmail.com", amountCents: session.amount_total, netCents: 2500, isGift: true, recipientEmail: "jordan@example.com" } });
  emailFailure = true;
  assert.equal((await webhook()).status, 500, "Provider failure must trigger webhook retry");
  emailFailure = false;
  assert.equal((await webhook()).status, 200);
  const sentCount = providerCalls.filter((call) => call.target.includes("messages/send")).length;
  assert.equal((await webhook()).status, 200);
  assert.equal(providerCalls.filter((call) => call.target.includes("messages/send")).length, sentCount, "Repeated payment event must not send again");
  const gifts = JSON.parse(records.get("gifts_for:jordan@example.com"));
  assert.equal(gifts.length, 1);
  assert(giftWrites.filter((write) => write.key.startsWith("gift:")).every((write) => !write.options?.expirationTtl), "Gifts do not expire");
  const emailCall = providerCalls.find((call) => call.target.includes("messages/send"));
  const mime = Buffer.from(JSON.parse(emailCall.options.body).raw, "base64url").toString();
  assert(mime.includes("From: alex@gmail.com\r\nTo: jordan@example.com"));
  assert.equal((await api("/api/gifts/claim", { code: gifts[0].code })).status, 401);
  assert.equal((await api("/api/gifts/claim", { code: gifts[0].code }, "wrong@example.com")).status, 403);
  const claims = await Promise.all([api("/api/gifts/claim", { code: gifts[0].code }, "jordan@example.com"), api("/api/gifts/claim", { code: gifts[0].code }, "jordan@example.com")]);
  assert.deepEqual(claims.map((response) => response.status).sort(), [200, 404]);
  assert.equal(records.get("user_balance:jordan@example.com"), "25", "Concurrent claims must credit exactly once");
  assert.equal(records.has("user_balance:alex@gmail.com"), false);
  const legacyGift = { code: "gft_legacy", stripeSessionId: legacySession.id, recipientEmail: "legacy@example.com", senderEmail: "alex@gmail.com", amountUsd: 25, claimed: false };
  records.set("gift:gft_legacy", JSON.stringify(legacyGift));
  records.set("gifts_for:legacy@example.com", JSON.stringify([legacyGift]));
  const legacyClaim = await api("/api/gifts/claim", { code: "gft_legacy" }, "legacy@example.com");
  assert.equal(legacyClaim.status, 200, JSON.stringify(await legacyClaim.clone().json()));
  assert.equal((await billing(env, { action: "balance", email: "legacy@example.com" })).balance_usd, 25, "Verified pre-ledger gifts remain redeemable");
  session.payment_intent.latest_charge.amount_refunded = session.amount_total;
  assert.equal((await testEnv.webhook("charge.refunded", session.payment_intent.latest_charge)).status, 200);
  assert.equal((await billing(env, { action: "balance", email: "jordan@example.com" })).balance_usd, 0, "Gift refunds deduct recipient credit once");
  assert.equal((await testEnv.webhook("charge.refunded", session.payment_intent.latest_charge)).status, 200);
  assert.equal((await billing(env, { action: "balance", email: "jordan@example.com" })).balance_usd, 0);
  const connect = await api("/api/gifts/gmail/connect", {}, "alex@gmail.com");
  const consent = new URL((await connect.json()).url);
  assert(consent.searchParams.get("scope").includes("gmail.send"));
  assert.equal(consent.searchParams.get("code_challenge_method"), "S256");
  const claimUrl = giftClaimUrl(env.APP_URL, "mock", "jordan@example.com");
  assert(!claimUrl.includes("playground/playground"));
  const preview = renderGiftEmail({ ...session.metadata, amountUsd: 25, claimUrl, giftMessage: '<script>alert("x")</script>', preview: true });
  assert(!preview.html.includes("<script>"));
  assert(preview.html.includes("No email sent"));
  console.log("Gift checks passed: no live network, no purchases, no real email. Verified sender binding, encrypted Gmail tokens, consent, signed payments, delivery retry, recipient ownership, no expiry, and concurrent redemption.");
} finally { globalThis.fetch = originalFetch; }
