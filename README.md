# LingoFusion Developers

The LingoFusion API pricing, model catalog, subscription comparison, documentation, and simulated developer dashboard.

## Development

```bash
pnpm install
pnpm dev
```

The optional local API simulation uses:

```bash
pnpm dev:all
```

## Live model providers

The Playground can call real models through the API server. It never exposes provider keys to the browser.

1. Copy `.env.example` to `.env` and set `LINGOFUSION_REAL_MODELS=true`.
2. Add `OPENAI_API_KEY` for LingoFusion Nano (`gpt-5-nano`) and LingoFusion Lite (`gpt-5-mini`).
3. Add `DEEPSEEK_API_KEY` for LingoFusion and ExplainFusion (`deepseek-v4-flash`), LingoFusion Pro (`deepseek-v4-pro`, high reasoning), and LingoFusion Ultra (`deepseek-v4-pro`, max reasoning).
4. Run `pnpm api` or `pnpm dev:all`.

When `LINGOFUSION_REAL_MODELS` is not enabled, the local deterministic simulation remains active. Real provider charges are billed directly by OpenAI and DeepSeek; the dashboard's local credit ledger remains a separate LingoFusion test ledger.

GitHub Pages hosts only the frontend. To make live calls from the public site, deploy `server.mjs` to a server host, configure the provider keys there, and set the public `VITE_LINGOFUSION_API_URL` build variable to that server URL.

Local dashboard ledger data is intentionally excluded from version control.

## Enterprise sales acknowledgements

Enterprise forms for 1,000 or more seats send an automatic acknowledgement to the submitted work email through [Resend](https://resend.com). Add `RESEND_API_KEY` and a verified `LINGOFUSION_EMAIL_FROM` address to the API server's `.env`, then run `pnpm api` or deploy `server.mjs` with those variables. The confirmation is only shown after Resend accepts the email; configuration or provider failures are shown to the requester instead.

## Deployment

Pushes to `main` deploy the static frontend to GitHub Pages. The Pages build includes an SPA fallback for model and subscription routes.
