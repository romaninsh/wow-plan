select
    "ID"                            as creature_family_id,
    "Name_lang"                     as name,
    "IconFileID"                    as icon_file_data_id,
    '{{ var("wago_build") }}'       as build
from {{ source('wago', 'CreatureFamily') }}
