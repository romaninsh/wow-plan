-- The spell effects the models need: 24 create item (recipes), 36 learn spell (recipe items),
-- 53 / 54 enchant item permanently / temporarily (misc_value is the SpellItemEnchantment id).
select
    "SpellID"                       as spell_id,
    "EffectIndex"                   as effect_index,
    "Effect"                        as effect,
    nullif("EffectItemType", 0)     as item_id,
    nullif("EffectTriggerSpell", 0) as trigger_spell_id,
    nullif("EffectMiscValue_0", 0)  as misc_value,
    "EffectBasePointsF"             as base_points
from {{ source('wago', 'SpellEffect') }}
where "DifficultyID" = 0
  and "Effect" in (24, 36, 53, 54)
