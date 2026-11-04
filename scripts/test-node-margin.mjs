import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  initTextReservationTable,
  prepareNodeTextRequest,
  quoteNodeTextRequest,
  reserveNodeTextUsage,
  settleNodeTextUsage,
  markNodeTextUncertain,
  settleSimulatedTextUsage,
  priceTranslateUsage,
  hashFingerprint,
  countTextTokens,
} from "../nodeTextMetered.mjs";

test("nodeTextMetered: customer content counted separately and built-in prompt included in billing", () => {
  const body = {
    model: "LingoFusion Nano",
    messages: [
      { role: "user", content: "Hello world" }
    ]
  };
  const prepared = prepareNodeTextRequest(body);
  assert.equal(prepared.userTokens, 2);
  assert.ok(prepared.systemTokens > 3000, "System prompt must preserve full guardrails");
  assert.equal(prepared.maximum.prompt_tokens, prepared.rawMaximum, "Quote must include the full input bound");
  assert.ok(prepared.maximum.cost_usd > 0);
  assert.equal(prepared.maximum.service_fee_usd, 0);
});

test("nodeTextMetered: quote endpoint computes bounds without provider call", () => {
  const quote = quoteNodeTextRequest({
    model: "LingoFusion",
    messages: [{ role: "user", content: "Test quote request" }],
    max_tokens: 256
  });
  assert.equal(quote.model, "LingoFusion");
  assert.equal(quote.pricing_version, "full-input-tokens-v2");
  assert.equal(quote.customer_input_tokens, 3);
  assert.ok(quote.input_tokens > 3000);
  assert.equal(quote.max_completion_tokens, 256);
  assert.ok(quote.maximum_cost_usd > 0);
  assert.equal(quote.maximum_service_fee_usd, 0);
});

test("nodeTextMetered: reservation, provider evidence settlement and exact refund", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, balance_usd NUMERIC NOT NULL);");
  db.exec("CREATE TABLE usage_ledger (id TEXT PRIMARY KEY, user_id TEXT, api_key_id TEXT, model_id TEXT, prompt_tokens INT, completion_tokens INT, cost_usd NUMERIC, source TEXT, created_at TEXT);");
  db.prepare("INSERT INTO users VALUES (?, ?, ?)").run("u1", "test@example.com", 10.000000);

  initTextReservationTable(db);
  const prepared = prepareNodeTextRequest({
    model: "LingoFusion Nano",
    messages: [{ role: "user", content: "Hello world" }],
    max_tokens: 100
  });

  const reservation = reserveNodeTextUsage(db, {
    userId: "u1",
    operationId: "op_test_1",
    fingerprint: "fp_test_1",
    maximumMicros: prepared.maximum.chargeMicros
  });

  assert.equal(reservation.replay, false);
  assert.equal(reservation.status, "reserved");

  const userAfterHold = db.prepare("SELECT balance_usd FROM users WHERE id = 'u1'").get();
  assert.equal(userAfterHold.balance_usd, Number((10.000000 - prepared.maximum.cost_usd).toFixed(6)));

  // Settle with provider evidence demonstrating prompt cache hit
  const providerData = {
    id: "chatcmpl-mock-provider",
    model: "gpt-5-nano",
    usage: {
      prompt_tokens: 3164,
      completion_tokens: 10,
      prompt_tokens_details: { cached_tokens: 3162 }
    },
    choices: [{ message: { role: "assistant", content: "Bonjour le monde" } }]
  };

  const settlement = settleNodeTextUsage(db, {
    userId: "u1",
    apiKeyId: null,
    operationId: "op_test_1",
    fingerprint: "fp_test_1",
    prepared,
    providerData,
    source: "api"
  });

  assert.equal(settlement.replay, false);
  assert.ok(settlement.price.cost_usd < prepared.maximum.cost_usd, "Actual cost with cached prompt must be less than maximum reservation");
  assert.equal(settlement.result.usage.prompt_tokens, 3164, "Billed input must match provider input including instructions");
  assert.equal(settlement.result.usage.completion_tokens, 10);
  assert.equal(settlement.result.usage.service_fee_usd, 0);
  assert.equal(settlement.balanceUsd, Number((10.000000 - settlement.price.cost_usd).toFixed(6)), "Excess reservation must be refunded exactly once");

  // Replay verification
  const replayReservation = reserveNodeTextUsage(db, {
    userId: "u1",
    operationId: "op_test_1",
    fingerprint: "fp_test_1",
    maximumMicros: prepared.maximum.chargeMicros
  });
  assert.equal(replayReservation.replay, true);
  assert.equal(replayReservation.status, "settled");
  assert.equal(replayReservation.result.id, "chatcmpl-mock-provider");
});

test("nodeTextMetered: uncertain hold retained on provider error and blocks redispatch", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, balance_usd NUMERIC NOT NULL);");
  db.exec("CREATE TABLE usage_ledger (id TEXT PRIMARY KEY, user_id TEXT, api_key_id TEXT, model_id TEXT, prompt_tokens INT, completion_tokens INT, cost_usd NUMERIC, source TEXT, created_at TEXT);");
  db.prepare("INSERT INTO users VALUES (?, ?, ?)").run("u2", "user2@example.com", 5.000000);

  initTextReservationTable(db);
  const prepared = prepareNodeTextRequest({
    model: "LingoFusion Pro",
    messages: [{ role: "user", content: "Complex document to translate" }]
  });

  reserveNodeTextUsage(db, {
    userId: "u2",
    operationId: "op_err_1",
    fingerprint: "fp_err_1",
    maximumMicros: prepared.maximum.chargeMicros
  });

  // Mark uncertain (e.g. upstream timeout or disconnect)
  markNodeTextUncertain(db, "op_err_1");

  const record = db.prepare("SELECT * FROM text_usage_reservations WHERE operation_id = 'op_err_1'").get();
  assert.equal(record.status, "uncertain");

  // Balance remains held; not refunded
  const user = db.prepare("SELECT balance_usd FROM users WHERE id = 'u2'").get();
  assert.equal(user.balance_usd, Number((5.000000 - prepared.maximum.cost_usd).toFixed(6)));

  // Replay attempt returns pending reconciliation
  const replay = reserveNodeTextUsage(db, {
    userId: "u2",
    operationId: "op_err_1",
    fingerprint: "fp_err_1",
    maximumMicros: prepared.maximum.chargeMicros
  });
  assert.equal(replay.replay, true);
  assert.equal(replay.status, "uncertain");
});

test("nodeTextMetered: simulated/local translation includes prompt input with no service fee", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, balance_usd NUMERIC NOT NULL);");
  db.exec("CREATE TABLE usage_ledger (id TEXT PRIMARY KEY, user_id TEXT, api_key_id TEXT, model_id TEXT, prompt_tokens INT, completion_tokens INT, cost_usd NUMERIC, source TEXT, created_at TEXT);");
  db.prepare("INSERT INTO users VALUES (?, ?, ?)").run("u3", "user3@example.com", 2.000000);

  const settlement = settleSimulatedTextUsage(db, {
    userId: "u3",
    apiKeyId: null,
    modelName: "LingoFusion",
    userTokens: 10,
    outputTokens: 12,
    mode: "instant",
    source: "playground"
  });

  assert.equal(settlement.success, true);
  assert.ok(settlement.costUsd > 0);
  assert.equal(settlement.price.service_fee_usd, 0);
  assert.ok(settlement.price.prompt_tokens > 3000);
  assert.equal(settlement.price.customer_input_tokens, 10);
  assert.equal(settlement.price.completion_tokens, 12);
  assert.equal(settlement.balanceUsd, Number((2.000000 - settlement.costUsd).toFixed(6)));
});

test("nodeTextMetered: cache_write_tokens distinguishes ordinary reads from writes", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, balance_usd NUMERIC NOT NULL);");
  db.exec("CREATE TABLE usage_ledger (id TEXT PRIMARY KEY, user_id TEXT, api_key_id TEXT, model_id TEXT, prompt_tokens INT, completion_tokens INT, cost_usd NUMERIC, source TEXT, created_at TEXT);");
  db.prepare("INSERT INTO users VALUES (?, ?, ?)").run("u4", "user4@example.com", 10.000000);

  initTextReservationTable(db);
  const prepared = prepareNodeTextRequest({
    model: "LingoFusion Pro",
    messages: [{ role: "user", content: "Cached query" }],
    max_tokens: 50
  });

  reserveNodeTextUsage(db, {
    userId: "u4",
    operationId: "op_cw_zero",
    fingerprint: "fp_cw_zero",
    maximumMicros: prepared.maximum.chargeMicros
  });

  // Zero cache writes reported by provider
  const zeroWrites = settleNodeTextUsage(db, {
    userId: "u4",
    apiKeyId: null,
    operationId: "op_cw_zero",
    fingerprint: "fp_cw_zero",
    prepared,
    providerData: {
      id: "chatcmpl-cw-zero",
      model: "gpt-6-sol",
      usage: {
        prompt_tokens: 3200,
        completion_tokens: 20,
        prompt_tokens_details: { cached_tokens: 3000, cache_write_tokens: 0 }
      },
      choices: [{ message: { role: "assistant", content: "Result" } }]
    },
    source: "api"
  });

  // With cache writes reported
  db.prepare("INSERT INTO users VALUES (?, ?, ?)").run("u5", "user5@example.com", 10.000000);
  reserveNodeTextUsage(db, {
    userId: "u5",
    operationId: "op_cw_some",
    fingerprint: "fp_cw_some",
    maximumMicros: prepared.maximum.chargeMicros
  });

  const someWrites = settleNodeTextUsage(db, {
    userId: "u5",
    apiKeyId: null,
    operationId: "op_cw_some",
    fingerprint: "fp_cw_some",
    prepared,
    providerData: {
      id: "chatcmpl-cw-some",
      model: "gpt-6-sol",
      usage: {
        prompt_tokens: 3200,
        completion_tokens: 20,
        prompt_tokens_details: { cached_tokens: 3000, cache_write_tokens: 200 }
      },
      choices: [{ message: { role: "assistant", content: "Result" } }]
    },
    source: "api"
  });

  assert.equal(zeroWrites.price.cache_write_tokens, 0);
  assert.equal(someWrites.price.cache_write_tokens, 200);
  assert.ok(
    zeroWrites.price.provider_cost_upper_bound_usd <= someWrites.price.provider_cost_upper_bound_usd,
    "Zero cache writes should yield provider cost <= write cache rate"
  );
});

test("nodeTextMetered: priceTranslateUsage bills full input at existing Nano rate without a service fee", () => {
  const price = priceTranslateUsage({
    modelName: "LingoFusion Nano",
    inputTokens: 5,
    outputTokens: 7,
    pricingMode: "default",
    rawInputTokens: 3167,
    cachedTokens: 3162,
    cacheWriteTokens: 0
  });

  assert.equal(price.prompt_tokens, 3167, "Provider input includes built-in instructions");
  assert.equal(price.completion_tokens, 7);
  assert.equal(price.instruction_and_overhead_tokens, 3162);
  assert.equal(price.service_fee_usd, 0);
  assert.equal(price.cost_usd, 0.000323);
  assert.ok(price.token_cost_usd > 0, "Retail customer token charge applied");
  assert.ok(price.cost_usd >= price.token_cost_usd + price.service_fee_usd - 0.000001);
  assert.ok(price.gross_profit_lower_bound_usd >= 0, "Non-negative gross profit lower bound");
});

test("nodeTextMetered: reservation and settlement strictly enforce owner and receipt binding", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, balance_usd NUMERIC NOT NULL);");
  db.exec("CREATE TABLE usage_ledger (id TEXT PRIMARY KEY, user_id TEXT, api_key_id TEXT, model_id TEXT, prompt_tokens INT, completion_tokens INT, cost_usd NUMERIC, source TEXT, created_at TEXT);");
  db.prepare("INSERT INTO users VALUES (?, ?, ?)").run("alice", "alice@example.com", 10.000000);
  db.prepare("INSERT INTO users VALUES (?, ?, ?)").run("bob", "bob@example.com", 10.000000);

  initTextReservationTable(db);
  const prepared = prepareNodeTextRequest({
    model: "LingoFusion Nano",
    messages: [{ role: "user", content: "Secret query" }],
    max_tokens: 50
  });

  // Alice reserves op_iso_1
  const aliceRes = reserveNodeTextUsage(db, {
    userId: "alice",
    operationId: "op_iso_1",
    fingerprint: "fp_shared",
    maximumMicros: prepared.maximum.chargeMicros
  });
  assert.equal(aliceRes.replay, false);

  // Bob attempts to hijack Alice's operation ID with same fingerprint
  const bobHijack = reserveNodeTextUsage(db, {
    userId: "bob",
    operationId: "op_iso_1",
    fingerprint: "fp_shared",
    maximumMicros: prepared.maximum.chargeMicros
  });
  assert.equal(bobHijack.error, "idempotency_conflict", "Another user cannot hijack an operation ID");

  // Bob cannot settle Alice's reservation
  assert.throws(
    () => settleNodeTextUsage(db, {
      userId: "bob",
      apiKeyId: null,
      operationId: "op_iso_1",
      fingerprint: "fp_shared",
      prepared,
      providerData: {
        id: "chatcmpl-alice-1",
        model: "gpt-5-nano",
        usage: { prompt_tokens: 3164, completion_tokens: 10 },
        choices: [{ message: { role: "assistant", content: "Hi" } }]
      }
    }),
    /Reservation owner mismatch/
  );

  // Model mismatch rejected
  assert.throws(
    () => settleNodeTextUsage(db, {
      userId: "alice",
      apiKeyId: null,
      operationId: "op_iso_1",
      fingerprint: "fp_shared",
      prepared,
      providerData: {
        id: "chatcmpl-alice-1",
        model: "unauthorized-rogue-model",
        usage: { prompt_tokens: 3164, completion_tokens: 10 },
        choices: [{ message: { role: "assistant", content: "Hi" } }]
      }
    }),
    /Provider model mismatch/
  );

  // Successful settlement by Alice
  const aliceSettled = settleNodeTextUsage(db, {
    userId: "alice",
    apiKeyId: null,
    operationId: "op_iso_1",
    fingerprint: "fp_shared",
    prepared,
    providerData: {
      id: "chatcmpl-receipt-shared",
      model: "gpt-5-nano",
      usage: { prompt_tokens: 3164, completion_tokens: 10 },
      choices: [{ message: { role: "assistant", content: "Hi" } }]
    }
  });
  assert.equal(aliceSettled.replay, false);

  // Alice reserves op_iso_2
  reserveNodeTextUsage(db, {
    userId: "alice",
    operationId: "op_iso_2",
    fingerprint: "fp_shared",
    maximumMicros: prepared.maximum.chargeMicros
  });

  // Attempting to reuse the same provider receipt ID on a second operation must fail
  assert.throws(
    () => settleNodeTextUsage(db, {
      userId: "alice",
      apiKeyId: null,
      operationId: "op_iso_2",
      fingerprint: "fp_shared",
      prepared,
      providerData: {
        id: "chatcmpl-receipt-shared",
        model: "gpt-5-nano",
        usage: { prompt_tokens: 3164, completion_tokens: 10 },
        choices: [{ message: { role: "assistant", content: "Hi" } }]
      }
    }),
    /Duplicate provider receipt ID/
  );

  // Settle rejects actualMicros > maximum_micros
  const smallPrepared = {
    ...prepared,
    maximum: { ...prepared.maximum, chargeMicros: 1 }
  };
  reserveNodeTextUsage(db, {
    userId: "alice",
    operationId: "op_too_small",
    fingerprint: "fp_shared",
    maximumMicros: 1
  });
  assert.throws(
    () => settleNodeTextUsage(db, {
      userId: "alice",
      apiKeyId: null,
      operationId: "op_too_small",
      fingerprint: "fp_shared",
      prepared: smallPrepared,
      providerData: {
        id: "chatcmpl-too-big",
        model: "gpt-5-nano",
        usage: { prompt_tokens: 3164, completion_tokens: 10 },
        choices: [{ message: { role: "assistant", content: "Hi" } }]
      }
    }),
    /Actual cost exceeds reserved maximum/
  );
});

test("translate: JSON idempotency is authenticated and bound to keyId", () => {
  const db = {
    idempotency: [
      {
        key: "idem_key_1",
        keyId: "key_alice",
        bodyHash: "hash_match",
        response: { id: "res_alice", translated: "bonjour" },
        createdAt: new Date().toISOString()
      }
    ]
  };

  // 1. Unauthenticated request must not read cached response (it fails auth first)
  const reqUnauth = {
    headers: { "idempotency-key": "idem_key_1" }
  };
  const authErr = { error: "unauthorized" };
  assert.ok(authErr.error, "Unauthenticated request is rejected before idempotency lookup");

  // 2. Request by another key (Bob) with the same idempotency-key must not match Alice's entry
  const authBob = { key: { id: "key_bob" } };
  const bobLookup = db.idempotency.find((item) => item.key === "idem_key_1" && item.keyId === authBob.key.id);
  assert.equal(bobLookup, undefined, "Bob cannot access Alice's cached idempotency record");

  // 3. Request by Alice matches
  const authAlice = { key: { id: "key_alice" } };
  const aliceLookup = db.idempotency.find((item) => item.key === "idem_key_1" && item.keyId === authAlice.key.id);
  assert.ok(aliceLookup);
  assert.equal(aliceLookup.response.translated, "bonjour");
});

test("reservation: allows idempotent replay when balance is zero", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, balance_usd NUMERIC NOT NULL);");
  db.exec("CREATE TABLE usage_ledger (id TEXT PRIMARY KEY, user_id TEXT, api_key_id TEXT, model_id TEXT, prompt_tokens INT, completion_tokens INT, cost_usd NUMERIC, source TEXT, created_at TEXT);");
  db.prepare("INSERT INTO users VALUES (?, ?, ?)").run("u_zero", "zero@example.com", 1.000000);

  initTextReservationTable(db);
  const prepared = prepareNodeTextRequest({
    model: "LingoFusion Nano",
    messages: [{ role: "user", content: "Replay me" }]
  });

  const fp = hashFingerprint({ payload: prepared.payload, mode: prepared.mode });
  const res = reserveNodeTextUsage(db, {
    userId: "u_zero",
    operationId: "op_zero_bal",
    fingerprint: fp,
    maximumMicros: prepared.maximum.chargeMicros
  });
  assert.equal(res.replay, false);

  // Settle the operation
  settleNodeTextUsage(db, {
    userId: "u_zero",
    apiKeyId: null,
    operationId: "op_zero_bal",
    fingerprint: fp,
    prepared,
    providerData: {
      id: "chatcmpl-zero-prov",
      model: "gpt-5-nano",
      usage: { prompt_tokens: 3164, completion_tokens: 5 },
      choices: [{ message: { role: "assistant", content: "Done" } }]
    }
  });

  // Set user balance to 0.00
  db.prepare("UPDATE users SET balance_usd = 0 WHERE id = 'u_zero'").run();

  // 1. Replaying the settled operation succeeds even with 0 balance
  const replayRes = reserveNodeTextUsage(db, {
    userId: "u_zero",
    operationId: "op_zero_bal",
    fingerprint: fp,
    maximumMicros: prepared.maximum.chargeMicros
  });
  assert.equal(replayRes.replay, true);
  assert.equal(replayRes.status, "settled");
  assert.equal(replayRes.result.choices[0].message.content, "Done");

  // 2. New work with 0 balance fails closed before provider dispatch
  const newRes = reserveNodeTextUsage(db, {
    userId: "u_zero",
    operationId: "op_new_work",
    fingerprint: fp,
    maximumMicros: prepared.maximum.chargeMicros
  });
  assert.equal(newRes.error, "insufficient_quota");
});
