-- Crafting recipes: the profession, skill thresholds, what it makes and how many reagents.
-- The yellow threshold is not in client data; green and gray are.
with reagent_counts as (
    select recipe_spell_id, count(*) as reagent_count
    from {{ ref('recipe_reagents') }}
    group by recipe_spell_id
)

select
    r.recipe_spell_id,
    r.name,
    r.skill_line_id,
    sk.name                         as profession_name,
    r.skill_required,
    nullif(r.skill_green, 0)        as skill_green,
    nullif(r.skill_gray, 0)         as skill_gray,
    r.creates_item_id,
    i.name                          as creates_item_name,
    i.quality                       as creates_item_quality,
    r.creates_count,
    coalesce(rc.reagent_count, 0)   as reagent_count,
    case when r.tool_item_ids is not null then to_json(r.tool_item_ids)::varchar end as tool_item_ids,
    r.cast_ms,
    r.source_kind,
    r.source_ref,
    r.build_first_seen,
    r.build_last_seen,
    r.confidence
from {{ ref('stg_opendata__recipes') }} as r
left join {{ ref('stg_wago__skill_lines') }} as sk on sk.skill_line_id = r.skill_line_id
left join {{ ref('stg_opendata__items') }} as i on i.item_id = r.creates_item_id
left join reagent_counts as rc using (recipe_spell_id)
