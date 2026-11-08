import { AUDIO_RATE, audioCharge } from '../shared/transcription.mjs';
import { assertSession, assertCharge, depositQuote, BILLING_POLICY, netCreditCents } from '../shared/billing.mjs';

export async function billing(env, body) {
  if (!env.BILLING || !env.GIFTS) throw new Error('Secure billing storage is not configured.');
  const response = await env.BILLING.get(env.BILLING.idFromName('ledger-v1')).fetch('https://billing/internal', { method: 'POST', body: JSON.stringify(body) });
  const value = await response.json();
  if (!response.ok) {
    const error = new Error(value.message || 'Billing operation failed.');
    error.status = response.status;
    error.code = value.error;
    throw error;
  }
  return value;
}

// All credit writers (deposits, gifts and refunds) share a strongly consistent ledger.
// KV is a compatibility projection, never the source of truth after first adoption.
export class BillingLedger {
  constructor(state, env) { this.state = state; this.env = env; }
  async unlimited(email) {
    const ownerHash = this.env.UNLIMITED_OWNER_EMAIL_SHA256;
    if (!/^[a-f0-9]{64}$/.test(ownerHash || '') || typeof email !== 'string') return false;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.trim().toLowerCase()));
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('') === ownerHash;
  }
  async initial(email) {
    const saved = await this.state.storage.get(`balance:${email}`);
    if (saved !== undefined) return saved;
    const value = Number(await this.env.GIFTS.get(`user_balance:${email}`) || 0);
    if (!Number.isFinite(value)) throw new Error('Existing balance needs review.');
    return value;
  }
  async project() {
    const pending = await this.state.storage.get('projection');
    if (!pending) return;
    for (const [email, balance] of Object.entries(pending)) await this.env.GIFTS.put(`user_balance:${email}`, String(balance));
    await this.state.storage.delete('projection');
    await this.state.storage.deleteAlarm();
  }
  async write(entries, balances = {}) {
    await this.state.storage.transaction(async storage => {
      for (const [key, value] of Object.entries(entries)) await storage.put(key, value);
      for (const [email, value] of Object.entries(balances)) await storage.put(`balance:${email}`, value);
      await storage.put('projection', balances);
      await storage.setAlarm(Date.now() + 10000);
    });
    // A projection failure must not roll back a committed credit or retry it.
    await this.project().catch(() => {});
  }
  async alarm() { await this.state.blockConcurrencyWhile(() => this.project()); }
  async usageResult(key, record) {
    if (!record.resultChunks) return record.result;
    let raw = '';
    for (let i = 0; i < record.resultChunks; i++) {
      const part = await this.state.storage.get(`${key}:result:${i}`);
      if (typeof part !== 'string') throw new Error('Stored response requires reconciliation.');
      raw += part;
    }
    return JSON.parse(raw);
  }
  async fetch(request) {
    return this.state.blockConcurrencyWhile(async () => {
      try {
        await this.project();
        const { action, email, order, session, delta, operationId, gifts, hold, gift, fingerprint, maximumMicros, actualMicros, result, evidence, liveCheckpoint } = await request.json();
        const storage = this.state.storage;
        if (action === 'usageStatus') {
          if (!email || !/^[A-Za-z0-9_-]{1,100}$/.test(operationId || '')) throw new Error('Invalid usage identity.');
          const record = await storage.get(`meteredUsage:${email}:${operationId}`);
          if (!record) return Response.json({ error: 'usage_not_found' }, { status: 404 });
          return Response.json({ operation_id: operationId, status: record.status,
            held_usd: record.status === 'settled' || record.unlimited ? 0 : record.maximumMicros / 1e6,
            cost_usd: record.actualMicros === undefined ? null : record.actualMicros / 1e6,
            billed_usd: record.actualMicros === undefined ? null : (record.unlimited ? 0 : record.actualMicros / 1e6),
            complimentary: record.unlimited === true,
            result: record.status === 'settled' ? await this.usageResult(`meteredUsage:${email}:${operationId}`, record) : null,
            balance_usd: await this.initial(email) });
        }
        if (['usageCancelUnclaimedLive', 'usageRecoverLive', 'usageReleaseUnsentLive'].includes(action)) {
          if (!email || !/^[A-Za-z0-9_-]{1,100}$/.test(operationId || '')) throw new Error('Invalid usage identity.');
          const key = `meteredUsage:${email}:${operationId}`;
          const prior = await storage.get(key);
          if (!prior || !prior.fingerprint?.startsWith('live-transcribe-v1:')) throw new Error('Unknown live session.');
          if (prior.status === 'settled') return Response.json({ result: await this.usageResult(key, prior), balance_usd: await this.initial(email) });
          const maxSeconds = Number(prior.fingerprint.slice('live-transcribe-v1:'.length));
          if (!Number.isInteger(maxSeconds) || maxSeconds < 1 || maxSeconds > 180 || !Number.isFinite(prior.createdAt)) throw new Error('Invalid live session record.');
          // Leave enough time for connection setup, the bounded session and final events.
          const claimStart = prior.liveClaimedAt ?? prior.createdAt + 120000;
          const recoverAt = claimStart + (maxSeconds + 120) * 1000;
          if (prior.liveClaimed && action === 'usageCancelUnclaimedLive') throw new Error('Provider session was claimed; reconciliation required.');
          if (prior.liveClaimed && action === 'usageRecoverLive' && Date.now() < recoverAt) {
            return Response.json({ pending: true, operation_id: operationId,
              retry_after_seconds: Math.max(1, Math.ceil((recoverAt - Date.now()) / 1000)),
              held_usd: prior.unlimited ? 0 : prior.maximumMicros / 1e6,
              message: 'This live session is still finishing. Check again shortly; its reserved credit will be returned if no final result arrives.' });
          }
          // Expired, unresolved live sessions receive a customer-favorable release.
          // This is not evidence of zero provider cost: the merchant absorbs unknown usage.
          // usageReleaseUnsentLive is internal-only and called before audio can be sent.
          const expiredClaim = prior.liveClaimed && action === 'usageRecoverLive';
          const checkpoint = prior.liveCheckpoint;
          if (action === 'usageReleaseUnsentLive' && checkpoint?.samples > 0) throw new Error('Audio was already sent.');
          const recoveredMicros = checkpoint ? audioCharge(checkpoint.samples, 30000) : 0;
          const receiptEntries = {};
          if (checkpoint) {
            const receiptKey = `meteredProvider:${checkpoint.providerRequestId}`;
            const receiptOwner = await storage.get(receiptKey);
            if (receiptOwner && receiptOwner !== key) throw new Error('Provider receipt reused.');
            receiptEntries[receiptKey] = key;
          }
          const result = { model: 'LingoFusion Live Transcribe', text: checkpoint?.text || '', duration_seconds: checkpoint ? checkpoint.samples / AUDIO_RATE : 0, cost_usd: recoveredMicros / 1e6, operation_id: operationId,
            recovery_status: checkpoint ? 'partial' : 'released',
            notice: checkpoint ? 'Recovered the available transcript. Billed only for recorded audio usage; unused reserved credit returned.' : expiredClaim ? 'The live session ended without a final result. Reserved credit returned. You can start a new transcription.' : 'No audio was transcribed. Reserved credit returned. You can start a new transcription.' };
          const recoveryEvidence = expiredClaim
            ? { expiredLiveRecovery: true, providerCostUnknown: true, merchantAbsorbsUnverifiedUsage: true, ...(checkpoint || {}), recoveredAt: Date.now() }
            : action === 'usageReleaseUnsentLive' ? { confirmedNoAudio: true } : { confirmedNoDispatch: true };
          const balance = (Math.round((await this.initial(email)) * 1e6) + (prior.unlimited ? 0 : prior.maximumMicros - recoveredMicros)) / 1e6;
          await this.write({ ...receiptEntries, [key]: { ...prior, status: 'settled', actualMicros: recoveredMicros, billedMicros: prior.unlimited ? 0 : recoveredMicros, result, evidence: recoveryEvidence } }, { [email]: balance });
          return Response.json({ result, balance_usd: balance });
        }
        if (['usageReserve', 'usageFinish', 'usageUncertain', 'usageClaimLive', 'usageLiveCheckpoint'].includes(action)) {
          if (!email || !operationId || operationId.length > 100 || !fingerprint) throw new Error('Invalid usage identity.');
          const key = `meteredUsage:${email}:${operationId}`;
          const prior = await storage.get(key);
          if (prior && prior.fingerprint !== fingerprint) throw new Error('Idempotency conflict.');
          if (action === 'usageReserve') {
            if (prior) return Response.json({ ...prior, result: await this.usageResult(key, prior), replay: true, balance_usd: await this.initial(email) });
            if (!Number.isSafeInteger(maximumMicros) || maximumMicros <= 0) throw new Error('Invalid reservation.');
            const available = Math.round((await this.initial(email)) * 1e6);
            const unlimited = await this.unlimited(email);
            if (!unlimited && available < maximumMicros) return Response.json({ message: 'Insufficient available funds.' }, { status: 402 });
            // The durable record is written before dispatch. Replays never redispatch.
            const record = { fingerprint, maximumMicros, ...(unlimited ? { unlimited: true } : {}), status: 'dispatched', createdAt: Date.now() };
            await this.write({ [key]: record }, unlimited ? {} : { [email]: (available - maximumMicros) / 1e6 });
            return Response.json({ ...record, replay: false });
          }
          if (!prior) throw new Error('Unknown reservation.');
          if (action === 'usageLiveCheckpoint') {
            const maxSeconds = Number(prior.fingerprint.slice('live-transcribe-v1:'.length));
            if (!prior.fingerprint.startsWith('live-transcribe-v1:') || !prior.liveClaimed || prior.status !== 'dispatched' ||
                !Number.isSafeInteger(liveCheckpoint?.samples) || liveCheckpoint.samples < (prior.liveCheckpoint?.samples || 0) ||
                liveCheckpoint.samples > maxSeconds * AUDIO_RATE || typeof liveCheckpoint.text !== 'string' ||
                new TextEncoder().encode(liveCheckpoint.text).length > 60000 ||
                typeof liveCheckpoint.providerRequestId !== 'string' || !liveCheckpoint.providerRequestId ||
                (prior.liveCheckpoint && prior.liveCheckpoint.providerRequestId !== liveCheckpoint.providerRequestId)) throw new Error('Invalid live checkpoint.');
            await storage.put(key, { ...prior, liveCheckpoint });
            return Response.json({ saved: true });
          }
          if (action === 'usageClaimLive') {
            if (prior.status !== 'dispatched' || prior.liveClaimed) throw new Error('Live session already claimed.');
            await storage.put(key, { ...prior, liveClaimed: true, liveClaimedAt: Date.now() });
            return Response.json({ claimed: true });
          }
          if (action === 'usageUncertain') {
            if (prior.status !== 'settled') await storage.put(key, { ...prior, status: 'uncertain' });
            return Response.json({ held: prior.status !== 'settled' });
          }
          if (prior.status === 'settled') {
            if (prior.actualMicros !== actualMicros) throw new Error('Conflicting settlement.');
            return Response.json({ ...prior, replay: true, balance_usd: await this.initial(email) });
          }
          if (!Number.isSafeInteger(actualMicros) || actualMicros < 0 || actualMicros > prior.maximumMicros || !evidence?.providerRequestId) {
            throw new Error('Verified bounded provider usage required.');
          }
          const receiptKey = `meteredProvider:${evidence.providerRequestId}`;
          const receiptOwner = await storage.get(receiptKey);
          if (receiptOwner && receiptOwner !== key) throw new Error('Provider receipt reused.');
          const serialized = JSON.stringify(result);
          if (typeof serialized !== 'string' || new TextEncoder().encode(serialized).length > 2000000) throw new Error('Response exceeds durable replay limit.');
          const resultEntries = {};
          const resultChunks = serialized.length > 16000 ? Math.ceil(serialized.length / 16000) : 0;
          for (let i = 0; i < resultChunks; i++) resultEntries[`${key}:result:${i}`] = serialized.slice(i * 16000, (i + 1) * 16000);
          const next = { ...prior, status: 'settled', actualMicros, billedMicros: prior.unlimited ? 0 : actualMicros, result: resultChunks ? undefined : result, resultChunks, evidence };
          const balance = Math.round((await this.initial(email)) * 1e6) + (prior.unlimited ? 0 : prior.maximumMicros - actualMicros);
          await this.write({ ...resultEntries, [key]: next, [receiptKey]: key }, { [email]: balance / 1e6 });
          return Response.json({ ...next, balance_usd: balance / 1e6 });
        }
        if (action === 'order') {
          const existing = await storage.get(`order:${order.id}`);
          if (existing && JSON.stringify(existing) !== JSON.stringify(order)) throw new Error('Conflicting order.');
          await storage.put(`order:${order.id}`, order);
          return Response.json({ recorded: true });
        }
        if (action === 'subscriptionStatus') {
          await storage.put(`stripeSubscriptionStatus:${session.id}`, session.status);
          const owner = await storage.get(`subscriptionOwner:${session.id}`);
          if (!owner) return Response.json({ received: true });
          const previous = await storage.get(`subscription:${owner}`);
          if (previous?.id === session.id) await storage.put(`subscription:${owner}`, { ...previous, status: session.status });
          return Response.json({ received: true });
        }
        if (action === 'balance') {
          const subscription = await storage.get(`subscription:${email}`) || null;
          if (subscription?.periodEnd && subscription.periodEnd * 1000 <= Date.now()) subscription.status = 'expired';
          return Response.json({ balance_usd: await this.initial(email), unlimited_balance: await this.unlimited(email), subscription });
        }
        if (action === 'grantTestCredit' || action === 'grantSpecialOffer') {
          throw new Error('Promotional credit grants are disabled.');
        }
        if (action === 'deduct') {
          if (!Number.isFinite(delta) || delta >= 0 || !operationId || operationId.length > 100) throw new Error('Only authenticated usage deductions are accepted.');
          const key = `deduct:${email}:${operationId}`;
          if (!await storage.get(key)) {
            const unlimited = await this.unlimited(email);
            await this.write({ [key]: unlimited ? { unlimited: true, usageDelta: delta, billedMicros: 0, createdAt: Date.now() } : true }, unlimited ? {} : { [email]: Number(((await this.initial(email)) + delta).toFixed(6)) });
          }
          return Response.json({ balance_usd: await this.initial(email) });
        }
        if (action === 'settle') {
          const saved = await storage.get(`order:${session.id}`);
          assertSession(session, saved);
          const charge = assertCharge(session);
          const tombstone = await storage.get(`refund:${charge.id}`);
          if (tombstone && (tombstone.hold || tombstone.amount_refunded > charge.amount_refunded)) throw new Error("Payment was refunded or disputed before fulfillment.");
          const key = `payment:${session.id}`;
          const previous = await storage.get(key);
          if (previous && (previous.disputed || charge.amount_refunded < (previous.refundedCents || 0))) throw new Error("Stale payment evidence; retry with current Stripe state.");
          const legacy = await this.env.GIFTS.get(`stripe_session:${session.id}`);
          // Do not retroactively change already fulfilled historical payments.
          if (legacy && !previous) throw new Error('Legacy payment requires manual reconciliation.');
          const owner = saved.email;
          if (saved.mode === 'subscription') {
            if (await storage.get(`stripeSubscriptionStatus:${session.subscription.id}`) === 'canceled') throw new Error('Canceled subscription cannot be reactivated.');
            if (charge.amount_refunded) throw new Error('Refunded subscription requires review.');
            const subscription = { ...saved.subscription, id: session.subscription.id, status: 'active', currency: 'usd', periodEnd: session.subscription.latest_invoice.lines?.data?.[0]?.period?.end || session.subscription.latest_invoice.period_end, invoiceId: session.subscription.latest_invoice.id };
            await this.write({ [key]: { ...previous, subscription: true }, [`subscription:${owner}`]: subscription, [`subscriptionOwner:${session.subscription.id}`]: owner });
            return Response.json({ verified: true, payment_status: 'paid', mode: 'subscription', subscription, balance_usd: await this.initial(owner) });
          }
          const net = netCreditCents(saved, charge);
          if (!previous && charge.amount_refunded) throw new Error('Refunded payment requires review before fulfillment.');
          const target = saved.isGift ? previous?.claimedBy : owner;
          const credited = previous?.creditedCents || 0;
          const change = target ? net - credited : 0;
          const balances = target && change ? { [target]: Number(((await this.initial(target)) + change / 100).toFixed(6)) } : {};
          const record = { ...previous, chargeId: charge.id, refundedCents: charge.amount_refunded, creditedCents: target ? net : 0, availableCents: net, email: owner, isGift: saved.isGift };
          await this.write({ [key]: record, [`charge:${charge.id}`]: session.id }, balances);
          return Response.json({ verified: true, payment_status: 'paid', currency: 'usd', isGift: saved.isGift, alreadyProcessed: Boolean(previous), net_deposited_usd: saved.netCents / 100, gross_charged_usd: saved.amountCents / 100, balance_usd: await this.initial(owner) });
        }
        if (action === 'adoptGift') {
          // Preserve redeemability of pre-ledger gifts using fresh Stripe evidence.
          // This registers provenance only; claiming remains a separate atomic action.
          const legacy = JSON.parse(await this.env.GIFTS.get(`gift:${gift.code}`) || 'null');
          if (!legacy || legacy.claimed || legacy.stripeSessionId !== session.id || legacy.recipientEmail !== email) throw new Error('Legacy gift needs review.');
          const quote = depositQuote(legacy.amountUsd);
          const owner = session.metadata?.userEmail || session.metadata?.senderEmail;
          const expected = { id: session.id, policy: BILLING_POLICY, mode: 'payment', email: owner, amountCents: quote.grossAmountCents, netCents: Math.round(legacy.amountUsd * 100), isGift: true, recipientEmail: email };
          if (session.metadata?.isGift !== 'true' || session.metadata?.recipientEmail !== email || Number(session.metadata?.netDepositUsd || session.metadata?.topUpAmount) !== legacy.amountUsd || !owner) throw new Error('Legacy gift provenance mismatch.');
          assertSession(session, expected);
          const evidence = assertCharge(session);
          const tombstone = await storage.get(`refund:${evidence.id}`);
          if (evidence.amount_refunded || tombstone?.hold || tombstone?.amount_refunded) throw new Error('Refunded or disputed gift cannot be adopted.');
          const existing = await storage.get(`order:${session.id}`);
          if (!existing) await this.write({ [`order:${session.id}`]: expected, [`payment:${session.id}`]: { chargeId: evidence.id, refundedCents: 0, creditedCents: 0, availableCents: expected.netCents, email: owner, isGift: true }, [`charge:${evidence.id}`]: session.id });
          return Response.json({ verified: true });
        }
        if (action === 'giftCredit') {
          let amountCents = 0;
          const entries = {};
          const seen = new Set();
          for (const gift of gifts) {
            if (seen.has(gift.stripeSessionId)) continue;
            seen.add(gift.stripeSessionId);
            const saved = await storage.get(`order:${gift.stripeSessionId}`);
            const payment = await storage.get(`payment:${gift.stripeSessionId}`);
            if (!saved || !payment || !saved.isGift || saved.recipientEmail !== email || (payment.refundedCents || payment.disputed)) throw new Error('Gift payment needs verification or manual review.');
            if (payment.claimedBy && payment.claimedBy !== email) throw new Error('Gift already claimed.');
            if (!payment.claimedBy) {
              amountCents += payment.availableCents;
              entries[`payment:${gift.stripeSessionId}`] = { ...payment, claimedBy: email, creditedCents: payment.availableCents };
            }
          }
          if (amountCents) await this.write(entries, { [email]: Number(((await this.initial(email)) + amountCents / 100).toFixed(6)) });
          return Response.json({ balance_usd: await this.initial(email), amount: amountCents / 100 });
        }
        if (action === 'refund') {
          const id = await storage.get(`charge:${session.id}`);
          if (!id) {
            const prior = await storage.get(`refund:${session.id}`);
            await storage.put(`refund:${session.id}`, { amount_refunded: Math.max(prior?.amount_refunded || 0, session.amount_refunded || 0), hold: hold === undefined ? prior?.hold : hold });
            return Response.json({ received: true, manualReview: true });
          }
          const saved = await storage.get(`order:${id}`);
          const previous = await storage.get(`payment:${id}`);
          if (previous.subscription) return Response.json({ received: true, manualReview: true });
          if (session.currency !== 'usd' || session.amount !== saved.amountCents || !Number.isSafeInteger(session.amount_refunded) || session.amount_refunded < (previous.refundedCents || 0) || session.amount_refunded > session.amount) throw new Error('Refund evidence is invalid or stale.');
          const disputed = hold === undefined ? previous.disputed : hold;
          const net = disputed ? 0 : netCreditCents(saved, session);
          const target = saved.isGift ? previous.claimedBy : saved.email;
          const change = target ? net - previous.creditedCents : 0;
          await this.write({ [`payment:${id}`]: { ...previous, disputed, refundedCents: session.amount_refunded, availableCents: net, creditedCents: target ? net : 0 } }, target && change ? { [target]: Number(((await this.initial(target)) + change / 100).toFixed(6)) } : {});
          return Response.json({ received: true });
        }
        throw new Error('Unknown billing operation.');
      } catch (error) { return Response.json({ message: error.message }, { status: 409 }); }
    });
  }
}
