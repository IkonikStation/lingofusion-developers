import { BILLING_POLICY, STRIPE_API_VERSION, depositQuote, requireUsd, retrieveCheckout, subscriptionQuote } from "../shared/billing.mjs";
import { billing as billingLedger } from "./billing.mjs";
export { BillingLedger } from "./billing.mjs";
import { dubbingRequest } from "./dubbing.mjs";
import { fulfillGiftThroughVault, verifyGiftWebhook } from "./gifts.mjs";
import { connectGmail, gmailCallback, gmailConfigured, gmailStatus } from "./gmail.mjs";
export { GiftClaims } from "./gifts.mjs";

// LingoFusion Private Cloudflare Worker Gateway
// Secrets (stored encrypted in Cloudflare — never in code or GitHub):
//   - STRIPE_SECRET_KEY
//   - VOICE_API_KEY
//   - OPENAI_API_KEY (optional)

const ALLOWED_ORIGINS = [
  "https://ikonikstation.github.io",
  "http://localhost:5173",
  "http://localhost:8787",
  "http://localhost:3000",
];

function getCorsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Idempotency-Key, X-LingoFusion-Client-Token",
  };
}

function jsonResponse(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...getCorsHeaders(origin),
      "Content-Type": "application/json",
    },
  });
}

const calculateGrossDeposit = depositQuote;

// ---------------------------------------------------------------------------
// OAuth sign-in (Google Identity Services + Sign in with Apple)
// ID tokens are verified server-side; the browser can never mint a session.
// Config (Worker vars/secrets): GOOGLE_CLIENT_ID, APPLE_CLIENT_ID, SESSION_SECRET
// ---------------------------------------------------------------------------
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function b64urlEncode(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str) {
  const pad = "=".repeat((4 - (str.length % 4)) % 4);
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function b64urlJson(str) {
  return JSON.parse(new TextDecoder().decode(b64urlDecode(str)));
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signSession(payload, secret) {
  const body = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(body));
  return `${body}.${b64urlEncode(new Uint8Array(sig))}`;
}

async function verifySession(token, secret) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const ok = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret),
    b64urlDecode(sig),
    new TextEncoder().encode(body),
  );
  if (!ok) return null;
  const payload = b64urlJson(body);
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

async function verifyGoogleIdToken(idToken, clientId) {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!res.ok) throw new Error("Google rejected the sign-in token.");
  const info = await res.json();
  if (info.aud !== clientId) throw new Error("Google token was issued for a different app.");
  if (!["accounts.google.com", "https://accounts.google.com"].includes(info.iss)) throw new Error("Invalid Google token issuer.");
  if (Number(info.exp) < Math.floor(Date.now() / 1000)) throw new Error("Google token expired.");
  if (String(info.email_verified) !== "true") throw new Error("Your Google email is not verified.");
  return { sub: info.sub, email: info.email, name: info.name || info.given_name || info.email, picture: info.picture };
}

async function verifyAppleIdToken(idToken, clientId) {
  const [h, p, s] = String(idToken || "").split(".");
  if (!h || !p || !s) throw new Error("Malformed Apple token.");
  let header;
  let claims;
  try {
    header = b64urlJson(h);
    claims = b64urlJson(p);
  } catch {
    throw new Error("Malformed Apple token.");
  }
  const jwks = await (await fetch("https://appleid.apple.com/auth/keys")).json();
  const jwk = (jwks.keys || []).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("Unknown Apple signing key.");
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    b64urlDecode(s),
    new TextEncoder().encode(`${h}.${p}`),
  );
  if (!valid) throw new Error("Apple token signature is invalid.");
  if (claims.iss !== "https://appleid.apple.com") throw new Error("Invalid Apple token issuer.");
  if (claims.aud !== clientId) throw new Error("Apple token was issued for a different app.");
  if (Number(claims.exp) < Math.floor(Date.now() / 1000)) throw new Error("Apple token expired.");
  return { sub: claims.sub, email: claims.email || `${claims.sub}@privaterelay.appleid.com` };
}

async function issueSession(env, provider, identity, nameOverride) {
  const now = Math.floor(Date.now() / 1000);
  const email = String(identity.email).toLowerCase();
  const user = {
    id: `usr_${provider}_${identity.sub}`,
    provider,
    email,
    name: nameOverride || identity.name || String(identity.email).split("@")[0],
    avatar: identity.picture || null,
  };

  // Sync latest cloud credit balance across devices
  let balanceUsd = 0;
  if (env.GIFTS) {
    const rawBal = env.BILLING ? String((await billingLedger(env, { action: "balance", email })).balance_usd) : await env.GIFTS.get(`user_balance:${email}`);
    if (rawBal !== null) {
      balanceUsd = Number(rawBal);
    }
  }
  user.balance_usd = balanceUsd;

  const token = await signSession({ ...user, iat: now, exp: now + SESSION_TTL_SECONDS }, env.SESSION_SECRET);
  return { user, sessionToken: token, expiresAt: (now + SESSION_TTL_SECONDS) * 1000 };
}

async function settleCheckout(env, id, supplied) {
  const session = supplied || await retrieveCheckout(id, env.STRIPE_SECRET_KEY);
  if (session.livemode !== /^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY || "")) throw new Error("Wrong Stripe mode.");
  const result = await billingLedger(env, { action: "settle", session });
  if (result.isGift) {
    const gift = await fulfillGiftThroughVault(session, env);
    result.giftCode = gift?.code;
  }
  return result;
}

export default {
  async fetch(request, env) {
    const requestOrigin = request.headers.get("origin") || "";
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: getCorsHeaders(requestOrigin) });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // 1. Health check
      if (request.method === "GET" && (path === "/" || path === "/api/health")) {
        return jsonResponse({ status: "ok", gateway: "lingofusion-edge" }, 200, requestOrigin);
      }

      // Security check for browser playground actions:
      // Must come from your official domain or supply the valid client handshake header
      const clientToken = request.headers.get("x-lingofusion-client-token");
      const isAllowedOrigin = ALLOWED_ORIGINS.includes(requestOrigin);
      const isDirectBotRequest = !isAllowedOrigin && clientToken !== "lf_play_secure_649f7";

      if ((path.startsWith("/api/playground") || path.startsWith("/v1/audio/speech") || path.startsWith("/v1/music")) && isDirectBotRequest) {
        return jsonResponse(
          {
            error: "forbidden",
            message: "Direct automated requests to this edge endpoint are restricted.",
          },
          403,
          requestOrigin,
        );
      }

      const signedInUser = async () => {
        const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
        return env.SESSION_SECRET ? verifySession(token, env.SESSION_SECRET).catch(() => null) : null;
      };
      if (request.method === "GET" && path === "/api/gifts/gmail/callback") return gmailCallback(request, env);
      if (request.method === "GET" && path === "/api/gifts/config") {
        return jsonResponse(await gmailStatus(env, await signedInUser()), 200, requestOrigin);
      }
      if (request.method === "POST" && path === "/api/gifts/gmail/connect") {
        const user = await signedInUser();
        if (!user) return jsonResponse({ message: "Sign in with Google first." }, 401, requestOrigin);
        const response = await connectGmail(request, env, user);
        return jsonResponse(await response.json(), response.status, requestOrigin);
      }
      if (request.method === "POST" && path === "/api/gifts/gmail/disconnect") {
        const user = await signedInUser();
        if (!user) return jsonResponse({ message: "Sign in first." }, 401, requestOrigin);
        await env.GIFTS?.delete(`gmail:${user.email.toLowerCase()}`);
        return jsonResponse({ connected: false }, 200, requestOrigin);
      }
      if (request.method === "POST" && ["/api/gifts/stripe-webhook", "/api/stripe-webhook", "/api/webhooks/stripe"].includes(path)) {
        const raw = await request.text();
        const secret = path === "/api/gifts/stripe-webhook" ? env.STRIPE_GIFT_WEBHOOK_SECRET : env.STRIPE_WEBHOOK_SECRET;
        if (!await verifyGiftWebhook(raw, request.headers.get("stripe-signature"), secret)) return jsonResponse({ error: "invalid_signature" }, 400, requestOrigin);
        const event = JSON.parse(raw);
        if (typeof event.livemode !== "boolean" || event.livemode !== /^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY || "")) return jsonResponse({ error: "wrong_stripe_mode" }, 400, requestOrigin);
        const object = event.data?.object;
        if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type) && object?.payment_status === "paid") {
          await settleCheckout(env, object.id);
        } else if (["charge.refunded", "charge.dispute.created", "charge.dispute.closed"].includes(event.type)) {
          let dispute;
          if (event.type !== "charge.refunded") {
            const disputeResponse = await fetch(`https://api.stripe.com/v1/disputes/${encodeURIComponent(object.id)}`, { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Stripe-Version": STRIPE_API_VERSION } });
            if (!disputeResponse.ok) throw new Error("Stripe dispute lookup failed.");
            dispute = await disputeResponse.json();
          }
          const chargeId = dispute?.charge || object.id;
          const response = await fetch(`https://api.stripe.com/v1/charges/${encodeURIComponent(chargeId)}`, { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Stripe-Version": STRIPE_API_VERSION } });
          if (!response.ok) throw new Error("Stripe refund lookup failed.");
          await billingLedger(env, { action: "refund", session: await response.json(), hold: event.type.startsWith("charge.dispute") ? dispute.status !== "won" : undefined });
        } else if (["invoice.paid", "invoice.payment_succeeded"].includes(event.type)) {
          const subscription = object.parent?.subscription_details?.subscription || object.subscription;
          if (subscription) {
            const response = await fetch(`https://api.stripe.com/v1/checkout/sessions?subscription=${encodeURIComponent(subscription)}&limit=1`, { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Stripe-Version": STRIPE_API_VERSION } });
            if (!response.ok) throw new Error("Stripe subscription lookup failed.");
            const session = (await response.json()).data?.[0];
            if (session?.metadata?.billingPolicy === BILLING_POLICY) await settleCheckout(env, session.id);
          }
        }
        return jsonResponse({ received: true }, 200, requestOrigin);
      }
      if (request.method === "POST" && ["/api/auto-recharge", "/api/billing/recharge", "/api/billing/reset-local-data"].includes(path)) {
        return jsonResponse({ error: "unavailable", message: "Automatic top-up and simulated balance changes are unavailable. Please add funds manually." }, 503, requestOrigin);
      }

      // 2. Create Stripe Checkout Session (server-side only using env.STRIPE_SECRET_KEY)
      if (request.method === "POST" && (path === "/api/create-checkout-session" || path === "/api/billing/deposit")) {
        const stripeKey = env.STRIPE_SECRET_KEY;
        if (!stripeKey) {
          return jsonResponse({ error: "stripe_not_configured", message: "STRIPE_SECRET_KEY secret is not set on Worker." }, 503);
        }

        const body = await request.json().catch(() => ({}));
        const buyer = await signedInUser();
        if (!buyer?.email) return jsonResponse({ error: "sign_in_required", message: "Sign in before checkout." }, 401, requestOrigin);
        try { requireUsd(body); } catch (error) { return jsonResponse({ message: error.message }, 400, requestOrigin); }

        const depositAmount = Number(body.amount ?? body.depositAmount ?? body.topUpAmount);
        if (!Number.isFinite(depositAmount) || depositAmount < 1 || depositAmount > 50000) {
          return jsonResponse({
            error: "deposit_amount_out_of_range",
            message: "Top-up amount must be between $1.00 and $50,000.00 USD.",
          }, 400);
        }

        const currency = "usd";
        const { netDepositedUsd, grossAmountCents, grossChargedUsd, estimatedStripeFeeUsd } =
          calculateGrossDeposit(depositAmount);
        const giftSender = body.isGift ? buyer : null;
        if (body.isGift && (!giftSender || giftSender.provider !== "google")) return jsonResponse({ message: "Sign in with Google before sending a gift." }, 401, requestOrigin);
        if (body.isGift && (!gmailConfigured(env) || !env.STRIPE_GIFT_WEBHOOK_SECRET || !env.GIFT_CLAIMS || !await env.GIFTS.get(`gmail:${giftSender.email.toLowerCase()}`))) return jsonResponse({ message: "Connect Gmail and enable gift delivery before checkout. You can preview the recipient experience without buying." }, 503, requestOrigin);
        const userId = buyer.id;
        const userEmail = buyer.email.toLowerCase();
        const returnPlaygroundUrl = String(
          body.returnUrl || env.APP_URL || "https://ikonikstation.github.io/lingofusion-developers/playground"
        ).replace(/\/+$/, "");

        const isGift = Boolean(body.isGift);
        const recipientEmail = String(body.recipientEmail || "").trim().toLowerCase();
        const giftMessage = String(body.giftMessage || "").slice(0, 500);
        const senderName = String(body.senderName || "").trim();

        if (isGift && (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail))) {
          return jsonResponse({
            error: "invalid_recipient_email",
            message: "Please enter a valid recipient email address for the gift.",
          }, 400);
        }

        const params = new URLSearchParams();
        params.append("mode", "payment");
        params.append("adaptive_pricing[enabled]", "false");
        params.append("custom_text[submit][message]", "All payments are charged in USD. Your bank may convert USD to your local currency.");
        if (userEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail) && userEmail !== "developer@lingofusion.dev") {
          params.append("customer_email", userEmail);
        }
        params.append("line_items[0][price_data][currency]", currency);
        params.append("line_items[0][price_data][unit_amount]", String(grossAmountCents));
        params.append(
          "line_items[0][price_data][product_data][name]",
          isGift
            ? `Gift LingoFusion Balance to ${recipientEmail} — $${netDepositedUsd.toFixed(2)} USD API Credit`
            : `LingoFusion Balance — $${netDepositedUsd.toFixed(2)} USD API Credit`,
        );
        params.append(
          "line_items[0][price_data][product_data][description]",
          isGift
            ? `Gifts +$${netDepositedUsd.toFixed(2)} USD in LingoFusion credits to ${recipientEmail}. The recipient can claim these credits instantly with their email.`
            : `Adds +$${netDepositedUsd.toFixed(2)} USD to your usable API balance`,
        );
        params.append("line_items[0][quantity]", "1");
        params.append("metadata[userId]", userId);
        params.append("metadata[userEmail]", userEmail);
        params.append("metadata[billingPolicy]", BILLING_POLICY);
        if (userEmail) {
          params.append("metadata[userEmail]", userEmail);
        }
        params.append("metadata[topUpAmount]", netDepositedUsd.toString());
        params.append("metadata[netDepositUsd]", netDepositedUsd.toString());
        params.append("metadata[currency]", currency);
        params.append("metadata[isGift]", isGift ? "true" : "false");
        if (isGift) {
          params.append("metadata[recipientEmail]", recipientEmail);
          params.append("metadata[senderEmail]", userEmail);
          if (giftMessage) params.append("metadata[giftMessage]", giftMessage);
          if (senderName) params.append("metadata[senderName]", senderName);
        }
        params.append("success_url", `${returnPlaygroundUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}${isGift ? "&gift=true" : ""}`);
        params.append("cancel_url", `${returnPlaygroundUrl}?payment=cancelled${isGift ? "&gift=cancelled" : ""}`);

        const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${stripeKey}`,
            "Stripe-Version": STRIPE_API_VERSION,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        });

        const stripeData = await stripeRes.json();
        if (!stripeRes.ok) {
          return jsonResponse({
            error: "stripe_error",
            message: stripeData?.error?.message || "Failed to create Stripe Checkout session",
          }, stripeRes.status);
        }

        if (stripeData.currency !== "usd") throw new Error("Stripe created an unexpected currency.");
        await billingLedger(env, { action: "order", order: { id: stripeData.id, policy: BILLING_POLICY, mode: "payment", email: userEmail, userId, amountCents: grossAmountCents, netCents: Math.round(netDepositedUsd * 100), isGift, recipientEmail } });
        return jsonResponse({
          url: stripeData.url,
          checkoutUrl: stripeData.url,
          sessionId: stripeData.id,
          currency,
          netDepositUsd: netDepositedUsd,
          grossAmountCents,
          grossChargedUsd,
          estimatedStripeFeeUsd,
          metadata: {
            userId,
            topUpAmount: netDepositedUsd.toString(),
            netDepositUsd: netDepositedUsd.toString(),
            currency,
          },
        });
      }

      // 2b. Ultra Custom Subscription Checkout (server-side only using env.STRIPE_SECRET_KEY)
      if (request.method === "POST" && path === "/api/billing/subscription-checkout") {
        const stripeKey = env.STRIPE_SECRET_KEY;
        const body = await request.json().catch(() => ({}));
        const buyer = await signedInUser();
        if (!buyer?.email) return jsonResponse({ error: "sign_in_required", message: "Sign in before checkout." }, 401, requestOrigin);
        try { requireUsd(body); } catch (error) { return jsonResponse({ message: error.message }, 400, requestOrigin); }

        const plan = String(body.plan || "ultra-custom");
        const billing = String(body.billing || body.billing_interval || "monthly").toLowerCase();
        const isYearly = billing === "yearly";

        let dubbingMins = 0;
        let voiceCredits = 25000;
        let textChars = 2200000;
        let transcribeMins = 30;
        let imageCount = 50;
        let monthlyPriceUsd = 19.99;
        let yearlyPriceUsd = 204.0;
        let productName = `LingoFusion Pro (${isYearly ? "Annual" : "Monthly"})`;
        let productDesc = "LingoFusion Pro recurring subscription — flat $19.99/mo with zero checkout fees";

        if (plan === "pro-max-750k" || plan === "pro-max") {
          monthlyPriceUsd = 39.99;
          yearlyPriceUsd = 408.0;
          voiceCredits = 75000;
          textChars = 4800000;
          transcribeMins = 75;
          imageCount = 150;
          productName = `LingoFusion Pro Max (${isYearly ? "Annual" : "Monthly"})`;
          productDesc = "LingoFusion Pro Max recurring subscription — flat $39.99/mo with zero checkout fees";
        } else if (plan === "ultra-custom") {
          dubbingMins = Math.max(0, Number(body.dubbing_mins ?? 30));
          voiceCredits = Math.max(0, Number(body.voice_credits ?? 1200000));
          textChars = Math.max(0, Number(body.text_chars ?? 5000000));
          transcribeMins = Math.max(0, Number(body.transcribe_mins ?? 120));
          imageCount = Math.max(0, Number(body.image_count ?? 50));
          monthlyPriceUsd = Math.max(29, Number(body.monthly_price_usd ?? 256.04));
          yearlyPriceUsd = Math.round(monthlyPriceUsd * 12 * 0.85 * 100) / 100;
          productName = `Ultra Custom Subscription (${isYearly ? "Annual" : "Monthly"})`;
          productDesc = `Custom quotas: ${dubbingMins}m dubbing, ${voiceCredits.toLocaleString()} voice credits, ${textChars.toLocaleString()} text chars, ${transcribeMins}m transcribe, ${imageCount} images (${isYearly ? "15% annual savings applied" : "Billed monthly"})`;
        }

        let quote;
        try { quote = subscriptionQuote(body); } catch (error) { return jsonResponse({ message: error.message }, 400, requestOrigin); }
        [dubbingMins, voiceCredits, textChars, transcribeMins, imageCount] = quote.quotas;
        monthlyPriceUsd = quote.monthly;
        yearlyPriceUsd = quote.yearly;
        const billedAmountUsd = isYearly ? yearlyPriceUsd : monthlyPriceUsd;
        const userId = buyer.id;
        const userEmail = buyer.email.toLowerCase();

        if (monthlyPriceUsd >= 5000) {
          return jsonResponse({
            isEnterpriseInvoice: true,
            notice: "Orders exceeding $5,000/month are processed via verified bank wire/ACH to prevent card processing delays and guarantee dedicated concurrency.",
            contactUrl: `/contact-sales?plan=${encodeURIComponent(plan)}&billing=${billing}&price=${billedAmountUsd.toFixed(2)}`,
          }, 200, requestOrigin);
        }

        const returnPlaygroundUrl = String(
          body.returnUrl || env.APP_URL || "https://ikonikstation.github.io/lingofusion-developers/playground"
        ).replace(/\/+$/, "");

        if (!stripeKey) return jsonResponse({ error: "stripe_not_configured" }, 503, requestOrigin);

        const params = new URLSearchParams();
        params.append("mode", "subscription");
        params.append("adaptive_pricing[enabled]", "false");
        params.append("custom_text[submit][message]", "All payments are charged in USD. Your bank may convert USD to your local currency.");
        if (userEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail) && userEmail !== "developer@lingofusion.dev") {
          params.append("customer_email", userEmail);
        }
        params.append("line_items[0][price_data][currency]", "usd");
        params.append("line_items[0][price_data][recurring][interval]", isYearly ? "year" : "month");
        params.append("line_items[0][price_data][unit_amount]", String(Math.round(billedAmountUsd * 100)));
        params.append("line_items[0][price_data][product_data][name]", productName);
        params.append(
          "line_items[0][price_data][product_data][description]",
          productDesc,
        );
        params.append("line_items[0][quantity]", "1");
        params.append("metadata[planId]", plan);
        params.append("metadata[userId]", userId);
        params.append("metadata[userEmail]", userEmail);
        params.append("metadata[billingPolicy]", BILLING_POLICY);
        params.append("metadata[billing]", billing);
        params.append("metadata[dubbing_mins]", String(dubbingMins));
        params.append("metadata[voice_credits]", String(voiceCredits));
        params.append("metadata[text_chars]", String(textChars));
        params.append("metadata[transcribe_mins]", String(transcribeMins));
        params.append("metadata[image_count]", String(imageCount));
        params.append("metadata[monthly_price_usd]", monthlyPriceUsd.toFixed(2));
        params.append("metadata[yearly_price_usd]", yearlyPriceUsd.toFixed(2));
        params.append("metadata[billed_amount_usd]", billedAmountUsd.toFixed(2));
        params.append("success_url", `${returnPlaygroundUrl}?subscription=success&session_id={CHECKOUT_SESSION_ID}`);
        params.append("cancel_url", `${returnPlaygroundUrl}?subscription=cancelled`);

        const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${stripeKey}`,
            "Stripe-Version": STRIPE_API_VERSION,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        });

        const stripeData = await stripeRes.json();
        if (!stripeRes.ok) {
          return jsonResponse({
            error: "stripe_error",
            message: stripeData?.error?.message || "Failed to create Stripe Subscription session",
          }, stripeRes.status, requestOrigin);
        }

        if (stripeData.currency !== "usd") throw new Error("Stripe created an unexpected currency.");
        await billingLedger(env, { action: "order", order: { id: stripeData.id, policy: BILLING_POLICY, mode: "subscription", email: userEmail, userId, amountCents: quote.amountCents, subscription: quote } });
        return jsonResponse({
          url: stripeData.url,
          checkoutUrl: stripeData.url,
          sessionId: stripeData.id,
          monthlyPriceUsd,
        }, 200, requestOrigin);
      }

      // 3. Verify Stripe Checkout Session (server-side only using env.STRIPE_SECRET_KEY)
      if (request.method === "POST" && path === "/api/verify-checkout-session") {
        const buyer = await signedInUser();
        if (!buyer?.email) return jsonResponse({ error: "sign_in_required" }, 401, requestOrigin);
        const body = await request.json().catch(() => ({}));
        const session = await retrieveCheckout(String(body.sessionId || body.session_id || ""), env.STRIPE_SECRET_KEY);
        if (session.metadata?.userEmail !== buyer.email.toLowerCase()) return jsonResponse({ error: "checkout_owner_mismatch" }, 403, requestOrigin);
        if (session.payment_status !== "paid" || session.status !== "complete") return jsonResponse({ verified: false, payment_status: session.payment_status }, 200, requestOrigin);
        const result = await settleCheckout(env, session.id, session);
        return jsonResponse({ ...result, sessionId: session.id, recipientEmail: session.metadata?.recipientEmail }, 200, requestOrigin);
      }

      // 4. Voice Synthesis Proxy (server-side only using env.VOICE_API_KEY)
      if (request.method === "POST" && (path === "/api/playground/speech" || path === "/v1/audio/speech")) {
        const voiceKey = env.VOICE_API_KEY;
        if (!voiceKey) {
          return jsonResponse({ error: "voice_provider_not_configured", message: "VOICE_API_KEY secret is not set on Worker." }, 503);
        }

        const body = await request.json().catch(() => ({}));
        const input = String(body.input || body.text || "").trim();
        if (!input) {
          return jsonResponse({ error: "missing_input", message: "Text input is required." }, 400);
        }

        const modelName = String(body.model || "LingoFusion Voice");
        const isFlash = modelName.toLowerCase().includes("flash");
        const rawVoice = String(body.voice || body.voice_id || body.gender || "female").trim().toLowerCase();
        const voiceId =
          rawVoice === "male" || rawVoice === "1sm7ggm6imuvqlz2bwm3"
            ? "1SM7GgM6IMuvQlz2BwM3"
            : rawVoice === "female" || rawVoice === "bzgkqpqms7kj9ulskvzn"
              ? "BZgkqPqms7Kj9ulSkVzn"
              : String(body.voice || body.voice_id || "BZgkqPqms7Kj9ulSkVzn");

        const defaultBase = atob("aHR0cHM6Ly9hcGkuZWxldmVubGFicy5pby92MS90ZXh0LXRvLXNwZWVjaC8=");
        const defaultM1 = atob("ZWxldmVuX3Y0");
        const defaultM2 = atob("ZWxldmVuX3Y0X3R1cmJv");
        const upstreamModel = isFlash ? (env.VOICE_MODEL_FLASH || defaultM2) : (env.VOICE_MODEL_STD || defaultM1);
        const upstreamUrl = `${env.VOICE_UPSTREAM_URL || defaultBase}${encodeURIComponent(voiceId)}`;

        const upstreamRes = await fetch(upstreamUrl, {
          method: "POST",
          headers: {
            "xi-api-key": voiceKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text: input,
            model_id: upstreamModel,
          }),
        });

        if (!upstreamRes.ok) {
          const errData = await upstreamRes.json().catch(() => ({}));
          return jsonResponse({
            error: "voice_synthesis_failed",
            message: errData?.detail?.message || errData?.message || `Voice synthesis failed (HTTP ${upstreamRes.status})`,
          }, upstreamRes.status);
        }

        const arrayBuffer = await upstreamRes.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        const base64 = btoa(binary);

        return jsonResponse({
          id: `speech_${ crypto.randomUUID().replace(/-/g, "").slice(0, 16) }`,
          model: modelName,
          status: "completed",
          audio_url: `data:audio/mpeg;base64,${base64}`,
          chars: input.length,
        });
      }

      // 4b. Chat / Text Translation Proxy
      if (request.method === "POST" && (path === "/api/playground/chat" || path === "/v1/chat/completions")) {
        const openaiKey = env.OPENAI_API_KEY;
        if (!openaiKey) {
          return jsonResponse({ error: "translation_engine_not_configured", message: "Translation engine secret is not configured on Gateway." }, 503, requestOrigin);
        }

        const upstreamRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiKey}`,
          },
          body: await request.text(),
        });

        const resHeaders = new Headers(upstreamRes.headers);
        const cors = getCorsHeaders(requestOrigin);
        for (const [k, v] of Object.entries(cors)) {
          resHeaders.set(k, v);
        }

        return new Response(upstreamRes.body, {
          status: upstreamRes.status,
          headers: resHeaders,
        });
      }

      // 4c. Image Translation / Edits Proxy
      if (request.method === "POST" && (path === "/api/playground/image" || path === "/v1/images/edits")) {
        const openaiKey = env.OPENAI_API_KEY;
        if (!openaiKey) {
          return jsonResponse({ error: "image_engine_not_configured", message: "Image synthesis engine secret is not configured on Gateway." }, 503, requestOrigin);
        }

        const contentType = request.headers.get("content-type") || "";
        const upstreamRes = await fetch("https://api.openai.com/v1/images/edits", {
          method: "POST",
          headers: {
            ...(contentType ? { "Content-Type": contentType } : {}),
            Authorization: `Bearer ${openaiKey}`,
          },
          body: request.body,
        });

        const resHeaders = new Headers(upstreamRes.headers);
        const cors = getCorsHeaders(requestOrigin);
        for (const [k, v] of Object.entries(cors)) {
          resHeaders.set(k, v);
        }

        return new Response(upstreamRes.body, {
          status: upstreamRes.status,
          headers: resHeaders,
        });
      }

      // 4d. Music Generation Proxy (server-side only using Treblo v3 / Melodia)
      if (request.method === "POST" && (path === "/api/playground/music" || path === "/v1/music")) {
        const trebloKey = env.TREBLO_API_KEY || env.VOICE_API_KEY;
        if (!trebloKey) {
          return jsonResponse({ error: "music_provider_not_configured", message: "TREBLO_API_KEY secret is not set on Worker." }, 503, requestOrigin);
        }

        const body = await request.json().catch(() => ({}));
        const prompt = String(body.prompt || body.input || body.text || "").trim();
        if (!prompt) {
          return jsonResponse({ error: "missing_prompt", message: "Music prompt is required." }, 400, requestOrigin);
        }

        const isInstrumental = Boolean(body.instrumental || body.force_instrumental || body.is_instrumental);
        const durationSeconds = Number(body.duration_seconds || body.duration || 60);
        const lyrics = !isInstrumental && typeof body.lyrics === "string" && body.lyrics.trim() ? body.lyrics.trim() : undefined;

        // Treblo v3 payload with real-time audio streaming
        // If instrumental is true, instrumental: true is passed and lyrics are omitted.
        // If instrumental is false, lyrics will be generated by Treblo based on prompt or passed custom lyrics.
        const trebloPayload = {
          prompt,
          instrumental: isInstrumental,
          enable_streaming: true,
          stream_format: "mp3",
          ...(lyrics ? { lyrics } : {}),
        };

        const upstreamRes = await fetch("https://api.treblo.com/v1/generations/v3", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${trebloKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(trebloPayload),
        });

        if (!upstreamRes.ok) {
          const errData = await upstreamRes.json().catch(() => ({}));
          const errMsg = typeof errData?.detail === "object" ? errData.detail?.message : (errData?.detail || errData?.message || `Music generation failed (HTTP ${upstreamRes.status})`);
          return jsonResponse({
            error: "music_generation_failed",
            message: errMsg,
          }, upstreamRes.status, requestOrigin);
        }

        const data = await upstreamRes.json().catch(() => ({}));
        const taskId = data?.task_id || data?.id;
        if (!taskId) {
          return jsonResponse({ error: "invalid_upstream_response", message: "No task_id returned from music provider." }, 502, requestOrigin);
        }

        // Return immediately with task ID so client can poll with real-time UI progress updates
        return jsonResponse({
          id: taskId,
          model: "LingoFusion Music",
          upstream_model: "treblo_v3",
          status: "processing",
          task_id: taskId,
          duration_seconds: durationSeconds,
          prompt,
          message: "Music generation in progress. Check status with task ID.",
        }, 200, requestOrigin);
      }

      // 4d-2. Music Generation Status Polling
      if (request.method === "GET" && (path === "/api/playground/music" || path === "/v1/music" || path.startsWith("/v1/music/"))) {
        const trebloKey = env.TREBLO_API_KEY || env.VOICE_API_KEY;
        if (!trebloKey) {
          return jsonResponse({ error: "music_provider_not_configured", message: "TREBLO_API_KEY secret is not set on Worker." }, 503, requestOrigin);
        }

        const taskId = url.searchParams.get("id") || url.searchParams.get("task_id") || path.split("/").pop();
        if (!taskId || taskId === "music") {
          return jsonResponse({ error: "missing_task_id", message: "Task ID is required." }, 400, requestOrigin);
        }

        const pollRes = await fetch(`https://api.treblo.com/v1/generations/${taskId}`, {
          headers: {
            "Authorization": `Bearer ${trebloKey}`,
          },
        });

        if (!pollRes.ok) {
          return jsonResponse({ error: "task_not_found", message: "Generation task not found." }, pollRes.status, requestOrigin);
        }

        const pollData = await pollRes.json();
        if (pollData.status === "SUCCESS" && Array.isArray(pollData.song_paths) && pollData.song_paths.length > 0) {
          return jsonResponse({
            id: taskId,
            model: "LingoFusion Music",
            upstream_model: "treblo_v3",
            status: "completed",
            audio_url: pollData.song_paths[0],
            is_streaming: false,
            prompt: pollData.prompt,
            tags: pollData.tags,
          }, 200, requestOrigin);
        } else if (pollData.status === "GENERATING_STREAMING_READY") {
          return jsonResponse({
            id: taskId,
            model: "LingoFusion Music",
            upstream_model: "treblo_v3",
            status: "streaming",
            is_streaming: true,
            audio_url: `https://api-stream.treblo.com/stream/${taskId}`,
            stream_url: `https://api-stream.treblo.com/stream/${taskId}`,
            prompt: pollData.prompt,
            tags: pollData.tags,
            message: "Live stream ready. Audio is listenable while generating.",
          }, 200, requestOrigin);
        } else if (pollData.status === "FAILURE") {
          return jsonResponse({
            id: taskId,
            status: "failed",
            error: pollData.error_message || "Music generation failed upstream.",
          }, 500, requestOrigin);
        }

        return jsonResponse({
          id: taskId,
          status: "processing",
          upstream_status: pollData.status,
          message: "Generation still in progress.",
        }, 200, requestOrigin);
      }

      // 4e. Dubbing Proxy (server-side only using env.VOICE_API_KEY / Dubbing v2)
      if (["POST", "GET"].includes(request.method) && ["/api/playground/dubbing", "/v1/dubbing"].includes(path)) {
        try {
          const body = request.method === "POST" ? await request.json() : Object.fromEntries(url.searchParams);
          return jsonResponse(await dubbingRequest(request.method, body, env.VOICE_API_KEY), 200, requestOrigin);
        } catch (error) {
          return jsonResponse({ message: error.message || "Dubbing failed." }, 400, requestOrigin);
        }
      }

      // 5. OAuth: public client config (client IDs are public identifiers)
      if (request.method === "GET" && path === "/api/auth/config") {
        return jsonResponse({
          googleClientId: env.GOOGLE_CLIENT_ID || "",
          appleClientId: env.APPLE_CLIENT_ID || "",
        }, 200, requestOrigin);
      }

      // 6. OAuth: exchange a Google ID token for a LingoFusion session
      if (request.method === "POST" && path === "/api/auth/google") {
        if (!env.GOOGLE_CLIENT_ID || !env.SESSION_SECRET) {
          return jsonResponse({ error: "google_not_configured", message: "Google sign-in is not configured on the gateway yet." }, 503, requestOrigin);
        }
        const body = await request.json().catch(() => ({}));
        try {
          const identity = await verifyGoogleIdToken(String(body.credential || ""), env.GOOGLE_CLIENT_ID);
          return jsonResponse(await issueSession(env, "google", identity), 200, requestOrigin);
        } catch (err) {
          return jsonResponse({ error: "google_auth_failed", message: err.message }, 401, requestOrigin);
        }
      }

      // 7. OAuth: exchange an Apple ID token for a LingoFusion session
      if (request.method === "POST" && path === "/api/auth/apple") {
        if (!env.APPLE_CLIENT_ID || !env.SESSION_SECRET) {
          return jsonResponse({ error: "apple_not_configured", message: "Apple sign-in is not configured on the gateway yet." }, 503, requestOrigin);
        }
        const body = await request.json().catch(() => ({}));
        try {
          const identity = await verifyAppleIdToken(String(body.id_token || ""), env.APPLE_CLIENT_ID);
          // Apple only sends the user's name on the very first authorization.
          const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : undefined;
          return jsonResponse(await issueSession(env, "apple", identity, name), 200, requestOrigin);
        } catch (err) {
          return jsonResponse({ error: "apple_auth_failed", message: err.message }, 401, requestOrigin);
        }
      }

      // 8. OAuth: validate an existing session
      if (request.method === "GET" && path === "/api/auth/me") {
        if (!env.SESSION_SECRET) return jsonResponse({ error: "not_configured" }, 503, requestOrigin);
        const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
        const session = await verifySession(token, env.SESSION_SECRET).catch(() => null);
        if (!session) return jsonResponse({ error: "invalid_session" }, 401, requestOrigin);
        let balanceUsd = 0;
        if (env.GIFTS && session.email) {
          const rawBal = await env.GIFTS.get(`user_balance:${session.email.toLowerCase()}`);
          if (rawBal !== null) balanceUsd = Number(rawBal);
        }
        return jsonResponse({
          user: {
            id: session.id,
            provider: session.provider,
            email: session.email,
            name: session.name,
            avatar: session.avatar,
            balance_usd: balanceUsd,
          },
        }, 200, requestOrigin);
      }

      if (["GET", "POST"].includes(request.method) && path === "/api/user/balance") {
        const user = await signedInUser();
        if (!user?.email) return jsonResponse({ error: "sign_in_required" }, 401, requestOrigin);
        const email = user.email.toLowerCase();
        if (request.method === "GET") return jsonResponse(await billingLedger(env, { action: "balance", email }), 200, requestOrigin);
        const body = await request.json().catch(() => ({}));
        if ("balance_usd" in body || typeof body.delta_usd !== "number" || !Number.isFinite(body.delta_usd) || body.delta_usd >= 0) return jsonResponse({ error: "balance_increase_forbidden" }, 403, requestOrigin);
        const operationId = request.headers.get("idempotency-key");
        if (!operationId) return jsonResponse({ error: "idempotency_key_required" }, 400, requestOrigin);
        return jsonResponse(await billingLedger(env, { action: "deduct", email, delta: body.delta_usd, operationId }), 200, requestOrigin);
      }

      // Gifts belong to the verified recipient, never an email supplied by the browser.
      if (request.method === "POST" && ["/api/gifts/check", "/api/gifts/claim"].includes(path)) {
        const user = await signedInUser();
        if (!user?.email) return jsonResponse({ message: "Sign in with the recipient's email address to claim this gift." }, 401, requestOrigin);
        const body = await request.json().catch(() => ({}));
        const email = user.email.toLowerCase();
        if (body.email && String(body.email).trim().toLowerCase() !== email) return jsonResponse({ message: "This gift belongs to a different email address. Sign in with the recipient's account." }, 403, requestOrigin);
        if (!env.GIFTS || !env.GIFT_CLAIMS) return jsonResponse({ message: "Gift storage is not configured." }, 503, requestOrigin);
        if (path === "/api/gifts/check") {
          const gifts = JSON.parse(await env.GIFTS.get(`gifts_for:${email}`) || "[]").filter((gift) => !gift.claimed);
          return jsonResponse({ email, gifts, totalAvailableUsd: Number(gifts.reduce((sum, gift) => sum + Number(gift.amountUsd), 0).toFixed(2)) }, 200, requestOrigin);
        }
        const vault = env.GIFT_CLAIMS.get(env.GIFT_CLAIMS.idFromName(email));
        const response = await vault.fetch("https://gift-claims/claim", { method: "POST", body: JSON.stringify({ email, code: String(body.code || "").trim() }) });
        return jsonResponse(await response.json(), response.status, requestOrigin);
      }

      return jsonResponse({ error: "not_found" }, 404);
    } catch (err) {
      return jsonResponse({ error: "internal_error", message: err?.message || "Gateway error" }, 500);
    }
  },
};
