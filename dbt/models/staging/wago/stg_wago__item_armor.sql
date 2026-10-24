-- Armor inputs per item level (ID = item level): base armor per material (ItemArmorTotal),
-- quality multiplier (ItemArmorQuality), shield armor per quality (ItemArmorShield).
{% for q in range(7) %}
select
    t."ID"                          as item_level,
    {{ q }}                         as quality,
    t."Cloth"                       as base_cloth,
    t."Leather"                     as base_leather,
    t."Mail"                        as base_mail,
    t."Plate"                       as base_plate,
    aq."Qualitymod_{{ q }}"         as quality_mod,
    sh."Quality_{{ q }}"            as shield_armor
from {{ source('wago', 'ItemArmorTotal') }} as t
left join {{ source('wago', 'ItemArmorQuality') }} as aq on aq."ID" = t."ID"
left join {{ source('wago', 'ItemArmorShield') }} as sh on sh."ID" = t."ID"
{% if not loop.last %}union all{% endif %}
{% endfor %}
