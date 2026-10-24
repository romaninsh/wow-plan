#!/bin/sh
# Run dbt for this project from anywhere: ./dbt/run.sh build
set -e
cd "$(dirname "$0")"
exec ../.venv/bin/dbt "$@" --profiles-dir .
