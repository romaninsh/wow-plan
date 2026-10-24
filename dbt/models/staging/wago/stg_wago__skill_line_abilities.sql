-- Spells taught under a skill line, with the skill thresholds (orange from MinSkillLineRank,
-- green from TrivialSkillLineRankLow, gray from TrivialSkillLineRankHigh).
select
    "ID"                            as skill_line_ability_id,
    "SkillLine"                     as skill_line_id,
    "Spell"                         as spell_id,
    "MinSkillLineRank"              as skill_required,
    nullif("TrivialSkillLineRankLow", 0)  as skill_green,
    nullif("TrivialSkillLineRankHigh", 0) as skill_gray,
    "AcquireMethod"                 as acquire_method,
    nullif("ClassMask", 0)          as class_mask,
    nullif("SupercedesSpell", 0)    as supersedes_spell_id
from {{ source('wago', 'SkillLineAbility') }}
