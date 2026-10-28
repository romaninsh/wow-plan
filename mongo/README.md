# mongo

Guides live in MongoDB, database `wowplan` (the `mongo` service in composer.yaml, a single-node
replica set). Draft model; it will grow.

| File | What |
|---|---|
| `schema.js` | collections, `$jsonSchema` validators and indexes. Idempotent |
| `views.js` | the read-only views the desktop plan pages read (`plan_target_rows`, `plan_place_groups`, `plan_bracket_rows`, `plan_character_rows`: place lifted out, owners and done state computed). Dropped and re-created on every run. Only the desktop admin reads them |
| `seed.js` | the sample plans for development and API tests (marked `sample: true`); deletes and re-inserts only the plans it lists |
| `guides.sh` | runs them against a target: `mongo/guides.sh local\|prod schema` (schema.js + views.js), `mongo/guides.sh local\|prod samples` (seed.js) |

The admin runs them with buttons, on the active profile's target (`TARGET` in `.env` /
`.env.prod`): **Update guides schema** on the Data page, **Reset sample plans** on the Plans
page. Production details: `docs/populate-prod.md`.

## Sample plans

| Plan | Link | Edit code (tests only) |
|---|---|---|
| House of Grr | `/p/k3Fq9xZ` | `Grr4` |
| Vinnie goes solo (clone) | `/p/p8Lm2Tw` | `Vin2` |
| Grak the patient | `/p/Zt4n0Ra` | `Grk9` |

Open `/p/k3Fq9xZ#edit=Grr4` in the web app to become an editor of House of Grr on that
browser. Real plans get random 4-character codes from `create_plan` (`generate_password(4)`,
no `0 1 I O l`); plans made before 2026-10-28 keep their 12-character codes, which still work.
Only the SHA-256 is stored (`edit_code_hash`, never served by the API).

## Collections

```
plans            _id: 7-char share id ("k3Fq9xZ" -> wow-plan.com/k3Fq9xZ), name, description,
                 game_build, forked_from (plan id it was cloned from), created_at, updated_at
plan_characters  _id "<plan>.<key>", plan_id, key ("vinnie"), order, name, race_id, class_id
                 (+ race_name, class_name snapshots), professions { primary: [ref] (max 2),
                 secondary: [ref] }, start (ref), notes
plan_blocks      _id "<plan>.b<n>", plan_id, order, min_level, max_level (1-60), title, zones [ref]
plan_targets     _id "<plan>.t<block><nn>", plan_id, block_id, order, kind, title, characters
                 (keys; empty = everyone), ref, place, count, level, purpose (sell|use|give),
                 for_character, done_by (keys), notes
```

`place` is where a target is done: `{ zone_id | lfg_dungeon_id | area_id, name }` (exactly one
id, nothing else) or null. It is always a game reference, never free text. Pages group a
block's targets by place; a place is done once every target there is ticked by all its
characters. A dungeon run's place is its dungeon, a trip's place its zone or area.

`ref` is a reference to the reference data (Postgres schema `wow`): one Blizzard id field
(`item_id`, `zone_id`, `area_id`, `quest_id`, `skill_line_id`, `recipe_spell_id`,
`lfg_dungeon_id`) plus a `name` snapshot (and `quality` for items), so a target still reads well
after a rebuild renames or drops what it points at.

Target kinds: `travel_to_zone`, `acquire_item`, `complete_quest`, `reach_profession_level`,
`craft_item`, `run_dungeon`, `reach_level`, `note`. A target may have no `ref` (a quest the data
doesn't have yet, a free-text goal): the title is what counts.

Validators require the fields each document can't do without and check the closed sets (kinds,
id shapes, at most two primary professions); any other field is allowed, so new character or
plan details need no migration. Rules that span collections (1-2 characters per plan, a valid
race/class pair, one faction per plan) belong to the actions. Level fit is loose: a level only
picks a bracket when none is named.

`place_key` is `place` as one flat value (`dungeon:3272`, `zone:14`, `area:159`, `none`),
written with it by the actions and the seed: pages filter on it, since Vantage's cache can't
filter on a field inside `place`.

Not stored, on purpose: drop sources (players write "from Shadowfang Keep" into a target's title
themselves), recommendations of any kind.
