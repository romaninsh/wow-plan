-- Top-level areas: the zones, cities and instances a guide block is set in, with a level range.
-- Forever data has no zone level field, so the range is the min/max exploration level of the
-- zone's sub-areas (level_source 'exploration'), replaced by seeds/ref_zone_levels.csv where
-- that is wrong (level_source 'seed').
with sub_areas as (
    select
        zone_id,
        count(*) - 1                                        as sub_area_count,
        min(nullif(exploration_level, 0))                   as exploration_min,
        max(nullif(exploration_level, 0))                   as exploration_max
    from {{ ref('areas') }}
    group by zone_id
),

quests as (
    select zone_id, count(*) as quest_count
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
    coalesce(zl.min_level, s.exploration_min) as min_level,
    coalesce(zl.max_level, s.exploration_max) as max_level,
    case when zl.zone_id is not null then 'seed'
         when s.exploration_min is not null then 'exploration' end as level_source,
    zl.source                       as level_note,
    coalesce(s.sub_area_count, 0)   as sub_area_count,
    coalesce(q.quest_count, 0)      as quest_count,
    a.faction_group_mask,
    a.build
from {{ ref('areas') }} as a
left join sub_areas as s on s.zone_id = a.area_id
left join quests as q on q.zone_id = a.area_id
left join {{ ref('ref_zone_levels') }} as zl on zl.zone_id = a.area_id
where a.is_zone
