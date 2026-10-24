-- Reputation factions (Darnassus, Thorium Brotherhood, ...). Groups such as "Horde" are rows too.
select
    f.faction_id,
    f.name,
    f.parent_faction_id,
    parent.name                     as parent_name,
    f.reputation_index is not null  as has_reputation,
    f.description,
    f.build
from {{ ref('stg_wago__factions') }} as f
left join {{ ref('stg_wago__factions') }} as parent on parent.faction_id = f.parent_faction_id
