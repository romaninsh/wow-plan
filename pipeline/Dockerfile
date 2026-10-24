# The data pipeline image: Python, dbt with DuckDB, git. Code is mounted, not copied
# (composer.yaml mounts dbt/, seeds/ and pipeline/ read-only and refs/ for downloads).
FROM python:3.13-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir "dbt-core~=1.12.6" "dbt-duckdb~=1.11.0"

# DuckDB extensions the models and the publish step load, baked in so imports work offline.
RUN python -c "import duckdb; c = duckdb.connect(); c.execute('INSTALL postgres')"

ENV WOW_REFS=/work/refs \
    WOW_SCRATCH=/tmp/wow \
    PYTHONUNBUFFERED=1

WORKDIR /work
ENTRYPOINT ["python3", "/work/pipeline/pipeline.py"]
