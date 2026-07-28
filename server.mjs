import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));
const dbPath = join(rootDir, "data", "api-platform.json");
const port = Number(process.env.LINGOFUSION_API_PORT || 8787);
const MICRO_CENTS_PER_DOLLAR = 100_000_000;

const textModels = [
  { model: "LingoFusion Nano", input: 0.15, output: 0.70 },
  { model: "LingoFusion Lite", input: 0.75, output: 3.00 },
  { model: "LingoFusion", input: 3.50, output: 20.00 },
  { model: "LingoFusion Pro", input: 4.00, output: 25.00 },
  { model: "ExplainFusion", input: 2.00, output: 10.00 },
  { model: "LingoFusion Ultra", input: 25.00, output: 150.00 },
];

const batchTextModels = [
  { model: "LingoFusion Nano", input: 0.08, output: 0.35 },
  { model: "LingoFusion Lite", input: 0.40, output: 1.50 },
  { model: "LingoFusion", input: 1.75, output: 10.00 },
  { model: "LingoFusion Pro", input: 2.00, output: 12.50 },
  { model: "ExplainFusion", input: 2.00, output: 12.50 },
  { model: "LingoFusion Ultra", input: 20.00, output: 120.00 },
];

const musicModels = [
  { model: "Aurora Music V1", pricePerMinute: 0.60 },
  { model: "Aurora Music V2", pricePerMinute: 0.99 },
];

const defaultDb = {
  account: {
    paidBalanceMicroCents: 0,
    rewardBalanceMicroCents: 0,
    pendingChargesMicroCents: 0,
    lifetimeSpendMicroCents: 0,
    totalPaidCreditPurchasedMicroCents: 0,
    totalRewardCreditEarnedMicroCents: 0,
  },
  autoRecharge: {
    enabled: false,
    thresholdMicroCents: dollarsToMicroCents(10),
    amountMicroCents: dollarsToMicroCents(50),
    monthlyLimitMicroCents: dollarsToMicroCents(250),
    notify: true,
    paymentMethod: "Manual invoice",
    lastAttemptAt: null,
  },
  projects: [],
  apiKeys: [],
  ledger: [],
  requestLogs: [],
  idempotency: [],
  jobs: [],
  rewardClaims: [],
};

function dollarsToMicroCents(value) {
  return Math.round(Number(value) * MICRO_CENTS_PER_DOLLAR);
}

function microCentsToDollars(value) {
  return value / MICRO_CENTS_PER_DOLLAR;
}

function nowIso() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

function hashSecret(secret) {
  return createHash("sha256").update(secret).digest("hex");
}

function safeEqualHash(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function createApiSecret() {
  return `lf_live_${randomBytes(24).toString("base64url")}`;
}

function maskSecret(secret) {
  return `${secret.slice(0, 8)}••••••••${secret.slice(-4).toUpperCase()}`;
}

function normalizePricingMode(value) {
  return value === "batch" ? "batch" : "default";
}

function normalizeModelName(value, pricingMode = "default") {
  const normalized = String(value || "").trim().toLowerCase();
  const models = pricingMode === "batch" ? batchTextModels : textModels;
  return models.find((model) => model.model.toLowerCase() === normalized);
}

function centsCostMicro(inputTokens, outputTokens, model) {
  const inputCost = (inputTokens / 1_000_000) * model.input;
  const outputCost = (outputTokens / 1_000_000) * model.output;
  return dollarsToMicroCents(inputCost + outputCost);
}

function normalizeMusicModelName(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return musicModels.find((model) => model.model.toLowerCase() === normalized);
}

function musicCostMicro(durationSeconds, model) {
  return dollarsToMicroCents((durationSeconds / 60) * model.pricePerMinute);
}

function tokenEstimate(text) {
  return Math.max(1, Math.ceil(String(text || "").length / 4));
}

const phraseTranslations = {
  english: {
    french: {
      "hello": "Bonjour",
      "hello, how are you?": "Bonjour, comment allez-vous ?",
      "how are you?": "Comment allez-vous ?",
      "good morning": "Bonjour",
      "thank you": "Merci",
      "thank you very much": "Merci beaucoup",
      "welcome": "Bienvenue",
      "yes": "Oui",
      "no": "Non",
      "goodbye": "Au revoir",
      "i love this": "J’adore ça.",
    },
    spanish: {
      "hello": "Hola",
      "hello, how are you?": "Hola, ¿cómo estás?",
      "how are you?": "¿Cómo estás?",
      "good morning": "Buenos días",
      "thank you": "Gracias",
      "yes": "Sí",
      "no": "No",
      "goodbye": "Adiós",
    },
    german: {
      "hello": "Hallo",
      "hello, how are you?": "Hallo, wie geht es dir?",
      "how are you?": "Wie geht es dir?",
      "good morning": "Guten Morgen",
      "thank you": "Danke",
      "yes": "Ja",
      "no": "Nein",
      "goodbye": "Auf Wiedersehen",
    },
  },
};

function syntheticTranslation(input, fromLanguage, toLanguage) {
  const source = String(input || "").trim();
  const sourceLanguage = String(fromLanguage || "").trim().toLowerCase();
  const targetLanguage = String(toLanguage || "").trim().toLowerCase();
  const normalizedSource = source.toLowerCase().replace(/\s+/g, " ");
  const translated = phraseTranslations[sourceLanguage]?.[targetLanguage]?.[normalizedSource];

  // The local platform only simulates a small, deterministic vocabulary. Returning the
  // original text for unsupported phrases keeps this preview stable and avoids implying a real model ran.
  return translated ?? source;
}

async function loadDb() {
  try {
    const db = JSON.parse(await readFile(dbPath, "utf8"));
    let migrated = false;

    for (const key of db.apiKeys ?? []) {
      if (key.scopes?.includes("Text translation") && !key.scopes.includes("Music generation")) {
        key.scopes.push("Music generation");
        migrated = true;
      }
    }

    if (migrated) await saveDb(db);
    return db;
  } catch {
    await saveDb(defaultDb);
    return structuredClone(defaultDb);
  }
}

async function saveDb(db) {
  await mkdir(dirname(dbPath), { recursive: true });
  const tmpPath = `${dbPath}.tmp`;
  await writeFile(tmpPath, JSON.stringify(db, null, 2));
  await rename(tmpPath, dbPath);
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type, authorization, idempotency-key",
  });
  res.end(JSON.stringify(body));
}

function publicDashboard(db) {
  const usage = db.requestLogs.reduce(
    (acc, log) => {
      acc.totalRequests += 1;
      acc.successfulRequests += log.status < 400 ? 1 : 0;
      acc.failedRequests += log.status >= 400 ? 1 : 0;
      acc.inputTokens += log.inputTokens || 0;
      acc.outputTokens += log.outputTokens || 0;
      acc.words += log.words || 0;
      acc.streamingRequests += log.streaming ? 1 : 0;
      acc.nonStreamingRequests += log.streaming ? 0 : 1;
      acc.totalSpendMicroCents += log.costMicroCents || 0;
      acc.totalLatencyMs += log.latencyMs || 0;
      return acc;
    },
    {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      inputTokens: 0,
      outputTokens: 0,
      words: 0,
      streamingRequests: 0,
      nonStreamingRequests: 0,
      totalSpendMicroCents: 0,
      totalLatencyMs: 0,
    },
  );

  const averageLatencyMs = usage.totalRequests ? Math.round(usage.totalLatencyMs / usage.totalRequests) : 0;

  return {
    account: {
      paidBalance: microCentsToDollars(db.account.paidBalanceMicroCents),
      rewardBalance: microCentsToDollars(db.account.rewardBalanceMicroCents),
      pendingCharges: microCentsToDollars(db.account.pendingChargesMicroCents),
      lifetimeSpend: microCentsToDollars(db.account.lifetimeSpendMicroCents),
      totalPaidCreditPurchased: microCentsToDollars(db.account.totalPaidCreditPurchasedMicroCents),
      totalRewardCreditEarned: microCentsToDollars(db.account.totalRewardCreditEarnedMicroCents),
    },
    autoRecharge: {
      enabled: db.autoRecharge.enabled,
      threshold: microCentsToDollars(db.autoRecharge.thresholdMicroCents),
      amount: microCentsToDollars(db.autoRecharge.amountMicroCents),
      monthlyLimit: microCentsToDollars(db.autoRecharge.monthlyLimitMicroCents),
      notify: db.autoRecharge.notify,
      paymentMethod: db.autoRecharge.paymentMethod,
      lastAttemptAt: db.autoRecharge.lastAttemptAt,
    },
    projects: db.projects,
    apiKeys: db.apiKeys.map(({ keyHash, ...key }) => key),
    ledger: db.ledger.map((entry) => ({
      ...entry,
      amount: microCentsToDollars(entry.amountMicroCents),
    })),
    requestLogs: db.requestLogs.map((log) => ({
      ...log,
      cost: microCentsToDollars(log.costMicroCents),
    })),
    usage: {
      ...usage,
      totalTokens: usage.inputTokens + usage.outputTokens,
      totalSpend: microCentsToDollars(usage.totalSpendMicroCents),
      averageLatencyMs,
    },
    models: textModels,
  };
}

function requireKey(db, req) {
  const auth = req.headers.authorization || "";
  const [, secret] = auth.match(/^Bearer\s+(.+)$/i) || [];
  if (!secret) return { error: "missing_api_key" };
  const secretHash = hashSecret(secret);
  const key = db.apiKeys.find((item) => item.status === "active" && safeEqualHash(item.keyHash, secretHash));
  if (!key) return { error: "invalid_api_key" };
  const project = db.projects.find((item) => item.id === key.projectId && item.status === "active");
  if (!project) return { error: "project_not_active" };
  return { key, project };
}

function applyCharge(db, amountMicroCents) {
  if (amountMicroCents <= 0) return { paid: 0, reward: 0 };
  const total = db.account.paidBalanceMicroCents + db.account.rewardBalanceMicroCents;
  if (total < amountMicroCents) return null;

  const reward = Math.min(db.account.rewardBalanceMicroCents, amountMicroCents);
  const paid = amountMicroCents - reward;
  db.account.rewardBalanceMicroCents -= reward;
  db.account.paidBalanceMicroCents -= paid;
  db.account.lifetimeSpendMicroCents += paid;
  return { paid, reward };
}

async function route(req, res) {
  if (req.method === "OPTIONS") return send(res, 204, {});
  const url = new URL(req.url, `http://${req.headers.host}`);
  const db = await loadDb();

  try {
    if (req.method === "GET" && url.pathname === "/api/dashboard") {
      return send(res, 200, publicDashboard(db));
    }

    if (req.method === "GET" && url.pathname === "/api/models") {
      return send(res, 200, { models: textModels });
    }

    if (req.method === "POST" && url.pathname === "/api/projects") {
      const body = await parseBody(req);
      if (!String(body.name || "").trim()) return send(res, 400, { error: "project_name_required" });
      const project = {
        id: id("proj"),
        name: String(body.name).trim(),
        description: String(body.description || "").trim(),
        status: "active",
        budgetMicroCents: dollarsToMicroCents(body.budget || 0),
        createdAt: nowIso(),
      };
      db.projects.push(project);
      await saveDb(db);
      return send(res, 201, publicDashboard(db));
    }

    if (req.method === "POST" && url.pathname === "/api/keys") {
      const body = await parseBody(req);
      const project = db.projects.find((item) => item.id === body.projectId && item.status === "active");
      if (!project) return send(res, 400, { error: "active_project_required" });
      if (!String(body.name || "").trim()) return send(res, 400, { error: "key_name_required" });
      const secret = createApiSecret();
      db.apiKeys.push({
        id: id("key"),
        name: String(body.name).trim(),
        projectId: project.id,
        keyHash: hashSecret(secret),
        masked: maskSecret(secret),
        scopes: Array.isArray(body.scopes) && body.scopes.length ? body.scopes : ["Text translation", "Music generation"],
        createdAt: nowIso(),
        expiresAt: body.expiresAt || null,
        spendLimitMicroCents: dollarsToMicroCents(body.spendLimit || 0),
        status: "active",
        allowedOrigins: body.allowedOrigins || "",
        allowedIps: body.allowedIps || "",
      });
      db.ledger.push({
        id: id("audit"),
        type: "api_key_created",
        amountMicroCents: 0,
        description: `Created API key for ${project.name}`,
        createdAt: nowIso(),
      });
      await saveDb(db);
      return send(res, 201, { secret, dashboard: publicDashboard(db) });
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/keys\/[^/]+\/rotate$/)) {
      const keyId = url.pathname.split("/")[3];
      const key = db.apiKeys.find((item) => item.id === keyId && item.status === "active");
      if (!key) return send(res, 404, { error: "key_not_found" });
      const secret = createApiSecret();
      key.keyHash = hashSecret(secret);
      key.masked = maskSecret(secret);
      key.rotatedAt = nowIso();
      db.ledger.push({
        id: id("audit"),
        type: "api_key_rotated",
        amountMicroCents: 0,
        projectId: key.projectId,
        description: `Rotated API key ${key.name}`,
        createdAt: nowIso(),
      });
      await saveDb(db);
      return send(res, 200, { secret, dashboard: publicDashboard(db) });
    }

    if (req.method === "POST" && url.pathname === "/api/billing/recharge") {
      const body = await parseBody(req);
      if (body.confirm !== "ADD_LOCAL_TEST_BALANCE") {
        return send(res, 409, { error: "recharge_confirmation_required" });
      }
      const amount = Number(body.amount);
      if (amount < 5 || amount > 1000) return send(res, 400, { error: "recharge_amount_out_of_range" });
      const amountMicroCents = dollarsToMicroCents(amount);
      db.account.paidBalanceMicroCents += amountMicroCents;
      db.account.totalPaidCreditPurchasedMicroCents += amountMicroCents;
      db.ledger.unshift({
        id: id("rch"),
        type: "paid_credit_purchase",
        amountMicroCents,
        description: "Local test balance purchase",
        status: "succeeded",
        createdAt: nowIso(),
      });
      await saveDb(db);
      return send(res, 200, publicDashboard(db));
    }

    if (req.method === "POST" && url.pathname === "/api/billing/reset-local-data") {
      const body = await parseBody(req);
      if (body.confirm !== "RESET_LOCAL_TEST_DATA") {
        return send(res, 409, { error: "reset_confirmation_required" });
      }

      db.account.paidBalanceMicroCents = 0;
      db.account.rewardBalanceMicroCents = 0;
      db.account.pendingChargesMicroCents = 0;
      db.account.lifetimeSpendMicroCents = 0;
      db.account.totalPaidCreditPurchasedMicroCents = 0;
      db.account.totalRewardCreditEarnedMicroCents = 0;
      db.ledger = [];
      db.requestLogs = [];
      db.idempotency = [];
      db.jobs = [];
      db.rewardClaims = [];
      db.autoRecharge.lastAttemptAt = null;
      await saveDb(db);
      return send(res, 200, publicDashboard(db));
    }

    if (req.method === "POST" && url.pathname === "/api/auto-recharge") {
      const body = await parseBody(req);
      const amount = Number(body.amount);
      const threshold = Number(body.threshold);
      if (amount < 5 || amount > 1000) return send(res, 400, { error: "recharge_amount_out_of_range" });
      if (threshold >= amount) return send(res, 400, { error: "threshold_must_be_lower_than_amount" });
      db.autoRecharge = {
        enabled: Boolean(body.enabled),
        thresholdMicroCents: dollarsToMicroCents(threshold),
        amountMicroCents: dollarsToMicroCents(amount),
        monthlyLimitMicroCents: dollarsToMicroCents(body.monthlyLimit || 0),
        notify: Boolean(body.notify),
        paymentMethod: String(body.paymentMethod || "Manual invoice"),
        lastAttemptAt: db.autoRecharge.lastAttemptAt,
      };
      await saveDb(db);
      return send(res, 200, publicDashboard(db));
    }

    if (req.method === "POST" && url.pathname === "/v1/translate") {
      const started = Date.now();
      const auth = requireKey(db, req);
      const requestId = id("req");
      const body = await parseBody(req);
      const idempotencyKey = req.headers["idempotency-key"];
      const bodyHash = hashSecret(JSON.stringify(body));
      const existingIdempotency = idempotencyKey
        ? db.idempotency.find((item) => item.key === idempotencyKey)
        : null;

      if (existingIdempotency) {
        if (existingIdempotency.bodyHash !== bodyHash) {
          return send(res, 409, { error: "idempotency_key_conflict" });
        }
        return send(res, 200, existingIdempotency.response);
      }

      if (auth.error) {
        return send(res, 401, { error: auth.error, request_id: requestId });
      }
      if (!auth.key.scopes.includes("Text translation")) {
        return send(res, 403, { error: "missing_scope", required_scope: "Text translation", request_id: requestId });
      }

      const pricingMode = normalizePricingMode(body.pricing_mode);
      const model = normalizeModelName(body.model, pricingMode);
      if (!model) return send(res, 400, { error: "unsupported_model", supported_models: (pricingMode === "batch" ? batchTextModels : textModels).map((item) => item.model), request_id: requestId });
      if (!body.input || !body.from_language || !body.to_language) {
        return send(res, 400, { error: "invalid_request", message: "model, input, from_language, and to_language are required", request_id: requestId });
      }

      const inputTokens = tokenEstimate(body.input);
      const outputText = syntheticTranslation(body.input, body.from_language, body.to_language);
      const outputTokens = tokenEstimate(outputText);
      const costMicroCents = centsCostMicro(inputTokens, outputTokens, model);
      const charge = applyCharge(db, costMicroCents);

      if (!charge) {
        const log = {
          id: requestId,
          timestamp: nowIso(),
          projectId: auth.project.id,
          keyId: auth.key.id,
          endpoint: "/v1/translate",
          model: model.model,
          feature: "Text translation",
          method: "POST",
          status: 402,
          processingStatus: "failed",
          streaming: Boolean(body.stream),
          inputTokens,
          outputTokens: 0,
          words: String(body.input).trim().split(/\s+/).filter(Boolean).length,
          costMicroCents: 0,
          creditSource: "none",
          latencyMs: Date.now() - started,
          errorCode: "insufficient_balance",
          retry: idempotencyKey ? "Safe with Idempotency-Key" : "May duplicate without Idempotency-Key",
        };
        db.requestLogs.unshift(log);
        await saveDb(db);
        return send(res, 402, { error: "insufficient_balance", request_id: requestId });
      }

      const response = {
        id: requestId,
        model: model.model,
        pricing_mode: pricingMode,
        output_text: outputText,
        stream: Boolean(body.stream),
        usage: {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          total_tokens: inputTokens + outputTokens,
          cost_usd: microCentsToDollars(costMicroCents),
        },
      };

      db.ledger.unshift({
        id: id("ch"),
        type: "api_usage_charge",
        amountMicroCents: -costMicroCents,
        projectId: auth.project.id,
        keyId: auth.key.id,
        requestId,
        description: `${model.model}${pricingMode === "batch" ? " Batch" : ""} /v1/translate`,
        status: "succeeded",
        createdAt: nowIso(),
      });
      db.requestLogs.unshift({
        id: requestId,
        timestamp: nowIso(),
        projectId: auth.project.id,
        keyId: auth.key.id,
        endpoint: "/v1/translate",
        model: model.model,
        feature: "Text translation",
        method: "POST",
        status: 200,
        processingStatus: "complete",
        streaming: Boolean(body.stream),
        inputTokens,
        outputTokens,
        words: String(body.input).trim().split(/\s+/).filter(Boolean).length,
        costMicroCents,
        creditSource: charge.reward ? "reward" : "paid",
        latencyMs: Date.now() - started,
        errorCode: "",
        retry: idempotencyKey ? "Original result stored" : "No idempotency key",
      });
      if (idempotencyKey) {
        db.idempotency.push({ key: idempotencyKey, bodyHash, response, createdAt: nowIso() });
      }
      await saveDb(db);
      return send(res, 200, response);
    }

    if (req.method === "POST" && url.pathname === "/v1/music") {
      const started = Date.now();
      const auth = requireKey(db, req);
      const requestId = id("req");
      const body = await parseBody(req);
      const idempotencyKey = req.headers["idempotency-key"];
      const bodyHash = hashSecret(JSON.stringify(body));
      const existingIdempotency = idempotencyKey
        ? db.idempotency.find((item) => item.key === idempotencyKey)
        : null;

      if (existingIdempotency) {
        if (existingIdempotency.bodyHash !== bodyHash) {
          return send(res, 409, { error: "idempotency_key_conflict" });
        }
        return send(res, 200, existingIdempotency.response);
      }

      if (auth.error) {
        return send(res, 401, { error: auth.error, request_id: requestId });
      }
      if (!auth.key.scopes.includes("Music generation")) {
        return send(res, 403, { error: "missing_scope", required_scope: "Music generation", request_id: requestId });
      }

      const model = normalizeMusicModelName(body.model);
      if (!model) {
        return send(res, 400, { error: "unsupported_model", supported_models: musicModels.map((item) => item.model), request_id: requestId });
      }
      const prompt = String(body.prompt || "").trim();
      const durationSeconds = Math.round(Number(body.duration_seconds));
      if (!prompt || !Number.isFinite(durationSeconds) || durationSeconds < 1 || durationSeconds > 3600) {
        return send(res, 400, { error: "invalid_request", message: "model, prompt, and duration_seconds (1-3600) are required", request_id: requestId });
      }

      const costMicroCents = musicCostMicro(durationSeconds, model);
      const charge = applyCharge(db, costMicroCents);

      if (!charge) {
        db.requestLogs.unshift({
          id: requestId,
          timestamp: nowIso(),
          projectId: auth.project.id,
          keyId: auth.key.id,
          endpoint: "/v1/music",
          model: model.model,
          feature: "Music generation",
          method: "POST",
          status: 402,
          processingStatus: "failed",
          streaming: false,
          inputTokens: 0,
          outputTokens: 0,
          words: prompt.split(/\s+/).filter(Boolean).length,
          costMicroCents: 0,
          creditSource: "none",
          latencyMs: Date.now() - started,
          errorCode: "insufficient_balance",
          retry: idempotencyKey ? "Safe with Idempotency-Key" : "May duplicate without Idempotency-Key",
        });
        await saveDb(db);
        return send(res, 402, { error: "insufficient_balance", request_id: requestId });
      }

      const response = {
        id: requestId,
        model: model.model,
        status: "completed",
        output: {
          prompt,
          duration_seconds: durationSeconds,
          audio_url: `local://aurora/${requestId}.wav`,
          note: "Simulated local Aurora music generation. No audio file is created.",
        },
        usage: {
          audio_seconds: durationSeconds,
          audio_minutes: durationSeconds / 60,
          cost_usd: microCentsToDollars(costMicroCents),
        },
      };

      db.ledger.unshift({
        id: id("ch"),
        type: "api_usage_charge",
        amountMicroCents: -costMicroCents,
        projectId: auth.project.id,
        keyId: auth.key.id,
        requestId,
        description: `${model.model} /v1/music`,
        status: "succeeded",
        createdAt: nowIso(),
      });
      db.requestLogs.unshift({
        id: requestId,
        timestamp: nowIso(),
        projectId: auth.project.id,
        keyId: auth.key.id,
        endpoint: "/v1/music",
        model: model.model,
        feature: "Music generation",
        method: "POST",
        status: 200,
        processingStatus: "complete",
        streaming: false,
        inputTokens: 0,
        outputTokens: 0,
        words: prompt.split(/\s+/).filter(Boolean).length,
        costMicroCents,
        creditSource: charge.reward ? "reward" : "paid",
        latencyMs: Date.now() - started,
        errorCode: "",
        retry: idempotencyKey ? "Original result stored" : "No idempotency key",
      });
      if (idempotencyKey) {
        db.idempotency.push({ key: idempotencyKey, bodyHash, response, createdAt: nowIso() });
      }
      await saveDb(db);
      return send(res, 200, response);
    }

    return send(res, 404, { error: "not_found" });
  } catch (error) {
    return send(res, 500, { error: "server_error", message: error.message });
  }
}

createServer(route).listen(port, "0.0.0.0", () => {
  console.log(`LingoFusion API backend listening on http://0.0.0.0:${port}`);
});
