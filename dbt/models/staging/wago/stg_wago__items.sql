-- One row per item the build gives a name (Item + ItemSparse with hotfixes). Items with only an
-- Item row (an id and a slot, no name, level or stats) are left out: unused or still withheld.
select
    s."ID"                              as item_id,
    s."Display_lang"                    as name,
    nullif(trim(s."Description_lang"), '') as description,
    s."OverallQualityID"                as quality,
    s."ItemLevel"                       as item_level,
    s."RequiredLevel"                   as required_level,
    i."ClassID"                         as item_class_id,
    i."SubclassID"                      as item_subclass_id,
    i."InventoryType"                   as inventory_type,
    i."Material"                        as material,
    s."Bonding"                         as binding,
    greatest(s."Stackable", 1)          as max_stack,
    nullif(s."SellPrice", 0)            as sell_price_copper,
    nullif(s."BuyPrice", 0)             as buy_price_copper,
    nullif(s."ItemSet", 0)              as item_set_id,
    nullif(s."RequiredSkill", 0)        as required_skill_line_id,
    nullif(s."RequiredSkillRank", 0)    as required_skill_rank,
    nullif(s."StartQuestID", 0)         as starts_quest_id,
    nullif(s."ItemDelay", 0)            as weapon_speed_ms,
    s."DmgVariance"                     as damage_variance,
    s."Flags_1"                         as flags_1,
    nullif(i."IconFileDataID", 0)       as icon_file_data_id,
    '{{ var("wago_build") }}'           as build
from {{ source('wago', 'ItemSparse') }} as s
join {{ source('wago', 'Item') }} as i on i."ID" = s."ID"
where nullif(trim(s."Display_lang"), '') is not null
