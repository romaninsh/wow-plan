select
    "ID"                            as class_id,
    "Name_lang"                     as name,
    "Filename"                      as token,
    "IconFileDataID"                as icon_file_data_id,
    "ArmorTypeMask"                 as armor_type_mask,
    "StartingLevel"                 as starting_level,
    nullif(trim("Description_lang"), '') as description,
    '{{ var("wago_build") }}'       as build
from {{ source('wago', 'ChrClasses') }}
