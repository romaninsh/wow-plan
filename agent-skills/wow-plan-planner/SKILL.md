---
name: wow-plan-planner
description: Build or extend a World of Warcraft: Forever levelling plan on wow-plan.com through its MCP tools (unlock_plan, add_block, add_target, find_game_data and the get_/list_ readers). Use when a player gives a plan id and edit key and asks for to-dos, a levelling route, gear to collect (twink or otherwise), dungeons to run or professions to raise.
---

# Planning on wow-plan.com

A plan is a player's own list of goals, grouped into level brackets. You fill it through the
`wowplan` MCP tools; the player watches the plan page, which updates as each call lands.

## The order of work

1. **Unlock.** `unlock_plan { plan_id, key }` with the 4-character edit key the player gave you.
   Every write to a locked plan is refused ("This plan is locked"). The unlock lasts for your
   MCP session; if you reconnect, unlock again.
2. **Read what is there.** `get_plans { id }`, then `list_plan_characters`, `list_plan_blocks`
   and `list_plan_targets`, each with `parent_id` set to the plan id. Note the character keys
   and the brackets' `_id`s; don't duplicate targets that already exist.
3. **Brackets first.** Every target sits in a bracket, and a new plan has none. Create the
   brackets the request needs with `add_block { plan_id, min_level, max_level, title? }` before
   adding anything. Brackets may share one edge level (1-10, 10-15, 15-19) but not overlap more;
   a one-level bracket (19-19) can't touch another. Keep them few: three to five for 1-19.
   `remove_block { block_id }` drops an empty one; there is no tool to change a bracket's levels.
4. **Add as you go.** Look a thing up, then add it at once with `add_target`. Don't collect the
   whole plan and write it at the end: the player is watching, a long silent run looks broken,
   and if you stop early nothing is saved.
5. **Finish with a short report:** what you added per bracket, and what you couldn't add or
   aren't sure of.

## Looking things up

- `find_game_data { kind, text }` searches by name (two characters or more). `kind` is one of
  `items`, `quests`, `zones`, `areas`, `dungeons`, `skill_lines`, `recipes`. It returns up to 25
  rows with their ids and a few facts (item level, required level, slot).
- `get_items`, `get_zones`, `get_areas`, `get_dungeons`, `get_skill_lines { id }` read one full
  record; `list_item_stats { item_id }` and `list_item_spells { item_id }` give an item's stats
  and effects.
- Use this build's data, not memory, for names, ids, levels and stats: items differ from
  classic (an item's level or required level can be different, and some items are one faction's
  only). Where the data has no source for an item, where it drops comes from your knowledge:
  put it in the target's `notes` and say so in the report.

## Adding targets

`add_target { plan_id, kind, ... }`. The kinds:

| kind | ref | other fields |
|---|---|---|
| `acquire_item` | `{ item_id }` | `place` where it drops, `count`, `purpose` |
| `run_dungeon` | `{ lfg_dungeon_id }` | |
| `travel_to_zone` | `{ zone_id }` or `{ area_id }` | |
| `complete_quest` | `{ quest_id }` | |
| `craft_item` | `{ recipe_spell_id }` | `count` |
| `reach_profession_level` | `{ skill_line_id }` | `level` |
| `reach_level` | none | `level` |
| `note` | none | `title`, `notes` |

- Give `block_id` to pick the bracket. Without it the bracket covering the target's level is
  taken. A level that doesn't fit the bracket is never refused: it comes back as `level_note`,
  which you mention to the player.
- `place { zone_id | lfg_dungeon_id | area_id }` says where it is done; the page groups a
  bracket's targets by place.
- `characters` (keys from `list_plan_characters`) only when the plan has two characters and the
  target is for one of them.
- `notes` (also `set_target_notes`): leave them out unless there is something the player can't
  see on the page and wouldn't find by playing. The page already shows the item, its slot,
  stats and level, and the zone or dungeon it's grouped under; don't repeat any of it, and don't
  write tips, routes or boss names by default. A note is for the non-obvious: an item that needs
  a profession, a faction-only reward, a quest that starts somewhere else. One short sentence.
- `ref` and `place` are JSON objects (`"ref": { "item_id": 5191 }`), not strings, and `level`
  and `count` are numbers. A to-do about an item, zone, dungeon, quest or recipe is that kind,
  linked by `ref`: the page shows the record and groups by place. `note` is only for a goal with
  no game record ("lock XP at 19").
- Errors are 422 with a sentence saying what to fix; fix the call and try again. If a linked
  to-do is refused and you can't see why, stop and say so in the report: don't turn it into a
  note. A 429 means you are going too fast: wait the seconds it gives.

## Judgement

The plan is the player's, and the game is about finding things out: exploring, asking other
players, trading. A plan is a list of goals, not a walkthrough. Give the fewest to-dos that get
the player there, with minimal detail, and leave how and where to them. Don't add a second
choice for every slot or a to-do per quest; a zone to level in is one to-do.

Name options and say what each is; don't rank them as "best in slot" unless the player asked
for that, and then say it's your view, not the data's.
