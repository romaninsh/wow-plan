-- Quest categories that are not a zone. A quest's zone_or_sort is -quest_sort_id for these.
select
    "ID"                            as quest_sort_id,
    "SortName_lang"                 as name,
    "UiOrderIndex"                  as ui_order,
    '{{ var("wago_build") }}'       as build
from {{ source('wago', 'QuestSort') }}
