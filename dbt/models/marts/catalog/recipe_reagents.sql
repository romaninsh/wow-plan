-- One row per recipe and reagent. Answers both "what does this need" and "what uses Light Leather".
-- Recipes here are crafting recipes (recipes) and profession enchants (enchants with a skill line):
-- recipe_spell_id is the spell id of either.
with crafts as (
    select recipe_spell_id, skill_line_id from {{ ref('int_recipes') }}
    union all
    select enchant_spell_id, skill_line_id from {{ ref('int_enchants') }} where skill_line_id is not null
)

select
    r.recipe_spell_id || ':' || g.item_id as recipe_reagent_id,
    r.recipe_spell_id,
    s.name                          as recipe_name,
    r.skill_line_id,
    g.item_id,
    i.name                          as item_name,
    g.count
from crafts as r
join {{ ref('stg_wago__spells') }} as s on s.spell_id = r.recipe_spell_id
join {{ ref('stg_wago__spell_reagents') }} as g on g.spell_id = r.recipe_spell_id
left join {{ ref('stg_wago__items') }} as i on i.item_id = g.item_id
qualify row_number() over (partition by r.recipe_spell_id, g.item_id order by g.slot) = 1
