# wow-plan

Game data for World of Warcraft: Forever (items, zones, dungeons, quests, recipes, professions, NPCs,
spells) and personal leveling guides built on it (product: wow-plan.com).

**Spirit.** WoW Forever is about enjoying every part of the game, not skipping it. We are against
pre-built guides and optimised checklists: players write their own plan from basic information and find
things themselves while they play. We help them stay focused, turning a playthrough into a collection of
short goals they chose, beyond quest completion. The data names things precisely and checks they fit a
level range; it never recommends (no best-in-slot, no optimal routes, no "best item" scores).

Three layers:

1. **Reference data (Postgres, done).** `pipeline/` fetches a client build's tables from wago.tools
   (hotfixes merged) and opendata; `dbt/` transforms and tests them; the result is Postgres schema
   `wow`, replaced whole on every import. Read-only. Design:
   `docs/superpowers/specs/2026-10-24-postgres-reference-pipeline-design.md`.
2. **Guides (MongoDB, next).** A guide covers one playthrough, solo or with one friend (up to 2
   characters), up to level 60. It is built from level-range blocks; everything in a block must fit
   its range (no Shadowfang Keep at level 5). Target kinds: travel to a zone, acquire an item,
   complete a quest, reach a profession level, craft an item to sell or use. Targets reference the
   reference data by Blizzard ID and keep a small snapshot (name, quality) so they survive an item
   being removed. Built with AI help; we focus on presentation. Each guide has a short random link
   (7 characters); opening it shows the guide and offers to clone it. Example material: the user's
   "House of Grr" planner (Vinnie, Undead Warlock; Lin, Skyborne Druid), checked for levels 1-20.
3. **API and web app (started).** `api/wowplan.yaml` serves guides and the game data they reference,
   read-only; the only writes are server actions (`create_plan`, `check_edit_code`). `web/wowplan/`
   is the React app: an intro (slogan, plan name, one character plus an optional friend, recently
   opened plans) and a read-only plan page (characters, level blocks, targets) with hover lookups
   of items, zones, areas, dungeons and skills. House rule: logic lives in the backend; the page
   keeps only what belongs to the browser (edit-code cookies, the recent list). Each plan has a
   share link (`/p/<id>`) and an edit link (`/p/<id>#edit=<code>`); the code goes into a cookie
   and the server says whether it edits. MCP access for AI agents comes later.

## Data notes

- **No drop sources, by decision.** Who drops an item is not in the data and won't be added
  (not from Classic emulator DBs, not from opendata's loot observations). A player who knows
  Robes of Arugal comes from Shadowfang Keep writes that into their own plan; otherwise it's
  theirs to find out.

- Items: every named item of the build (24,174 for 1.60.1.70532). ~7,700 Item rows without a name
  are ignored (unused or still withheld).
- Quests, NPCs, objects come from players' game caches (opendata) and cover only what someone has
  seen; opendata's loot, vendor and spawn data arrives after launch (2026-11-04).
- Zones have no level field in Forever data: ranges come from sub-area exploration levels, with
  seed overrides. Dungeon ranges are seeded (`seeds/ref_dungeon_levels.csv`).
- Recipe `skill_required` is the client minimum; the trainer's requirement is server-side.
- Stat values follow opendata's budget formula; spot-check against the game.

## Next

- Spot-check item stats against in-game tooltips; fill dungeon and zone level seeds.
- Design the guide documents in MongoDB, then the guide pages in Vantage (a separate menu section).
- API (`api/`) and MCP access; the React client.
