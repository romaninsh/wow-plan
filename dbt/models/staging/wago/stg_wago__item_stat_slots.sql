-- ItemSparse's ten stat slots as rows: which stat, and its share of the item's stat budget
-- (StatPercentEditor, in 1/10000 of the RandPropPoints value for the item's level, quality and slot).
with slots as (
    {% for n in range(10) %}
    select
        "ID"                                    as item_id,
        {{ n }}                                 as slot,
        "StatModifier_bonusStat_{{ n }}"        as stat_type_id,
        "StatPercentEditor_{{ n }}"             as budget_share
    from {{ source('wago', 'ItemSparse') }}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
)

select *
from slots
where stat_type_id >= 0
  and not (stat_type_id = 0 and budget_share = 0)
