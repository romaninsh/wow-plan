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
3. **API, web app and MCP (started).** `api/wowplan.yaml` serves guides and the game data they
   reference. Records are read-only; plans change only through server actions (`create_plan`,
   `unlock_plan`, the target actions, `tick_todo`, `set_target_notes`), refused for a plan the
   session hasn't unlocked. The same API is an MCP server (`/mcp` on the API's own port) for
   AI agents.
   `web/wowplan/` is the React app: an intro (slogan, plan name, one character plus an optional
   friend, recently opened plans) and a plan page (characters, level blocks, targets) with
   hover lookups of items, zones, areas, dungeons and skills, and a padlock: unlocked with the
   edit key, it ticks to-dos and edits notes. House rule: logic lives in the backend; the page
   keeps only what belongs to the browser (the session token, the recent list). Each plan has
   a share link (`/p/<id>`); an old edit link (`/p/<id>#edit=<code>`) unlocks once.

## Editing plans (decided 2026-10-28)

- **Main interaction is an AI agent over MCP** (built into vantage-server 1.10: it exposes the
  vista and calls our actions). Typical session: "good gear for a rogue at 20?" → the agent
  searches the reference data and names options (never ranks them); "Robes of Arugal drop in
  SFK, add for Lin" → one `add_target` action.
- **Edit key:** 4 characters, copy-paste (e.g. into WoW chat to a friend). Only its hash is
  stored. Brute force is the API's rate limit's job, not ours.
- **Unlock:** a visual unlock on the plan page (lock button, type the key); it changes the
  session so the editing actions open up for that plan, remembered on the device. Replaces
  the `#edit=` link. Built (see "Sessions and unlock").
- **Targets belong to a level bracket (block) and a place** (zone, dungeon or area). The page
  groups a bracket's targets by place; a place stays open until all its targets are ticked
  (SFK stays on the list while something there is left to farm). More associations later.
- **Level fit is loose, not a rule** (2026-10-28, replaces "everything in a block must fit its
  range"): players get items they can't equip yet and go back to low-level zones. With no
  bracket named, a target goes into the bracket covering its level; a named bracket is always
  accepted, and a level mismatch only comes back as a note for the agent to mention. Nothing is
  refused for level; the MCP agent building the plan decides.
- **Sessions and unlock (decided 2026-10-28; built except the Sessions page):**
  - Two kinds of visitor: one with a plan's id (reads that plan only: no listing, a plan's
    characters, brackets and to-dos reachable only from the plan) and one who also has its
    edit key.
  - A WebSocket connection is a session: every connection gets one, in memory, with no sign-in.
    It ends after **1 hour without activity** (updates are cheap in memory, so it tracks last
    access and the like). A reload or second tab resumes it with its token.
  - Unlocking sends the key; the server adds the plan to the session's list of plans, and the
    session may then edit those plans. Several plans can be unlocked at once.
  - **Each device unlocks on its own** with the key (every device is its own session; no
    accounts).
  - One write rule on the server refuses edits to plans not in the session's list, for the
    web page and MCP agents alike. A new edit key also revokes that plan from every session.
  - A desktop **Sessions** page lists who is connected (which page/plan, last access) and can
    **grant** edit on a plan to a session (support) as well as revoke it or disconnect. Not
    built: waits for VAN-540.
  - Rate limits: unlocking five tries then one per 5 s, per session and per address (a new
    session per guess doesn't help); new plans five then one per 20 s; each edit action 20
    then one a second.
  - Built 2026-10-28 (branch `sessions-and-mcp`, vantage-server 1.10): `application.yaml`
    `session:`, the `plan_id` rule in `datasource/plans.yaml`, `api/wowplan.yaml` (plans by id,
    their parts only `via: plans`, every record read-only, the target actions, MCP at `/mcp`
    on the API's port, an API-wide `rate_limit` on tool calls and invokes),
    the padlock on the plan page; checked by `tests/sessions_and_mcp.mjs`. add_target,
    update_target and move_target carry a copy of resolve_target's checks: an API action
    can't call another script action yet (VAN-546). Sessions are in memory: a server restart
    (or a scale-down to zero) locks every plan again.
- **Order:** actions and Guides pages in the Vantage desktop first (full access there), then
  the API/MCP and the web unlock once vantage-server 1.10 is out.

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
