-- Faction templates: FactionGroup is a mask, 1 player, 2 Alliance, 4 Horde, 8 monster.
select
    "ID"                            as faction_template_id,
    nullif("Faction", 0)            as faction_id,
    "FactionGroup"                  as faction_group_mask,
    case
        when ("FactionGroup" & 2) <> 0 then 'Alliance'
        when ("FactionGroup" & 4) <> 0 then 'Horde'
    end                             as side
from {{ source('wago', 'FactionTemplate') }}
