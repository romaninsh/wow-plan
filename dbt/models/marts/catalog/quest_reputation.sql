-- Reputation a quest awards, per faction.
select
    q.quest_id || ':' || r.faction_id as quest_reputation_id,
    q.quest_id,
    q.name                          as quest_name,
    r.faction_id,
    f.name                          as faction_name,
    r.value
from {{ ref('stg_opendata__quests') }} as q,
     unnest(q.reward_reputation) as t(r)
left join {{ ref('stg_wago__factions') }} as f on f.faction_id = r.faction_id
