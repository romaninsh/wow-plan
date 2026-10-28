-- Where an item comes from, as far as the client data says: one row per item and source.
--   crafted        a profession recipe makes it (source_id = recipe spell)
--   quest_reward   a quest gives it (source_id = quest; opendata, only quests someone has seen)
--   quest_choice   a quest offers it as one of its choice rewards
--   reputation     it asks for a reputation standing: a faction's reward, sold by its
--                  quartermaster (source_id = faction; NULL when the build gives only the standing)
--   pvp_rank       it asks for a PvP rank: an honor reward
-- Creature and boss loot, vendor stock and world drops are server-side and not in this data.
with sources as (
    select
        creates_item_id                 as item_id,
        'crafted'                       as kind,
        recipe_spell_id                 as source_id,
        name                            as source_name,
        profession_name                 as detail,
        null::bigint                    as zone_id
    from {{ ref('recipes') }}

    union all
    select
        qi.item_id,
        case qi.role when 'reward' then 'quest_reward' else 'quest_choice' end,
        qi.quest_id,
        qi.quest_name,
        'quest level ' || q.quest_level,
        q.zone_id
    from {{ ref('quest_items') }} as qi
    join {{ ref('quests') }} as q using (quest_id)
    where qi.role in ('reward', 'choice')

    union all
    select
        item_id,
        'reputation',
        required_faction_id,
        coalesce(required_faction_name, 'faction not in client data'),
        required_standing_name,
        null
    from {{ ref('items') }}
    where required_standing is not null

    union all
    select item_id, 'pvp_rank', null, 'PvP rank ' || required_pvp_rank, null, null
    from {{ ref('items') }}
    where required_pvp_rank is not null
)

select
    s.item_id || ':' || s.kind || ':' || coalesce(s.source_id, 0) as item_source_id,
    s.item_id,
    i.name                          as item_name,
    s.kind,
    s.source_id,
    s.source_name,
    s.detail,
    case when s.kind = 'crafted' then s.source_id end as recipe_spell_id,
    case when s.kind like 'quest_%' then s.source_id end as quest_id,
    case when s.kind = 'reputation' then s.source_id end as faction_id,
    s.zone_id,
    z.name                          as zone_name
from sources as s
join {{ ref('stg_wago__items') }} as i on i.item_id = s.item_id
left join {{ ref('stg_wago__areas') }} as z on z.area_id = s.zone_id
