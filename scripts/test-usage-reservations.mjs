import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UsageReservations } from '../shared/usage-reservations.mjs';

function harness(balance = 100) {
  const data = new Map([['usageBalance:alice', balance], ['usageBalance:bob', 100]]);
  let queue = Promise.resolve(); let failKey;
  const tx = { async get(key) { return structuredClone(data.get(key)); }, async put(key, value) { if (key === failKey) throw new Error('Injected storage failure'); data.set(key, structuredClone(value)); } };
  const storage = { transaction(fn) { const run = queue.then(async () => { const before = structuredClone(data); try { return await fn(tx); } catch (e) { data.clear(); for (const entry of before) data.set(...entry); throw e; } }); queue = run.catch(() => {}); return run; } };
  const ledger = new UsageReservations(storage);
  const reserve = (operationId = 'r1', options = {}) => ledger.reserve({ account: 'alice', operationId, fingerprint: 'server-request-hash', maxCostMicros: 60, dailyLimitMicros: 1000, maxConcurrent: 10, ...options });
  return { data, ledger, reserve, fail(key) { failKey = key; } };
}

test('atomic reservations reject concurrent overspending', async () => {
  const h = harness(); const results = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => h.reserve('r'+i)));
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1); assert.equal(h.data.get('usageBalance:alice'), 40);
});
test('request-bound idempotency dispatches once and debits actual cost once', async () => {
  const h = harness(); await Promise.all(Array.from({ length: 10 }, () => h.reserve()));
  const begins = await Promise.all(Array.from({ length: 10 }, () => h.ledger.begin('alice', 'r1')));
  assert.equal(begins.filter(x => x.dispatch).length, 1);
  const outcome = { account: 'alice', operationId: 'r1', actualCostMicros: 25, providerRequestId: 'provider_1' };
  await Promise.all(Array.from({ length: 10 }, () => h.ledger.finish(outcome)));
  assert.equal(h.data.get('usageBalance:alice'), 75); assert.equal(h.data.get('usageActive:alice'), 0);
});
test('changed payload or bound cannot reuse an operation id', async () => {
  const h = harness(); await h.reserve();
  await assert.rejects(h.reserve('r1', { fingerprint: 'other' }), /conflict/);
  await assert.rejects(h.reserve('r1', { maxCostMicros: 1 }), /conflict/);
});
test('empty balance, invalid amounts and spending limits fail closed', async () => {
  const h = harness(0); await assert.rejects(h.reserve(), /Insufficient/);
  for (const n of [-1, NaN, Infinity, 0, 0.1, Number.MAX_SAFE_INTEGER+1]) await assert.rejects(h.reserve('bad', { maxCostMicros: n }), /bounds/);
  const h2 = harness(); await assert.rejects(h2.reserve('day', { dailyLimitMicros: 59 }), /Daily/);
});
test('confirmed pre-dispatch cancellation refunds the hold once', async () => {
  const h = harness(); await h.reserve();
  const failure = { account: 'alice', operationId: 'r1', actualCostMicros: 0, confirmedNoCharge: true };
  await h.ledger.finish(failure); await h.ledger.finish(failure);
  assert.equal(h.data.get('usageBalance:alice'), 100); assert.equal((await h.ledger.begin('alice', 'r1')).dispatch, false);
});
test('timeouts and disconnected streams retain holds until trusted settlement', async () => {
  const h = harness(); await h.reserve(); await h.ledger.begin('alice', 'r1'); await h.ledger.uncertain('alice', 'r1');
  assert.equal(h.data.get('usageBalance:alice'), 40); assert.equal((await h.ledger.begin('alice', 'r1')).dispatch, false);
  await assert.rejects(h.ledger.finish({ account: 'alice', operationId: 'r1', actualCostMicros: 0 }), /evidence/);
  await h.ledger.finish({ account: 'alice', operationId: 'r1', actualCostMicros: 20, providerRequestId: 'stream_receipt' });
  assert.equal(h.data.get('usageBalance:alice'), 80);
});
test('actual usage above reservation blocks further spending and retains evidence', async () => {
  const h = harness(1000); await h.reserve(); await h.ledger.begin('alice', 'r1');
  assert.deepEqual(await h.ledger.finish({ account: 'alice', operationId: 'r1', actualCostMicros: 61, providerRequestId: 'too_expensive' }), { needsReview: true });
  await assert.rejects(h.ledger.finish({ account: 'alice', operationId: 'r1', actualCostMicros: 20, providerRequestId: 'other' }), /manual reconciliation/);
  await assert.rejects(h.ledger.finish({ account: 'alice', operationId: 'r1', actualCostMicros: 0, confirmedNoCharge: true }), /manual reconciliation/);
  await assert.rejects(h.reserve('r2'), /reconciliation/); assert.equal(h.data.get('usageBalance:alice'), 940);
});
test('storage failure rolls back both hold and operation record', async () => {
  const h = harness(); h.fail('usage:alice:r1'); await assert.rejects(h.reserve(), /storage failure/);
  assert.equal(h.data.get('usageBalance:alice'), 100); assert.equal(h.data.has('usageActive:alice'), false);
  h.fail(null); await h.reserve(); assert.equal(h.data.get('usageBalance:alice'), 40);
});
test('provider receipts cannot settle different operations or accounts twice', async () => {
  const h = harness(1000); await h.reserve(); await h.reserve('r2');
  await h.ledger.begin('alice', 'r1'); await h.ledger.begin('alice', 'r2');
  await h.ledger.finish({ account: 'alice', operationId: 'r1', actualCostMicros: 20, providerRequestId: 'same_receipt' });
  await assert.rejects(h.ledger.finish({ account: 'alice', operationId: 'r2', actualCostMicros: 20, providerRequestId: 'same_receipt' }), /another operation/);
  assert.equal(h.data.get('usageBalance:bob'), 100);
});
test('daily budget counts held and settled usage, and concurrency caps open requests', async () => {
  const h = harness(1000); await h.reserve('r1', { maxConcurrent: 1 });
  await assert.rejects(h.reserve('r2', { maxConcurrent: 1 }), /Concurrency/);
  await assert.rejects(h.reserve('r2', { dailyLimitMicros: 100 }), /Daily/);
  await h.ledger.begin('alice', 'r1'); await h.ledger.finish({ account: 'alice', operationId: 'r1', actualCostMicros: 50, providerRequestId: 'first' });
  await assert.rejects(h.reserve('r2', { dailyLimitMicros: 100 }), /Daily/);
});
