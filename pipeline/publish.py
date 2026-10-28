#!/usr/bin/env python3
"""The Postgres side of an import: publish, record a failure, roll back. Keeps a history.

  WOW_PG_URL=<postgres url> publish.py publish <manifest.json> <wow.duckdb>
  WOW_PG_URL=<postgres url> publish.py failed <message>
  WOW_PG_URL=<postgres url> publish.py rollback

The URL comes from the environment, not argv, so it never shows in a process list. The run's
details come from WOW_RUN_* variables set by pipeline.py (build, product, fetched_at,
opendata_commit, code_commit, started_at, target).

publish (after `dbt build` passed), each step committed on its own:
  1. copy every mart (models under dbt/models/marts) into a fresh schema wow_next
  2. add the primary key and indexes from each model's meta (pg_primary_key, pg_indexes)
  3. record per-table row counts in wow_next.build_info
  4. swap in one statement: wow -> wow_prev (dropping the older wow_prev), wow_next -> wow,
     granting read access to the role in WOW_PG_READER when it is set and exists
  5. add an "ok" row to wow_meta.import_history
A failure before step 4 leaves the live schema `wow` untouched.

failed: adds a "failed" row (dbt build or tests failed; nothing was published).
rollback: swaps wow and wow_prev in one statement (a second rollback undoes the first) and adds
a "rolled back" row naming the build that is live again.

wow_meta.import_history lives outside the swapped schemas, so it survives every import. The
read-only role gets USAGE on wow_meta and SELECT on the table.
"""
from __future__ import annotations

import json
import os
import re
import sys
import time

import duckdb

# postgres_execute takes one statement per call: these run one by one
HISTORY = ["CREATE SCHEMA IF NOT EXISTS wow_meta", """
CREATE TABLE IF NOT EXISTS wow_meta.import_history (
    id               bigserial PRIMARY KEY,
    action           text NOT NULL,          -- import | rollback
    status           text NOT NULL,          -- ok | failed | rolled back
    target           text,                   -- local | prod: the database this row lives in
    build            text,
    product          text,
    fetched_at       text,
    opendata_commit  text,
    code_commit      text,                   -- git commit of dbt/, seeds/, pipeline/ (+ -dirty)
    started_at       timestamptz,
    finished_at      timestamptz NOT NULL DEFAULT now(),
    duration_s       integer,
    tables           integer,
    total_rows       bigint,
    items            integer,
    quests           integer,
    zones            integer,
    dungeons         integer,
    npcs             integer,
    recipes          integer,
    message          text,
    row_counts       jsonb
)"""]


def lit(v) -> str:
    """A SQL literal (the statements go through postgres_execute, which takes no parameters)."""
    if v is None or v == "":
        return "NULL"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


class Pg:
    def __init__(self, pg_url: str, duckdb_path: str = ":memory:"):
        # Not read_only: that would make the attached Postgres read-only too.
        self.con = duckdb.connect(duckdb_path)
        self.con.execute("INSTALL postgres; LOAD postgres")
        self.con.execute("ATTACH ? AS pg (TYPE postgres)", [pg_url])

    def run(self, sql: str) -> None:
        self.con.execute("CALL postgres_execute('pg', ?)", [sql])

    def query(self, sql: str) -> list[tuple]:
        return self.con.execute("SELECT * FROM postgres_query('pg', ?)", [sql]).fetchall()

    def close(self) -> None:
        self.con.execute("DETACH pg")


def reader_role(db: Pg) -> str:
    """WOW_PG_READER when set and present on this server (production: wow_reader), else ""."""
    reader = os.environ.get("WOW_PG_READER", "").strip()
    if reader and not re.fullmatch(r"[a-z_][a-z0-9_]*", reader):
        sys.exit(f"WOW_PG_READER {reader!r} is not a plain role name")
    if reader and not db.query(f"SELECT 1 FROM pg_roles WHERE rolname = '{reader}'"):
        print(f"  role {reader} not on this server: no read grants", flush=True)
        return ""
    return reader


# The history as seen from the live schema: Vantage's datasource reads schema `wow` only, so
# each import (and a rollback, for an older schema without it) puts this view in wow. A view
# reads with its owner's rights, so the reader needs only the usual grant on wow.
HISTORY_VIEW = "CREATE OR REPLACE VIEW {schema}.import_history AS SELECT * FROM wow_meta.import_history"


def grants(schema: str, reader: str) -> str:
    """plpgsql statements giving the reader read access to a schema's tables."""
    if not reader:
        return ""
    return (f"EXECUTE format('GRANT USAGE ON SCHEMA {schema} TO %I', '{reader}'); "
            f"EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA {schema} TO %I', '{reader}'); ")


def ensure_history(db: Pg) -> None:
    """Create wow_meta.import_history on first use and let the reader see it. Called before any
    swap, so a problem here stops the run before it changes anything."""
    for sql in HISTORY:
        db.run(sql)
    reader = reader_role(db)
    if reader:
        db.run("DO $$ BEGIN " + grants("wow_meta", reader) + "END $$")


def record(db: Pg, action: str, status: str, message: str = "", counts: dict | None = None,
           build: str | None = None) -> None:
    """Add a row to wow_meta.import_history."""
    ensure_history(db)
    env = os.environ.get
    started = env("WOW_RUN_STARTED_AT", "")
    duration = int(time.time() - float(env("WOW_RUN_STARTED_EPOCH"))) if env("WOW_RUN_STARTED_EPOCH") else None
    counts = counts or {}
    row = {
        "action": action, "status": status, "target": env("WOW_RUN_TARGET", ""),
        "build": build if build is not None else env("WOW_RUN_BUILD", ""),
        "product": env("WOW_RUN_PRODUCT", ""), "fetched_at": env("WOW_RUN_FETCHED_AT", ""),
        "opendata_commit": env("WOW_RUN_OPENDATA_COMMIT", ""), "code_commit": env("WOW_RUN_CODE_COMMIT", ""),
        "started_at": started, "duration_s": duration,
        "tables": len(counts) or None, "total_rows": sum(counts.values()) or None,
        "items": counts.get("items"), "quests": counts.get("quests"), "zones": counts.get("zones"),
        "dungeons": counts.get("dungeons"), "npcs": counts.get("npcs"), "recipes": counts.get("recipes"),
        "message": message,
    }
    cols = ", ".join(list(row) + ["row_counts"])
    vals = ", ".join(lit(v) for v in row.values())
    rc = lit(json.dumps(counts)) + "::jsonb" if counts else "NULL"
    db.run(f"INSERT INTO wow_meta.import_history ({cols}) VALUES ({vals}, {rc})")


def publish(manifest_path: str, duckdb_path: str, pg_url: str) -> None:
    manifest = json.load(open(manifest_path, encoding="utf-8"))
    marts = sorted(
        (n for n in manifest["nodes"].values()
         if n["resource_type"] == "model" and len(n["fqn"]) > 1 and n["fqn"][1] == "marts"),
        key=lambda n: n["alias"],
    )
    if not marts:
        sys.exit("no marts in the manifest; run dbt build first")

    db = Pg(pg_url, duckdb_path)  # dbt is done with the file
    ensure_history(db)
    db.run("DROP SCHEMA IF EXISTS wow_next CASCADE")
    db.run("CREATE SCHEMA wow_next")

    counts: dict[str, int] = {}
    for node in marts:
        name = node["alias"]
        src = f'"{node["database"]}"."{node["schema"]}"."{name}"'
        db.con.execute(f'CREATE TABLE pg.wow_next."{name}" AS SELECT * FROM {src}')
        meta = (node.get("config") or {}).get("meta") or node.get("meta") or {}
        if meta.get("pg_primary_key"):
            db.run(f'ALTER TABLE wow_next."{name}" ADD PRIMARY KEY ("{meta["pg_primary_key"]}")')
        for col in meta.get("pg_indexes", []):
            db.run(f'CREATE INDEX ON wow_next."{name}" ("{col}")')
        counts[name] = db.con.execute(f"SELECT count(*) FROM {src}").fetchone()[0]
        print(f"  {name}: {counts[name]} rows", flush=True)

    db.run(HISTORY_VIEW.format(schema="wow_next"))
    db.run("ALTER TABLE wow_next.build_info ADD COLUMN row_counts jsonb")
    db.run("UPDATE wow_next.build_info SET row_counts = " + lit(json.dumps(counts)) + "::jsonb")
    db.run("ANALYZE")

    # A read-only role (production: wow_reader, what Cloud Run connects as) loses its grants with
    # every import, because the schema is new. Re-grant inside the swap so it never sees a schema
    # it can't read. Unset, or a role this server doesn't have (local), changes nothing.
    reader = reader_role(db)

    # One statement, one transaction: readers see the old schema or the new one, never neither.
    db.run("DO $$ BEGIN "
           "DROP SCHEMA IF EXISTS wow_prev CASCADE; "
           "IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'wow') THEN ALTER SCHEMA wow RENAME TO wow_prev; END IF; "
           "ALTER SCHEMA wow_next RENAME TO wow; "
           + grants("wow", reader) +
           "END $$")
    if reader:
        print(f"  {reader}: read access to schema wow", flush=True)
    record(db, "import", "ok", f"published {len(marts)} tables", counts)
    db.close()
    print(f"published {len(marts)} tables to schema wow", flush=True)


def failed(message: str, pg_url: str) -> None:
    db = Pg(pg_url)
    record(db, "import", "failed", message)
    db.close()
    print("recorded the failed import in wow_meta.import_history", flush=True)


def rollback(pg_url: str) -> None:
    db = Pg(pg_url)
    ensure_history(db)
    have = {r[0] for r in db.query("SELECT nspname FROM pg_namespace WHERE nspname IN ('wow', 'wow_prev')")}
    if have != {"wow", "wow_prev"}:
        sys.exit("nothing to roll back to: schema wow_prev doesn't exist (one import so far?)")
    live = db.query("SELECT build FROM wow.build_info")
    back = db.query("SELECT build FROM wow_prev.build_info")
    live_build = live[0][0] if live else "?"
    back_build = back[0][0] if back else "?"
    counts_row = db.query("SELECT row_counts::text FROM wow_prev.build_info")
    counts = json.loads(counts_row[0][0]) if counts_row and counts_row[0][0] else {}
    reader = reader_role(db)
    # one statement: wow and wow_prev trade places, so a second rollback undoes the first
    db.run("DO $$ BEGIN "
           "ALTER SCHEMA wow RENAME TO wow_swap; "
           "ALTER SCHEMA wow_prev RENAME TO wow; "
           "ALTER SCHEMA wow_swap RENAME TO wow_prev; "
           + HISTORY_VIEW.format(schema="wow") + "; "
           + grants("wow", reader) +
           "END $$")
    record(db, "rollback", "rolled back", f"{back_build} is live again; {live_build} kept as the previous import",
           counts, build=back_build)
    db.close()
    print(f"rolled back: {back_build} is live in schema wow; {live_build} is in wow_prev", flush=True)


if __name__ == "__main__":
    pg_url = os.environ.get("WOW_PG_URL", "")
    args = sys.argv[1:]
    if not pg_url or not args:
        sys.exit(__doc__.strip())
    if args[0] == "publish" and len(args) == 3:
        publish(args[1], args[2], pg_url)
    elif args[0] == "failed" and len(args) == 2:
        failed(args[1], pg_url)
    elif args[0] == "rollback" and len(args) == 1:
        rollback(pg_url)
    else:
        sys.exit(__doc__.strip())
