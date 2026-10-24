-- Crafting recipes (opendata extract_client.py extract_spells_and_recipes): a spell under a skill
-- line that creates an item (effect 24) and takes reagents. One row per spell; when a spell sits
-- under several skill lines the lowest SkillLineAbility row wins. Recipes whose product has no
-- name in this build (unused leftovers, like the nameless items) are left out.
with sla as (
    select *,
        row_number() over (partition by spell_id order by skill_line_ability_id) as rn,
        count(distinct skill_line_id) over (partition by spell_id) as skill_line_count
    from {{ ref('stg_wago__skill_line_abilities') }}
),

creates as (
    select spell_id, item_id, greatest(1, cast(round(coalesce(base_points, 1)) as integer)) as count
    from {{ ref('stg_wago__spell_effects') }}
    where effect = 24 and item_id is not null
    qualify row_number() over (partition by spell_id order by effect_index) = 1
),

has_reagents as (
    select distinct spell_id from {{ ref('stg_wago__spell_reagents') }}
),

-- recipe item -> recipe: the item's "learn" effect casts a spell whose effect 36 teaches the recipe
taught_by as (
    select se.trigger_spell_id as spell_id, min(ie.item_id) as item_id
    from {{ ref('stg_wago__item_effects') }} as ie
    join {{ ref('stg_wago__spell_effects') }} as se on se.spell_id = ie.spell_id and se.effect = 36
    where ie.trigger_type = 6 and se.trigger_spell_id is not null
    group by se.trigger_spell_id
)

select
    sla.spell_id                    as recipe_spell_id,
    sla.skill_line_id,
    sla.skill_line_count,
    sla.skill_required,
    sla.skill_green,
    sla.skill_gray,
    sla.acquire_method,
    c.item_id                       as creates_item_id,
    c.count                         as creates_count,
    tb.item_id                      as taught_by_item_id
from sla
join creates as c on c.spell_id = sla.spell_id
join has_reagents as hr on hr.spell_id = sla.spell_id
join {{ ref('stg_wago__items') }} as made on made.item_id = c.item_id
left join taught_by as tb on tb.spell_id = sla.spell_id
where sla.rn = 1
