# mongo

Guides live in MongoDB, database `wowplan` (the `mongo` service in composer.yaml, a single-node
replica set). Draft model; it will grow.

| File | What |
|---|---|
| `schema.js` | collections, `$jsonSchema` validators and indexes. Idempotent |
| `seed.js` | three sample plans for development and API tests; replaces only those plans |

Both run inside the container (composer mounts this folder at `/scripts`): the admin's
**Reset sample plans** button on the Plans page, or

```bash
docker compose -p <compose project> -f composer.yaml exec -T mongo \
  mongosh "mongodb://localhost:27017/wowplan?directConnection=true" --quiet --file /scripts/schema.js
```

## Sample plans

| Plan | Link | Edit code (tests only) |
|---|---|---|
| House of Grr | `/p/k3Fq9xZ` | `GrrDemoEdit2` |
| Vinnie goes solo (clone) | `/p/p8Lm2Tw` | `VinnieSolo34` |
| Grak the patient | `/p/Zt4n0Ra` | `GrakEditMe56` |

Open `/p/k3Fq9xZ#edit=GrrDemoEdit2` in the web app to become an editor of House of Grr on that
browser. Real plans get random codes from `create_plan`; only their SHA-256 is stored
(`edit_code_hash`, never served by the API).

## Collections

```
plans            _id: 7-char share id ("k3Fq9xZ" -> wow-plan.com/k3Fq9xZ), name, description,
                 game_build, forked_from (plan id it was cloned from), created_at, updated_at
plan_characters  _id "<plan>.<key>", plan_id, key ("vinnie"), order, name, race_id, class_id
                 (+ race_name, class_name snapshots), professions { primary: [ref] (max 2),
                 secondary: [ref] }, start (ref), notes
plan_blocks      _id "<plan>.b<n>", plan_id, order, min_level, max_level (1-60), title, zones [ref]
plan_targets     _id "<plan>.t<block><nn>", plan_id, block_id, order, kind, title, characters
                 (keys; empty = everyone), ref, count, level, purpose (sell|use|give),
                 for_character, done_by (keys), notes
```

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
race/class pair, targets that fit their block's level range, one faction per plan) belong to
the API.

Not stored, on purpose: drop sources (players write "from Shadowfang Keep" into a target's title
themselves), recommendations of any kind.
