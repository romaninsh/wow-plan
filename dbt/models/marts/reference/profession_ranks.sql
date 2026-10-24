-- Profession trainer ranks: the skill they open and the character level they need (seed).
select rank, name, min_skill, max_skill, required_level, source
from {{ ref('ref_profession_ranks') }}
