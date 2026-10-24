select
    race_id,
    name,
    token,
    -- allowable_race_mask bit for this race on items and quests
    case when race_id between 1 and 63 then (1::bigint << (race_id - 1)) end as race_mask,
    faction_template_id,
    flags,
    description,
    build
from {{ ref('stg_wago__races') }}
