import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { calculateGrossDepositCents, calculateTokenCostUsd } from "../server.mjs";

const TEST_PORT = 8799;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

async function runTests() {
  console.log("=== 1. Testing Unit Formulas (Stripe Gross-Up & Token Pricing Engine) ===");

  // Example from specification:
  // Model Price: $2.00 / 1M input, $8.00 / 1M output
  // Prompt tokens: 1,500, Completion tokens: 400
  // Prompt cost = $0.003000, Output cost = $0.003200, Total = $0.006200
  const exampleCost = calculateTokenCostUsd(1500, 400, 2.0, 8.0);
  assert.equal(exampleCost, 0.0062, "Token cost calculator must match exact example ($0.006200)");
  console.log("✓ Token cost formula verified: 1500 in @ $2/1M + 400 out @ $8/1M = $" + exampleCost.toFixed(6));

  // Stripe Gross-Up Formula:
  // Gross (in dollars) = (NetDeposit + 0.30) / (1 - 0.029)
  // Convert to integer cents using Math.ceil(Gross * 100)
  const deposit5 = calculateGrossDepositCents(5.0);
  // (5 + 0.30) / 0.971 = 5.458290422... -> Math.ceil(545.829...) = 546 cents ($5.46)
  assert.equal(deposit5.grossAmountCents, 546, "Gross cents for $5.00 net deposit must be 546 cents");
  assert.equal(deposit5.grossChargedUsd, 5.46);
  console.log(`✓ Stripe fee gross-up verified: $5.00 net -> ${deposit5.grossAmountCents} cents ($${deposit5.grossChargedUsd})`);

  console.log("\n=== 2. Starting API Server for End-to-End Integration Tests ===");
  const serverProc = spawn("node", ["server.mjs"], {
    env: {
      ...process.env,
      LINGOFUSION_API_PORT: String(TEST_PORT),
      LINGOFUSION_REAL_MODELS: "false",
      STRIPE_WEBHOOK_SECRET: "whsec_test_secret_123",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Server startup timed out")), 5000);
    serverProc.stdout.on("data", (chunk) => {
      if (String(chunk).includes("listening")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    serverProc.on("error", reject);
  });

  try {
    // Reset test data first
    await fetch(`${BASE_URL}/api/billing/reset-local-data`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: "RESET_LOCAL_TEST_DATA" }),
    });

    // Verify GET /v1/models
    const modelsRes = await fetch(`${BASE_URL}/v1/models`);
    assert.equal(modelsRes.status, 200);
    const modelsPayload = await modelsRes.json();
    assert.equal(modelsPayload.object, "list");
    assert.ok(Array.isArray(modelsPayload.data) && modelsPayload.data.length >= 3);
    const gpt4o = modelsPayload.data.find((m) => m.model_id === "gpt-4o");
    assert.ok(gpt4o, "gpt-4o must be in model_pricing");
    console.log(`✓ GET /v1/models returned ${modelsPayload.data.length} active models with per-1M pricing`);

    // Create an API key
    const createKeyRes = await fetch(`${BASE_URL}/api/keys`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "E2E Test Key" }),
    });
    assert.equal(createKeyRes.status, 201);
    const keyData = await createKeyRes.json();
    const apiKeySecret = keyData.secret;
    assert.ok(apiKeySecret.startsWith("sk_live_"), "Generated key should have sk_live_ prefix");
    console.log(`✓ Created API key with prefix ${keyData.key_prefix}`);

    // Verify HTTP 402 Insufficient Balance when balance_usd == 0
    const zeroBalRes = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKeySecret}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
      }),
    });
    assert.equal(zeroBalRes.status, 402, "Should return HTTP 402 when balance_usd <= 0");
    const zeroBalJson = await zeroBalRes.json();
    assert.deepEqual(zeroBalJson, {
      error: {
        message: "Insufficient balance. Please deposit credits.",
        type: "insufficient_quota",
        code: "insufficient_quota",
      },
    });
    console.log("✓ Pre-check 402 insufficient_quota response matches exact specification");

    // Verify Deposit minimum $5.00 enforcement
    const lowDepositRes = await fetch(`${BASE_URL}/api/billing/deposit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ depositAmount: 3.0 }),
    });
    assert.equal(lowDepositRes.status, 400, "Deposit under $5.00 must be rejected");

    // Valid Deposit $5.00
    const depositRes = await fetch(`${BASE_URL}/api/billing/deposit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ depositAmount: 5.0 }),
    });
    assert.equal(depositRes.status, 200);
    const depositData = await depositRes.json();
    assert.ok(depositData.checkoutUrl, "Must return checkoutUrl");
    assert.equal(depositData.grossAmountCents, 546);
    assert.equal(depositData.metadata.netDepositUsd, "5");
    console.log(`✓ POST /api/billing/deposit returned checkoutUrl and grossAmountCents=${depositData.grossAmountCents}`);

    // Test Stripe Webhook with signature verification
    const webhookEventPayload = JSON.stringify({
      id: "evt_test_001",
      type: "checkout.session.completed",
      data: {
        object: {
          id: depositData.sessionId,
          amount_total: depositData.grossAmountCents,
          metadata: depositData.metadata,
        },
      },
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", "whsec_test_secret_123")
      .update(`${timestamp}.${webhookEventPayload}`, "utf8")
      .digest("hex");

    const webhookRes = await fetch(`${BASE_URL}/api/webhooks/stripe`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": `t=${timestamp},v1=${signature}`,
      },
      body: webhookEventPayload,
    });
    assert.equal(webhookRes.status, 200);
    const webhookData = await webhookRes.json();
    assert.equal(webhookData.balance_usd, 5.0, "User balance must be credited exact net deposit ($5.00)");
    console.log(`✓ POST /api/webhooks/stripe verified signature, credited $5.00 net, recorded deposit_ledger`);

    // Test Direct API Proxy (/v1/chat/completions) non-streaming
    const chatRes = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKeySecret}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello!" }],
        stream: false,
      }),
    });
    assert.equal(chatRes.status, 200);
    const chatData = await chatRes.json();
    assert.equal(chatData.object, "chat.completion");
    assert.ok(chatData.usage.prompt_tokens > 0);
    assert.ok(chatData.usage.completion_tokens > 0);
    assert.ok(chatData.usage.cost_usd > 0);
    assert.equal(
      Number((5.0 - chatData.usage.cost_usd).toFixed(6)),
      chatData.usage.balance_usd,
      "Balance must be atomically deducted by exact cost_usd",
    );
    console.log(
      `✓ POST /v1/chat/completions (non-stream) billed $${chatData.usage.cost_usd.toFixed(6)}, new balance: $${chatData.usage.balance_usd.toFixed(6)}`,
    );

    // Test Direct API Proxy (/v1/chat/completions) streaming SSE
    const streamRes = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKeySecret}`,
      },
      body: JSON.stringify({
        model: "claude-sonnet-4",
        messages: [{ role: "user", content: "Stream test" }],
        stream: true,
      }),
    });
    assert.equal(streamRes.status, 200);
    assert.ok(streamRes.headers.get("content-type")?.includes("text/event-stream"));
    const streamText = await streamRes.text();
    assert.ok(streamText.includes("data: [DONE]"), "SSE stream must end with data: [DONE]");
    assert.ok(streamText.includes('"usage"'), "SSE stream must include final usage chunk");
    console.log("✓ POST /v1/chat/completions (stream: true) streamed SSE chunks and final usage chunk");

    // Test Aborted Streaming Call (client disconnects early -> captures partial tokens & deducts)
    const beforeAbortDash = await (await fetch(`${BASE_URL}/api/dashboard`)).json();
    const balanceBeforeAbort = beforeAbortDash.user.balance_usd;
    const ledgerCountBeforeAbort = beforeAbortDash.usageLedger.length;

    const abortController = new AbortController();
    const abortStreamRes = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKeySecret}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Write a detailed paragraph about distributed systems" }],
        stream: true,
        stream_delay_ms: 40,
      }),
      signal: abortController.signal,
    });

    const reader = abortStreamRes.body.getReader();
    // Read 2 chunks then abort early
    await reader.read();
    await reader.read();
    abortController.abort();

    // Wait briefly for server close handler to finalize atomic deduction
    await new Promise((r) => setTimeout(r, 150));

    const afterAbortDash = await (await fetch(`${BASE_URL}/api/dashboard`)).json();
    assert.equal(
      afterAbortDash.usageLedger.length,
      ledgerCountBeforeAbort + 1,
      "Aborted stream must record partial token usage in usage_ledger",
    );
    assert.ok(
      afterAbortDash.user.balance_usd < balanceBeforeAbort,
      "Aborted stream must deduct partial cost from user balance",
    );
    console.log(
      `✓ Aborted stream handled: captured ${afterAbortDash.usageLedger[0].completion_tokens} partial completion tokens and deducted $${afterAbortDash.usageLedger[0].cost_usd.toFixed(6)}`,
    );

    // Test Playground Session Endpoint (/api/playground/chat)
    const pgRes = await fetch(`${BASE_URL}/api/playground/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b",
        messages: [
          { role: "system", content: "Be concise." },
          { role: "user", content: "Hello playground!" },
        ],
        stream: false,
      }),
    });
    assert.equal(pgRes.status, 200);
    const pgData = await pgRes.json();
    assert.equal(pgData.model, "llama-3.3-70b");

    const finalDash = await (await fetch(`${BASE_URL}/api/dashboard`)).json();
    assert.equal(finalDash.usageLedger[0].source, "playground");
    assert.equal(finalDash.usageLedger[0].api_key_id, null);
    console.log("✓ POST /api/playground/chat logged source='playground' with api_key_id=null");

    console.log("\nALL TESTS PASSED SUCCESSFULLY!");
  } finally {
    serverProc.kill("SIGTERM");
  }
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
