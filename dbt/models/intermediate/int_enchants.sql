-- Enchant spells a player can get: a spell whose effect enchants an item (53 permanent, 54
-- temporary) and that is either a profession ability (Enchanting, Engineering scopes, ...) or
-- what an item casts on use (enchant scrolls, armor kits, sharpening stones, oils). Engraving
-- (skill line 2851, Season of Discovery runes) and QA / NPC-only spells are left out. One row
-- per spell; when a spell sits under several skill lines the lowest SkillLineAbility row wins.
with effects as (
    select spell_id, effect, misc_value as enchant_id
    from {{ ref('stg_wago__spell_effects') }}
    where effect in (53, 54) and misc_value is not null
    qualify row_number() over (partition by spell_id order by effect_index) = 1
),

sla as (
    select *
    from {{ ref('stg_wago__skill_line_abilities') }}
    where skill_line_id <> 2851
    qualify row_number() over (partition by spell_id order by skill_line_ability_id) = 1
),

-- the item that casts the enchant when used; several items can (old and new ids): the lowest id
used_by as (
    select spell_id, min(item_id) as item_id, count(*) as item_count
    from {{ ref('stg_wago__item_effects') }}
    join {{ ref('stg_wago__items') }} using (item_id)
    where trigger_type = 0
    group by spell_id
),

-- the formula that teaches it: its learn effect names the enchant, or casts a spell that does
taught_by as (
    select spell_id, min(item_id) as item_id
    from (
        select ie.spell_id, ie.item_id
        from {{ ref('stg_wago__item_effects') }} as ie
        where ie.trigger_type = 6
        union all
        select se.trigger_spell_id, ie.item_id
        from {{ ref('stg_wago__item_effects') }} as ie
        join {{ ref('stg_wago__spell_effects') }} as se on se.spell_id = ie.spell_id and se.effect = 36
        where ie.trigger_type = 6 and se.trigger_spell_id is not null
    )
    group by spell_id
)

select
    e.spell_id                      as enchant_spell_id,
    e.enchant_id,
    e.effect = 53                   as permanent,
    sla.skill_line_id,
    sla.skill_required,
    sla.skill_green,
    sla.skill_gray,
    ub.item_id,
    ub.item_count,
    tb.item_id                      as taught_by_item_id
from effects as e
left join sla on sla.spell_id = e.spell_id
left join used_by as ub on ub.spell_id = e.spell_id
left join taught_by as tb on tb.spell_id = e.spell_id
where sla.spell_id is not null or ub.spell_id is not null
