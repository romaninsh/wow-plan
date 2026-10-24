select
    s.spell_id,
    s.name,
    s.rank,
    s.description,
    s.school_mask,
    coalesce(sc.name, case when s.school_mask > 0 then 'Multiple' end) as school_name,
    s.spell_level,
    s.cast_ms,
    sla.skill_line_id,
    sk.name                         as skill_name,
    s.build
from {{ ref('stg_wago__spells') }} as s
left join {{ ref('ref_spell_schools') }} as sc using (school_mask)
left join (
    select spell_id, skill_line_id
    from {{ ref('stg_wago__skill_line_abilities') }}
    qualify row_number() over (partition by spell_id order by skill_line_ability_id) = 1
) as sla using (spell_id)
left join {{ ref('stg_wago__skill_lines') }} as sk on sk.skill_line_id = sla.skill_line_id
