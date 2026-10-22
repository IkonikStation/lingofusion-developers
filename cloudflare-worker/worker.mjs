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

      if ((path.startsWith("/api/playground") || path.startsWith("/v1/audio/speech")) && isDirectBotRequest) {
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

      return jsonResponse({ error: "not_found" }, 404);
    } catch (err) {
      return jsonResponse({ error: "internal_error", message: err?.message || "Gateway error" }, 500);
    }
  },
};
