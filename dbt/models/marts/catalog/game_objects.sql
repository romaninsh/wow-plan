-- Game objects: chests, herbs, ore veins, doors, quest objects.
select
    o.object_id,
    o.name,
    o.object_type,
    o.lock_type,
    o.required_skill_line_id,
    sk.name                         as required_skill_name,
    o.required_skill_rank,
    o.display_id,
    o.source_kind,
    o.source_ref,
    o.build_first_seen,
    o.build_last_seen,
    o.confidence
from {{ ref('stg_opendata__objects') }} as o
left join {{ ref('stg_wago__skill_lines') }} as sk on sk.skill_line_id = o.required_skill_line_id
