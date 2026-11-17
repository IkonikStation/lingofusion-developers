# Google OAuth verification preparation

This is a preparation draft, not a submitted application or a published privacy policy.

## Requested Gmail scope

`https://www.googleapis.com/auth/gmail.send` lets a signed-in user choose to
connect their Gmail account so that LingoFusion can send a gift notification from
that account to the recipient they specify. After Stripe confirms payment, the
message includes a claim link and an optional note supplied by the sender. The app
does not request permission to read the sender's mailbox. Google sign-in alone does
not connect Gmail; the user must separately grant the send permission.

The gateway checks that the Google account granting access matches the signed-in
account. It stores the refresh token encrypted in Cloudflare KV and uses it to send
the notification through the Gmail API. Gift and payment records include the sender
and recipient addresses and gift details. Gift records have no expiry so that an
unclaimed gift remains available. A disconnect endpoint deletes the stored Gmail
token; users can also revoke access in their Google account.

## Outstanding review materials

- Verify a domain under the developer's control using Google Search Console's
  domain (DNS) method and use suitable URLs for the homepage and OAuth callback.
- Publish an accurate privacy policy linked from the homepage and consent screen.
  Confirm the operator's actual retention, deletion, support, and third-party data
  practices before making legal or policy commitments.
- Provide Google a demonstration of the actual OAuth consent and gift workflow.
  A safe test environment must avoid real charges and real gift emails.
- Explain the requested scope and submit the production app for Google review.
  Google decides whether the gift email use case meets its Gmail API policies.
