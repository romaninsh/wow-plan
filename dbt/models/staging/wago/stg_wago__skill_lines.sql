select
    "ID"                            as skill_line_id,
    "DisplayName_lang"              as name,
    nullif(trim("HordeDisplayName_lang"), '') as horde_name,
    nullif(trim("Description_lang"), '') as description,
    "CategoryID"                    as category_id,
    nullif("ParentSkillLineID", 0)  as parent_skill_line_id,
    "SpellIconFileID"               as icon_file_data_id,
    "Flags"                         as flags,
    '{{ var("wago_build") }}'       as build
from {{ source('wago', 'SkillLine') }}
