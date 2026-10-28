#!/bin/sh
# Build the wowplan image (api/wowplan.yaml + web/wowplan/ on vantage-server), push it to
# wow-plan's Artifact Registry and deploy it to Cloud Run, then check the live service.
#
#   ./deploy.sh            build, push, deploy, check
#   ./deploy.sh --check    only check the live service
#
# Only the image changes: size, env, secrets, the Cloud SQL socket and the VPC egress are
# Terraform's (~/Work/vantage-terraform/modules/wow-plan-gcp), which ignores the image, so a
# later `tofu apply` never rolls a deploy back. Needs: docker, gcloud signed in, and
# `gcloud auth configure-docker europe-west2-docker.pkg.dev` once.
set -eu

PROJECT=inlaid-agility-461020-e4
REGION=europe-west2
SERVICE=wow-plan
REGISTRY=$REGION-docker.pkg.dev/$PROJECT/wow-plan/wow-plan
URL=https://wow-plan-u6faisil3q-nw.a.run.app

ROOT=$(cd "$(dirname "$0")" && pwd)
cd "$ROOT"

check() {
  echo "== checking $URL"
  ok=1
  ready=$(curl -s -m 30 "$URL/v1/ready" || true)
  echo "ready:  $ready"
  case "$ready" in *'"ready":true'*) ;; *) ok=0 ;; esac
  title=$(curl -s -m 30 "$URL/" | grep -o '<title>[^<]*' | sed 's/<title>//' || true)
  echo "page:   ${title:-<none>}"
  [ "$title" = "wow-plan.com" ] || ok=0
  tables=$(curl -s -m 30 "$URL/v1/schema" | grep -o '"plan_targets"' | head -n 1 || true)
  echo "schema: ${tables:-plan_targets missing}"
  [ -n "$tables" ] || ok=0
  if [ $ok = 1 ]; then echo "OK"; else echo "CHECK FAILED" >&2; exit 1; fi
}

if [ "${1:-}" = "--check" ]; then check; exit 0; fi

# a tag per build: time + commit (+ "-dirty" when the working tree has uncommitted changes)
SHA=$(git rev-parse --short HEAD 2>/dev/null || echo nogit)
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then SHA="$SHA-dirty"; fi
TAG=$(date +%Y%m%d-%H%M)-$SHA
IMG=$REGISTRY:$TAG

echo "== building $IMG"
docker build --platform linux/amd64 --build-arg API=wowplan -t "$IMG" .

# no env file may reach the image (.dockerignore keeps them out; check anyway)
if docker run --rm --platform linux/amd64 --entrypoint sh "$IMG" -c 'find /app -name ".env*" | grep -q .'; then
  echo "an .env file is inside the image; not pushing" >&2
  exit 1
fi

echo "== pushing"
docker push "$IMG"

echo "== deploying to Cloud Run ($SERVICE, $REGION)"
gcloud run deploy "$SERVICE" --region "$REGION" --project "$PROJECT" --image "$IMG" --quiet

check
echo "deployed $IMG"
