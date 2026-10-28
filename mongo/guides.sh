#!/bin/sh
# The guides database (MongoDB `wowplan`) of one target, from this machine:
#
#   mongo/guides.sh local|prod schema    validators and indexes (schema.js), then the read-only
#                                        views the desktop pages read (views.js)
#   mongo/guides.sh local|prod samples   reload the sample plans (seed.js) and nothing else
#
# local = the composer.yaml mongo; prod = Atlas (SECRET_PLANS_URL in .env.prod; this machine's
# IP must be on the Atlas access list). The actions Update guides schema and Reset sample plans
# run this with the active profile's TARGET.
#
# What each does to existing data:
#   schema   creates missing collections, replaces validators (collMod) and adds indexes; drops
#            and re-creates the views. Deletes no documents.
#   samples  deletes the plans seed.js lists (and their characters, brackets, to-dos), then
#            inserts them again. No other plan is touched: a plan is a sample only if seed.js
#            lists it (marked `sample: true`).
# The prod URL is never printed and never on this machine's command lines; inside the mongo:7
# container it is mongosh's argument (mongosh takes it no other way).
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
TARGET=${1:-}
WHAT=${2:-}
case "$WHAT" in
  schema) FILES="schema.js views.js" ;;
  samples) FILES="seed.js" ;;
  *) echo "usage: mongo/guides.sh local|prod schema|samples" >&2; exit 2 ;;
esac

case "$TARGET" in
  local)
    # the Vantage-run stack's compose project (actions get COMPOSE_PROJECT_NAME; a shell may not)
    if [ -z "${COMPOSE_PROJECT_NAME:-}" ]; then
      COMPOSE_PROJECT_NAME=$(docker ps --filter label=com.docker.compose.service=mongo \
        --filter "label=com.docker.compose.project.working_dir=$ROOT" \
        --format '{{.Label "com.docker.compose.project"}}' | head -n 1)
    fi
    if [ -n "$COMPOSE_PROJECT_NAME" ]; then export COMPOSE_PROJECT_NAME; fi
    for f in $FILES; do
      docker compose -f composer.yaml exec -T mongo \
        mongosh "mongodb://localhost:27017/wowplan?directConnection=true" --quiet --file "/scripts/$f"
    done
    ;;
  prod)
    SECRET_PLANS_URL=$(sed -n 's/^SECRET_PLANS_URL=//p' .env.prod 2>/dev/null | tail -n 1)
    if [ -z "$SECRET_PLANS_URL" ]; then
      echo "SECRET_PLANS_URL is missing from .env.prod. See docs/populate-prod.md." >&2
      exit 1
    fi
    export SECRET_PLANS_URL
    echo "PRODUCTION guides database (Atlas): $WHAT"
    docker run --rm -i -e SECRET_PLANS_URL -e FILES="$FILES" -v "$ROOT/mongo:/scripts:ro" mongo:7 sh -c '
set -eu
url=$(printf "%s" "$SECRET_PLANS_URL" | tr -d "\"")
name=$(mongosh "$url" --quiet --eval "print(db.getName())")
if [ "$name" != wowplan ]; then
  echo "SECRET_PLANS_URL selects database \"$name\", not wowplan: nothing changed." >&2
  exit 1
fi
for f in $FILES; do mongosh "$url" --quiet --file "/scripts/$f"; done
'
    ;;
  *)
    echo "usage: mongo/guides.sh local|prod schema|samples" >&2
    exit 2
    ;;
esac
