import { createHash, randomUUID } from "node:crypto";
import { getEncoding } from "js-tiktoken";
import { buildModelSystemPrompt } from "./shared/systemPrompts.mjs";
import { prepareTextRequest, verifyAndPrice } from "./shared/textRequest.mjs";
import { TEXT_PRICING_VERSION, textPricePolicy, priceTextUsage } from "./shared/textPricing.mjs";

let encoder;
const getTokenizer = () => (encoder ||= getEncoding("o200k_base"));

export const countTextTokens = (text) => {
  const str = String(text || "");
  if (!str) return 0;
  try {
    return getTokenizer().encode(str).length;
  } catch {
    return Math.max(1, Math.ceil(str.length / 4));
  }
};

export const hashFingerprint = (data) => {
  return createHash("sha256").update(typeof data === "string" ? data : JSON.stringify(data)).digest("hex");
};

export function initTextReservationTable(sqlDb) {
  sqlDb.exec(`
    CREATE TABLE IF NOT EXISTS text_usage_reservations (
      operation_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      maximum_micros INTEGER NOT NULL,
      actual_micros INTEGER,
      provider_request_id TEXT,
      status TEXT NOT NULL,
      result TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  try {
    sqlDb.exec("ALTER TABLE text_usage_reservations ADD COLUMN provider_request_id TEXT;");
  } catch {}
  try {
    sqlDb.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_text_res_provider_req_id ON text_usage_reservations (provider_request_id) WHERE provider_request_id IS NOT NULL;");
  } catch {}
}

export function prepareNodeTextRequest(body, defaultModelName = "LingoFusion") {
  return prepareTextRequest({ ...body, model: body.model || defaultModelName });
}

export function quoteNodeTextRequest(body, defaultModelName = "LingoFusion") {
  const prepared = prepareNodeTextRequest(body, defaultModelName);
  return {
    model: prepared.policy.model,
    pricing_version: TEXT_PRICING_VERSION,
    maximum_cost_usd: prepared.maximum.cost_usd,
    maximum_service_fee_usd: 0,
    input_tokens: prepared.rawMaximum,
    customer_input_tokens: prepared.userTokens,
    instruction_tokens_estimate: prepared.systemTokens,
    max_completion_tokens: prepared.maxOutput,
    notice: "Input includes built-in system instructions and request overhead at the published input rate. Output includes reasoning. No additional service fee. Final token charges round up once to six decimal USD places.",
  };
}

export function reserveNodeTextUsage(sqlDb, { userId, operationId, fingerprint, maximumMicros }) {
  if (!userId || !operationId || !fingerprint || !Number.isSafeInteger(maximumMicros) || maximumMicros <= 0) {
    throw new Error("Invalid reservation identity or bounds");
  }

  initTextReservationTable(sqlDb);
  const maxCostUsd = Number((maximumMicros / 1e6).toFixed(6));

  sqlDb.exec("BEGIN IMMEDIATE TRANSACTION");
  try {
    const prior = sqlDb.prepare("SELECT * FROM text_usage_reservations WHERE operation_id = ?").get(operationId);
    if (prior) {
      if (prior.user_id !== userId || prior.fingerprint !== fingerprint) {
        sqlDb.exec("ROLLBACK");
        return { error: "idempotency_conflict" };
      }
      sqlDb.exec("COMMIT");
      let parsedResult = null;
      try { parsedResult = JSON.parse(prior.result); } catch {}
      return {
        replay: true,
        status: prior.status,
        operationId,
        maximumMicros: prior.maximum_micros,
        actualMicros: prior.actual_micros,
        result: parsedResult,
      };
    }

    const user = sqlDb.prepare("SELECT id, balance_usd FROM users WHERE id = ?").get(userId);
    if (!user) {
      sqlDb.exec("ROLLBACK");
      return { error: "user_not_found" };
    }

    const availableMicros = Math.round(Number(user.balance_usd) * 1e6);
    if (availableMicros < maximumMicros) {
      sqlDb.exec("ROLLBACK");
      return { error: "insufficient_quota", message: "Insufficient balance for reservation." };
    }

    sqlDb.prepare(
      "UPDATE users SET balance_usd = ROUND(balance_usd - ?, 6) WHERE id = ? AND balance_usd >= ?"
    ).run(maxCostUsd, userId, maxCostUsd);

    sqlDb.prepare(`
      INSERT INTO text_usage_reservations (operation_id, user_id, fingerprint, maximum_micros, status, created_at)
      VALUES (?, ?, ?, ?, 'reserved', ?)
    `).run(operationId, userId, fingerprint, maximumMicros, new Date().toISOString());

    sqlDb.exec("COMMIT");
    return {
      replay: false,
      status: "reserved",
      operationId,
      maximumMicros,
      maxCostUsd,
    };
  } catch (err) {
    try { sqlDb.exec("ROLLBACK"); } catch {}
    throw err;
  }
}

export function settleNodeTextUsage(sqlDb, { userId, apiKeyId, operationId, fingerprint, prepared, providerData, source = "api", db = null }) {
  const { policy, mode, userTokens, rawMaximum, maxOutput, longContext, maximum } = prepared;
  const usage = providerData?.usage;

  if (!providerData?.id || typeof providerData.id !== "string" || !usage) {
    throw new Error("Missing provider provenance");
  }

  if (!providerData?.model || typeof providerData.model !== "string" ||
      !(providerData.model === policy.upstream || providerData.model.startsWith(`${policy.upstream}-`))) {
    throw new Error("Provider model mismatch");
  }

  const promptTokens = Number(usage.prompt_tokens);
  const completionTokens = Number(usage.completion_tokens);
  const cachedTokens = Number(usage.prompt_tokens_details?.cached_tokens ?? 0);
  const cacheWriteTokens = Number(usage.prompt_tokens_details?.cache_write_tokens ?? 0);
  const reasoningTokens = Number(usage.completion_tokens_details?.reasoning_tokens ?? 0);

  if (!Number.isSafeInteger(promptTokens) || promptTokens < userTokens || promptTokens > rawMaximum ||
      !Number.isSafeInteger(completionTokens) || completionTokens < 0 || completionTokens > maxOutput) {
    throw new Error("Provider usage outside reservation");
  }

  const price = verifyAndPrice(prepared, providerData);

  const actualCostUsd = price.cost_usd;
  const ledgerId = randomUUID();
  const createdAt = new Date().toISOString();
  const expectedFingerprint = fingerprint || hashFingerprint({ pricingVersion: TEXT_PRICING_VERSION, payload: prepared.payload, mode: prepared.mode });

  sqlDb.exec("BEGIN IMMEDIATE TRANSACTION");
  try {
    const record = sqlDb.prepare("SELECT * FROM text_usage_reservations WHERE operation_id = ?").get(operationId);
    if (!record) {
      sqlDb.exec("ROLLBACK");
      throw new Error("Reservation not found for settlement");
    }
    if (record.user_id !== userId) {
      sqlDb.exec("ROLLBACK");
      throw new Error("Reservation owner mismatch");
    }
    if (record.fingerprint !== expectedFingerprint) {
      sqlDb.exec("ROLLBACK");
      throw new Error("Reservation fingerprint mismatch");
    }
    if (record.maximum_micros !== prepared.maximum.chargeMicros) {
      sqlDb.exec("ROLLBACK");
      throw new Error("Reservation maximum mismatch");
    }
    if (record.status === "settled") {
      sqlDb.exec("COMMIT");
      let parsed = null;
      try { parsed = JSON.parse(record.result); } catch {}
      return { replay: true, result: parsed };
    }
    if (record.status !== "reserved") {
      sqlDb.exec("ROLLBACK");
      throw new Error(`Cannot settle reservation in ${record.status} state`);
    }
    if (price.chargeMicros > record.maximum_micros) {
      sqlDb.exec("ROLLBACK");
      throw new Error("Actual cost exceeds reserved maximum");
    }

    const priorReceipt = sqlDb.prepare(
      "SELECT operation_id FROM text_usage_reservations WHERE provider_request_id = ? AND operation_id != ?"
    ).get(providerData.id, operationId);
    if (priorReceipt) {
      sqlDb.exec("ROLLBACK");
      throw new Error("Duplicate provider receipt ID");
    }

    const maximumCostUsd = Number((record.maximum_micros / 1e6).toFixed(6));
    const refundUsd = Number(Math.max(0, maximumCostUsd - actualCostUsd).toFixed(6));

    if (refundUsd > 0) {
      sqlDb.prepare("UPDATE users SET balance_usd = ROUND(balance_usd + ?, 6) WHERE id = ?").run(refundUsd, userId);
    }

    const updatedUser = sqlDb.prepare("SELECT balance_usd FROM users WHERE id = ?").get(userId);
    const balanceUsd = Number(Number(updatedUser?.balance_usd || 0).toFixed(6));

    sqlDb.prepare(`
      INSERT INTO usage_ledger (id, user_id, api_key_id, model_id, prompt_tokens, completion_tokens, cost_usd, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(ledgerId, userId, apiKeyId, policy.model, promptTokens, completionTokens, actualCostUsd, source, createdAt);

    const clientUsage = {
      prompt_tokens: promptTokens,
      customer_input_tokens: userTokens,
      instruction_and_overhead_tokens: price.instruction_and_overhead_tokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
      cost_usd: actualCostUsd,
      service_fee_usd: price.service_fee_usd,
      token_cost_usd: price.token_cost_usd,
      balance_usd: balanceUsd,
    };

    const finalResult = {
      ...providerData,
      model: policy.model,
      usage: clientUsage,
      cost_usd: actualCostUsd,
      service_fee_usd: price.service_fee_usd,
      token_cost_usd: price.token_cost_usd,
      pricing_version: TEXT_PRICING_VERSION,
      instruction_and_overhead_tokens: price.instruction_and_overhead_tokens,
      operation_id: operationId,
      balance_usd: balanceUsd,
    };

    sqlDb.prepare(`
      UPDATE text_usage_reservations
      SET status = 'settled', actual_micros = ?, provider_request_id = ?, result = ?
      WHERE operation_id = ? AND user_id = ?
    `).run(price.chargeMicros, providerData.id, JSON.stringify(finalResult), operationId, userId);

    sqlDb.exec("COMMIT");

    if (db) {
      db.account.paidBalanceMicroCents = Math.round(balanceUsd * 100_000_000);
      db.requestLogs.unshift({
        id: providerData.id || `req-${ledgerId}`,
        timestamp: createdAt,
        projectId: db.projects[0]?.id || "proj_default",
        keyId: apiKeyId || "playground_session",
        endpoint: source === "api" ? "/v1/chat/completions" : "/api/playground/chat",
        model: policy.model,
        feature: "Text chat completions",
        method: "POST",
        status: 200,
        processingStatus: "complete",
        streaming: Boolean(prepared.payload.stream),
        inputTokens: price.prompt_tokens,
        outputTokens: completionTokens,
        reasoningTokens,
        totalTokens: price.prompt_tokens + completionTokens,
        costMicroCents: Math.round(actualCostUsd * 100_000_000),
        creditSource: "paid",
        cachedTokens,
        serviceFeeUsd: price.service_fee_usd,
        tokenCostUsd: price.token_cost_usd,
        grossProfitLowerBoundUsd: price.gross_profit_lower_bound_usd,
        rawUsage: usage,
        errorCode: "",
        retry: "",
      });
    }

    return {
      replay: false,
      price,
      balanceUsd,
      result: finalResult,
    };
  } catch (err) {
    try { sqlDb.exec("ROLLBACK"); } catch {}
    throw err;
  }
}

export function markNodeTextUncertain(sqlDb, operationId, userId = null) {
  initTextReservationTable(sqlDb);
  try {
    if (userId) {
      sqlDb.prepare("UPDATE text_usage_reservations SET status = 'uncertain' WHERE operation_id = ? AND user_id = ? AND status = 'reserved'").run(operationId, userId);
    } else {
      sqlDb.prepare("UPDATE text_usage_reservations SET status = 'uncertain' WHERE operation_id = ? AND status = 'reserved'").run(operationId);
    }
  } catch {}
}

export function settleSimulatedTextUsage(sqlDb, { userId, apiKeyId, modelName = "LingoFusion", userTokens, outputTokens, mode = "default", source = "playground", db = null, systemTokens }) {
  const policy = textPricePolicy(modelName, false);
  const rawMaximum = userTokens + (systemTokens ?? countTextTokens(buildModelSystemPrompt({ modelName })));
  const price = priceTextUsage({
    policy,
    mode,
    userTokens,
    outputTokens,
    rawInputTokens: rawMaximum,
    cachedTokens: 0,
    cacheWriteTokens: 0,
    longContext: false,
  });

  const costUsd = price.cost_usd;
  const ledgerId = randomUUID();
  const createdAt = new Date().toISOString();

  sqlDb.exec("BEGIN IMMEDIATE TRANSACTION");
  try {
    const update = sqlDb.prepare("UPDATE users SET balance_usd = ROUND(balance_usd - ?, 6) WHERE id = ? AND balance_usd >= ?").run(costUsd, userId, costUsd);
    if (!update || update.changes === 0) {
      sqlDb.exec("ROLLBACK");
      return { success: false, error: "insufficient_quota" };
    }

    const updatedUser = sqlDb.prepare("SELECT balance_usd FROM users WHERE id = ?").get(userId);
    const balanceUsd = Number(Number(updatedUser?.balance_usd || 0).toFixed(6));

    sqlDb.prepare(`
      INSERT INTO usage_ledger (id, user_id, api_key_id, model_id, prompt_tokens, completion_tokens, cost_usd, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(ledgerId, userId, apiKeyId, policy.model, price.prompt_tokens, outputTokens, costUsd, source, createdAt);

    sqlDb.exec("COMMIT");

    if (db) {
      db.account.paidBalanceMicroCents = Math.round(balanceUsd * 100_000_000);
      db.requestLogs.unshift({
        id: `sim-${ledgerId}`,
        timestamp: createdAt,
        projectId: db.projects[0]?.id || "proj_default",
        keyId: apiKeyId || "playground_session",
        endpoint: source === "api" ? "/v1/chat/completions" : "/api/playground/chat",
        model: policy.model,
        feature: "Simulated text completions",
        method: "POST",
        status: 200,
        processingStatus: "complete",
        streaming: false,
        inputTokens: price.prompt_tokens,
        outputTokens,
        reasoningTokens: 0,
        totalTokens: price.prompt_tokens + outputTokens,
        costMicroCents: Math.round(costUsd * 100_000_000),
        creditSource: "paid",
        cachedTokens: 0,
        serviceFeeUsd: price.service_fee_usd,
        tokenCostUsd: price.token_cost_usd,
        grossProfitLowerBoundUsd: price.gross_profit_lower_bound_usd,
        errorCode: "",
        retry: "",
      });
    }

    return {
      success: true,
      costUsd,
      balanceUsd,
      price,
    };
  } catch (err) {
    try { sqlDb.exec("ROLLBACK"); } catch {}
    throw err;
  }
}

export function priceTranslateUsage({ modelName, inputTokens, outputTokens, pricingMode = "default", rawInputTokens, cachedTokens = 0, cacheWriteTokens = 0 }) {
  const policy = textPricePolicy(modelName, false);
  const rawMax = rawInputTokens && rawInputTokens >= inputTokens ? rawInputTokens : (inputTokens + countTextTokens(buildModelSystemPrompt({ modelName })));
  const price = priceTextUsage({
    policy,
    mode: pricingMode,
    userTokens: inputTokens,
    outputTokens,
    rawInputTokens: rawMax,
    cachedTokens,
    cacheWriteTokens,
    longContext: false,
  });
  return price;
}
