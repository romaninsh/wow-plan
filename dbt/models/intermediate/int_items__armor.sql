-- Armor value of armor-class items (opendata extract_client.py compute_armor, keyed by armor
-- subclass rather than Item.Material): shields from ItemArmorShield; everything else base armor
-- for the armor type x the slot's share x the quality multiplier, rounded half up.
select
    i.item_id,
    sc.armor_type,
    case
        when i.inventory_type = 14
            then cast(floor(a.shield_armor + 0.5) as integer)
        when sc.armor_type is not null and loc.armor_location_id is not null
            then cast(floor(a.quality_mod
                 * case sc.armor_type when 'Cloth' then a.base_cloth when 'Leather' then a.base_leather
                                      when 'Mail' then a.base_mail when 'Plate' then a.base_plate end
                 * case sc.armor_type when 'Cloth' then loc.cloth_modifier when 'Leather' then loc.leather_modifier
                                      when 'Mail' then loc.mail_modifier when 'Plate' then loc.plate_modifier end
                 + 0.5) as integer)
    end                                     as armor,
    case when i.inventory_type = 14 then 'ItemArmorShield' else 'ItemArmorTotal' end as armor_source
from {{ ref('stg_wago__items') }} as i
join {{ ref('stg_wago__item_armor') }} as a on a.item_level = i.item_level and a.quality = i.quality
left join {{ ref('ref_armor_subclasses') }} as sc on sc.item_subclass_id = i.item_subclass_id
left join {{ ref('ref_inventory_types') }} as inv on inv.inventory_type = i.inventory_type
left join {{ ref('stg_wago__armor_locations') }} as loc on loc.armor_location_id = inv.armor_location_id
where i.item_class_id = 4
