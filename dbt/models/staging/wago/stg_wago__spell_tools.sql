-- Items a spell needs in the bags to cast (Blacksmith Hammer, Mining Pick, ...).
{% for n in range(2) %}
select "SpellID" as spell_id, "Totem_{{ n }}" as item_id
from {{ source('wago', 'SpellTotems') }}
where "Totem_{{ n }}" > 0
{% if not loop.last %}union all{% endif %}
{% endfor %}
