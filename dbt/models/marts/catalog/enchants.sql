-- Enchants: what the enchant does (the tooltip line the item gets), which slots it goes on, who
-- makes it (profession and skill) and what to buy or use for it: the formula that teaches it and
-- the item that applies it (in Forever, Enchanting makes scroll items like "Enchant Weapon -
-- Crusader"). Neither the enchant nor the spell carries a character level here: the level gate
-- is the applying item's required_level.
with reagent_counts as (
    select spell_id, count(*) as reagent_count
    from {{ ref('stg_wago__spell_reagents') }}
    group by spell_id
),

-- the slots, from SpellEquippedItems: inventory types when it names them, else the subclasses
-- (weapon types for weapon enchants, Shield for shield ones)
slot_names as (
    -- Chest and Robe, and the two Off Hand types, share a name: keep each name once
    select eq.spell_id, it.name, min(it.inventory_type) as inventory_type
    from {{ ref('stg_wago__spell_equipped_items') }} as eq
    join {{ ref('ref_inventory_types') }} as it
      on it.inventory_type between 1 and 62 and (eq.inventory_type_mask & (1::bigint << it.inventory_type)) <> 0
    group by eq.spell_id, it.name
),

slots as (
    select spell_id, string_agg(name, ', ' order by inventory_type) as applies_to
    from slot_names
    group by spell_id
),

subclasses as (
    -- the verbose name: "One-Handed Axes" and "Two-Handed Axes" are both "Axe" in name
    select eq.spell_id, string_agg(coalesce(sc.verbose_name, sc.name), ', ' order by sc.item_subclass_id) as applies_to
    from {{ ref('stg_wago__spell_equipped_items') }} as eq
    join {{ ref('stg_wago__item_subclasses') }} as sc
      on sc.item_class_id = eq.item_class_id
     and sc.item_subclass_id between 0 and 62
     and (eq.subclass_mask & (1::bigint << sc.item_subclass_id)) <> 0
    where eq.inventory_type_mask = 0
    group by eq.spell_id
)

select
    x.enchant_spell_id,
    s.name,
    x.enchant_id,
    ie.effect_text,
    x.permanent,
    case when x.permanent then 'permanent' else 'temporary' end as kind,
    coalesce(sl.applies_to, sc.applies_to) as applies_to,
    x.skill_line_id,
    sk.name                         as profession_name,
    x.skill_required,
    x.skill_green,
    x.skill_gray,
    rc.reagent_count,
    x.taught_by_item_id,
    tb.name                         as taught_by_item_name,
    x.item_id,
    i.name                          as item_name,
    i.required_level                as item_required_level,
    x.item_count,
    ie.duration_s,
    ie.charges,
    ie.item_level_min,
    ie.item_level_max,
    s.description,
    s.build
from {{ ref('int_enchants') }} as x
join {{ ref('stg_wago__spells') }} as s on s.spell_id = x.enchant_spell_id
left join {{ ref('stg_wago__item_enchantments') }} as ie on ie.enchant_id = x.enchant_id
left join {{ ref('stg_wago__skill_lines') }} as sk on sk.skill_line_id = x.skill_line_id
left join {{ ref('stg_wago__items') }} as tb on tb.item_id = x.taught_by_item_id
left join {{ ref('stg_wago__items') }} as i on i.item_id = x.item_id
left join reagent_counts as rc on rc.spell_id = x.enchant_spell_id
left join slots as sl on sl.spell_id = x.enchant_spell_id
left join subclasses as sc on sc.spell_id = x.enchant_spell_id
