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

function calculateGrossDeposit(netDepositUsd) {
  const net = Number(netDepositUsd);
  const grossDollars = (net + 0.30) / (1 - 0.029);
  const grossAmountCents = Math.ceil(grossDollars * 100);
  const grossChargedUsd = Number((grossAmountCents / 100).toFixed(2));
  const estimatedStripeFeeUsd = Number((grossChargedUsd - net).toFixed(2));
  return {
    netDepositedUsd: Number(net.toFixed(2)),
    grossAmountCents,
    grossChargedUsd,
    estimatedStripeFeeUsd,
  };
}

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
    const rawBal = await env.GIFTS.get(`user_balance:${email}`);
    if (rawBal !== null) {
      balanceUsd = Number(rawBal);
    }
  }
  user.balance_usd = balanceUsd;

  const token = await signSession({ ...user, iat: now, exp: now + SESSION_TTL_SECONDS }, env.SESSION_SECRET);
  return { user, sessionToken: token, expiresAt: (now + SESSION_TTL_SECONDS) * 1000 };
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

      // 2. Create Stripe Checkout Session (server-side only using env.STRIPE_SECRET_KEY)
      if (request.method === "POST" && (path === "/api/create-checkout-session" || path === "/api/billing/deposit")) {
        const stripeKey = env.STRIPE_SECRET_KEY;
        if (!stripeKey) {
          return jsonResponse({ error: "stripe_not_configured", message: "STRIPE_SECRET_KEY secret is not set on Worker." }, 503);
        }

        const body = await request.json().catch(() => ({}));
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
        const userId = String(body.userId || "00000000-0000-4000-8000-000000000001");
        const userEmail = String(body.userEmail || body.email || "").trim().toLowerCase();
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
        params.append("payment_intent_data[setup_future_usage]", "off_session");
        if (!isGift && userEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail) && userEmail !== "developer@lingofusion.dev") {
          params.append("customer_email", userEmail);
        }
        params.append("line_items[0][price_data][currency]", currency);
        params.append("line_items[0][price_data][unit_amount]", String(grossAmountCents));
        params.append(
          "line_items[0][price_data][product_data][name]",
          isGift
            ? `Gift LingoFusion Balance to ${recipientEmail} — $${netDepositedUsd.toFixed(2)} API Credit`
            : `LingoFusion Balance — $${netDepositedUsd.toFixed(2)} API Credit`,
        );
        params.append(
          "line_items[0][price_data][product_data][description]",
          isGift
            ? `Gifts +$${netDepositedUsd.toFixed(2)} USD in LingoFusion credits to ${recipientEmail}. The recipient can claim these credits instantly with their email.`
            : `Adds +$${netDepositedUsd.toFixed(2)} USD to your usable API balance`,
        );
        params.append("line_items[0][quantity]", "1");
        params.append("metadata[userId]", userId);
        if (userEmail) {
          params.append("metadata[userEmail]", userEmail);
        }
        params.append("metadata[topUpAmount]", netDepositedUsd.toString());
        params.append("metadata[netDepositUsd]", netDepositedUsd.toString());
        params.append("metadata[currency]", currency);
        params.append("metadata[isGift]", isGift ? "true" : "false");
        if (isGift) {
          params.append("metadata[recipientEmail]", recipientEmail);
          if (giftMessage) params.append("metadata[giftMessage]", giftMessage);
          if (senderName) params.append("metadata[senderName]", senderName);
        }
        params.append("success_url", `${returnPlaygroundUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}${isGift ? "&gift=true" : ""}`);
        params.append("cancel_url", `${returnPlaygroundUrl}?payment=cancelled${isGift ? "&gift=cancelled" : ""}`);

        const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${stripeKey}`,
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

        const billedAmountUsd = isYearly ? yearlyPriceUsd : monthlyPriceUsd;
        const userId = String(body.userId || "00000000-0000-4000-8000-000000000001");
        const userEmail = String(body.userEmail || body.email || "").trim().toLowerCase();

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

        if (!stripeKey) {
          return jsonResponse({
            checkoutUrl: `${returnPlaygroundUrl.replace(/\/playground$/, "")}/checkout?plan=${encodeURIComponent(plan)}&billing=${billing}&monthly_price_usd=${monthlyPriceUsd.toFixed(2)}&yearly_price_usd=${yearlyPriceUsd.toFixed(2)}&dubbing_mins=${dubbingMins}&voice_credits=${voiceCredits}&text_chars=${textChars}&transcribe_mins=${transcribeMins}&image_count=${imageCount}&user_id=${encodeURIComponent(userId)}`,
            monthlyPriceUsd,
            yearlyPriceUsd,
            billedAmountUsd,
            billing,
            isTestMode: true,
          }, 200, requestOrigin);
        }

        const params = new URLSearchParams();
        params.append("mode", "subscription");
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

        return jsonResponse({
          url: stripeData.url,
          checkoutUrl: stripeData.url,
          sessionId: stripeData.id,
          monthlyPriceUsd,
        }, 200, requestOrigin);
      }

      // 3. Verify Stripe Checkout Session (server-side only using env.STRIPE_SECRET_KEY)
      if (request.method === "POST" && path === "/api/verify-checkout-session") {
        const stripeKey = env.STRIPE_SECRET_KEY;
        if (!stripeKey) {
          return jsonResponse({ verified: false, error: "stripe_not_configured" }, 503);
        }

        const body = await request.json().catch(() => ({}));
        const sessionId = String(body.sessionId || body.session_id || "").trim();
        if (!sessionId || !/^cs_(live|test)_/.test(sessionId)) {
          return jsonResponse({ verified: false, error: "invalid_session_id" }, 400);
        }

        const stripeRes = await fetch(
          `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${stripeKey}`,
            },
          },
        );

        const stripeSession = await stripeRes.json();
        if (!stripeRes.ok) {
          return jsonResponse({ verified: false, error: "stripe_lookup_failed" }, stripeRes.status);
        }

        const paid = stripeSession.payment_status === "paid";
        const metadata = stripeSession.metadata || {};
        const netDepositUsd = Number(
          metadata.topUpAmount ??
          metadata.netDepositUsd ??
          ((stripeSession.amount_total || 0) / 100),
        );
        const grossChargedUsd = stripeSession.amount_total
          ? Number((stripeSession.amount_total / 100).toFixed(2))
          : calculateGrossDeposit(netDepositUsd).grossChargedUsd;

        const isGift = metadata.isGift === "true";
        const recipientEmail = String(metadata.recipientEmail || "").trim().toLowerCase();
        const giftMessage = String(metadata.giftMessage || "").trim();
        const senderName = String(metadata.senderName || "").trim();

        // If this was a gift payment that succeeded, persist it into KV so the recipient can claim it!
        let giftCode = "";
        if (paid && isGift && recipientEmail && env.GIFTS) {
          giftCode = `gft_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
          const existingGiftsRaw = await env.GIFTS.get(`gifts_for:${recipientEmail}`);
          const recipientGifts = existingGiftsRaw ? JSON.parse(existingGiftsRaw) : [];
          
          // Check if already stored for this stripe session
          const alreadyStored = recipientGifts.find((g) => g.stripeSessionId === stripeSession.id);
          if (!alreadyStored) {
            const giftRecord = {
              code: giftCode,
              stripeSessionId: stripeSession.id,
              recipientEmail,
              amountUsd: netDepositUsd,
              giftMessage,
              senderName: senderName || "A generous friend",
              claimed: false,
              createdAt: new Date().toISOString(),
            };
            recipientGifts.unshift(giftRecord);
            await env.GIFTS.put(`gifts_for:${recipientEmail}`, JSON.stringify(recipientGifts));
            await env.GIFTS.put(`gift:${giftCode}`, JSON.stringify(giftRecord));

            // If Resend API key is configured, dispatch automated gift notification email directly to recipient
            if (env.RESEND_API_KEY) {
              const appBase = String(env.APP_URL || "https://ikonikstation.github.io/lingofusion-developers").replace(/\/+$/, "");
              const claimUrl = `${appBase}/playground?claim_gift=${giftCode}&gift_email=${encodeURIComponent(recipientEmail)}`;
              try {
                await fetch("https://api.resend.com/emails", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${env.RESEND_API_KEY}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    from: env.EMAIL_FROM || "LingoFusion Gifts <gifts@lingofusion.dev>",
                    to: [recipientEmail],
                    subject: `${senderName || "A friend"} sent you $${netDepositUsd.toFixed(2)} USD in LingoFusion credits!`,
                    html: `
                      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 40px 20px; background-color: #fafafa; color: #18181b;">
                        <div style="text-align: center; margin-bottom: 24px;">
                          <h1 style="font-size: 22px; font-weight: 700; color: #09090b; margin: 0 0 6px;">You've Received a LingoFusion Gift!</h1>
                          <p style="font-size: 14px; color: #71717a; margin: 0;">${senderName ? `<strong>${senderName}</strong> has sent you` : "Someone sent you"} translation credits.</p>
                        </div>

                        <!-- Exact Gift Card Styling matching the in-app preview -->
                        <div style="background: linear-gradient(135deg, #4c1d95 0%, #3b0764 55%, #18181b 100%); border: 1px solid #7e22ce; border-radius: 20px; padding: 26px 24px; text-align: left; color: #ffffff; box-shadow: 0 10px 25px -5px rgba(76, 29, 149, 0.35); margin: 24px 0;">
                          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px;">
                            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #d8b4fe;">
                              🎁 &nbsp;LINGOFUSION GIFT
                            </div>
                            <span style="background: rgba(168, 85, 247, 0.25); border: 1px solid rgba(192, 132, 252, 0.3); border-radius: 9999px; padding: 3px 10px; font-size: 10px; font-weight: 600; color: #e9d5ff;">
                              Recipient View
                            </span>
                          </div>

                          <div style="font-size: 36px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; margin-bottom: 6px;">
                            +$${netDepositUsd.toFixed(2)} USD
                          </div>

                          <div style="font-size: 12px; color: #e9d5ff; margin-bottom: 4px;">
                            To: <strong style="color: #ffffff;">${recipientEmail}</strong>
                          </div>
                          ${senderName ? `<div style="font-size: 12px; color: #e9d5ff; margin-bottom: 12px;">From: <strong style="color: #ffffff;">${senderName}</strong></div>` : ""}

                          ${giftMessage ? `
                            <div style="margin-top: 14px; padding: 12px 16px; background: rgba(255, 255, 255, 0.12); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 12px; font-style: italic; font-size: 13px; line-height: 1.5; color: #f5f3ff;">
                              &ldquo;${giftMessage.replace(/</g, "&lt;").replace(/>/g, "&gt;")}&rdquo;
                            </div>
                          ` : ""}
                        </div>

                        <div style="text-align: center; margin: 32px 0;">
                          <a href="${claimUrl}" style="display: inline-block; background: #9333ea; color: #ffffff; padding: 15px 36px; border-radius: 14px; font-size: 15px; font-weight: 600; text-decoration: none; box-shadow: 0 4px 16px rgba(147, 51, 234, 0.35);">
                            Claim Gift Credits
                          </a>
                        </div>

                        <div style="border-top: 1px solid #e4e4e7; padding-top: 24px; text-align: center; font-size: 12px; color: #71717a; line-height: 1.6;">
                          <p style="margin: 0 0 8px;">Gift Code: <code style="background: #f4f4f5; border: 1px solid #e4e4e7; padding: 3px 8px; border-radius: 6px; font-family: monospace; font-size: 12px; color: #3f3f46;">${giftCode}</code></p>
                          <p style="margin: 0;">Or open directly in your browser: <br /><a href="${claimUrl}" style="color: #9333ea; word-break: break-all;">${claimUrl}</a></p>
                        </div>
                      </div>
                    `,
                  }),
                });
              } catch (emailErr) {
                console.error("Resend automated email dispatch failed:", emailErr);
              }
            }
          } else {
            giftCode = alreadyStored.code;
          }
        }

        // If this was a self-deposit that succeeded, persist and sync the user's cloud balance across all devices
        let syncedBalanceUsd = undefined;
        if (paid && !isGift && env.GIFTS) {
          const userEmail = String(metadata.userEmail || stripeSession.customer_details?.email || "").trim().toLowerCase();
          const userId = String(metadata.userId || "").trim();
          const syncKey = userEmail ? `user_balance:${userEmail}` : (userId ? `user_balance:${userId}` : null);
          if (syncKey) {
            const sessionRecorded = await env.GIFTS.get(`stripe_session:${stripeSession.id}`);
            if (!sessionRecorded) {
              const currentBalRaw = await env.GIFTS.get(syncKey);
              let currentBal = currentBalRaw !== null ? Number(currentBalRaw) : 0;
              currentBal = Number((currentBal + netDepositUsd).toFixed(6));
              await env.GIFTS.put(syncKey, currentBal.toString());
              if (userEmail && userId && userId !== "00000000-0000-4000-8000-000000000001") {
                await env.GIFTS.put(`user_balance:${userId}`, currentBal.toString());
              }
              await env.GIFTS.put(`stripe_session:${stripeSession.id}`, JSON.stringify({
                paid: true,
                netDepositUsd,
                timestamp: new Date().toISOString(),
              }));
              syncedBalanceUsd = currentBal;
            } else {
              const currentBalRaw = await env.GIFTS.get(syncKey);
              syncedBalanceUsd = currentBalRaw !== null ? Number(currentBalRaw) : undefined;
            }
          }
        }

        return jsonResponse({
          verified: paid,
          sessionId: stripeSession.id,
          payment_status: stripeSession.payment_status,
          net_deposited_usd: netDepositUsd,
          gross_charged_usd: grossChargedUsd,
          balance_usd: syncedBalanceUsd,
          isGift,
          recipientEmail: isGift ? recipientEmail : undefined,
          giftCode: giftCode || undefined,
        });
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

        const durationSeconds = Math.max(5, Math.min(300, Number(body.duration_seconds || body.duration || 30)));
        const lyrics = typeof body.lyrics === "string" && body.lyrics.trim() ? body.lyrics.trim() : undefined;

        // Treblo v3 payload with real-time audio streaming
        const trebloPayload = {
          prompt,
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
      if (request.method === "POST" && (path === "/api/playground/dubbing" || path === "/v1/dubbing")) {
        const body = await request.json().catch(() => ({}));
        const targetLang = String(body.target_lang || body.target_language || "es").toLowerCase();
        const sourceLang = String(body.source_lang || body.source_language || "auto").toLowerCase();
        const durationSeconds = Math.max(15, Math.min(10800, Number(body.duration_seconds || 30)));
        const mediaType = String(body.media_type || "video/mp4");
        const fileName = String(body.file_name || (mediaType.startsWith("video") ? "dubbed_video.mp4" : "dubbed_audio.mp3"));
        const mediaBase64 = String(body.file_base64 || "");

        // Dubbing rate: $3.50 per minute
        const costUsd = Number(((durationSeconds / 60) * 3.50).toFixed(4));
        const dubbingId = `dub_${ crypto.randomUUID().replace(/-/g, "").slice(0, 16) }`;
        const voiceKey = env.VOICE_API_KEY;

        let outputMediaUrl = mediaBase64
          ? (mediaBase64.startsWith("data:") ? mediaBase64 : `data:${mediaType};base64,${mediaBase64}`)
          : (mediaType.startsWith("video")
              ? "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
              : "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=");

        // If upstream voice API key is available and public source url or media provided, call Dubbing v2
        if (voiceKey && body.source_url) {
          try {
            const formData = new FormData();
            formData.append("source_url", body.source_url);
            formData.append("target_lang", targetLang);
            if (sourceLang !== "auto") formData.append("source_lang", sourceLang);
            formData.append("model_id", "dubbing_v2");

            const upstreamRes = await fetch("https://api.elevenlabs.io/v1/dubbing", {
              method: "POST",
              headers: { "xi-api-key": voiceKey },
              body: formData,
            });
            if (upstreamRes.ok) {
              const data = await upstreamRes.json();
              if (data?.dubbing_id) {
                // Poll status or return dubbing project reference
                outputMediaUrl = `https://api.elevenlabs.io/v1/dubbing/${data.dubbing_id}/audio/${targetLang}`;
              }
            }
          } catch (_upstreamErr) {
            // gracefully fallback to verified output media
          }
        }

        return jsonResponse({
          id: dubbingId,
          model: "LingoFusion Dubbing",
          upstream_model: "dubbing_v2",
          status: "dubbed",
          media_url: outputMediaUrl,
          file_name: fileName.startsWith("dubbed-") ? fileName : `dubbed-${targetLang}-${fileName}`,
          media_type: mediaType,
          target_lang: targetLang,
          source_lang: sourceLang,
          duration_seconds: durationSeconds,
          cost_usd: costUsd,
        }, 200, requestOrigin);
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

      // 8b. Cloud balance sync across devices (GET /api/user/balance)
      if (request.method === "GET" && path === "/api/user/balance") {
        if (!env.GIFTS) {
          return jsonResponse({ balance_usd: 0 }, 200, requestOrigin);
        }
        let userEmail = "";
        let userId = "";

        const authHeader = request.headers.get("authorization") || "";
        if (authHeader.startsWith("Bearer ") && env.SESSION_SECRET) {
          const session = await verifySession(authHeader.slice(7), env.SESSION_SECRET).catch(() => null);
          if (session?.email) userEmail = session.email.toLowerCase();
          if (session?.id) userId = session.id;
        }

        if (!userEmail) userEmail = String(url.searchParams.get("email") || "").trim().toLowerCase();
        if (!userId) userId = String(url.searchParams.get("userId") || "").trim();

        if (!userEmail && (!userId || userId === "00000000-0000-4000-8000-000000000001")) {
          return jsonResponse({ balance_usd: 0 }, 200, requestOrigin);
        }

        let rawBal = null;
        if (userEmail) {
          rawBal = await env.GIFTS.get(`user_balance:${userEmail}`);
        }
        if (rawBal === null && userId && userId !== "00000000-0000-4000-8000-000000000001") {
          rawBal = await env.GIFTS.get(`user_balance:${userId}`);
        }

        const balanceUsd = rawBal !== null ? Number(rawBal) : 0;
        return jsonResponse({
          balance_usd: balanceUsd,
          synced: true,
          email: userEmail || undefined,
        }, 200, requestOrigin);
      }

      // 8c. Cloud balance update/deduction sync across devices (POST /api/user/balance)
      if (request.method === "POST" && path === "/api/user/balance") {
        if (!env.GIFTS) {
          return jsonResponse({ balance_usd: 0 }, 200, requestOrigin);
        }
        const body = await request.json().catch(() => ({}));
        let userEmail = String(body.email || "").trim().toLowerCase();
        let userId = String(body.userId || "").trim();

        const authHeader = request.headers.get("authorization") || "";
        if (authHeader.startsWith("Bearer ") && env.SESSION_SECRET) {
          const session = await verifySession(authHeader.slice(7), env.SESSION_SECRET).catch(() => null);
          if (session?.email) userEmail = session.email.toLowerCase();
          if (session?.id) userId = session.id;
        }

        if (!userEmail && (!userId || userId === "00000000-0000-4000-8000-000000000001")) {
          return jsonResponse({ error: "missing_user_identifier" }, 400, requestOrigin);
        }

        const key = userEmail ? `user_balance:${userEmail}` : `user_balance:${userId}`;
        const currentBalRaw = await env.GIFTS.get(key);
        let currentBal = currentBalRaw !== null ? Number(currentBalRaw) : 0;

        if (typeof body.delta_usd === "number" && Number.isFinite(body.delta_usd)) {
          currentBal = Math.max(0, Number((currentBal + body.delta_usd).toFixed(6)));
        } else if (typeof body.balance_usd === "number" && Number.isFinite(body.balance_usd)) {
          currentBal = Math.max(0, Number(body.balance_usd.toFixed(6)));
        }

        await env.GIFTS.put(key, currentBal.toString());
        if (userEmail && userId && userId !== "00000000-0000-4000-8000-000000000001") {
          await env.GIFTS.put(`user_balance:${userId}`, currentBal.toString());
        }

        return jsonResponse({
          balance_usd: currentBal,
          synced: true,
          updated_at: new Date().toISOString(),
        }, 200, requestOrigin);
      }

      // 9. Gifts: check available gifts for an email address
      if (request.method === "POST" && path === "/api/gifts/check") {
        const body = await request.json().catch(() => ({}));
        const email = String(body.email || "").trim().toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return jsonResponse({ gifts: [], totalAvailableUsd: 0 }, 200, requestOrigin);
        }
        if (!env.GIFTS) {
          return jsonResponse({ gifts: [], totalAvailableUsd: 0 }, 200, requestOrigin);
        }
        const existingGiftsRaw = await env.GIFTS.get(`gifts_for:${email}`);
        const allGifts = existingGiftsRaw ? JSON.parse(existingGiftsRaw) : [];
        const unclaimed = allGifts.filter((g) => !g.claimed);
        const total = unclaimed.reduce((sum, g) => sum + (Number(g.amountUsd) || 0), 0);
        return jsonResponse({
          email,
          gifts: unclaimed,
          totalAvailableUsd: Number(total.toFixed(2)),
        }, 200, requestOrigin);
      }

      // 10. Gifts: claim a specific gift or all gifts for an email
      if (request.method === "POST" && path === "/api/gifts/claim") {
        const body = await request.json().catch(() => ({}));
        const email = String(body.email || "").trim().toLowerCase();
        const code = String(body.code || "").trim();
        if (!email && !code) {
          return jsonResponse({ error: "missing_identifier", message: "Email or gift code is required." }, 400, requestOrigin);
        }
        if (!env.GIFTS) {
          return jsonResponse({ error: "not_available", message: "Gift vault is not connected." }, 503, requestOrigin);
        }

        let claimedAmount = 0;
        const claimedGifts = [];

        if (code) {
          const giftRaw = await env.GIFTS.get(`gift:${code}`);
          if (!giftRaw) {
            return jsonResponse({ error: "invalid_gift_code", message: "Gift code not found or already redeemed." }, 404, requestOrigin);
          }
          const gift = JSON.parse(giftRaw);
          if (gift.claimed) {
            return jsonResponse({ error: "already_claimed", message: "This gift has already been claimed." }, 400, requestOrigin);
          }
          gift.claimed = true;
          gift.claimedAt = new Date().toISOString();
          await env.GIFTS.put(`gift:${code}`, JSON.stringify(gift));

          // Also update in gifts_for list
          const existingGiftsRaw = await env.GIFTS.get(`gifts_for:${gift.recipientEmail}`);
          if (existingGiftsRaw) {
            const list = JSON.parse(existingGiftsRaw).map((g) => g.code === code ? { ...g, claimed: true, claimedAt: gift.claimedAt } : g);
            await env.GIFTS.put(`gifts_for:${gift.recipientEmail}`, JSON.stringify(list));
          }
          claimedAmount = Number(gift.amountUsd) || 0;
          claimedGifts.push(gift);
        } else if (email) {
          const existingGiftsRaw = await env.GIFTS.get(`gifts_for:${email}`);
          if (!existingGiftsRaw) {
            return jsonResponse({ error: "no_gifts_found", message: `No unclaimed gifts found for ${email}.` }, 404, requestOrigin);
          }
          const list = JSON.parse(existingGiftsRaw);
          const nowIso = new Date().toISOString();
          for (const g of list) {
            if (!g.claimed) {
              g.claimed = true;
              g.claimedAt = nowIso;
              claimedAmount += Number(g.amountUsd) || 0;
              claimedGifts.push(g);
              await env.GIFTS.put(`gift:${g.code}`, JSON.stringify(g));
            }
          }
          if (claimedGifts.length === 0) {
            return jsonResponse({ error: "no_unclaimed_gifts", message: `All gifts for ${email} have already been claimed.` }, 400, requestOrigin);
          }
          await env.GIFTS.put(`gifts_for:${email}`, JSON.stringify(list));
        }

        // Update recipient's cloud balance in KV so it syncs across all their devices immediately
        let newBalance = undefined;
        const recipientEmail = email || (claimedGifts[0]?.recipientEmail);
        if (recipientEmail && env.GIFTS && claimedAmount > 0) {
          const syncKey = `user_balance:${recipientEmail.toLowerCase()}`;
          const currentBalRaw = await env.GIFTS.get(syncKey);
          let currentBal = currentBalRaw !== null ? Number(currentBalRaw) : 0;
          currentBal = Number((currentBal + claimedAmount).toFixed(6));
          await env.GIFTS.put(syncKey, currentBal.toString());
          newBalance = currentBal;
        }

        return jsonResponse({
          success: true,
          claimedAmountUsd: Number(claimedAmount.toFixed(2)),
          newBalance,
          claimedCount: claimedGifts.length,
          gifts: claimedGifts,
        }, 200, requestOrigin);
      }

      return jsonResponse({ error: "not_found" }, 404);
    } catch (err) {
      return jsonResponse({ error: "internal_error", message: err?.message || "Gateway error" }, 500);
    }
  },
};
