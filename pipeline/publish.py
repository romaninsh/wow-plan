#!/usr/bin/env python3
"""Publish the dbt marts from DuckDB into Postgres schema `wow`.

  publish.py <manifest.json> <wow.duckdb> <postgres url>

Run by pipeline.py import after `dbt build` passed, with a Python that has the duckdb module
(the pipeline image, or the project's .venv). Steps, each committed on its own:

  1. copy every mart (models under dbt/models/marts) into a fresh schema wow_next
  2. add the primary key and indexes from each model's meta (pg_primary_key, pg_indexes)
  3. record per-table row counts in wow_next.build_info
  4. swap in one statement: wow -> wow_prev (dropping the older wow_prev), wow_next -> wow

A failure before step 4 leaves the live schema `wow` untouched.
"""
from __future__ import annotations

import json
import sys

import duckdb


def main(manifest_path: str, duckdb_path: str, pg_url: str) -> None:
    manifest = json.load(open(manifest_path, encoding="utf-8"))
    marts = sorted(
        (n for n in manifest["nodes"].values()
         if n["resource_type"] == "model" and len(n["fqn"]) > 1 and n["fqn"][1] == "marts"),
        key=lambda n: n["alias"],
    )
    if not marts:
        sys.exit("no marts in the manifest; run dbt build first")

    # Not read_only: that would make the attached Postgres read-only too. dbt is done with the file.
    con = duckdb.connect(duckdb_path)
    con.execute("INSTALL postgres; LOAD postgres")
    con.execute("ATTACH ? AS pg (TYPE postgres)", [pg_url])

    def pg(sql: str) -> None:
        con.execute("CALL postgres_execute('pg', ?)", [sql])

    pg("DROP SCHEMA IF EXISTS wow_next CASCADE")
    pg("CREATE SCHEMA wow_next")

    counts: dict[str, int] = {}
    for node in marts:
        name = node["alias"]
        src = f'"{node["database"]}"."{node["schema"]}"."{name}"'
        con.execute(f'CREATE TABLE pg.wow_next."{name}" AS SELECT * FROM {src}')
        meta = (node.get("config") or {}).get("meta") or node.get("meta") or {}
        if meta.get("pg_primary_key"):
            pg(f'ALTER TABLE wow_next."{name}" ADD PRIMARY KEY ("{meta["pg_primary_key"]}")')
        for col in meta.get("pg_indexes", []):
            pg(f'CREATE INDEX ON wow_next."{name}" ("{col}")')
        counts[name] = con.execute(f"SELECT count(*) FROM {src}").fetchone()[0]
        print(f"  {name}: {counts[name]} rows", flush=True)

    pg("ALTER TABLE wow_next.build_info ADD COLUMN row_counts jsonb")
    pg("UPDATE wow_next.build_info SET row_counts = '" + json.dumps(counts).replace("'", "''") + "'::jsonb")
    pg("ANALYZE")

    # One statement, one transaction: readers see the old schema or the new one, never neither.
    pg("DO $$ BEGIN "
       "DROP SCHEMA IF EXISTS wow_prev CASCADE; "
       "IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'wow') THEN ALTER SCHEMA wow RENAME TO wow_prev; END IF; "
       "ALTER SCHEMA wow_next RENAME TO wow; "
       "END $$")
    con.execute("DETACH pg")
    print(f"published {len(marts)} tables to schema wow", flush=True)


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__.strip())
    main(*sys.argv[1:])
