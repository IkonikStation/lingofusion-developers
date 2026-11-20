#!/usr/bin/env bash
set -euo pipefail

if [[ ${1:-} != "--apply" ]]; then
  cat <<'PLAN'
Cloud Run plan only. Google Cloud has not been changed.
Location us-central1. Request-based billing. 0–1 instances, 1 vCPU, 768 MiB, concurrency 1.
Configure and verify the project-scoped $0 Cloud Run spend cap and net-cost alerts before enabling deployment APIs.
Build Linux amd64 locally and push to a private regional Artifact Registry repository with cleanup.
Use Cloud Run IAM with federated LingoFusion credentials and the Piper bearer token.
Apply only after the billing account and residual overage risk receive explicit approval.
PLAN
  exit 0
fi

project=${PIPER_GCP_PROJECT:?Set the dedicated Google Cloud project ID.}
account=${PIPER_GCP_BILLING_ACCOUNT:?Set the explicitly approved Cloud Billing account ID.}
if [[ ! "$project" =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]$ || ! "$account" =~ ^[A-F0-9]{6}(-[A-F0-9]{6}){2}$ ||
      "${PIPER_APPROVED_BILLING_ACCOUNT:-}" != "$account" ]]; then
  echo "Deployment requires explicit approval of the exact Cloud Billing account and remaining overage risk." >&2
  exit 1
fi

repo_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
deploy_dir="$repo_dir/deploy/piper"
cd "$repo_dir"

export GCLOUD_BIN=${GCLOUD_BIN:-gcloud}
export PATH="$(dirname "$(command -v "$GCLOUD_BIN")"):$PATH"
region=us-central1
service=lingofusion-piper
repository=lingofusion-piper
registry="${region}-docker.pkg.dev"
image="$registry/$project/$repository/piper:current"
pool=lingofusion-piper
provider=gateway
invoker="piper-gateway@$project.iam.gserviceaccount.com"
runtime="piper-runtime@$project.iam.gserviceaccount.com"
state_dir="${PIPER_DEPLOY_STATE:-$HOME/.config/lingofusion/piper-cloudrun/$project}"
umask 077
mkdir -p "$state_dir"
chmod 0700 "$state_dir"

# Finish the local build and its size check before any cloud mutation.
docker buildx build --platform linux/amd64 --provenance=false --load --file "$deploy_dir/Dockerfile" --tag "$image" .
compressed=$(docker image save "$image" | gzip -1 | wc -c)
if (( compressed > 430 * 1024 * 1024 )); then
  echo "The compressed Docker archive exceeds the initial 430 MiB registry allowance." >&2
  exit 1
fi

gcloud_cmd() { "$GCLOUD_BIN" "$@"; }
project_number=$(gcloud_cmd projects describe "$project" --format='value(projectNumber)')
linked=$(gcloud_cmd billing projects describe "$project" --format='value(billingAccountName)')
if [[ "$linked" != "billingAccounts/$account" ]]; then
  echo "The dedicated project must be linked to the explicitly approved billing account." >&2
  exit 1
fi
if [[ "$(gcloud_cmd billing projects describe "$project" --format='value(billingEnabled)' | tr '[:upper:]' '[:lower:]')" != "true" ]]; then
  echo "Billing is not active on the dedicated project." >&2
  exit 1
fi

gcloud_cmd services enable billingbudgets.googleapis.com --project "$project"
python3 "$deploy_dir/configure-budgets.py" "$project" "$project_number" "$account"
gcloud_cmd services enable run.googleapis.com artifactregistry.googleapis.com iam.googleapis.com \
  sts.googleapis.com iamcredentials.googleapis.com --project "$project"

if ! gcloud_cmd artifacts repositories describe "$repository" --location "$region" --project "$project" --quiet >/dev/null; then
  gcloud_cmd artifacts repositories create "$repository" --repository-format=docker --location "$region" --project "$project" \
    --disable-vulnerability-scanning
fi
gcloud_cmd artifacts repositories set-cleanup-policies "$repository" --location "$region" --project "$project" \
  --policy="$deploy_dir/registry-cleanup.json" --no-dry-run
gcloud_cmd auth configure-docker "$registry" --quiet
docker push "$image"
digest=$(gcloud_cmd artifacts docker images describe "$image" --project "$project" --format='value(image_summary.digest)')
if [[ ! "$digest" =~ ^sha256:[a-f0-9]{64}$ ]]; then
  echo "Unable to verify the immutable Artifact Registry image." >&2
  exit 1
fi

token_digest=$(node "$deploy_dir/cloud-run-credentials.mjs" "$state_dir" "$project_number" "$project")
for name in piper-runtime piper-gateway; do
  if ! gcloud_cmd iam service-accounts describe "$name@$project.iam.gserviceaccount.com" --project "$project" --quiet >/dev/null; then
    gcloud_cmd iam service-accounts create "$name" --project "$project"
  fi
done

if ! gcloud_cmd iam workload-identity-pools describe "$pool" --location global --project "$project" --quiet >/dev/null; then
  gcloud_cmd iam workload-identity-pools create "$pool" --location global --project "$project"
fi
issuer=https://api.lingofusion.dev/identity/voice-flash-lite
subject=lingofusion-gateway-piper
pool_resource="projects/$project_number/locations/global/workloadIdentityPools/$pool"
provider_args=(--workload-identity-pool "$pool" --location global --project "$project"
  --issuer-uri "$issuer" --attribute-mapping 'google.subject=assertion.sub'
  --attribute-condition "assertion.sub == '$subject'" --jwk-json-path "$state_dir/gateway-jwks.json")
if gcloud_cmd iam workload-identity-pools providers describe "$provider" --workload-identity-pool "$pool" \
    --location global --project "$project" --quiet >/dev/null; then
  gcloud_cmd iam workload-identity-pools providers update-oidc "$provider" "${provider_args[@]}"
else
  gcloud_cmd iam workload-identity-pools providers create-oidc "$provider" "${provider_args[@]}"
fi
gcloud_cmd iam service-accounts add-iam-policy-binding "$invoker" --project "$project" \
  --member="principal://iam.googleapis.com/$pool_resource/subject/$subject" --role=roles/iam.workloadIdentityUser --condition=None >/dev/null

gcloud_cmd run deploy "$service" --project "$project" --region "$region" \
  --image "${image%:current}@$digest" --service-account "$runtime" --execution-environment gen2 \
  --port 8080 --cpu 1 --memory 768Mi --concurrency 1 --timeout 55s \
  --min 0 --max 1 --min-instances 0 --max-instances 1 --cpu-throttling --no-cpu-boost \
  --ingress all --no-allow-unauthenticated --invoker-iam-check \
  --startup-probe "tcpSocket.port=8080,periodSeconds=2,timeoutSeconds=1,failureThreshold=20" \
  --set-env-vars "PIPER_API_TOKEN_SHA256=$token_digest" --quiet
gcloud_cmd run services add-iam-policy-binding "$service" --project "$project" --region "$region" \
  --member "serviceAccount:$invoker" --role roles/run.invoker --condition=None >/dev/null

# Catch any stale service-level grants before the existing gateway can route traffic here.
gcloud_cmd run services get-iam-policy "$service" --project "$project" --region "$region" --format=json |
  python3 -c 'import json,sys
bindings=json.load(sys.stdin).get("bindings",[])
invokers={m for b in bindings if b["role"] in ("roles/run.invoker","roles/run.servicesInvoker") for m in b["members"]}
public={m for b in bindings for m in b["members"] if m in ("allUsers","allAuthenticatedUsers")}
if public or invokers != {sys.argv[1]}: sys.exit("Unexpected Cloud Run service IAM grants. Gateway activation stopped.")
' "serviceAccount:$invoker"

origin=$(gcloud_cmd run services describe "$service" --region "$region" --project "$project" --format='value(status.url)')
# Save the origin alongside the existing secrets without printing credential contents.
node --input-type=module - "$state_dir/gateway-secrets.json" "$origin" <<'NODE'
import { readFileSync, renameSync, writeFileSync } from "node:fs";
const [path, origin] = process.argv.slice(2);
if (!/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)?\.run\.app$/.test(origin)) throw new Error("Invalid default Cloud Run URL.");
const config = { ...JSON.parse(readFileSync(path, "utf8")), PIPER_ORIGIN: origin };
writeFileSync(path + ".new", JSON.stringify(config), { mode: 0o600 });
renameSync(path + ".new", path);
NODE

node "$deploy_dir/check-cloud-run.mjs" "$state_dir/gateway-secrets.json" --synthesize
printf 'Private Cloud Run deployment verified at %s\n' "$origin"
printf 'Gateway secret file (owner-only) is at %s/gateway-secrets.json\n' "$state_dir"
