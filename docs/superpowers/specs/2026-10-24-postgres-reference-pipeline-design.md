# Postgres reference data pipeline and admin

Date: 2026-10-24. Repo: github.com/romaninsh/wow-plan (this folder; the Vantage project is the repo root).

## Intent

wow-plan.com will let people build personal leveling guides for World of Warcraft: Forever, written with
AI help and shared through short links. Every guide points at game data: items, zones, quests, professions.
This piece builds that game data: a clean, indexed, read-only Postgres database for one client build,
rebuilt with one action whenever a build ships or Blizzard pushes hotfixes, and a Vantage admin to examine it.

**The spirit of the product** (user): WoW Forever is about enjoying every part of the game, not skipping
it. wow-plan is against pre-built guides and optimised checklists. Players write their own plan from basic
information, and find things themselves while they play. What we offer is focus: the playthrough becomes
a collection of short goals the player chose, beyond quest completion. The data set serves that: it lets
a player name a goal precisely (this item, this zone, this skill level) and check it fits their level; it
does not tell them the best way to get there.

Guides go up to level 60, so the database loads the whole build, not just the early levels. A guide will be
built from level-range blocks (out of scope here), and everything inside a block must fit its range: you
can't send a level 5 character to Shadowfang Keep. So every kind of guide target needs a level to check
against: items, quests, zones, dungeons, recipes (profession skill, plus the character level a trainer
rank needs).

The guide targets the data has to support: travel to a zone, acquire an item, complete a quest, reach a
profession level, craft an item to sell or use. The user's own "House of Grr" planner (levels 1–20 checked
by hand; beyond that unchecked) is the test material.

The admin is for us, to check the data. The database is what a later read-only API (Vantage `api/`) and a
React client will serve. Neither the API, the React client, nor the MongoDB guide store is part of this piece.

## Goals

- Two actions in the Vantage admin, each with one field, the client build: **Fetch build** downloads the
  table files that are missing for that build; **Import build** transforms, tests and publishes what is on
  disk. Both stream progress into a Vantage terminal.
- Postgres holds the complete data for that build, Forever's withheld dungeon loot included (fetched with
  hotfixes merged).
- An **Items** page where typing "robes of arugal" into the binder search finds the item; every stat is a
  sortable numeric column; selecting a row shows a tooltip-style summary tab.
- Plain binder pages for the other published tables.
- The repo stays tidy: our code, seeds and docs are committed; downloads and generated files are not.

## Non-goals

- Fuzzy or typo-tolerant search. Vantage's built-in binder search is the search. (User: "keep it simple".)
- The API, MCP, React client, MongoDB guides, sign-in. Later pieces.
- Keeping history of past builds or items. A removed item simply disappears on the next import.
- Retail or Classic Era builds. Forever (1.60.1.x) only; the table layouts are the same as retail, so the
  pipeline would accept another build number, but nothing is designed or tested for it.
- Localised names. enUS only; IDs are the contract.

## Anti-goals

- No pre-built guides, best-in-slot lists, optimal routes, "best item for X" rankings, stat-weight scores
  or anything else that plays the game for the player. The published tables hold facts (what an item is,
  its level, its stats; a quest's level and rewards; a zone's level range), never recommendations. Sorting
  by a stat in the admin is for us to check the data, not a feature to carry into the product.

- A failed import must never leave the admin showing half a database.
- No data scraped from Wowhead or similar sites. Sources: wago.tools exports, the opendata repo, our seeds.
- The import must not be able to change Vantage project files.
- No guessed values: stat names, enum labels and constants come from wago's own data or value lists, or
  from a seed whose source is written down.

## Sources

| Source | What | How |
|---|---|---|
| wago.tools DB2 CSV | items, item sparse (names, levels, stats, prices), item effects, stat budget tables (RandPropPoints, ItemArmor*, ItemDamage*), spells, skill lines, recipes (SkillLineAbility + SpellReagents + SpellEffect), zones, maps, classes, races, factions, flight paths, lookups | `GET https://wago.tools/db2/<Table>/csv?build=<build>&useHotfixes=1`, one request per table, ~0.5 s apart, User-Agent naming the project |
| opendata repo | quests, NPCs and game objects seen in players' caches (not in DB2 on this engine); later loot, vendors, spawns | `git clone`/`git pull` of github.com/wowlayerup-forever/opendata into `refs/opendata` |
| `seeds/` | constants no source publishes | committed CSV |

`useHotfixes=1` is verified: for 1.60.1.70532 ItemSparse grows from 19,258 to 24,174 rows and includes
Robes of Arugal (item level 28, required level 23), the Rotmender's set and Blindwatcher's Sight.

Items, recipes and spells move from opendata to wago (built in our dbt from the raw tables), so the pipeline
depends on opendata only for what DB2 cannot give. opendata's `tools/extract_client.py` is the reference for
how recipes and stats are assembled from DB2; we re-implement it in SQL, we do not run it.

## How it runs

Two actions, because downloading needs no dbt and should not happen on every import (user):

```
The build field defaults to the newest 1.60.1.x build wago lists under any Forever product (`wowf` or
`wow_classic_beta`); which product does not matter, since any build can be fetched and imported again later
(user). `build_info.product` records which one it came from.

Fetch build (kind: command, field: build)
  └─ pipeline container, fetch only: for each wago table the models need, download
     refs/wago/<build>/<Table>.csv only if the file is missing (with useHotfixes=1);
     clone refs/opendata if missing. Re-fetching a table means deleting its file first.

Import build (kind: command, field: build; must already be fetched)
  └─ pipeline container, no network to wago:
       1. dbt     build with --vars '{wago_build: <build>}' : staging, intermediate, marts, tests
       2. publish marts into Postgres schema wow_next, then swap (below)
```

The import fails with a clear message naming any table file missing for that build.

- **Container.** `pipeline/Dockerfile`: Python, dbt-core + dbt-duckdb, git. `composer.yaml` gets a
  `pipeline` service behind a profile (never started by a plain `up`), like the bakery example's `seed`.
- **Mounts.** `./dbt` read-only, `./seeds` read-only, `./refs` read-write. Nothing else from the project.
  dbt's `target/`, `logs/` and the DuckDB working file go to scratch inside the container
  (`--target-path`, `DBT_LOG_PATH`, profile `path:`). The container can change only `refs/` and Postgres.
- **Transforms stay in DuckDB** (it reads the CSVs in place and is fast); only finished marts go to Postgres.
- **Postgres.** A `postgres` service in `composer.yaml` (official image, named volume, loopback ephemeral
  port as the existing `mongo` service does). The pipeline reaches it as `postgres:5432` on the compose
  network. Vantage's datasource: `postgres://…@postgres:5432/wow?sslmode=disable&options=-c%20search_path%3Dwow`.
- **Swap.** Marts are written into schema `wow_next` (dropped first if left over). After every table,
  index and test has passed: one transaction `DROP SCHEMA IF EXISTS wow_prev CASCADE; ALTER SCHEMA wow
  RENAME TO wow_prev; ALTER SCHEMA wow_next RENAME TO wow;`. A failure at any step stops before the swap
  and the terminal shows the error; the live `wow` schema is untouched. `wow_prev` is kept only as the
  one-step rollback.
- **Metadata.** A `wow.build_info` table: build, product, fetched_at (oldest download time among the
  build's table files, so stale hotfix data is visible), opendata commit, row counts per table.
- **Tests that block versus warn** *(builder's call)*. Tests inside one source block the swap (unique and
  not_null ids, wago-to-wago references, unknown stat ids). References between opendata and wago records
  (quest_items → items, quest_npcs → npcs, quests → areas) are `severity: warn`: opendata comes from
  players' caches of other builds, so some links will dangle, and that must not stop an import. Warnings
  print in the terminal and their counts go into `build_info`.
- **No foreign keys in Postgres** *(builder's call)*: the schema is read-only and rebuilt whole; dbt tests
  check references, and dangling cross-source links are expected (above).
- **Development.** The same dbt project runs on the host through `.venv` (`./dbt/run.sh`), publishing to
  the composer Postgres through its mapped port. The SQLite publish step and `data/opendata.sqlite` go.

## Published tables (schema `wow`)

All tables from the current dbt project carry over (zones, areas, maps, taxi nodes/paths, classes, races,
factions, skill lines, item sets, item subclasses, items, item_stats, quests, quest_items, quest_npcs,
quest_reputation, recipes, recipe_reagents, npcs, game_objects, spells), rebuilt from wago where noted above.

Items without an ItemSparse row (~7,700 even with hotfixes: an id and a slot, no name, level or stats) are
not published (user: "unused old items, we are just ignoring"). References to them from quests or recipes
show up as cross-source warnings (see "Tests that block versus warn").

Postgres specifics:

- Every table has a primary key (the single id column, as today; bridge tables keep their `a:b` text key).
- B-tree indexes on every id, foreign id, and the columns pages sort or filter by (name, quality, levels,
  slot, class, each stat column on items).
- Lists stay JSON text as today unless a page needs them otherwise (decided while building).

### Level ranges

- **Items**: `required_level`, `item_level` (from ItemSparse with hotfixes).
- **Quests**: `min_level`, `quest_level` (opendata).
- **Zones**: no zone-level field in Forever data (AreaTable.ExplorationLevel is 0 on zones, ContentTuningID
  is set on only 21 areas). Derived as min/max `ExplorationLevel` over the zone's sub-areas, which comes close
  (Tirisfal 5–12, Silverpine 10–20, Hillsbrad 20–31, Arathi 30–40, Winterspring 55–60; Duskwood 10–30 is
  loose), then overridden from `seeds/ref_zone_levels.csv` where it is wrong. `level_source` says which.
- **Dungeons and raids**: LFGDungeons → ContentTuning gives one number that doesn't match known ranges
  (Shadowfang Keep 18; Ruins of Lordaeron 15 in one field, 27 in another), so ranges come from the same seed.
  Published as a `dungeons` table: dungeon id, name, map, zone it is entered from, min/max level, source.
- **Professions**: recipe `skill_required`/green/gray; trainer ranks (Apprentice/Journeyman/Expert/Artisan
  with skill cap and character level) as a seed unless a wago table carries them.
- Seeded ranges are our own judgement: each row says where it came from (in-game, Forever patch notes, the
  user). Start with the zones and dungeons in the user's planner; the rest filled in as guides need them.

### items: stats as columns

- A fixed, committed list of stat columns *(builder's call)*: `seeds/ref_item_stat_types.csv` maps each
  stat type id to its column name and label. Every listed column is always published (blank, not 0,
  when an item lacks it), so the table YAML and Items page never break between builds. A test fails the
  import when a build uses a stat type id that is not in the seed; adding a stat is a one-line seed
  change plus the page column. The list starts with every stat this build uses:
  stamina, spirit, intellect, agility, strength, armor, spell damage, healing, attack power, ranged attack
  power, the five resistances, hit/crit/haste/defense/dodge/parry/block ratings, and the rest found in
  the data. Forever uses ~35 stat type ids that opendata has no names for (83–139); their names come from
  wago's published value list for `StatModifier_bonusStat` (the DB2 viewer page carries enums), else a seed.
- Values are fixed per item: the data shows no class-dependent "primary stat" types (71–74) and every
  level-scaling column (`ContentTuningID`, `PlayerLevelToItemLevelCurveID`, `ItemLevelOffsetCurveID`) is 0.
  So they are computed in dbt at build time, with opendata's formula:
  `round(StatPercentEditor_n × RandPropPoints[item_level].<quality bucket>_<slot bucket> / 10000)`.
  Armor and weapon damage follow opendata's `compute_armor` / `compute_damage`.
- The raw inputs are published beside the results (budget shares, item level, quality, slot), so values can
  be checked or recomputed. No scores or weightings on top of them (see Anti-goals).
- `item_stats` (long form, one row per item and stat) stays for the API.

## Admin (Vantage)

- Datasource `datasource/wow.yaml` (`type: postgres`). Remove `datasource/opendata.yaml`.
- **Items page**: a binder over `items` with search (name searchable), columns name (quality colour),
  quality, item level, required level, slot, armor type/subclass, and the stat columns, all sortable;
  `allow_add: false`. The first tab under the grid is a custom summary view laid out like the in-game
  tooltip: name in quality colour, binding, slot and armor type, armor or damage, stats ("+12 Stamina"),
  equip and use effects (spell descriptions), required level, item level, sell price as g/s/c. No icons.
  Further tabs: Details (all columns) and relation tabs (recipes that create it, recipes that use it,
  quests that reward or require it).
- Plain read-only binder pages for zones and dungeons (with level ranges and their source), quests,
  recipes, NPCs, spells, and a Reference section
  (classes, races, factions, skill lines, item sets). Menu grouped: Items, World, Quests, Crafting, Reference.
  A separate menu section for MongoDB tables comes later.
- **Import build** action in the toolbar of a small Data page (current build, row counts from `build_info`).
- A first-run setup wizard (services, then import), like the bakery's.

## Repo

```
agents/BRIEF.md          project brief (update for this design)
dbt/                     models, macros, tests; profiles.yml; README.md
seeds/                   our CSV constants, _seeds.yml, README.md
pipeline/                Dockerfile, fetch script, entry script
datasource/ table/ page/ menu/ action/ view/   Vantage
composer.yaml            postgres, mongo, pipeline (profile)
docs/superpowers/specs/  this document
```

Ignored: `refs/` (downloads), `data/`, `.venv/`, dbt output, scratch, `.superpowers/`, Vantage-generated
files (`*/README.md` except ours, `.agents/`, `.claude/skills/`, `AGENTS.md`).

## Verification

- dbt tests: unique + not_null ids, relationships between marts, accepted values for enum columns, and a
  check that every stat type id used in the build has a name.
- Spot checks in the terminal output after publish: Robes of Arugal (6324) present with item level 28,
  required level 23; row counts per table.
- In Vantage (MCP): `list_logs` clean, `run_data_script` finds 6324 by search, the Items page sorts by
  Spirit, the summary tab renders.
- A stat spot-check against a few known tooltips is still owed (opendata's caveat); the summary page is
  where that happens.

## Left to the builder

- Exact list and naming of stat columns (from the data and wago's value list).
- Which lists become bridge tables versus JSON text.
- Postgres image version, credentials (local only), resource limits.
- The fetch script's language (Python standard library preferred, as opendata does).
- Column widths, colours, labels on pages (vantage-quality checklist).
