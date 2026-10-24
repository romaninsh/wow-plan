select
    "ID"                            as item_set_id,
    "Name_lang"                     as name,
    nullif("RequiredSkill", 0)      as required_skill_line_id,
    nullif("RequiredSkillRank", 0)  as required_skill_rank,
    list_filter(
        [{% for n in range(17) %}"ItemID_{{ n }}"{% if not loop.last %}, {% endif %}{% endfor %}],
        lambda x: x <> 0
    )                               as item_ids,
    '{{ var("wago_build") }}'       as build
from {{ source('wago', 'ItemSet') }}
