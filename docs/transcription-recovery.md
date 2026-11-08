# Live transcription recovery

Live microphone sessions reserve credit before connecting to the provider.
A connection claim prevents ticket reuse; it does not prove that audio was sent.

The authenticated `/api/transcription/recover` route operates only on the
signed-in account's existing live-transcription reservation. It never starts
provider work. File-transcription requests use their existing status path.

- Settled sessions replay their existing transcript and charge.
- Unclaimed sessions return the reservation immediately.
- Provider connection/setup errors before any audio release the hold immediately.
- Active claimed sessions retain the hold and return a retry interval.
- Unresolved expired sessions settle from the last durable transcript/audio
  checkpoint and return the unused reservation. Without a checkpoint, the
  customer is charged zero; any unverified provider cost is absorbed by the
  merchant. This release is not proof of zero provider usage.

The expiry is the server-recorded claim time plus the maximum audio duration
and 120 seconds for connection/finalization. Legacy claims without a timestamp
also allow the original 120-second ticket lifetime. Clients cannot choose the
reservation age, audio duration, price, refund amount or account being recovered.

Before transcript output is forwarded to the browser, the gateway durably saves
its text, the audio samples already sent and the provider request identity.
Recovery is serialized with settlement and credits the unused hold once;
repeated recovery cannot add credit or dispatch another provider request.
Complimentary accounts never gain balance from releasing a hold.

The Playground checks pending sessions on reload. Recovery either restores the
available transcript, explains that a session is still finishing, or clears the
expired hold so another transcription can start.

Validation uses synthetic provider sockets and isolated balances, including
startup failure, interrupted audio, legacy expiry, concurrent recovery, partial
transcripts, settled replay, account isolation and complimentary balances.
