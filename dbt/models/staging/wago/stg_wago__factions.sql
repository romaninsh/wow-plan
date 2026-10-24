select
    "ID"                            as faction_id,
    "Name_lang"                     as name,
    nullif(trim("Description_lang"), '') as description,
    nullif("ReputationIndex", -1)   as reputation_index,
    nullif("ParentFactionID", 0)    as parent_faction_id,
    "Expansion"                     as expansion_id,
    "Flags"                         as flags,
    '{{ var("wago_build") }}'       as build
from {{ source('wago', 'Faction') }}
