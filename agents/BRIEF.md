# WoW Forever DB

A backend service for World of Warcraft: Forever game data (items, zones, quests, recipes, NPCs, spells)
and for leveling plans built on it. Three layers:

1. **Reference data (dbt).** `dbt/` turns raw inputs in `refs/` into `data/wow.sqlite`: clean, indexed,
   tested tables that are rebuilt whenever the inputs change. Read-only for everyone else.
2. **Leveling plans (MongoDB).** People create plans for a playthrough, solo or with one friend
   (up to 2 characters): characters (race, class, professions), level brackets with zones, and
   targets to reach (skill levels, items to craft or loot, dungeons, class quests), ticked off as
   they play. Targets point at reference data by Blizzard ID. Example of the idea: the
   "House of Grr" planner (Vinnie, Undead Warlock; Lin, Skyborne Druid).
3. **API and MCP.** Later: expose both layers so other tools and AI agents can read the data and
   work with plans.

## Data

- `refs/opendata`: clone of github.com/wowlayerup-forever/opendata (client layer: items, spells,
  recipes, objects, and the NPCs and quests players have seen). Its world, market and derived
  layers are empty until after launch (2026-11-04).
- `refs/wago/<build>/`: DB2 CSV exports from wago.tools (zones, maps, classes, races, factions,
  item classes, skill lines, flight paths). Current build 1.60.1.70532.
- `data/opendata.sqlite`: the opendata repo's own SQLite build. The current pages read it;
  they move to `data/wow.sqlite` next.

## Next

- Point the Vantage pages at `data/wow.sqlite`; add Zones and the bridge tables as relation tabs.
- Design the leveling plan documents in MongoDB, then plan pages.
- An API (`api/`) and MCP access.
