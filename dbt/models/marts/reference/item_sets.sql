select
    s.item_set_id,
    s.name,
    len(s.item_ids)                 as item_count,
    to_json(s.item_ids)::varchar    as item_ids,
    s.required_skill_line_id,
    sk.name                         as required_skill_name,
    s.required_skill_rank,
    s.build
from {{ ref('stg_wago__item_sets') }} as s
left join {{ ref('stg_wago__skill_lines') }} as sk on sk.skill_line_id = s.required_skill_line_id
