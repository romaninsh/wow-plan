-- Dungeons and raids (group finder entries), with a level range from seeds/ref_dungeon_levels.csv.
-- The client's own tuning level is kept for reference; it doesn't match known ranges.
-- LFGDungeons.MapID is 0 on every row in Forever data, so the instance map is matched by name
-- (map_match 'name') when the id is missing.
with instance_maps as (
    select map_id, name from {{ ref('maps') }}
    where instance_type in (1, 2)
    qualify row_number() over (partition by name order by map_id) = 1
),

matched as (
    select
        d.*,
        coalesce(nullif(d.map_id, 0), im.map_id) as resolved_map_id,
        case when nullif(d.map_id, 0) is not null then 'id'
             when im.map_id is not null then 'name' end as map_match
    from {{ ref('stg_wago__lfg_dungeons') }} as d
    left join instance_maps as im on im.name = d.name
)

select
    d.lfg_dungeon_id,
    d.name,
    d.resolved_map_id               as map_id,
    d.map_match,
    m.name                          as map_name,
    m.instance_type_name            as kind,
    m.max_players,
    dl.min_level,
    dl.max_level,
    dl.source                       as level_source,
    d.tuning_min_level,
    d.difficulty_id,
    d.build
from matched as d
left join {{ ref('maps') }} as m on m.map_id = d.resolved_map_id
left join {{ ref('ref_dungeon_levels') }} as dl on dl.lfg_dungeon_id = d.lfg_dungeon_id
