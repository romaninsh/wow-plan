-- One row per recipe and reagent. Answers both "what does this need" and "what uses Light Leather".
select
    r.recipe_spell_id || ':' || g.item_id as recipe_reagent_id,
    r.recipe_spell_id,
    r.name                          as recipe_name,
    r.skill_line_id,
    g.item_id,
    i.name                          as item_name,
    g.count
from {{ ref('stg_opendata__recipes') }} as r,
     unnest(r.reagents) as t(g)
left join {{ ref('stg_opendata__items') }} as i on i.item_id = g.item_id
