-- Crafting recipes: profession, skill thresholds (orange/required, green, gray; yellow is not in
-- client data), what it makes, the recipe item that teaches it, and how many reagents it takes.
with reagent_counts as (
    select spell_id, count(*) as reagent_count
    from {{ ref('stg_wago__spell_reagents') }}
    group by spell_id
),

tools as (
    select spell_id, to_json(list(item_id order by item_id))::varchar as tool_item_ids
    from {{ ref('stg_wago__spell_tools') }}
    group by spell_id
)

select
    r.recipe_spell_id,
    s.name,
    r.skill_line_id,
    sk.name                         as profession_name,
    r.skill_required,
    r.skill_green,
    r.skill_gray,
    r.creates_item_id,
    i.name                          as creates_item_name,
    i.quality                       as creates_item_quality,
    i.required_level                as creates_item_required_level,
    r.creates_count,
    rc.reagent_count,
    r.taught_by_item_id,
    tb.name                         as taught_by_item_name,
    t.tool_item_ids,
    s.cast_ms,
    s.description,
    s.build
from {{ ref('int_recipes') }} as r
join {{ ref('stg_wago__spells') }} as s on s.spell_id = r.recipe_spell_id
left join {{ ref('stg_wago__skill_lines') }} as sk on sk.skill_line_id = r.skill_line_id
left join {{ ref('stg_wago__items') }} as i on i.item_id = r.creates_item_id
left join {{ ref('stg_wago__items') }} as tb on tb.item_id = r.taught_by_item_id
left join reagent_counts as rc on rc.spell_id = r.recipe_spell_id
left join tools as t on t.spell_id = r.recipe_spell_id
