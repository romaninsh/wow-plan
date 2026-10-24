-- SpellReagents' eight slots as rows.
{% for n in range(8) %}
select
    "SpellID"               as spell_id,
    {{ n }}                 as slot,
    "Reagent_{{ n }}"       as item_id,
    "ReagentCount_{{ n }}"  as count
from {{ source('wago', 'SpellReagents') }}
where "Reagent_{{ n }}" > 0 and "ReagentCount_{{ n }}" > 0
{% if not loop.last %}union all{% endif %}
{% endfor %}
