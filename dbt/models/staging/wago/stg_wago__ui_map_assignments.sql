-- Where a UiMap sits in world coordinates: Region_0..2 is the min corner (x, y, z),
-- Region_3..5 the max corner. UiMin/UiMax are the 0..1 window of the map texture it covers.
-- Used to turn world positions into the 0..100 map coordinates players see.
select
    "ID"                            as ui_map_assignment_id,
    "UiMapID"                       as ui_map_id,
    "MapID"                         as map_id,
    nullif("AreaID", 0)             as area_id,
    "OrderIndex"                    as order_index,
    "UiMin_0"                       as ui_min_x,
    "UiMin_1"                       as ui_min_y,
    "UiMax_0"                       as ui_max_x,
    "UiMax_1"                       as ui_max_y,
    "Region_0"                      as world_min_x,
    "Region_1"                      as world_min_y,
    "Region_2"                      as world_min_z,
    "Region_3"                      as world_max_x,
    "Region_4"                      as world_max_y,
    "Region_5"                      as world_max_z,
    '{{ var("wago_build") }}'       as build
from {{ source('wago', 'UiMapAssignment') }}
