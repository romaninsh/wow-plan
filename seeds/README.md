# seeds

Our own data: facts about the game that no downloaded table publishes. dbt loads every CSV here
into DuckDB (`dbt/dbt_project.yml` points `seed-paths` at this folder), and `_seeds.yml`
documents and tests them.

Rules:

- One CSV per list, header row, sorted by the key column. Plain diffs, one line per value.
- Add a seed only for something genuinely missing upstream. Check wago.tools first, including
  its value lists (enums) for DB2 columns, and prefer fetching a table over typing one in.
- Say where the values came from: in `_seeds.yml`, and in a `source` column where rows differ.

| File | What | Source |
|---|---|---|
| `ref_item_stat_types.csv` | stat type id → items column, tooltip label, base or Equip: line | wago ItemStatType value list |
| `ref_inventory_types.csv` | slot id → name, stat budget slot, armor location | client constants; opendata extractor |
| `ref_armor_subclasses.csv` | armor subclass → armor type for the armor formula | ItemSubClass names |
| `ref_item_qualities.csv` | quality id → name, tooltip colour | client constants |
| `ref_item_bindings.csv` | bind type → tooltip wording | client constants |
| `ref_zone_levels.csv` | zone level ranges where sub-area levels are wrong | per row (empty so far) |
| `ref_dungeon_levels.csv` | dungeon level ranges | per row |
| `ref_profession_ranks.csv` | trainer ranks: skill bounds, character level | per row |
| `ref_reputation_standings.csv` | reputation standing → name (Hated to Exalted) | client constants |
| `ref_creature_classifications.csv` | creature rank → name | client constants |
| `ref_map_instance_types.csv` | Map.InstanceType → name | client constants |
| `ref_spell_schools.csv` | school bit → name | client constants |
