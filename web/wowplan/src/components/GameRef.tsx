import { useMemo } from "react";
import { observer, useCollection, useRecord } from "@vantage-ui/client/react";
import { useDb } from "../db";
import type { Items } from "../vantage.gen";
import type { GameRef } from "../shapes";
import { HoverCard } from "./HoverCard";

/** A game data reference (item, zone, area, dungeon, skill) with a card looked up on hover. */
export function GameRefLink({ value, label }: { value: GameRef; label?: string }) {
  const text = label ?? value.name ?? "?";
  if (value.item_id != null) {
    const q = value.quality ?? 1;
    return <HoverCard className={`q${q}`} label={text} card={() => <ItemCard id={value.item_id!} />} />;
  }
  if (value.zone_id != null) return <HoverCard label={text} card={() => <ZoneCard id={value.zone_id!} />} />;
  if (value.area_id != null) return <HoverCard label={text} card={() => <AreaCard id={value.area_id!} />} />;
  if (value.lfg_dungeon_id != null) return <HoverCard label={text} card={() => <DungeonCard id={value.lfg_dungeon_id!} />} />;
  if (value.skill_line_id != null) return <HoverCard label={text} card={() => <SkillCard id={value.skill_line_id!} />} />;
  return <span>{text}</span>;
}

function Missing({ what }: { what: string }) {
  return <span className="dim">Not in this game build's data ({what}).</span>;
}

// ── item: laid out like the in-game tooltip ───────────────────────────────────

const ItemCard = observer(({ id }: { id: number }) => {
  const db = useDb();
  const ref = useMemo(() => db.items.ref(String(id)), [db, id]);
  const { value, status, error } = useRecord(ref);
  if (status === "error") return <span className="dim">{error}</span>;
  if (status === "missing") return <Missing what={`item ${id}`} />;
  if (!value) return <span className="dim">Looking up…</span>;
  return <ItemTooltip item={value} itemId={id} />;
});

const TRIGGER: Record<string, string> = { use: "Use", equip: "Equip", chance_on_hit: "Chance on hit", learn: "Use", soulstone: "Use" };

const ItemTooltip = observer(({ item, itemId }: { item: Items; itemId: number }) => {
  const db = useDb();
  // A filter with the numeric id, not item.stats / item.spells: following those relations sends
  // the id as text, which Postgres refuses against a bigint column (noted in FEEDBACK.md).
  const stats = useCollection(db.item_stats.where({ item_id: itemId }));
  const spells = useCollection(db.item_spells.where({ item_id: itemId }));
  return (
    <>
      <div className={`t-name q${item.quality ?? 1}`}>{item.name}</div>
      {item.binding_name && item.binding_name !== "None" && <div>{item.binding_name}</div>}
      {item.inventory_type ? (
        <div className="split">
          <span>{item.slot_name}</span>
          <span>{item.armor_type ?? item.item_subclass_name}</span>
        </div>
      ) : null}
      {(item.armor ?? 0) > 0 && <div>{item.armor} Armor</div>}
      {item.damage_min != null && (
        <div className="split">
          <span>{item.damage_min} - {item.damage_max} Damage</span>
          <span>Speed {((item.weapon_speed_ms ?? 0) / 1000).toFixed(2)}</span>
        </div>
      )}
      {(item.dps ?? 0) > 0 && <div>({item.dps} damage per second)</div>}
      {stats.items.map((s) =>
        s.tooltip_kind === "base" && (s.value ?? 0) > 0 ? <div key={s.id}>+{s.value} {s.label}</div> : null,
      )}
      {item.item_set_name && <div className="gold">Set: {item.item_set_name}</div>}
      {item.usable_by_classes && <div>Classes: {item.usable_by_classes}</div>}
      {item.required_skill_name && <div>Requires {item.required_skill_name} ({item.required_skill_rank})</div>}
      {(item.required_level ?? 0) > 0 && <div>Requires Level {item.required_level}</div>}
      <div className="gold">Item Level {item.item_level}</div>
      {stats.items.map((s) =>
        s.tooltip_kind === "equip" && (s.value ?? 0) > 0 ? (
          <div key={s.id} className="green">Equip: +{s.value} {s.label}</div>
        ) : null,
      )}
      {spells.items.map((sp) => (
        <div key={sp.id} className="green">
          {TRIGGER[sp.trigger ?? ""] ?? "Use"}: {sp.spell_description ?? sp.spell_name}
        </div>
      ))}
      {item.description && <div className="flavor">"{item.description}"</div>}
      {item.sell_price_text && <div className="dim">Sell Price: {item.sell_price_text}</div>}
    </>
  );
});

// ── places, dungeons, skills ──────────────────────────────────────────────────

function levels(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min === max || max == null) return `level ${min}`;
  return `levels ${min}–${max}`;
}

const ZoneCard = observer(({ id }: { id: number }) => {
  const db = useDb();
  const ref = useMemo(() => db.zones.ref(String(id)), [db, id]);
  const { value: z, status } = useRecord(ref);
  if (status === "missing") return <Missing what={`zone ${id}`} />;
  if (!z) return <span className="dim">Looking up…</span>;
  const range = levels(z.min_level, z.max_level);
  return (
    <>
      <div className="t-name">{z.name}</div>
      <div className="dim">{[z.kind, z.map_name].filter(Boolean).join(" · ")}</div>
      {range && (
        <div className="gold">
          {range}
          {z.level_source === "exploration" && <span className="dim"> (from its sub-areas)</span>}
        </div>
      )}
      <div className="dim">{z.sub_area_count} sub-areas{(z.quest_count ?? 0) > 0 ? ` · ${z.quest_count} quests seen so far` : ""}</div>
    </>
  );
});

const AreaCard = observer(({ id }: { id: number }) => {
  const db = useDb();
  const ref = useMemo(() => db.areas.ref(String(id)), [db, id]);
  const { value: a, status } = useRecord(ref);
  if (status === "missing") return <Missing what={`area ${id}`} />;
  if (!a) return <span className="dim">Looking up…</span>;
  return (
    <>
      <div className="t-name">{a.name}</div>
      <div className="dim">{[a.zone_name !== a.name ? a.zone_name : null, a.map_name].filter(Boolean).join(" · ")}</div>
      {(a.exploration_level ?? 0) > 0 && <div className="gold">Exploration level {a.exploration_level}</div>}
    </>
  );
});

const DungeonCard = observer(({ id }: { id: number }) => {
  const db = useDb();
  const ref = useMemo(() => db.dungeons.ref(String(id)), [db, id]);
  const { value: d, status } = useRecord(ref);
  if (status === "missing") return <Missing what={`dungeon ${id}`} />;
  if (!d) return <span className="dim">Looking up…</span>;
  const range = levels(d.min_level, d.max_level);
  return (
    <>
      <div className="t-name">{d.name}</div>
      <div className="dim">{[d.kind, d.max_players ? `${d.max_players} players` : null].filter(Boolean).join(" · ")}</div>
      {range ? <div className="gold">{range}</div> : <div className="dim">Level range not known yet</div>}
    </>
  );
});

const SkillCard = observer(({ id }: { id: number }) => {
  const db = useDb();
  const ref = useMemo(() => db.skill_lines.ref(String(id)), [db, id]);
  const { value: s, status } = useRecord(ref);
  if (status === "missing") return <Missing what={`skill ${id}`} />;
  if (!s) return <span className="dim">Looking up…</span>;
  return (
    <>
      <div className="t-name">{s.name}</div>
      <div className="dim">{s.category}</div>
      {(s.recipe_count ?? 0) > 0 && <div className="gold">{s.recipe_count} recipes</div>}
      {s.description && <div>{s.description}</div>}
    </>
  );
});
