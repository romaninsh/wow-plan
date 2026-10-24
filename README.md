# wow-plan

Game data and leveling guides for World of Warcraft: Forever.

- **Reference data.** Every item, zone, quest, recipe, NPC and spell for a given client build,
  cleaned and indexed. Rebuilt from public sources whenever a new build ships. Read-only.
- **Guides (planned).** Personal leveling guides for one or two characters, built with AI help,
  shared through short links and cloned to modify. Stored in MongoDB and pointing at the
  reference data by Blizzard ID.
- **API and MCP (planned).** Read-only access to the reference data and access to guides, for
  the wow-plan.com web client and for AI agents.

## Layout

| Path | What |
|---|---|
| `datasource/` `table/` `page/` `menu/` `action/` | the Vantage admin app: browse and check the data |
| `dbt/` | dbt project that turns downloaded tables into the published data set ([README](dbt/README.md)) |
| `seeds/` | our own data for facts no source publishes ([README](seeds/README.md)) |
| `agents/` | notes for AI agents working on this repo (`BRIEF.md`) |
| `composer.yaml` | local services Vantage starts |
| `refs/` | downloads: the opendata clone and wago.tools exports. Not committed |
| `data/` | local database files. Not committed |

## Sources

- [wago.tools](https://wago.tools): the game client's data tables (DB2) per build, exported as CSV.
- [wowlayerup-forever/opendata](https://github.com/wowlayerup-forever/opendata) (CC BY 4.0):
  quests, NPCs and objects from players' game caches, later loot, vendors and spawns.

Nothing here is scraped from Wowhead or similar sites. World of Warcraft and related names are
trademarks of Blizzard Entertainment; this is a fan project, not affiliated with Blizzard.

## Building the data

```bash
python3 -m venv .venv && .venv/bin/pip install dbt-duckdb
./dbt/run.sh build
```
