-- Every area with the top-level zone it belongs to (Brill -> Tirisfal Glades) and its depth.
with recursive walk as (
    select
        area_id,
        parent_area_id,
        area_id     as zone_id,
        0           as depth
    from {{ ref('stg_wago__areas') }}
    -- roots: no parent, or a parent this build does not have (e.g. 17845 Dreambound Pinnacle -> 16597)
    where parent_area_id is null
       or parent_area_id not in (select area_id from {{ ref('stg_wago__areas') }})

    union all

    select
        child.area_id,
        child.parent_area_id,
        walk.zone_id,
        walk.depth + 1
    from {{ ref('stg_wago__areas') }} as child
    join walk on child.parent_area_id = walk.area_id
)

select area_id, zone_id, depth
from walk
