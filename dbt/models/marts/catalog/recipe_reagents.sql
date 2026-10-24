-- One row per recipe and reagent. Answers both "what does this need" and "what uses Light Leather".
select
    r.recipe_spell_id || ':' || g.item_id as recipe_reagent_id,
    r.recipe_spell_id,
    s.name                          as recipe_name,
    r.skill_line_id,
    g.item_id,
    i.name                          as item_name,
    g.count
from {{ ref('int_recipes') }} as r
join {{ ref('stg_wago__spells') }} as s on s.spell_id = r.recipe_spell_id
join {{ ref('stg_wago__spell_reagents') }} as g on g.spell_id = r.recipe_spell_id
left join {{ ref('stg_wago__items') }} as i on i.item_id = g.item_id
qualify row_number() over (partition by r.recipe_spell_id, g.item_id order by g.slot) = 1
