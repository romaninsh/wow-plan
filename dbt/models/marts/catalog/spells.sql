select
    s.spell_id,
    s.name,
    s.rank,
    s.description,
    s.school_mask,
    coalesce(sc.name, case when s.school_mask > 0 then 'Multiple' end) as school_name,
    s.spell_level,
    s.skill_line_id,
    sk.name                         as skill_name,
    s.source_kind,
    s.source_ref,
    s.build_first_seen,
    s.build_last_seen,
    s.confidence
from {{ ref('stg_opendata__spells') }} as s
left join {{ ref('ref_spell_schools') }} as sc using (school_mask)
left join {{ ref('stg_wago__skill_lines') }} as sk on sk.skill_line_id = s.skill_line_id
