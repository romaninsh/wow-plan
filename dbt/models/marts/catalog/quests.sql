-- Quests from the client cache: only those some player has seen so far.
-- zone_or_sort > 0 is the zone (AreaTable id), < 0 a quest category (QuestSort id, negated).
select
    q.quest_id,
    q.name,
    q.quest_level,
    q.min_level,
    case when q.zone_or_sort > 0 then q.zone_or_sort end as zone_id,
    z.name                          as zone_name,
    case when q.zone_or_sort < 0 then -q.zone_or_sort end as quest_sort_id,
    qs.name                         as quest_sort_name,
    coalesce(z.name, qs.name)       as category_name,
    q.quest_info_id,
    qi.name                         as quest_type_name,
    q.next_quest_id,
    q.objectives,
    q.description,
    coalesce(len(q.objective_items), 0) as objective_item_count,
    coalesce(len(q.objective_npcs), 0)  as objective_npc_count,
    q.reward_xp,
    q.reward_money_copper,
    coalesce(len(q.reward_items), 0)        as reward_item_count,
    coalesce(len(q.reward_choice_items), 0) as reward_choice_count,
    q.race_mask,
    q.flags,
    q.source_kind,
    q.source_ref,
    q.build_first_seen,
    q.build_last_seen,
    q.confidence
from {{ ref('stg_opendata__quests') }} as q
left join {{ ref('stg_wago__areas') }} as z on z.area_id = q.zone_or_sort and q.zone_or_sort > 0
left join {{ ref('stg_wago__quest_sorts') }} as qs on qs.quest_sort_id = -q.zone_or_sort and q.zone_or_sort < 0
left join {{ ref('stg_wago__quest_infos') }} as qi on qi.quest_info_id = q.quest_info_id
