# LingoFusion Developers

The LingoFusion API pricing, model catalog (`LingoFusion Nano` to `LingoFusion Ultra`), subscription comparison, documentation, interactive translation playground, and prepaid token billing platform.

## Development

```bash
pnpm install
pnpm dev
```

The local API server uses:

```bash
pnpm dev:all
```

## Live model providers

The Playground can call live upstream models through the API server without exposing provider keys to the browser.

1. Copy `.env.example` to `.env` and set `LINGOFUSION_REAL_MODELS=true`.
2. Add your upstream provider keys for `LingoFusion Nano` through `LingoFusion Ultra`.
3. Run `pnpm api` or `pnpm dev:all`.

When `LINGOFUSION_REAL_MODELS` is not enabled, the deterministic translation engine remains active.

GitHub Pages hosts the frontend at `https://ikonikstation.github.io/lingofusion-developers/models`. To make live server calls from the public site, deploy `server.mjs` to a server host and set the public `VITE_LINGOFUSION_API_URL` build variable to that server URL.

Local dashboard ledger data is intentionally excluded from version control.

## Enterprise sales acknowledgements

Enterprise forms for 1,000 or more seats send an automatic acknowledgement to the submitted work email through [Resend](https://resend.com). Add `RESEND_API_KEY` and a verified `LINGOFUSION_EMAIL_FROM` address to the API server's `.env`, then run `pnpm api` or deploy `server.mjs` with those variables.

## Deployment

Pushes to `main` deploy the static frontend to GitHub Pages. The Pages build includes an SPA fallback for `/models`, `/playground`, and subscription routes.

## Gift delivery and receiver preview

Gifts use the signed-in sender's Gmail account after separate Google consent.
See [gift delivery setup](docs/gift-delivery.md) for Gmail OAuth and payment webhook
configuration. The [receiver preview](https://ikonikstation.github.io/lingofusion-developers/playground/?gift_preview=1)
works without purchasing or sending anything.
