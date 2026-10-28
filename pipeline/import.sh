#!/bin/sh
# Import a fetched build into the reference database of one target, or roll back, from this
# machine:
#
#   pipeline/import.sh local|prod [build]    import (empty build = the newest fetched)
#   pipeline/import.sh local|prod rollback   swap the live import with the previous one
#                                            (wow <-> wow_prev; run again to undo)
#
# local = the composer.yaml postgres; prod = Cloud SQL wow-plan-pg over its public IP (this
# machine's address must be in the instance's authorized networks). The Import build, Re-import
# and Roll back actions run this with the active profile's TARGET. Both targets use the same
# pipeline container: dbt build and tests in DuckDB on this machine, then the wow_next -> wow
# swap in Postgres; a failing test stops before the swap. Every run adds a row to
# wow_meta.import_history in that database (build, counts, outcome, this project's commit).
# For prod it publishes as the owner `wow` (WOW_PG_OWNER_URL in .env.prod) and re-grants read
# access to `wow_reader`, what Cloud Run reads as. The URL is never printed and never on a
# command line: docker gets it as `-e WOW_PG_URL`, forwarded from this environment.
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
TARGET=${1:-}
ARG=${2:-}
# an empty form field arrives as the unfilled placeholder "${form.build}": no build given
case "$ARG" in '${'*) ARG="" ;; esac
if [ "$ARG" = rollback ]; then CMD=rollback; BUILD=""; else CMD=import; BUILD=$ARG; fi

case "$TARGET" in
  local|prod) ;;
  *) echo "usage: pipeline/import.sh local|prod [build|rollback]" >&2; exit 2 ;;
esac

# the Vantage-run stack's compose project, so the pipeline image is reused
if [ -z "${COMPOSE_PROJECT_NAME:-}" ]; then
  COMPOSE_PROJECT_NAME=$(docker ps --filter label=com.docker.compose.service=postgres \
    --filter "label=com.docker.compose.project.working_dir=$ROOT" \
    --format '{{.Label "com.docker.compose.project"}}' | head -n 1)
fi
if [ -n "$COMPOSE_PROJECT_NAME" ]; then export COMPOSE_PROJECT_NAME; else unset COMPOSE_PROJECT_NAME; fi

# recorded in the import history: the target, and this project's commit (the container has no .git)
WOW_RUN_TARGET=$TARGET
WOW_RUN_CODE_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || true)
if [ -n "$WOW_RUN_CODE_COMMIT" ] && [ -n "$(git status --porcelain -- dbt seeds pipeline 2>/dev/null)" ]; then
  WOW_RUN_CODE_COMMIT="$WOW_RUN_CODE_COMMIT-dirty"
fi
export WOW_RUN_TARGET WOW_RUN_CODE_COMMIT

if [ "$TARGET" = prod ]; then
  WOW_PG_URL=$(sed -n 's/^WOW_PG_OWNER_URL=//p' .env.prod 2>/dev/null | tail -n 1)
  if [ -z "$WOW_PG_URL" ]; then
    echo "WOW_PG_OWNER_URL is missing from .env.prod. See docs/populate-prod.md." >&2
    exit 1
  fi
  export WOW_PG_URL
  if [ $CMD = rollback ]; then
    echo "Rolling back PRODUCTION (Cloud SQL wow-plan-pg) to the previous import"
  else
    echo "Importing build ${BUILD:-<newest fetched>} into PRODUCTION (Cloud SQL wow-plan-pg)"
  fi
  exec docker compose -f composer.yaml --profile pipeline run --rm --no-deps \
    -e WOW_PG_URL -e WOW_PG_READER=wow_reader -e WOW_RUN_TARGET -e WOW_RUN_CODE_COMMIT \
    pipeline $CMD $BUILD
fi

if [ $CMD = rollback ]; then
  echo "Rolling back the local postgres to the previous import"
else
  echo "Importing build ${BUILD:-<newest fetched>} into the local postgres"
fi
exec docker compose -f composer.yaml --profile pipeline run --rm --no-deps \
  -e WOW_RUN_TARGET -e WOW_RUN_CODE_COMMIT pipeline $CMD $BUILD
