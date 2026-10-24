-- Spells an item casts or grants: Use:, Equip:, Chance on hit:, and the "learn" effect of recipes.
-- TriggerType names follow opendata extract_client.py TRIGGER.
select
    x."ItemID"                      as item_id,
    e."SpellID"                     as spell_id,
    e."TriggerType"                 as trigger_type,
    case e."TriggerType"
        when 0 then 'use'
        when 1 then 'equip'
        when 2 then 'chance_on_hit'
        when 4 then 'soulstone'
        when 6 then 'learn'
        else 'other'
    end                             as trigger,
    nullif(e."Charges", 0)          as charges,
    nullif(e."CoolDownMSec", -1)    as cooldown_ms,
    e."LegacySlotIndex"             as slot_index
from {{ source('wago', 'ItemXItemEffect') }} as x
join {{ source('wago', 'ItemEffect') }} as e on e."ID" = x."ItemEffectID"
where e."SpellID" > 0
