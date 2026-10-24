select
    "ID"                            as ui_map_id,
    "Name_lang"                     as name,
    nullif("ParentUiMapID", 0)      as parent_ui_map_id,
    "Type"                          as ui_map_type,
    "System"                        as system,
    "Flags"                         as flags,
    '{{ var("wago_build") }}'       as build
from {{ source('wago', 'UiMap') }}
