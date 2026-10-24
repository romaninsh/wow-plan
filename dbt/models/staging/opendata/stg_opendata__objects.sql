select
    object_id,
    name,
    object_type,
    lock_type,
    required_skill_id               as required_skill_line_id,
    required_skill_rank,
    display_id,
    source.kind                     as source_kind,
    source.ref                      as source_ref,
    build_first_seen,
    build_last_seen,
    confidence
from {{ source('opendata', 'objects') }}
