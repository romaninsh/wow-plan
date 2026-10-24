select
    "ClassID"                       as item_class_id,
    "ClassName_lang"                as name,
    "Flags"                         as flags,
    '{{ var("wago_build") }}'       as build
from {{ source('wago', 'ItemClass') }}
