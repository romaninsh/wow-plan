-- Every named place: zones, cities, dungeons and the sub-areas inside them.
select
    a.area_id,
    a.name,
    a.parent_area_id,
    parent.name                     as parent_name,
    r.zone_id,
    zone.name                       as zone_name,
    r.depth = 0                     as is_zone,
    r.depth,
    a.map_id,
    m.name                          as map_name,
    m.instance_type_name,
    a.exploration_level,
    a.faction_group_mask,
    a.internal_name,
    a.build
from {{ ref('stg_wago__areas') }} as a
left join {{ ref('int_areas__zone_rollup') }} as r using (area_id)
left join {{ ref('stg_wago__areas') }} as parent on parent.area_id = a.parent_area_id
left join {{ ref('stg_wago__areas') }} as zone on zone.area_id = r.zone_id
left join {{ ref('maps') }} as m on m.map_id = a.map_id
