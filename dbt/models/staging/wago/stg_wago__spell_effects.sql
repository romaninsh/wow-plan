-- The spell effects the models need: 24 create item (recipes), 36 learn spell (recipe items).
select
    "SpellID"                       as spell_id,
    "EffectIndex"                   as effect_index,
    "Effect"                        as effect,
    nullif("EffectItemType", 0)     as item_id,
    nullif("EffectTriggerSpell", 0) as trigger_spell_id,
    "EffectBasePointsF"             as base_points
from {{ source('wago', 'SpellEffect') }}
where "DifficultyID" = 0
  and "Effect" in (24, 36)
