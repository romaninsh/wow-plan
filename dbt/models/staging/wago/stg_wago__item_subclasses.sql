-- Keyed by (item_class_id, item_subclass_id); "ID" is only the DB2 row id.
select
    "ClassID"                       as item_class_id,
    "SubClassID"                    as item_subclass_id,
    "DisplayName_lang"              as name,
    nullif(trim("VerboseName_lang"), '') as verbose_name,
    "Flags"                         as flags,
    '{{ var("wago_build") }}'       as build
from {{ source('wago', 'ItemSubClass') }}
where "SubClassID" >= 0
