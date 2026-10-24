-- Items with their class, slot, quality and set resolved to names. Stub rows (no name) are
-- kept so every item id other tables mention resolves; filter on has_details to hide them.
with classes as (
    select class_id, name, class_mask from {{ ref('classes') }}
),

usable as (
    select
        i.item_id,
        string_agg(c.name, ', ' order by c.class_id) as usable_by_classes
    from {{ ref('stg_opendata__items') }} as i
    join classes as c on (i.allowable_class_mask & c.class_mask) <> 0
    where i.allowable_class_mask is not null
      and i.allowable_class_mask not in (0, -1)
      -- a mask covering every class is "all classes", not a restriction
      and (i.allowable_class_mask & (select bit_or(class_mask) from classes)) <> (select bit_or(class_mask) from classes)
    group by i.item_id
)

select
    i.item_id,
    i.name,
    i.has_details,
    i.quality,
    q.name                          as quality_name,
    i.item_level,
    i.required_level,
    i.item_class_id,
    ic.name                         as item_class_name,
    i.item_subclass_id,
    isc.name                        as item_subclass_name,
    i.inventory_type,
    it.name                         as slot_name,
    i.binding,
    b.name                          as binding_name,
    i.max_stack,
    i.armor,
    i.damage.min                    as damage_min,
    i.damage.max                    as damage_max,
    i.damage.speed_ms               as weapon_speed_ms,
    case when i.damage.speed_ms > 0
         then round((i.damage.min + i.damage.max) / 2.0 / (i.damage.speed_ms / 1000.0), 1)
    end                             as dps,
    case when i.stats is not null then to_json(i.stats)::varchar end as stats,
    case when i.spells is not null then to_json(i.spells)::varchar end as spells,
    u.usable_by_classes,
    i.allowable_class_mask,
    i.allowable_race_mask,
    i.required_skill_id             as required_skill_line_id,
    sk.name                         as required_skill_name,
    i.required_skill_rank,
    i.item_set_id,
    s.name                          as item_set_name,
    i.sell_price_copper,
    i.buy_price_copper,
    i.icon_file_data_id,
    i.description,
    i.source_kind,
    i.source_ref,
    i.build_first_seen,
    i.build_last_seen,
    i.confidence
from {{ ref('stg_opendata__items') }} as i
left join {{ ref('ref_item_qualities') }} as q on q.quality = i.quality
left join {{ ref('stg_wago__item_classes') }} as ic on ic.item_class_id = i.item_class_id
left join {{ ref('stg_wago__item_subclasses') }} as isc
       on isc.item_class_id = i.item_class_id and isc.item_subclass_id = i.item_subclass_id
left join {{ ref('ref_inventory_types') }} as it on it.inventory_type = i.inventory_type
left join {{ ref('ref_item_bindings') }} as b on b.binding = i.binding
left join {{ ref('stg_wago__skill_lines') }} as sk on sk.skill_line_id = i.required_skill_id
left join {{ ref('stg_wago__item_sets') }} as s on s.item_set_id = i.item_set_id
left join usable as u on u.item_id = i.item_id
