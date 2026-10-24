-- Dungeons and raids from the group finder table. The ContentTuning level numbers are kept for
-- reference but are not used as the level range (they don't match known ranges); see
-- seeds/ref_dungeon_levels.csv.
select
    d."ID"                          as lfg_dungeon_id,
    d."Name_lang"                   as name,
    d."MapID"                       as map_id,
    d."TypeID"                      as type_id,
    d."DifficultyID"                as difficulty_id,
    d."Faction"                     as faction,
    nullif(d."ContentTuningID", 0)  as content_tuning_id,
    nullif(ct."MinLevelSquish", 0)  as tuning_min_level,
    nullif(ct."MaxLevelSquish", 0)  as tuning_max_level,
    '{{ var("wago_build") }}'       as build
from {{ source('wago', 'LFGDungeons') }} as d
left join {{ source('wago', 'ContentTuning') }} as ct on ct."ID" = d."ContentTuningID"
