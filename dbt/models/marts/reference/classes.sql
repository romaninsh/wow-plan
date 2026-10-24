select
    class_id,
    name,
    token,
    -- allowable_class_mask bit for this class on items and quests
    (1::bigint << (class_id - 1))   as class_mask,
    armor_type_mask,
    icon_file_data_id,
    description,
    build
from {{ ref('stg_wago__classes') }}
