select
    spell_id,
    name,
    nullif(trim(rank), '')          as rank,
    nullif(trim(description), '')   as description,
    school                          as school_mask,
    spell_level,
    skill_id                        as skill_line_id,
    source.kind                     as source_kind,
    source.ref                      as source_ref,
    build_first_seen,
    build_last_seen,
    confidence
from {{ source('opendata', 'spells') }}
