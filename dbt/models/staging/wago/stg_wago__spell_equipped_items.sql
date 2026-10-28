-- The item a spell needs equipped or targets (SpellEquippedItems): enchants use it for the slots
-- they go on. inventory_type_mask has bit n set for inventory type n; subclass_mask likewise for
-- the item class's subclasses. One row per spell.
select
    "SpellID"                           as spell_id,
    "EquippedItemClass"                 as item_class_id,
    "EquippedItemInvTypes"              as inventory_type_mask,
    "EquippedItemSubclass"              as subclass_mask
from {{ source('wago', 'SpellEquippedItems') }}
qualify row_number() over (partition by "SpellID" order by "ID") = 1
