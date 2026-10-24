-- Spells an item casts or grants, for the tooltip's Use: / Equip: / Chance on hit: lines.
-- Effects pointing at a spell the build doesn't ship are left out (inert, as in opendata).
select
    e.item_id || ':' || e.spell_id || ':' || e.trigger_type as item_spell_id,
    e.item_id,
    i.name                              as item_name,
    e.spell_id,
    s.name                              as spell_name,
    e.trigger,
    s.description                       as spell_description,
    e.charges,
    e.cooldown_ms,
    e.slot_index
from {{ ref('stg_wago__item_effects') }} as e
join {{ ref('stg_wago__items') }} as i using (item_id)
join {{ ref('stg_wago__spells') }} as s using (spell_id)
qualify row_number() over (partition by e.item_id, e.spell_id, e.trigger_type order by e.slot_index) = 1
