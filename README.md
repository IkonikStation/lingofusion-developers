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

Local dashboard ledger data is intentionally excluded from version control.

## Deployment

Pushes to `main` deploy the static frontend to GitHub Pages. The Pages build includes an SPA fallback for model and subscription routes.
