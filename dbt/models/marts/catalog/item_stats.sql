-- One row per item and stat (the long form of the stat columns on items), with the budget inputs
-- so any value can be checked: value = round(budget_share x budget_points / 10000).
select
    v.item_id || ':' || v.slot          as item_stat_id,
    v.item_id,
    i.name                              as item_name,
    v.slot,
    v.stat_type_id,
    v.column_name                       as stat,
    v.label,
    v.tooltip_kind,
    v.value,
    v.budget_share,
    v.budget_points,
    i.item_level,
    i.required_level,
    i.inventory_type
from {{ ref('int_items__stat_values') }} as v
join {{ ref('stg_wago__items') }} as i using (item_id)
