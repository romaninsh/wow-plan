-- Quest types (Elite, Dungeon, Raid, PvP, ...). A quest's `type` is a quest_info_id.
select
    "ID"                            as quest_info_id,
    "InfoName_lang"                 as name,
    '{{ var("wago_build") }}'       as build
from {{ source('wago', 'QuestInfo') }}
