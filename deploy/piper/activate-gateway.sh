#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" != "--apply" || -z "${PIPER_GCP_BILLING_ACCOUNT:-}" ||
    "${PIPER_APPROVED_BILLING_ACCOUNT:-}" != "$PIPER_GCP_BILLING_ACCOUNT" ]]; then
  echo "Gateway activation requires --apply and explicit approval of the associated billing account and overage risk." >&2
  exit 1
fi
project=${PIPER_GCP_PROJECT:?Set the dedicated Google Cloud project ID.}
export GCLOUD_BIN=${GCLOUD_BIN:-gcloud}
state_dir=${PIPER_DEPLOY_STATE:-$HOME/.config/lingofusion/piper-cloudrun/$project}
secret_file="$state_dir/gateway-secrets.json"
repo_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$repo_dir"

project_number=$("$GCLOUD_BIN" projects describe "$project" --format='value(projectNumber)')
linked=$("$GCLOUD_BIN" billing projects describe "$project" --format='value(billingAccountName)')
[[ "$linked" == "billingAccounts/$PIPER_GCP_BILLING_ACCOUNT" ]]
node -e 'const {PIPER_WIF_PROVIDER}=JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")); if (!PIPER_WIF_PROVIDER?.startsWith(`projects/${process.argv[2]}/`)) process.exit(1)' "$secret_file" "$project_number"
python3 deploy/piper/configure-budgets.py "$project" "$project_number" "$PIPER_GCP_BILLING_ACCOUNT"
node deploy/piper/check-cloud-run.mjs "$secret_file"
npx wrangler deploy --keep-vars --secrets-file "$secret_file"
