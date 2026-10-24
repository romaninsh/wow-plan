-- Each item stat's value: budget share x the RandPropPoints budget for the item's level, quality
-- bucket and slot, / 10000, rounded half up (opendata extract_client.py compute_stats).
-- Values are fixed per item: no class-dependent stat types and no level scaling in Forever data.
select
    s.item_id,
    s.slot,
    s.stat_type_id,
    st.column_name,
    st.label,
    st.tooltip_kind,
    s.budget_share,
    rp.points                           as budget_points,
    case when rp.points is not null
         then cast(floor(s.budget_share * rp.points / 10000.0 + 0.5) as integer)
    end                                 as value
from {{ ref('stg_wago__item_stat_slots') }} as s
join {{ ref('stg_wago__items') }} as i using (item_id)
left join {{ ref('ref_inventory_types') }} as inv on inv.inventory_type = i.inventory_type
left join {{ ref('stg_wago__rand_prop_points') }} as rp
       on rp.item_level = i.item_level
      and rp.stat_budget_slot = inv.stat_budget_slot
      and rp.quality_bucket = case when i.quality >= 4 then 'Epic' when i.quality = 3 then 'Superior' else 'Good' end
left join {{ ref('ref_item_stat_types') }} as st on st.stat_type_id = s.stat_type_id
