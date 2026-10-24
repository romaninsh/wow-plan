# wow_db dbt project

Turns one World of Warcraft: Forever client build's data into the published reference database:
Postgres schema `wow`, which the Vantage admin and later the API and MCP read.

```
refs/wago/<build>/*.csv          wago.tools DB2 exports, hotfixes merged (pipeline fetch)
refs/opendata/data/client/*.jsonl quests, NPCs, objects from players' game caches
../seeds/*.csv                    our own data: constants and level ranges no source publishes
        │  sources, read in place by DuckDB
        ▼
staging/       stg_<source>__<table>   one view per raw table: renamed, typed, slots unpivoted
intermediate/  int_<entity>__<what>    computed values: item stats, armor, weapon damage,
                                       recipes, area -> zone rollup
marts/         world/ reference/ catalog/ + build_info   the published tables
        │  pipeline/publish.py (after dbt build passed)
        ▼
Postgres wow_next -> swapped in as wow (previous kept as wow_prev)
```

## Run

The normal way is the admin's **Fetch build** and **Import build** actions (Data page), which run
`pipeline/pipeline.py` in the `pipeline` container. From a terminal:

```bash
python3 pipeline/pipeline.py fetch [build]      # download missing tables (default: newest Forever build)
python3 pipeline/pipeline.py import [build]     # dbt build + publish (default: newest fetched build)
./dbt/run.sh build -s items+                    # develop one model and what depends on it (DuckDB only)
```

On the host, `import` uses the project's `.venv` (`python3 -m venv .venv && .venv/bin/pip install
dbt-duckdb`) and finds the composer Postgres by its published port (or set `WOW_PG_URL`).

## Where things come from

- **Items** (wago Item + ItemSparse + ItemSearchName): only items with a name; stats, armor and
  weapon damage computed with opendata's formulas (`tools/extract_client.py`) ported to SQL. Stat
  values are fixed per item in Forever data (no class-dependent or level-scaled stats).
- **Stat columns** on `items` come from `seeds/ref_item_stat_types.csv`; a build using an unknown
  stat type fails `tests/assert_every_stat_type_is_named.sql`.
- **Recipes and spells** (wago SkillLineAbility, SpellEffect, SpellReagents, SpellName, ...).
  `skill_required` is the client's minimum; trainer requirements are server-side.
- **Zones** level range: sub-area exploration levels, overridden by `seeds/ref_zone_levels.csv`.
  **Dungeons**: `seeds/ref_dungeon_levels.csv`.
- **Quests, NPCs, objects** (opendata): only what players have seen. Links from them into wago data
  are `severity: warn` tests; links inside wago data block the import.

## Conventions

- IDs are Blizzard IDs and are the contract; names are enUS display text.
- Lists are JSON text on the parent (`item_sets.item_ids`) and bridge tables where they matter
  (`item_stats`, `item_spells`, `quest_items`, `recipe_reagents`), with a text key `<parent>:<child>`.
- Missing stats, armor and DPS are 0, not NULL, so descending sorts put real values first.
- Money is in copper (`*_copper`); `items.sell_price_text` is the tooltip wording.
- Facts only, never recommendations: no best-in-slot, scores or rankings (see agents/BRIEF.md).
- Every mart lists `pg_primary_key` and `pg_indexes` in `_marts.yml` for the Postgres copy.
