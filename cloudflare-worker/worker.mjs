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
  const user = {
    id: `usr_${provider}_${identity.sub}`,
    provider,
    email: String(identity.email).toLowerCase(),
    name: nameOverride || identity.name || String(identity.email).split("@")[0],
    avatar: identity.picture || null,
  };
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
        const returnPlaygroundUrl = String(
          body.returnUrl || env.APP_URL || "https://ikonikstation.github.io/lingofusion-developers/playground"
        ).replace(/\/+$/, "");

        const params = new URLSearchParams();
        params.append("mode", "payment");
        params.append("payment_intent_data[setup_future_usage]", "off_session");
        params.append("line_items[0][price_data][currency]", currency);
        params.append("line_items[0][price_data][unit_amount]", String(grossAmountCents));
        params.append(
          "line_items[0][price_data][product_data][name]",
          `LingoFusion Credits — $${netDepositedUsd.toFixed(2)} USD`,
        );
        params.append(
          "line_items[0][price_data][product_data][description]",
          `Adds +$${netDepositedUsd.toFixed(2)} USD to your LingoFusion balance (includes $${estimatedStripeFeeUsd.toFixed(2)} processing fee)`,
        );
        params.append("line_items[0][quantity]", "1");
        params.append("metadata[userId]", userId);
        params.append("metadata[topUpAmount]", netDepositedUsd.toString());
        params.append("metadata[netDepositUsd]", netDepositedUsd.toString());
        params.append("metadata[currency]", currency);
        params.append("success_url", `${returnPlaygroundUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`);
        params.append("cancel_url", `${returnPlaygroundUrl}?payment=cancelled`);

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

        return jsonResponse({
          verified: paid,
          sessionId: stripeSession.id,
          payment_status: stripeSession.payment_status,
          net_deposited_usd: netDepositUsd,
          gross_charged_usd: grossChargedUsd,
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

      // 4b. Chat / Text Translation Proxy (server-side only using env.OPENAI_API_KEY)
      if (request.method === "POST" && (path === "/api/playground/chat" || path === "/v1/chat/completions")) {
        const openaiKey = env.OPENAI_API_KEY;
        if (!openaiKey) {
          return jsonResponse({ error: "translation_provider_not_configured", message: "OPENAI_API_KEY secret is not set on Worker." }, 503, requestOrigin);
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

      // 4c. Image Translation / Edits Proxy (server-side only using env.OPENAI_API_KEY)
      if (request.method === "POST" && (path === "/api/playground/image" || path === "/v1/images/edits")) {
        const openaiKey = env.OPENAI_API_KEY;
        if (!openaiKey) {
          return jsonResponse({ error: "image_provider_not_configured", message: "OPENAI_API_KEY secret is not set on Worker." }, 503, requestOrigin);
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

      // 4d. Music Generation Proxy (server-side only using env.VOICE_API_KEY / ElevenLabs Music v2)
      if (request.method === "POST" && (path === "/api/playground/music" || path === "/v1/music")) {
        const voiceKey = env.VOICE_API_KEY;
        if (!voiceKey) {
          return jsonResponse({ error: "music_provider_not_configured", message: "VOICE_API_KEY secret is not set on Worker." }, 503, requestOrigin);
        }

        const body = await request.json().catch(() => ({}));
        const prompt = String(body.prompt || body.input || body.text || "").trim();
        if (!prompt) {
          return jsonResponse({ error: "missing_prompt", message: "Music prompt is required." }, 400, requestOrigin);
        }

        const durationSeconds = Math.max(5, Math.min(300, Number(body.duration_seconds || body.duration || 30)));
        const musicLengthMs = Math.round(durationSeconds * 1000);
        const modelId = "music_v2";

        const upstreamRes = await fetch("https://api.elevenlabs.io/v1/music", {
          method: "POST",
          headers: {
            "xi-api-key": voiceKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            prompt,
            model_id: modelId,
            music_length_ms: musicLengthMs,
            force_instrumental: Boolean(body.force_instrumental ?? false),
          }),
        });

        if (!upstreamRes.ok) {
          const errData = await upstreamRes.json().catch(() => ({}));
          return jsonResponse({
            error: "music_generation_failed",
            message: errData?.detail?.message || errData?.message || `Music generation failed (HTTP ${upstreamRes.status})`,
          }, upstreamRes.status, requestOrigin);
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
          id: `music_${ crypto.randomUUID().replace(/-/g, "").slice(0, 16) }`,
          model: "LingoFusion Music",
          upstream_model: "music_v2",
          status: "completed",
          audio_url: `data:audio/mpeg;base64,${base64}`,
          duration_seconds: durationSeconds,
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
        return jsonResponse({ user: { id: session.id, provider: session.provider, email: session.email, name: session.name, avatar: session.avatar } }, 200, requestOrigin);
      }

      return jsonResponse({ error: "not_found" }, 404);
    } catch (err) {
      return jsonResponse({ error: "internal_error", message: err?.message || "Gateway error" }, 500);
    }
  },
};
