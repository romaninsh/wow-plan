-- Every race/class pair a player can create in this build, with its side. The character picker
-- reads this, and the create_plan action checks against it (one side per plan).
select
    cb.race_id || '-' || cb.class_id    as combo_id,
    cb.race_id,
    r.name                              as race_name,
    cb.class_id,
    c.name                              as class_name,
    ft.side,
    r.name || ' ' || c.name             as label
from {{ ref('stg_wago__char_base_info') }} as cb
join {{ ref('stg_wago__races') }} as r using (race_id)
join {{ ref('stg_wago__classes') }} as c using (class_id)
left join {{ ref('stg_wago__faction_templates') }} as ft on ft.faction_template_id = r.faction_template_id
