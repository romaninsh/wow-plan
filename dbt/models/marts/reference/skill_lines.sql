-- Skills: professions (category 11), secondary skills such as Cooking and First Aid (9 holds
-- them with riding, racials and lockpicking), weapon skills, class spell trees.
with recipe_counts as (
    select skill_line_id, count(*) as recipe_count
    from {{ ref('stg_opendata__recipes') }}
    group by skill_line_id
)

select
    s.skill_line_id,
    s.name,
    s.category_id,
    case s.category_id
        when 11 then 'Profession'
        when 9 then 'Secondary'
        when 6 then 'Weapon'
        when 7 then 'Class'
        when 8 then 'Armor'
        when 10 then 'Language'
        else 'Other'
    end                             as category,
    coalesce(rc.recipe_count, 0)    as recipe_count,
    coalesce(rc.recipe_count, 0) > 0 as is_craft,
    s.parent_skill_line_id,
    s.horde_name,
    s.description,
    s.icon_file_data_id,
    s.build
from {{ ref('stg_wago__skill_lines') }} as s
left join recipe_counts as rc using (skill_line_id)
