-- What an enchant puts on an item (SpellItemEnchantment): the tooltip line and its numbers.
-- The line is the client's own text; $k1..$k3 in it stand for the effect points, filled in here
-- when the build gives them (scaling enchants leave them at 0, and keep the placeholder).
select
    "ID"                                as enchant_id,
    replace(replace(replace("Name_lang",
        '$k1', case when "EffectPointsMin_0" > 0 then "EffectPointsMin_0"::varchar else '$k1' end),
        '$k2', case when "EffectPointsMin_1" > 0 then "EffectPointsMin_1"::varchar else '$k2' end),
        '$k3', case when "EffectPointsMin_2" > 0 then "EffectPointsMin_2"::varchar else '$k3' end)
                                        as effect_text,
    nullif("Duration", 0)               as duration_s,
    nullif("Charges", 0)                as charges,
    nullif("MinLevel", 0)               as min_level,
    nullif("ItemLevelMin", 0)           as item_level_min,
    nullif("ItemLevelMax", 0)           as item_level_max,
    nullif("RequiredSkillID", 0)        as required_skill_line_id,
    nullif("RequiredSkillRank", 0)      as required_skill_rank
from {{ source('wago', 'SpellItemEnchantment') }}
