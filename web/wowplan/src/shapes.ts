// Embedded MongoDB fields arrive as objects and arrays; the generated types say `string`
// (Vantage tables have no object type). These read them safely.

/** A reference to game data: one Blizzard id field and a name snapshot. */
export interface GameRef {
  name?: string;
  item_id?: number;
  zone_id?: number;
  area_id?: number;
  quest_id?: number;
  skill_line_id?: number;
  recipe_spell_id?: number;
  lfg_dungeon_id?: number;
  quality?: number;
}

function parse(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
}

export function asRef(value: unknown): GameRef | null {
  const v = parse(value);
  return v && typeof v === "object" && !Array.isArray(v) ? (v as GameRef) : null;
}

export function asRefs(value: unknown): GameRef[] {
  const v = parse(value);
  return Array.isArray(v) ? v.filter((x): x is GameRef => !!x && typeof x === "object") : [];
}

export function asKeys(value: unknown): string[] {
  const v = parse(value);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export interface Professions {
  primary: GameRef[];
  secondary: GameRef[];
}

export function asProfessions(value: unknown): Professions {
  const v = parse(value) as { primary?: unknown; secondary?: unknown } | null;
  return { primary: asRefs(v?.primary), secondary: asRefs(v?.secondary) };
}
