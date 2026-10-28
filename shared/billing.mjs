// Amounts are presentment USD. Settlement currency and bank configuration are independent.
export const BILLING_POLICY = 'usd-v1';
export const STRIPE_API_VERSION = '2026-09-30.endive';
export function requireUsd(body) {
  if (body.currency !== undefined && body.currency !== 'usd' && body.currency !== 'USD') throw new Error('Only USD payments are supported.');
}
export function depositQuote(amount) {
  const net = Number(amount);
  if (!Number.isFinite(net) || net < 1 || net > 50000 || Math.abs(net * 100 - Math.round(net * 100)) > 1e-7) throw new Error('Credit amounts must be USD cents between $1 and $50,000.');
  const grossAmountCents = Math.ceil(((net + .30) / (1 - .029)) * 100);
  return { netDepositedUsd: net, grossAmountCents, grossChargedUsd: grossAmountCents / 100, estimatedStripeFeeUsd: Number((grossAmountCents / 100 - net).toFixed(2)) };
}
export function subscriptionQuote(body) {
  requireUsd(body);
  const plan = body.plan || 'ultra-custom';
  const billing = body.billing || body.billing_interval || 'monthly';
  if (!['monthly', 'yearly'].includes(billing)) throw new Error('Invalid billing interval.');
  let quotas, monthly, yearly;
  if (['pro', 'pro-250k', 'pro-350k'].includes(plan)) { monthly = 19.99; yearly = 204; quotas = [0, 25000, 2200000, 30, 50]; }
  else if (['pro-max', 'pro-max-750k'].includes(plan)) { monthly = 39.99; yearly = 408; quotas = [0, 75000, 4800000, 75, 150]; }
  else if (plan === 'ultra-custom') {
    const names = ['dubbing_mins', 'voice_credits', 'text_chars', 'transcribe_mins', 'image_count'];
    const limits = [60000, 10000000, 10000000, 6000, 1000];
    const defaults = [30, 1200000, 5000000, 120, 50];
    quotas = names.map((name, i) => {
      const n = Number(body[name] ?? defaults[i]);
      if (!Number.isSafeInteger(n) || n < 0 || n > limits[i]) throw new Error('Invalid subscription quota.');
      return n;
    });
    monthly = Math.round((29 + quotas[0]*3.5 + quotas[1]*.00007 + quotas[2]*.000006 + quotas[3]*.017 + quotas[4]*.12)*100)/100;
    yearly = Math.round(monthly*12*.85*100)/100;
  } else throw new Error('Unknown subscription plan.');
  return { plan, billing, quotas, monthly, yearly, amountCents: Math.round((billing === 'yearly' ? yearly : monthly)*100) };
}
export function assertSession(session, order) {
  if (!order || order.id !== session.id || order.policy !== BILLING_POLICY) throw new Error('Checkout needs manual review: no matching server order.');
  if (session.currency !== 'usd' || session.presentment_details?.presentment_currency && session.presentment_details.presentment_currency !== 'usd') throw new Error('Unexpected payment currency.');
  if (session.mode !== order.mode || session.amount_total !== order.amountCents || (session.metadata?.userEmail || (order.isGift ? session.metadata?.senderEmail : null)) !== order.email) throw new Error('Checkout does not match its server order.');
  if (session.status !== 'complete' || session.payment_status !== 'paid') throw new Error('Payment has not succeeded.');
  return order;
}
export function paymentEvidence(session) {
  if (session.mode === 'subscription') {
    const invoice = session.subscription?.latest_invoice;
    if (invoice?.status !== 'paid' || invoice.currency !== 'usd' || !Number.isSafeInteger(invoice.amount_paid) || invoice.amount_paid <= 0) throw new Error('Subscription invoice is not paid in USD.');
    const pi = invoice.payment_intent || invoice.payments?.data?.find(x => x.status === 'paid')?.payment?.payment_intent;
    return pi;
  }
  return session.payment_intent;
}
export function assertCharge(session) {
  const pi = paymentEvidence(session);
  const charge = pi?.latest_charge;
  const expectedAmount = session.mode === 'subscription' ? session.subscription.latest_invoice.amount_paid : session.amount_total;
  for (const object of [pi, charge]) {
    if (object?.presentment_details?.presentment_currency && object.presentment_details.presentment_currency !== 'usd') throw new Error('Localized presentment is forbidden.');
  }
  if (charge?.disputed) throw new Error('Disputed payment requires review.');
  if (pi?.status !== 'succeeded' || pi.currency !== 'usd' || pi.amount_received !== expectedAmount || charge?.status !== 'succeeded' || charge.paid !== true || charge.currency !== 'usd' || charge.amount !== expectedAmount) throw new Error('No matching successful USD charge.');
  if (!Number.isSafeInteger(charge.amount_refunded) || charge.amount_refunded < 0 || charge.amount_refunded > charge.amount) throw new Error('Invalid refund evidence.');
  return charge;
}
export function netCreditCents(order, charge) {
  // Any refund before fulfillment holds the order for review. After fulfillment,
  // refund deductions are cumulative and proportional, rounded up to a cent.
  return Math.max(0, order.netCents - Math.ceil(order.netCents * charge.amount_refunded / charge.amount));
}
export async function retrieveCheckout(id, key, fetcher = fetch) {
  if (!/^cs_(test|live)_[A-Za-z0-9_]+$/.test(id)) throw new Error('Invalid Checkout Session ID.');
  const params = new URLSearchParams();
  params.append('expand[]', 'payment_intent.latest_charge');
  params.append('expand[]', 'subscription.latest_invoice');
  const response = await fetcher(`https://api.stripe.com/v1/checkout/sessions/${id}?${params}`, { headers: { Authorization: `Bearer ${key}`, 'Stripe-Version': STRIPE_API_VERSION } });
  const session = await response.json();
  if (!response.ok) throw new Error('Stripe Checkout lookup failed.');
  if (session.mode === 'subscription') {
    const invoice = session.subscription?.latest_invoice;
    if (invoice?.id) {
      const invRes = await fetcher(`https://api.stripe.com/v1/invoices/${invoice.id}?expand[]=payments.data.payment.payment_intent`, { headers: { Authorization: `Bearer ${key}`, 'Stripe-Version': STRIPE_API_VERSION } });
      if (!invRes.ok) throw new Error('Stripe invoice lookup failed.');
      const expanded = await invRes.json();
      session.subscription.latest_invoice = expanded;
      let pi = expanded.payment_intent || expanded.payments?.data?.find(x => x.status === 'paid')?.payment?.payment_intent;
      if (pi) {
        const piRes = await fetcher(`https://api.stripe.com/v1/payment_intents/${typeof pi === 'string' ? pi : pi.id}?expand[]=latest_charge`, { headers: { Authorization: `Bearer ${key}`, 'Stripe-Version': STRIPE_API_VERSION } });
        if (!piRes.ok) throw new Error('Stripe payment lookup failed.');
        expanded.payment_intent = await piRes.json();
      }
    }
  }
  return session;
}
