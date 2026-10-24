select
    "ID"                            as area_id,
    "AreaName_lang"                 as name,
    "ZoneName"                      as internal_name,
    "ContinentID"                   as map_id,
    nullif("ParentAreaID", 0)       as parent_area_id,
    "ExplorationLevel"              as exploration_level,
    "FactionGroupMask"              as faction_group_mask,
    "AreaBit"                       as area_bit,
    "Flags_0"                       as flags,
    "Flags_1"                       as flags_2,
    '{{ var("wago_build") }}'       as build
from {{ source('wago', 'AreaTable') }}
