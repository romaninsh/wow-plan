-- Direct flight legs between two flight masters.
select
    p.taxi_path_id,
    p.from_taxi_node_id,
    f.name                          as from_name,
    p.to_taxi_node_id,
    t.name                          as to_name,
    f.map_id,
    p.cost_copper,
    p.build
from {{ ref('stg_wago__taxi_paths') }} as p
left join {{ ref('stg_wago__taxi_nodes') }} as f on f.taxi_node_id = p.from_taxi_node_id
left join {{ ref('stg_wago__taxi_nodes') }} as t on t.taxi_node_id = p.to_taxi_node_id
