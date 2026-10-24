select
    npc_id,
    name,
    nullif(trim(subname), '')       as subname,
    creature_type                   as creature_type_id,
    classification,
    display_ids,
    source.kind                     as source_kind,
    source.ref                      as source_ref,
    build_first_seen,
    build_last_seen,
    confidence
from {{ source('opendata', 'npcs') }}
