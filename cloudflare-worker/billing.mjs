import { assertSession, assertCharge, depositQuote, BILLING_POLICY, netCreditCents } from '../shared/billing.mjs';

export async function billing(env, body) {
  if (!env.BILLING || !env.GIFTS) throw new Error('Secure billing storage is not configured.');
  const response = await env.BILLING.get(env.BILLING.idFromName('ledger-v1')).fetch('https://billing/internal', { method: 'POST', body: JSON.stringify(body) });
  const value = await response.json();
  if (!response.ok) throw new Error(value.message || 'Billing operation failed.');
  return value;
}

// All credit writers (deposits, gifts and refunds) share a strongly consistent ledger.
// KV is a compatibility projection, never the source of truth after first adoption.
export class BillingLedger {
  constructor(state, env) { this.state = state; this.env = env; }
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
  async fetch(request) {
    return this.state.blockConcurrencyWhile(async () => {
      try {
        await this.project();
        const { action, email, order, session, delta, operationId, gifts, hold, gift } = await request.json();
        const storage = this.state.storage;
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
          return Response.json({ balance_usd: await this.initial(email), subscription });
        }
        if (action === 'deduct') {
          if (!Number.isFinite(delta) || delta >= 0 || !operationId || operationId.length > 100) throw new Error('Only authenticated usage deductions are accepted.');
          const key = `deduct:${email}:${operationId}`;
          if (!await storage.get(key)) await this.write({ [key]: true }, { [email]: Number(((await this.initial(email)) + delta).toFixed(6)) });
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
