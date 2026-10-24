select
    "ID"                            as map_id,
    "MapName_lang"                  as name,
    "Directory"                     as directory,
    "MapType"                       as map_type,
    "InstanceType"                  as instance_type,
    "ExpansionID"                   as expansion_id,
    nullif("AreaTableID", 0)        as area_id,
    nullif("ParentMapID", -1)       as parent_map_id,
    nullif("MaxPlayers", 0)         as max_players,
    "Flags_0"                       as flags,
    '{{ var("wago_build") }}'       as build
from {{ source('wago', 'Map') }}
