select
    (sc.item_class_id * 100 + sc.item_subclass_id) as item_subclass_key,
    sc.item_class_id,
    c.name                          as item_class_name,
    sc.item_subclass_id,
    sc.name,
    sc.verbose_name,
    sc.build
from {{ ref('stg_wago__item_subclasses') }} as sc
left join {{ ref('stg_wago__item_classes') }} as c using (item_class_id)
