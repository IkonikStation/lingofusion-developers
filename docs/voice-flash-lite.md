# LingoFusion Voice Flash Lite

Flash Lite is served by the existing `/v1/audio/speech` API and the Playground Voice tab. Use model ID `lingofusion-voice-flash-lite`. The API charges **$0.02 USD per 1,000 Unicode characters** ($0.000020 per character) after trimming surrounding whitespace and successfully generating audio. The limit is 1,500 characters per request and 12 gateway admissions per minute per account. A request can return HTTP 503 while the shared Piper slot is busy. Failed synthesis and rejected requests incur no charge. Concurrent requests may pass the initial balance check together. The ledger checks the exact balance again when charging, so a request can return HTTP 402 if another request spent the available credit first.

| Language | Voice ID |
| --- | --- |
| English (US), default | `en_US-joe-medium` |
| Spanish (Spain) | `es_ES-davefx-medium` |
| German (Germany) | `de_DE-thorsten-medium` |
| Portuguese (Brazil) | `pt_BR-cadu-medium` |

Supply `voice` or `language` (a supported locale or its base language code). For a binary result, set `response_format` to `mp3` (default) or `wav`. For a JSON result with an audio data URL, send `Accept: application/json` or use `"response_format":"json","output_format":"wav"`. The gateway returns a request ID and billing fields in the audio response headers. The request ID can be used with `GET /api/usage/<request-id>` on the same account to retrieve the settlement receipt. Receipts store character usage and billing metadata. Audio and text are processed in memory and temporary storage during the request.

```sh
curl --fail-with-body https://api.lingofusion.dev/v1/audio/speech \
  -H "Authorization: Bearer ${LINGOFUSION_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"model":"lingofusion-voice-flash-lite","input":"Hola, ¿cómo estás?","language":"es-ES","response_format":"wav"}' \
  --output speech.wav
```

## Voice provenance

The voice catalog pins one revision of the Piper voice repository and verifies SHA-256 for each model, configuration and model card. The four selected weights were fine-tuned from the [rdh base trained from scratch](https://huggingface.co/rhasspy/piper-voices/blob/e9c8a39444359388adaa94255becb37a5a2b8e51/nl/nl_BE/rdh/medium/MODEL_CARD), with CC0 recordings throughout the training chain, as documented by [Piper's commercial-use list](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/COMMERCIAL_USE.md). The pinned model cards are also installed alongside the weights. Piper's engine uses GPL-3.0-or-later. The project explains how the engine license, dataset licenses and model rights relate in its [voice licensing guide](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/LICENSING.md). This deployment uses the voices as a hosted service and supplies generated audio to callers.

## Google Cloud Run deployment

The Docker image targets Linux amd64 and bundles the four verified voice models and a pinned FFmpeg build for MP3 and WAV. Cloud Run is configured for `us-central1`, request-based billing, **0 minimum and 1 maximum instance**, 1 vCPU, 768 MiB of RAM, one request at a time, and a 55-second request timeout. Request-based billing and scale-to-zero avoid a continuously running instance. [Cloud Run free tier and pricing](https://cloud.google.com/run/pricing)

### Billing controls and approval

The deployment script defaults to a read-only plan. Apply it only after the operator explicitly approves the exact Cloud Billing account and the remaining overage risk. Use a dedicated project linked to that account so the cap and alerts affect Piper alone. The script verifies the billing account and creates or verifies these safeguards before enabling the deployment APIs or pushing the image.

- **Cloud Run gross spend cap of $0** in the billing account currency, scoped to Cloud Run in the dedicated project. The script stops if the Budget API rejects the cap or returns a state other than `CONFIGURED`. The cap can pause the service at its first estimated usage, even when free-tier credits would reduce the actual bill to zero. Google can bill for overages accrued before enforcement. [Spend cap behavior](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps)
- **Project-wide net cost alert at one cent** in the billing account currency, with free-tier credits included. Use Billing Reports for accrued net cost and Cloud Run’s built-in Metrics tab for billable instance time, requests and memory. Project owners receive budget notifications. [Billing budgets and alerts](https://docs.cloud.google.com/billing/docs/how-to/budgets)
- **Private registry with one retained image version**, automatic cleanup for superseded versions, and no automatic paid image scanning on the new repo. The script builds locally and checks that the compressed Docker archive is below 430 MiB before any cloud changes. Review the account’s remaining shared storage allowance before each upload, including temporary overlap during updates. Cloud Run’s spend cap does not cover Artifact Registry storage. [Artifact Registry pricing](https://cloud.google.com/artifact-registry/pricing)
- **Gateway-wide ceiling of 1,000 synthesis attempts and 384 MiB of audio per UTC month.** The gateway reserves the maximum response size before each call, then records the delivered size when the usage settles. Failed and interrupted calls keep their full allowance. The existing account limit remains 12 requests per minute. The controls stop Flash Lite requests when their allowance is exhausted, before generating audio or charging the customer.

Free-tier allowances are shared across projects on the billing account. Networking eligibility depends on where traffic goes, and egress to Cloudflare may be billable. Logs and registry storage have separate allowances. Monitoring and delayed enforcement reduce exposure but cannot guarantee a zero bill on pay-as-you-go.

### Private ingress

Cloudflare Workers reach the default HTTPS `run.app` URL using Google Workload Identity Federation. A dedicated invocation account has the Cloud Run Invoker role on this service. The Worker exchanges a short-lived signed assertion for a Google ID token scoped to the service URL. Google verifies it through `X-Serverless-Authorization`. Piper separately verifies its bearer token against a SHA-256 digest stored in the Cloud Run service configuration. The runtime account has no application IAM roles. [Cloud Run external service authentication](https://docs.cloud.google.com/run/docs/authenticating/service-to-service)

### Apply after approval

1. Sign in to Google Cloud CLI and select the dedicated project linked to the approved billing account. The operator needs permissions to manage the project’s APIs, scoped billing budgets, registry, Cloud Run service and invocation IAM. Verify that the billing account has enough unused free-tier storage and compute allowances.
2. Run `deploy/piper/deploy-cloud-run.sh` to preview. With explicit approval in place, set `PIPER_GCP_PROJECT` to the project ID, set `PIPER_GCP_BILLING_ACCOUNT` and `PIPER_APPROVED_BILLING_ACCOUNT` to the approved billing-account ID, and run `deploy/piper/deploy-cloud-run.sh --apply`. If the CLI is installed outside `PATH`, set `GCLOUD_BIN` to its executable. The script checks anonymous denial, bearer-token enforcement, and authenticated MP3 and WAV output before returning.
3. With the same approval and configuration, run `deploy/piper/activate-gateway.sh --apply`. It rechecks the budgets and private origin, then publishes the existing Worker code with its new secret bindings. The owner-only deployment state directory defaults to `~/.config/lingofusion/piper-cloudrun/<project-id>`. Keep the generated credentials out of Git and browser code.

| Worker secret | Purpose |
| --- | --- |
| `PIPER_ORIGIN` | Cloud Run service URL |
| `PIPER_API_TOKEN` | Piper bearer token whose digest is stored in the service |
| `PIPER_WIF_PROVIDER` | Dedicated Google workload identity provider resource name |
| `PIPER_INVOKER_SERVICE_ACCOUNT` | Service account allowed to invoke Piper |
| `PIPER_WIF_SIGNER` | Owner-only OIDC signing key for the Worker |

After activating the Worker, verify one short request per format with a funded test account, then confirm the usage receipt and exact balance change. If the cap enforces, keep it in place and review Cloud Billing before resuming traffic. Disable Flash Lite in the gateway and revoke the invoker grant to stop new synthesis. Registry storage remains while images are retained.

## Local Docker verification

```sh
docker buildx build --platform linux/amd64 --load -f deploy/piper/Dockerfile -t lingofusion-piper:local .
export PIPER_API_TOKEN=$(openssl rand -hex 32)
docker run --rm -p 127.0.0.1:8788:8080 --cpus 1 --memory 768m -e PIPER_API_TOKEN lingofusion-piper:local
```

From another terminal with the same test token exported, run `python3 deploy/piper/check-health.py`. The Node API can use `PIPER_ORIGIN=http://127.0.0.1:8788` with the same token and `PIPER_LOCAL_DEVELOPMENT=true`. Use an authenticated, funded local API key or signed-in Playground user to verify the integration.
