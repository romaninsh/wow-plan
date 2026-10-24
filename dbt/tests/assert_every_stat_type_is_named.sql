-- Blocks the import when the build uses a stat type seeds/ref_item_stat_types.csv doesn't list:
-- items would silently lose that stat. Fix: add the id (name from wago's ItemStatType list) to the
-- seed, and the column to the Items page.
select stat_type_id, count(*) as item_count
from {{ ref('int_items__stat_values') }}
where column_name is null
group by stat_type_id
