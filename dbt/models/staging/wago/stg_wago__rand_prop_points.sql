-- Stat budget per item level (RandPropPoints.ID is the item level), one row per quality bucket and
-- budget slot. Quality bucket: Epic for quality >= 4, Superior for 3, Good below (opendata
-- extract_client.py quality_bucket); budget slot from ref_inventory_types.stat_budget_slot.
{% set buckets = ['Epic', 'Superior', 'Good'] %}
{% for b in buckets %}
{% for n in range(5) %}
select
    "ID"            as item_level,
    '{{ b }}'       as quality_bucket,
    {{ n }}         as stat_budget_slot,
    "{{ b }}_{{ n }}" as points
from {{ source('wago', 'RandPropPoints') }}
{% if not loop.last %}union all{% endif %}
{% endfor %}
{% if not loop.last %}union all{% endif %}
{% endfor %}
