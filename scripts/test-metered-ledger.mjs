import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './billing-test-harness.mjs';
import { billing } from '../cloudflare-worker/billing.mjs';

test('concurrent holds cannot spend the same funds; replays cannot redispatch', async () => {
  const h = harness(), email = 'metered@example.com';
  h.records.set(`user_balance:${email}`, '0.01');
  const reserve = operationId => billing(h.env, { action: 'usageReserve', email,
    operationId, fingerprint: 'server-hash', maximumMicros: 7000 });
  const attempts = await Promise.allSettled([reserve('one'), reserve('two')]);
  assert.equal(attempts.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal((await reserve('one')).replay, true);
  await assert.rejects(billing(h.env, { action: 'usageReserve', email,
    operationId: 'one', fingerprint: 'different', maximumMicros: 7000 }), /conflict/);
  const args = { action: 'usageFinish', email, operationId: 'one', fingerprint: 'server-hash',
    actualMicros: 2000, result: { text: 'Bonjour' }, evidence: { providerRequestId: 'provider-1' } };
  assert.equal((await billing(h.env, args)).balance_usd, 0.008);
  assert.equal((await billing(h.env, args)).balance_usd, 0.008);
});
test('ambiguous work retains its hold and over-bound settlement is rejected', async () => {
  const h = harness(), email = 'ambiguous@example.com';
  h.records.set(`user_balance:${email}`, '1');
  const identity = { email, operationId: 'timeout', fingerprint: 'hash' };
  await billing(h.env, { action: 'usageReserve', ...identity, maximumMicros: 10000 });
  await billing(h.env, { action: 'usageUncertain', ...identity });
  assert.equal((await billing(h.env, { action: 'balance', email })).balance_usd, 0.99);
  assert.equal((await billing(h.env, { action: 'usageReserve', ...identity, maximumMicros: 10000 })).status, 'uncertain');
  await assert.rejects(billing(h.env, { action: 'usageFinish', ...identity, actualMicros: 10001,
    evidence: { providerRequestId: 'too-large' } }), /bounded/);
});

test('large Unicode responses replay across durable chunks and status is owner-bound', async () => {
  const h = harness(), email = 'large@example.com';
  h.records.set(`user_balance:${email}`, '1');
  const identity = { email, operationId: 'large', fingerprint: 'request-hash' };
  const result = { text: '翻訳🌍'.repeat(20000) };
  await billing(h.env, { action: 'usageReserve', ...identity, maximumMicros: 100000 });
  await billing(h.env, { action: 'usageFinish', ...identity, actualMicros: 50000, result,
    evidence: { providerRequestId: 'large-provider' } });
  const replay = await billing(h.env, { action: 'usageReserve', ...identity, maximumMicros: 100000 });
  assert.deepEqual(replay.result, result);
  const status = await billing(h.env, { action: 'usageStatus', email, operationId: 'large' });
  assert.equal(status.status, 'settled'); assert.equal(status.held_usd, 0);
  assert.deepEqual(status.result, result);
  await assert.rejects(billing(h.env, { action: 'usageStatus', email: 'other@example.com', operationId: 'large' }));
});
