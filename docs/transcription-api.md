# Transcription

| Public model | OpenAI model | Retail USD / minute |
| --- | --- | --- |
| LingoFusion Transcribe | gpt-transcribe | $0.01 |
| LingoFusion Live Transcribe | gpt-live-transcribe | $0.03 |

Mini is removed from the public catalog. File transcription and microphone transcription are separate workflows. OpenAI's [file transcription guide](https://developers.openai.com/api/docs/guides/speech-to-text) and [live transcription guide](https://developers.openai.com/api/docs/guides/realtime-transcription) describe the upstream contracts.

The production gateway is `https://lingofusion-gateway.lingofusion-api.workers.dev`. HTTP requests require a signed account session or active customer API key in `Authorization: Bearer …`. OpenAI credentials stay on the server.

## Recorded audio

`POST /v1/audio/transcriptions` (also `/api/transcription/file`) accepts multipart fields `model=LingoFusion Transcribe` and `file`, plus an `Idempotency-Key` header of 1–100 letters, numbers, underscores or hyphens.

The gateway accepts canonical 44-byte-header, mono PCM16 WAV at 24 kHz, between 0.1 seconds and 180 seconds. The Playground accepts browser-decodable recordings up to 25 MB and converts them locally. External API callers must convert their own audio to this WAV format. Client-supplied duration and price fields do not control billing.

Success returns `model`, `text`, `duration_seconds`, `cost_usd`, `balance_usd`, and `operation_id`. Repeating the same operation and audio returns the durable receipt without submitting audio again. Different audio with the same operation ID is rejected.

## Live microphone audio

1. `POST /api/transcription/live` with an `Idempotency-Key`, JSON `{ "maximum_seconds": 60 }`, and bearer authentication. Bounds are 1–180 seconds; Playground uses 60. The maximum charge is reserved before provider dispatch.
2. Open the returned `websocket_url` with subprotocols `["lingofusion-transcription", ticket]`. The ticket expires after 120 seconds and can be claimed once. Treat it as a temporary credential.
3. Wait for `{ "type": "ready" }`. Send `{ "type": "input_audio_buffer.append", "audio": "<base64 PCM16>" }`. Audio must be mono little-endian PCM16 at 24 kHz, with no WAV header. Each frame is at most 48,000 bytes. The gateway commits turns every five seconds and enforces the reserved audio duration.
4. Consume `input_audio_buffer.committed`, `conversation.item.input_audio_transcription.delta`, and `conversation.item.input_audio_transcription.completed`. Order transcripts by committed item ID; completions can arrive out of order.
5. Send `{ "type": "finish" }` to stop. The server also emits `finishing` when the audio limit or session timeout is reached. Stop microphone capture then. A final `settled` event contains the transcript and receipt, and the socket closes. Frames already in transit after the limit are discarded.

The gateway sets `gpt-live-transcribe`, PCM format and manual turn detection; clients cannot override upstream configuration.

## Settlement and recovery

Audio cost is calculated from validated sample counts using integer microdollars: `ceil(samples × microdollars_per_minute / (24000 × 60))`. File rate is 10,000 microdollars per minute; live rate is 30,000. There is no additional service fee. Unused reserved credit is returned on settlement.

`GET /api/usage/:operation_id` returns the authenticated owner's operation status and settled receipt. `POST /api/transcription/cancel` with JSON `{ "operation_id": "…" }` refunds a live reservation only if no provider socket has claimed it. Cancellation and socket claim are serialized atomically; replayed cancellation never refunds twice.

An uncertain provider outcome retains the reservation for reconciliation. Recover the operation instead of submitting it under a new ID. Never automatically redispatch ambiguous provider work or refund a claimed session without evidence.

## Validation

`npm run test:transcription` uses synthetic audio, ledger storage and provider responses only. It checks duration validation, upstream model selection, authentication, prepayment, file replay, insufficient funds, unknown outcomes, live protocol, automatic duration limits, unused-credit refunds, ticket replay, owner binding and failed ticket creation. The browser upload flow was also exercised against an isolated local mock provider. Real OpenAI model access and microphone end-to-end operation require a separately authorized paid test.
