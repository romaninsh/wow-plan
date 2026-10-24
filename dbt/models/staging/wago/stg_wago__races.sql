select
    "ID"                            as race_id,
    "Name_lang"                     as name,
    "ClientFileString"              as token,
    "ClientPrefix"                  as client_prefix,
    "FactionID"                     as faction_template_id,
    "Flags"                         as flags,
    nullif(trim("LoreDescription_lang"), '') as description,
    '{{ var("wago_build") }}'       as build
from {{ source('wago', 'ChrRaces') }}
