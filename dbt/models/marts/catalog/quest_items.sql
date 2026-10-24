-- Items a quest asks for or gives. role: objective (bring it), reward (always given),
-- choice (pick one of the choice rows).
with unioned as (
    select quest_id, 'objective' as role, o.item_id, o.count
    from {{ ref('stg_opendata__quests') }}, unnest(objective_items) as t(o)
    union all
    select quest_id, 'reward', o.item_id, o.count
    from {{ ref('stg_opendata__quests') }}, unnest(reward_items) as t(o)
    union all
    select quest_id, 'choice', o.item_id, o.count
    from {{ ref('stg_opendata__quests') }}, unnest(reward_choice_items) as t(o)
)

select
    u.quest_id || ':' || u.role || ':' || u.item_id as quest_item_id,
    u.quest_id,
    q.name                          as quest_name,
    u.role,
    u.item_id,
    i.name                          as item_name,
    i.quality                       as item_quality,
    u.count
from unioned as u
left join {{ ref('stg_opendata__quests') }} as q using (quest_id)
left join {{ ref('stg_wago__items') }} as i using (item_id)
