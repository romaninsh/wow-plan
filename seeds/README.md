# seeds

Our own data: facts about the game that no downloaded table publishes. dbt loads every CSV
here as a table in the `ref` schema (`dbt/dbt_project.yml` points `seed-paths` at this folder),
and `_seeds.yml` documents and tests them.

Rules:

- One CSV per list, header row, sorted by the key column. Plain diffs, one line per value.
- Add a seed only for something genuinely missing upstream. Check wago.tools first, including
  its value lists (enums) for DB2 columns, and prefer fetching a table over typing one in.
- Say where the values came from in `_seeds.yml`.

| File | What | Source |
|---|---|---|
| `ref_item_qualities.csv` | quality id → name, tooltip colour | client constants |
| `ref_inventory_types.csv` | inventory type → slot name | client constants |
| `ref_item_bindings.csv` | bind type → tooltip wording | client constants |
| `ref_creature_classifications.csv` | creature rank → name | client constants |
| `ref_map_instance_types.csv` | Map.InstanceType → name | client constants |
| `ref_spell_schools.csv` | school bit → name | client constants |
