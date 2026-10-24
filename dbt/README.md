# wow_db dbt project

Turns the raw game data in `refs/` into the published data set `data/wow.sqlite`, which the
Vantage app, the API and MCP read.

```
refs/opendata/data/client/*.jsonl    opendata client layer (items, quests, recipes, npcs, objects, spells)
refs/wago/<build>/*.csv              wago.tools DB2 exports (zones, maps, classes, factions, ...)
        │  sources (read in place by DuckDB, nothing is copied)
        ▼
staging/       stg_<source>__<table>   one view per raw file: renamed, typed, nulls cleaned
intermediate/  int_<entity>__<what>    shared joins and recursion (area -> zone rollup)
../seeds/      ref_*                   our own data: game constants the client keeps in code (quality, slot, ...)
marts/         world/ reference/ catalog/   published tables, one row per entity or bridge
        │  on-run-end: publish_sqlite()
        ▼
data/wow.sqlite   (marts only, with unique and lookup indexes from meta.sqlite_*)
data/wow.duckdb   (everything, for ad-hoc analysis)
```

## Run

```bash
./dbt/run.sh build                 # seeds, models, tests, publish
./dbt/run.sh build -s items+       # one table and everything downstream of it
./dbt/run.sh docs generate && ./dbt/run.sh docs serve
```

`run.sh` uses the project's `.venv` (`python3 -m venv .venv && .venv/bin/pip install dbt-duckdb`).

## Refreshing the inputs

- opendata: `git -C refs/opendata pull`, then build.
- wago: fetch the new build's CSVs into `refs/wago/<build>/` (see `refs/wago/README.md`), set
  `wago_build` in `dbt_project.yml` (or `--vars '{wago_build: 1.60.1.xxxxx}'`), then build.
  Every wago-derived row carries `build`; opendata rows carry `build_first_seen` / `build_last_seen`.

## Conventions

- IDs are Blizzard IDs and are the contract; names are enUS display text.
- Lists and maps are published as JSON text (`items.stats`, `item_sets.item_ids`) and, where
  they matter for queries, also as bridge tables (`item_stats`, `quest_items`, `recipe_reagents`).
- Bridge tables have a text key `<parent>:<child>` so every published table has a single-column id.
- Money is in copper (`*_copper`). Facts only: no opinion columns in marts (that is the planner's job).
- Every mart has a `unique` + `not_null` test on its id; references between marts have
  `relationships` tests.
