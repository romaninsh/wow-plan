select
    "ID"                            as taxi_node_id,
    "Name_lang"                     as name,
    "ContinentID"                   as map_id,
    "Pos_0"                         as world_x,
    "Pos_1"                         as world_y,
    "Pos_2"                         as world_z,
    "Flags"                         as flags,
    -- Which faction each slot is for is not confirmed against Forever yet.
    nullif("MountCreatureID_0", 0)  as mount_npc_id_0,
    nullif("MountCreatureID_1", 0)  as mount_npc_id_1,
    '{{ var("wago_build") }}'       as build
from {{ source('wago', 'TaxiNodes') }}
