select
    m.map_id,
    m.name,
    m.instance_type,
    it.name                         as instance_type_name,
    m.max_players,
    m.expansion_id,
    m.area_id,
    m.parent_map_id,
    m.directory,
    m.build
from {{ ref('stg_wago__maps') }} as m
left join {{ ref('ref_map_instance_types') }} as it using (instance_type)
