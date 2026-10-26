# Gifts sent from the signed-in user's Gmail

The recipient demo is available at:
https://ikonikstation.github.io/lingofusion-developers/playground/?gift_preview=1

It shows the same email template and claim card used by real gifts. The demo uses
sample data and local UI state: it does not create a payment, email, gift record,
redemption, or wallet credit.

## Enable actual Gmail delivery

1. In the Google Cloud project for the existing `GOOGLE_CLIENT_ID`, enable the
   Gmail API. Add `https://www.googleapis.com/auth/gmail.send` to the OAuth consent
   configuration. Google requires verification for a public app using this scope:
   https://developers.google.com/workspace/gmail/api/auth/scopes
2. Add this exact authorized redirect URI to the OAuth web client:
   `https://lingofusion-gateway.lingofusion-api.workers.dev/api/gifts/gmail/callback`
3. Store that OAuth client's secret using `wrangler secret put GOOGLE_CLIENT_SECRET`.
   Keep it in Cloudflare Secrets, never frontend environment variables or Git.
4. In Stripe, register this webhook endpoint for `checkout.session.completed` and
   `checkout.session.async_payment_succeeded`:
   `https://lingofusion-gateway.lingofusion-api.workers.dev/api/gifts/stripe-webhook`.
   Store its signing secret using `wrangler secret put STRIPE_GIFT_WEBHOOK_SECRET`.
5. Deploy the Worker with `wrangler deploy`. Its `GiftClaims` Durable Object binding
   and migration are declared in `wrangler.toml`.

Each sender signs in with Google and chooses **Connect Gmail** in the gifting
screen. That opens Google's separate consent flow for sending email. The callback
checks that the consenting Gmail account matches the signed-in LingoFusion account.
Refresh tokens stay encrypted in server-side storage. Google sign-in alone never
sends mail or grants Gmail access.

Actual gift checkout stays disabled until the gateway and sender connection are
ready. The server chooses the sender from the verified session, not an editable
email field. After Stripe confirms payment, the gift is stored without expiration
and its email is sent through that user's Gmail mailbox to the entered recipient.
A signed payment webhook handles delivery even when the purchaser closes the page.
Provider failures cause webhook retries, rather than being silently ignored.

The recipient follows the email link and signs in with the matching email address.
The claim processor binds redemption to that account and serializes claims so the
same gift cannot credit twice. The sender does not receive the gifted credits.

## Checks without purchases or email

Run `node scripts/test-gifts.mjs`. Every provider request is mocked and any unexpected
network request is blocked. The checks cover Gmail token encryption and account
binding, consent and PKCE, paid versus unpaid and unsigned webhooks, delivery retry,
recipient ownership, concurrent claims, non-expiring gifts, and escaped email HTML.
