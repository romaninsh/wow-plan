select
    recipe_spell_id,
    name,
    skill_id                        as skill_line_id,
    skill_ids                       as skill_line_ids,
    skill_required,
    skill_green,
    skill_gray,
    creates.item_id                 as creates_item_id,
    creates.count                   as creates_count,
    reagents,
    tool_item_ids,
    cast_ms,
    source.kind                     as source_kind,
    source.ref                      as source_ref,
    build_first_seen,
    build_last_seen,
    confidence
from {{ source('opendata', 'recipes') }}
