-- Top-level areas: the zones, cities and instances a quest or a leveling plan is set in.
with sub_areas as (
    select zone_id, count(*) - 1 as sub_area_count
    from {{ ref('areas') }}
    group by zone_id
),

quests as (
    select zone_id, count(*) as quest_count, min(quest_level) as min_quest_level, max(quest_level) as max_quest_level
    from {{ ref('quests') }}
    where zone_id is not null
    group by zone_id
)

select
    a.area_id                       as zone_id,
    a.name,
    a.map_id,
    a.map_name,
    a.instance_type_name            as kind,
    coalesce(s.sub_area_count, 0)   as sub_area_count,
    coalesce(q.quest_count, 0)      as quest_count,
    q.min_quest_level,
    q.max_quest_level,
    a.faction_group_mask,
    a.build
from {{ ref('areas') }} as a
left join sub_areas as s on s.zone_id = a.area_id
left join quests as q on q.zone_id = a.area_id
where a.is_zone
