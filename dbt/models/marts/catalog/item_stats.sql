-- One row per item and stat, so "items with Intellect between levels 15 and 20" is a plain query.
-- Values are computed by the opendata extractor from the client's stat budget tables;
-- spot-check them against in-game tooltips.
select
    i.item_id || ':' || s.key       as item_stat_id,
    i.item_id,
    i.name                          as item_name,
    s.key                           as stat,
    s.value::bigint                 as value,
    i.item_level,
    i.required_level,
    i.inventory_type
from {{ ref('stg_opendata__items') }} as i,
     unnest(map_entries(i.stats)) as e(s)
where i.stats is not null
