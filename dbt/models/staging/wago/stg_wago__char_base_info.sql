-- Race/class pairs a player can create (the character creation screen's rules).
select
    "RaceID"                        as race_id,
    "ClassID"                       as class_id,
    nullif("OtherFactionRaceID", 0) as other_faction_race_id
from {{ source('wago', 'CharBaseInfo') }}
