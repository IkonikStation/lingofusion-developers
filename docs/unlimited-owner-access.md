# Account-specific unlimited access

The Cloudflare gateway may grant one authenticated account unlimited prepaid usage. Its private `UNLIMITED_OWNER_EMAIL_SHA256` setting contains exactly one lowercase SHA-256 digest of the verified owner's normalized email address. An absent or malformed setting grants unlimited access to nobody. The account address and configured digest are not shipped in the site bundle or committed to this repository.

The gateway derives account identity from a verified session or active API key. It never accepts a client-provided unlimited flag or target email as entitlement evidence. The billing ledger checks the configured identity itself before reservations and legacy media deductions.

- Unlimited requests still have normal model limits, bounded provider dispatch, idempotency, usage evidence and reconciliation.
- Complimentary reservations hold no prepaid money. Settlement records reference usage cost and `billedMicros: 0`; status exposes `complimentary: true` and `billed_usd: 0`.
- Cancellation/replay cannot turn a complimentary reservation into spendable credit. Each reservation remembers whether it actually held prepaid funds, including across entitlement changes.
- Existing prepaid balances stay finite. JSON and storage never contain numeric Infinity. The UI renders `∞` from the authenticated balance response's `unlimited_balance` flag.
- Account switches clear the UI entitlement. Other accounts retain normal reservations, deductions and insufficient-funds rejection.
- Purchases, paid subscriptions and gifts retain their existing verified payment rules. Unlimited access does not create gift credit or add money to a wallet.
- Provider usage still costs the service owner money. This entitlement waives deductions from the owner's prepaid account; it does not grant free OpenAI or other provider service.

Only a deployment administrator can configure or remove this setting. Removing it disables future complimentary requests; previously dispatched requests settle under their original reservation policy.

`npm run test:unlimited-balance` exercises the configured owner, normal customers, spoofed identities, concurrent reservations, replay, cancellation, revocation, zero-credit dispatch and legacy media deductions using synthetic providers and storage only.
