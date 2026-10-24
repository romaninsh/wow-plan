-- Share of an item level's base armor each body slot gets, per material.
select
    "ID"                    as armor_location_id,
    "Clothmodifier"         as cloth_modifier,
    "Leathermodifier"       as leather_modifier,
    "Chainmodifier"         as mail_modifier,
    "Platemodifier"         as plate_modifier
from {{ source('wago', 'ArmorLocation') }}
