-- Creatures from the client cache: only those some player has seen so far.
select
    n.npc_id,
    n.name,
    n.subname,
    n.creature_type_id,
    ct.name                         as creature_type_name,
    n.classification,
    cc.name                         as classification_name,
    case when n.display_ids is not null then to_json(n.display_ids)::varchar end as display_ids,
    n.source_kind,
    n.source_ref,
    n.build_first_seen,
    n.build_last_seen,
    n.confidence
from {{ ref('stg_opendata__npcs') }} as n
left join {{ ref('stg_wago__creature_types') }} as ct using (creature_type_id)
left join {{ ref('ref_creature_classifications') }} as cc using (classification)
