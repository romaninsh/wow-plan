select
    "ID"                            as creature_type_id,
    "Name_lang"                     as name,
    '{{ var("wago_build") }}'       as build
from {{ source('wago', 'CreatureType') }}
