// Internal accounting primitive for the billing upgrade. Not wired to any public
// route and not included in the emergency release. All amounts are integer USD
// microdollars, computed by trusted server pricing/provider adapters, never clients.
const money = value => Number.isSafeInteger(value) && value >= 0;
const identity = value => typeof value === 'string' && value.length > 0 && value.length <= 200;
const requireValue = (condition, message) => { if (!condition) throw new Error(message); };
const accountKey = account => encodeURIComponent(account);
const operationKey = (account, operationId) => `usage:${accountKey(account)}:${encodeURIComponent(operationId)}`;

export class UsageReservations {
  constructor(storage) { this.storage = storage; }

  async reserve({ account, operationId, fingerprint, maxCostMicros, dailyLimitMicros, maxConcurrent = 2, now = Date.now() }) {
    requireValue(identity(account) && identity(operationId) && identity(fingerprint), 'Invalid internal usage identity');
    requireValue(money(maxCostMicros) && maxCostMicros > 0 && money(dailyLimitMicros) && Number.isSafeInteger(maxConcurrent) && maxConcurrent > 0 && Number.isSafeInteger(now) && now >= 0, 'Invalid server spending bounds');
    return this.storage.transaction(async tx => {
      const key = operationKey(account, operationId);
      const prior = await tx.get(key);
      if (prior) {
        requireValue(prior.fingerprint === fingerprint && prior.maximum === maxCostMicros, 'Idempotency conflict');
        return { ...prior, replay: true };
      }
      const balanceKey = `usageBalance:${accountKey(account)}`;
      const balance = await tx.get(balanceKey);
      requireValue(money(balance), 'Authoritative funds not initialized');
      requireValue(!await tx.get(`usageBlocked:${accountKey(account)}`), 'Account requires reconciliation');
      requireValue(balance >= maxCostMicros, 'Insufficient available funds');
      const activeKey = `usageActive:${accountKey(account)}`;
      const active = await tx.get(activeKey) || 0;
      requireValue(active < maxConcurrent, 'Concurrency limit exceeded');
      const day = new Date(now).toISOString().slice(0, 10);
      const budgetKey = `usageBudget:${accountKey(account)}:${day}`;
      const budget = await tx.get(budgetKey) || { held: 0, spent: 0 };
      requireValue(budget.spent + budget.held + maxCostMicros <= dailyLimitMicros, 'Daily spending limit exceeded');
      const record = { account, operationId, fingerprint, maximum: maxCostMicros, status: 'reserved', day, createdAt: now };
      await tx.put(balanceKey, balance - maxCostMicros);
      await tx.put(budgetKey, { ...budget, held: budget.held + maxCostMicros });
      await tx.put(activeKey, active + 1);
      await tx.put(key, record);
      return { ...record, replay: false };
    });
  }

  async begin(account, operationId) {
    return this.storage.transaction(async tx => {
      const key = operationKey(account, operationId);
      const record = await tx.get(key);
      requireValue(record, 'Unknown usage reservation');
      if (record.status !== 'reserved') return { dispatch: false, record };
      requireValue(!await tx.get(`usageBlocked:${accountKey(account)}`), 'Account requires reconciliation');
      const next = { ...record, status: 'dispatched' };
      await tx.put(key, next);
      return { dispatch: true, record: next };
    });
  }

  async uncertain(account, operationId) {
    return this.storage.transaction(async tx => {
      const key = operationKey(account, operationId);
      const record = await tx.get(key);
      requireValue(record, 'Unknown usage reservation');
      if (record.status === 'dispatched') await tx.put(key, { ...record, status: 'uncertain' });
      // A network timeout or disconnected stream is not evidence of zero cost.
      return { held: !['settled', 'released'].includes(record.status) };
    });
  }

  async finish({ account, operationId, actualCostMicros, providerRequestId, confirmedNoCharge = false }) {
    requireValue(money(actualCostMicros), 'Invalid actual cost');
    return this.storage.transaction(async tx => {
      const key = operationKey(account, operationId);
      const record = await tx.get(key);
      requireValue(record, 'Unknown usage reservation');
      const zero = actualCostMicros === 0 && confirmedNoCharge;
      requireValue(zero || identity(providerRequestId), 'Trusted provider evidence required');
      if (['settled', 'released'].includes(record.status)) {
        requireValue(record.actual === actualCostMicros && record.providerRequestId === (providerRequestId || null), 'Conflicting settlement replay');
        return { ...record, replay: true };
      }
      if (record.observedCost !== undefined) {
        requireValue(record.observedCost === actualCostMicros && record.providerRequestId === providerRequestId, 'Over-bound evidence requires manual reconciliation');
        return { needsReview: true };
      }
      requireValue(record.status !== 'reserved' || zero, 'Usage was not dispatched');
      if (actualCostMicros > record.maximum) {
        const receiptKey = `usageProvider:${encodeURIComponent(providerRequestId)}`;
        const owner = await tx.get(receiptKey);
        requireValue(!owner || owner === key, 'Provider receipt already belongs to another operation');
        await tx.put(receiptKey, key);
        await tx.put(`usageBlocked:${accountKey(account)}`, true);
        await tx.put(key, { ...record, status: 'uncertain', observedCost: actualCostMicros, providerRequestId });
        return { needsReview: true }; // Keep the hold; never silently underbill or overdraw.
      }
      if (providerRequestId) {
        const receiptKey = `usageProvider:${encodeURIComponent(providerRequestId)}`;
        const owner = await tx.get(receiptKey);
        requireValue(!owner || owner === key, 'Provider receipt already belongs to another operation');
        await tx.put(receiptKey, key);
      }
      const balanceKey = `usageBalance:${accountKey(account)}`;
      const balance = await tx.get(balanceKey);
      requireValue(money(balance) && Number.isSafeInteger(balance + record.maximum - actualCostMicros), 'Invalid authoritative balance');
      const budgetKey = `usageBudget:${accountKey(account)}:${record.day}`;
      const budget = await tx.get(budgetKey);
      const activeKey = `usageActive:${accountKey(account)}`;
      const active = await tx.get(activeKey);
      requireValue(budget && budget.held >= record.maximum && active > 0, 'Inconsistent reservation counters');
      const next = { ...record, status: zero ? 'released' : 'settled', actual: actualCostMicros, providerRequestId: providerRequestId || null };
      await tx.put(balanceKey, balance + record.maximum - actualCostMicros);
      await tx.put(budgetKey, { held: budget.held - record.maximum, spent: budget.spent + actualCostMicros });
      await tx.put(activeKey, active - 1);
      await tx.put(key, next);
      return { ...next, replay: false };
    });
  }
}
