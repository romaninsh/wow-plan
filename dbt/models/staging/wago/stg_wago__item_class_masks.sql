-- Class and race restrictions. ItemSparse has no AllowableClass column on this engine;
-- ItemSearchName carries it. -1 means every class or race.
select
    "ID"                                as item_id,
    "AllowableClass"                    as allowable_class_mask,
    "AllowableRaces_0"                  as allowable_race_mask
from {{ source('wago', 'ItemSearchName') }}
