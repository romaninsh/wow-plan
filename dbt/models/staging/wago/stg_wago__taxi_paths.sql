select
    "ID"                            as taxi_path_id,
    "FromTaxiNode"                  as from_taxi_node_id,
    "ToTaxiNode"                    as to_taxi_node_id,
    "Cost"                          as cost_copper,
    '{{ var("wago_build") }}'       as build
from {{ source('wago', 'TaxiPath') }}
