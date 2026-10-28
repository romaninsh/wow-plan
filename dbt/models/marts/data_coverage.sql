-- How the build's data spreads over level brackets: one row per bracket, a count per kind of
-- data, so a gap (nothing above level 30, a bracket without dungeons) shows at a glance. The
-- admin's Data stats page reads it. "no level" counts rows with no level or level 0.
--   items     required_level            quests   min_level (opendata: what players have seen)
--   zones     min_level (derived/seeded) dungeons min_level (seeded only)
--   areas     exploration_level         recipes  the made item's required_level
with brackets as (
    select * from (values
        (0, 'no level'), (1, '1-10'), (2, '11-20'), (3, '21-30'),
        (4, '31-40'), (5, '41-50'), (6, '51-60'), (7, 'over 60')
    ) as b(bracket_order, bracket)
),

levels as (
    select 'items' as what, required_level as lvl from {{ ref('items') }}
    union all select 'quests', min_level from {{ ref('quests') }}
    union all select 'zones', min_level from {{ ref('zones') }}
    union all select 'dungeons', min_level from {{ ref('dungeons') }}
    union all select 'areas', exploration_level from {{ ref('areas') }}
    union all select 'recipes', creates_item_required_level from {{ ref('recipes') }}
),

binned as (
    select
        what,
        case
            when lvl is null or lvl <= 0 then 0
            when lvl <= 10 then 1
            when lvl <= 20 then 2
            when lvl <= 30 then 3
            when lvl <= 40 then 4
            when lvl <= 50 then 5
            when lvl <= 60 then 6
            else 7
        end as bracket_order
    from levels
)

select
    b.bracket_order,
    b.bracket,
    count(x.what) filter (where x.what = 'items')::integer    as items,
    count(x.what) filter (where x.what = 'quests')::integer   as quests,
    count(x.what) filter (where x.what = 'zones')::integer    as zones,
    count(x.what) filter (where x.what = 'dungeons')::integer as dungeons,
    count(x.what) filter (where x.what = 'areas')::integer    as areas,
    count(x.what) filter (where x.what = 'recipes')::integer  as recipes
from brackets b
left join binned x using (bracket_order)
group by b.bracket_order, b.bracket
order by b.bracket_order
