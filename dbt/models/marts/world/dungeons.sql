-- Dungeons and raids (group finder entries), with a level range from seeds/ref_dungeon_levels.csv.
-- The client's own tuning level is kept for reference; it doesn't match known ranges.
select
    d.lfg_dungeon_id,
    d.name,
    d.map_id,
    m.name                          as map_name,
    m.instance_type_name            as kind,
    m.max_players,
    dl.min_level,
    dl.max_level,
    dl.source                       as level_source,
    d.tuning_min_level,
    d.difficulty_id,
    d.build
from {{ ref('stg_wago__lfg_dungeons') }} as d
left join {{ ref('maps') }} as m on m.map_id = d.map_id
left join {{ ref('ref_dungeon_levels') }} as dl on dl.lfg_dungeon_id = d.lfg_dungeon_id
