-- Weapon damage (opendata extract_client.py damage_table + compute_damage): pick the ItemDamage*
-- table from class, subclass, slot and the caster flag (Flags_1 & 0x200), read the DPS for the
-- item level and quality, then min/max = DPS x speed x (1 -/+ variance / 2), rounded half up.
with picked as (
    select
        i.item_id,
        i.weapon_speed_ms,
        coalesce(i.damage_variance, 0) as variance,
        i.item_level,
        i.quality,
        case
            when i.item_class_id = 6 then 'ItemDamageAmmo'
            when i.item_class_id <> 2 then null
            when i.item_subclass_id in (2, 3, 18, 19) then 'ItemDamageRanged'   -- bow, gun, crossbow, wand
            when i.item_subclass_id = 16 then 'ItemDamageThrown'
            when i.item_subclass_id in (1, 5, 6, 8, 10, 20) or i.inventory_type = 17
                then case when (i.flags_1 & 512) <> 0 then 'ItemDamageTwoHandCaster' else 'ItemDamageTwoHand' end
            else case when (i.flags_1 & 512) <> 0 then 'ItemDamageOneHandCaster' else 'ItemDamageOneHand' end
        end as damage_table
    from {{ ref('stg_wago__items') }} as i
    where i.item_class_id in (2, 6)
)

select
    p.item_id,
    p.damage_table,
    d.dps,
    p.weapon_speed_ms,
    cast(floor(d.dps * p.weapon_speed_ms / 1000.0 * (1 - p.variance / 2) + 0.5) as integer) as damage_min,
    cast(floor(d.dps * p.weapon_speed_ms / 1000.0 * (1 + p.variance / 2) + 0.5) as integer) as damage_max
from picked as p
join {{ ref('stg_wago__item_damage') }} as d
  on d.damage_table = p.damage_table and d.item_level = p.item_level and d.quality = p.quality
where p.weapon_speed_ms > 0
