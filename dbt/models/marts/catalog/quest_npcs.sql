-- Creatures a quest asks you to kill (or interact with), and how many.
select
    q.quest_id || ':' || o.npc_id   as quest_npc_id,
    q.quest_id,
    q.name                          as quest_name,
    o.npc_id,
    n.name                          as npc_name,
    o.count
from {{ ref('stg_opendata__quests') }} as q,
     unnest(q.objective_npcs) as t(o)
left join {{ ref('stg_opendata__npcs') }} as n on n.npc_id = o.npc_id
