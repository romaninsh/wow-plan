-- Items with class, slot, quality, binding and set resolved to names, armor and weapon damage
-- computed, and one column per stat type in seeds/ref_item_stat_types.csv (0 when the item
-- doesn't have it). The column list is fixed by the seed, so it never changes between builds.
-- depends_on: {{ ref('ref_item_stat_types') }}
{%- set stat_columns = [] -%}
{%- if execute -%}
  {%- set res = run_query("select column_name from " ~ ref('ref_item_stat_types') ~ " order by stat_type_id") -%}
  {%- set stat_columns = res.columns[0].values() -%}
{%- endif %}

with stats as (
    select
        item_id
        {%- for c in stat_columns %},
        cast(coalesce(sum(value) filter (where column_name = '{{ c }}'), 0) as integer) as "{{ c }}"
        {%- endfor %}
    from {{ ref('int_items__stat_values') }}
    group by item_id
),

classes as (
    select class_id, name, class_mask from {{ ref('classes') }}
),

usable as (
    select
        m.item_id,
        string_agg(c.name, ', ' order by c.class_id) as usable_by_classes
    from {{ ref('stg_wago__item_class_masks') }} as m
    join classes as c on (m.allowable_class_mask & c.class_mask) <> 0
    where m.allowable_class_mask not in (0, -1)
      -- a mask covering every class is no restriction
      and (m.allowable_class_mask & (select bit_or(class_mask) from classes)) <> (select bit_or(class_mask) from classes)
    group by m.item_id
),

-- race mask bits per side, for items whose race restriction leaves only one side's races
side_masks as (
    select
        bit_or(r.race_mask) filter (where c.side = 'Alliance') as alliance_mask,
        bit_or(r.race_mask) filter (where c.side = 'Horde')    as horde_mask
    from {{ ref('races') }} as r
    join (select distinct race_id, side from {{ ref('class_race_combos') }}) as c using (race_id)
    where r.race_mask is not null
)

select
    i.item_id,
    i.name,
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
    ar.armor_type,
    i.binding,
    b.name                          as binding_name,
    i.max_stack,
    coalesce(ar.armor, 0)           as armor,
    dm.damage_min,
    dm.damage_max,
    i.weapon_speed_ms,
    coalesce(case when i.weapon_speed_ms > 0 and dm.damage_max is not null
         then round((dm.damage_min + dm.damage_max) / 2.0 / (i.weapon_speed_ms / 1000.0), 1)
    end, 0)                         as dps
    {#- 0 when the item lacks the stat: Postgres sorts NULL first when descending, which would put
        items without the stat at the top of a "most Spirit" sort. Pages show 0 as blank. #}
    {%- for c in stat_columns %},
    coalesce(st."{{ c }}", 0) as "{{ c }}"
    {%- endfor %},
    u.usable_by_classes,
    cm.allowable_class_mask,
    cm.allowable_race_mask,
    -- one side only: the client's Horde / Alliance item flags (ItemSparse.Flags_1 bits 0 and 1),
    -- or a race restriction that leaves only that side's races. NULL: both sides can use it.
    case
        when i.flags_1 & 1 <> 0 then 'Horde'
        when i.flags_1 & 2 <> 0 then 'Alliance'
        when cm.allowable_race_mask not in (0, -1)
             and cm.allowable_race_mask & sm.horde_mask = 0
             and cm.allowable_race_mask & sm.alliance_mask <> 0 then 'Alliance'
        when cm.allowable_race_mask not in (0, -1)
             and cm.allowable_race_mask & sm.alliance_mask = 0
             and cm.allowable_race_mask & sm.horde_mask <> 0 then 'Horde'
    end                             as faction_side,
    i.opposite_faction_item_id,
    -- a reputation the item asks for (usually a faction quartermaster's reward). Some builds give
    -- the standing but no faction (the Warsong Gulch rewards in 1.60.1): faction_id stays NULL.
    i.required_faction_id,
    f.name                          as required_faction_name,
    i.required_standing,
    rs.name                         as required_standing_name,
    -- the client's PvP rank number as stored (ItemSparse.RequiredPVPRank); not mapped to titles
    i.required_pvp_rank,
    i.required_skill_line_id,
    sk.name                         as required_skill_name,
    i.required_skill_rank,
    i.item_set_id,
    s.name                          as item_set_name,
    i.starts_quest_id,
    i.sell_price_copper,
    -- tooltip wording: 1g 2s 3c, leaving out zero units (200 -> 2s)
    nullif(trim(
        case when i.sell_price_copper // 10000 > 0 then (i.sell_price_copper // 10000) || 'g ' else '' end ||
        case when (i.sell_price_copper // 100) % 100 > 0 then ((i.sell_price_copper // 100) % 100) || 's ' else '' end ||
        case when i.sell_price_copper % 100 > 0 then (i.sell_price_copper % 100) || 'c' else '' end
    ), '')                          as sell_price_text,
    i.buy_price_copper,
    i.icon_file_data_id,
    i.description,
    ar.armor_source,
    dm.damage_table,
    i.build
from {{ ref('stg_wago__items') }} as i
left join stats as st on st.item_id = i.item_id
left join {{ ref('int_items__armor') }} as ar on ar.item_id = i.item_id
left join {{ ref('int_items__damage') }} as dm on dm.item_id = i.item_id
left join {{ ref('ref_item_qualities') }} as q on q.quality = i.quality
left join {{ ref('stg_wago__item_classes') }} as ic on ic.item_class_id = i.item_class_id
left join {{ ref('stg_wago__item_subclasses') }} as isc
       on isc.item_class_id = i.item_class_id and isc.item_subclass_id = i.item_subclass_id
left join {{ ref('ref_inventory_types') }} as it on it.inventory_type = i.inventory_type
left join {{ ref('ref_item_bindings') }} as b on b.binding = i.binding
left join {{ ref('stg_wago__skill_lines') }} as sk on sk.skill_line_id = i.required_skill_line_id
left join {{ ref('stg_wago__item_sets') }} as s on s.item_set_id = i.item_set_id
left join {{ ref('stg_wago__item_class_masks') }} as cm on cm.item_id = i.item_id
left join usable as u on u.item_id = i.item_id
left join {{ ref('stg_wago__factions') }} as f on f.faction_id = i.required_faction_id
left join {{ ref('ref_reputation_standings') }} as rs on rs.standing = i.required_standing
cross join side_masks as sm
