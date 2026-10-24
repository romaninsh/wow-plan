-- Weapon DPS per damage table, item level and quality (ItemDamage* tables, ID = item level).
{% set tables = ['ItemDamageOneHand', 'ItemDamageOneHandCaster', 'ItemDamageTwoHand', 'ItemDamageTwoHandCaster',
                 'ItemDamageRanged', 'ItemDamageThrown', 'ItemDamageAmmo'] %}
{% for t in tables %}
{% for q in range(7) %}
select '{{ t }}' as damage_table, "ID" as item_level, {{ q }} as quality, "Quality_{{ q }}" as dps
from {{ source('wago', t) }}
{% if not loop.last %}union all{% endif %}
{% endfor %}
{% if not loop.last %}union all{% endif %}
{% endfor %}
