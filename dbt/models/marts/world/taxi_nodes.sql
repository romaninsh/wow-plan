select
    t.taxi_node_id,
    t.name,
    t.map_id,
    m.name                          as map_name,
    t.world_x,
    t.world_y,
    t.world_z,
    t.flags,
    t.mount_npc_id_0,
    t.mount_npc_id_1,
    t.build
from {{ ref('stg_wago__taxi_nodes') }} as t
left join {{ ref('maps') }} as m using (map_id)
