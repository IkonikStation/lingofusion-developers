# Superseded prompt-service billing draft

The owner replaced this policy on November 4, 2026: keep current input/output
token prices and bill the full provider input, including the system prompt.

See [the current local token billing policy](token-billing.md).
The service-fee and character-pricing proposals are superseded. No starting
service fee or character minimum is part of the selected policy.

The local implementation retains prepaid reservations, authoritative provider
usage, owner-bound idempotency, receipt deduplication, streaming settlement,
and read-only recovery of ambiguous requests. Its customer prices now come
from full input/output token usage at the existing rates. Production deployment
and real-provider verification have not occurred.
