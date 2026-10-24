-- Spells with a name: rank and description (Spell), school and cast time (SpellMisc, normal
-- difficulty), level (SpellLevels, normal difficulty).
select
    n."ID"                              as spell_id,
    n."Name_lang"                       as name,
    nullif(trim(s."NameSubtext_lang"), '') as rank,
    nullif(trim(s."Description_lang"), '') as description,
    nullif(trim(s."AuraDescription_lang"), '') as aura_description,
    m."SchoolMask"                      as school_mask,
    nullif(ct."Base", 0)                as cast_ms,
    nullif(l."SpellLevel", 0)           as spell_level,
    nullif(l."BaseLevel", 0)            as base_level,
    nullif(m."SpellIconFileDataID", 0)  as icon_file_data_id,
    '{{ var("wago_build") }}'           as build
from {{ source('wago', 'SpellName') }} as n
left join {{ source('wago', 'Spell') }} as s on s."ID" = n."ID"
left join {{ source('wago', 'SpellMisc') }} as m on m."SpellID" = n."ID" and m."DifficultyID" = 0
left join {{ source('wago', 'SpellCastTimes') }} as ct on ct."ID" = m."CastingTimeIndex"
left join {{ source('wago', 'SpellLevels') }} as l on l."SpellID" = n."ID" and l."DifficultyID" = 0
where nullif(trim(n."Name_lang"), '') is not null
qualify row_number() over (partition by n."ID" order by m."ID", l."ID") = 1
