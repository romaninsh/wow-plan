import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { observer, useCollection, useRecord, useRun } from "@vantage-ui/client/react";
import { useDb } from "../db";
import { recentPlans, rememberEditKey, rememberPlan } from "../local";

interface CharacterDraft {
  name: string;
  race: string; // race_id, picked first
  combo: string; // class_race_combos id, "<race>-<class>", once the class is picked too
}

const EXAMPLE_PLAN = "k3Fq9xZ";

export function Home() {
  return (
    <div className="wrap">
      <header className="hero">
        <h1>
          Your playthrough.
          <br />
          <em>Your</em> goals.
        </h1>
        <div className="ornament" aria-hidden="true"><span /></div>
        <p>
          No ready-made guides, no optimised checklists. Write a plan for your character, or for you and a friend, as a
          string of short goals: places to reach, things to make, gear to find. We keep you on track while you play.
        </p>
      </header>
      <NewPlanForm />
      <Recent />
      <p className="example">
        Want to see one first? <Link to={`/p/${EXAMPLE_PLAN}`}>House of Grr</Link>, a Warlock and a Druid levelling
        together.
      </p>
    </div>
  );
}

const NewPlanForm = observer(() => {
  const db = useDb();
  const navigate = useNavigate();
  const create = useRun(db.run.create_plan);
  const [name, setName] = useState("");
  const [chars, setChars] = useState<CharacterDraft[]>([{ name: "Lin Grr", race: "", combo: "" }]);

  // the first character's pick decides the side a second character can be on (the server checks it too)
  const firstId = chars[0]?.combo ?? "";
  const first = useMemo(() => db.class_race_combos.ref(firstId || "none"), [db, firstId]);
  const firstCombo = useRecord(first).value;
  const side = firstId ? firstCombo?.side ?? null : null;

  const result = create.result as { id?: string; edit_code?: string } | undefined;
  useEffect(() => {
    if (create.status === "done" && result?.id && result.edit_code) {
      // the server unlocked the new plan in this session; the key is shown once, on the plan page
      rememberPlan(result.id, true);
      rememberEditKey(result.id, result.edit_code);
      navigate(`/p/${result.id}`, { state: { editKey: result.edit_code } });
    }
  }, [create.status, result, navigate]);

  const update = (i: number, patch: Partial<CharacterDraft>) =>
    setChars((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const characters = chars.map((c) => {
      const [race_id, class_id] = c.combo.split("-");
      return { name: c.name, race_id: Number(race_id), class_id: Number(class_id) };
    });
    create.start({ name, characters } as Parameters<typeof create.start>[0]);
  };

  const busy = create.status === "starting" || create.status === "running";
  return (
    <form className="panel form" onSubmit={submit}>
      <div className="field">
        <label className="label" htmlFor="plan-name">Name your plan</label>
        <input id="plan-name" className="input" value={name} maxLength={120} placeholder="House of Grr"
          onChange={(e) => setName(e.target.value)} />
      </div>
      {chars.map((c, i) => (
        <div className="char-row" key={i}>
          <div className="field">
            <label className="label" htmlFor={`char-name-${i}`}>{i === 0 ? "Your character" : "Your friend's character"}</label>
            <input id={`char-name-${i}`} className="input" value={c.name} maxLength={40} placeholder={i === 0 ? "Lin Grr" : "Vinnie Grr"}
              onChange={(e) => update(i, { name: e.target.value })} />
          </div>
          <RaceClassFields index={i} race={c.race} combo={c.combo} side={i === 0 ? null : side}
            onChange={(patch) => update(i, patch)} />
          {i === 1 ? (
            <button type="button" className="btn subtle" onClick={() => setChars((cs) => cs.slice(0, 1))}>Remove</button>
          ) : (
            <span />
          )}
        </div>
      ))}
      <div className="row">
        {chars.length < 2 && (
          <button type="button" className="btn subtle" onClick={() => setChars((cs) => [...cs, { name: "", race: "", combo: "" }])}>
            + Level with a friend
          </button>
        )}
        <span className="grow" />
        {create.status === "failed" && <span className="error" role="alert">{create.error?.message}</span>}
        <button type="submit" className="btn primary" disabled={busy}>{busy ? "Creating…" : "Create plan"}</button>
      </div>
    </form>
  );
});

/** Race, then class, as the game's character screen asks: two short lists instead of one of every
 *  pair (57 rows the browser's own menu drew as tall as the screen). The pairs come from the
 *  server's class_race_combos: races by side (both for the first character, the first's side for
 *  the second), then the classes that race can be. */
const RaceClassFields = observer(({ index, race, combo, side, onChange }: {
  index: number; race: string; combo: string; side: "Alliance" | "Horde" | null;
  onChange: (patch: { race?: string; combo?: string }) => void;
}) => {
  const db = useDb();
  const all = useCollection(db.class_race_combos.sort("label", "asc"));
  const sides = side ? [side] : (["Alliance", "Horde"] as const);
  const races = (s: string) => {
    const seen = new Map<string, string>();
    for (const c of all.items) {
      if (c.side === s && c.race_id != null && !seen.has(String(c.race_id))) seen.set(String(c.race_id), c.race_name ?? "?");
    }
    return [...seen].sort((a, b) => a[1].localeCompare(b[1]));
  };
  const classes = all.items
    .filter((c) => race !== "" && String(c.race_id) === race)
    .sort((a, b) => (a.class_name ?? "").localeCompare(b.class_name ?? ""));
  return (
    <>
      <div className="field">
        <label className="label" htmlFor={`char-race-${index}`}>Race</label>
        <select id={`char-race-${index}`} className="select" value={race}
          onChange={(e) => onChange({ race: e.target.value, combo: "" })}>
          <option value="">Choose…</option>
          {sides.map((s) => (
            <optgroup key={s} label={s}>
              {races(s).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="label" htmlFor={`char-class-${index}`}>Class</label>
        <select id={`char-class-${index}`} className="select" value={combo} disabled={race === ""}
          onChange={(e) => onChange({ combo: e.target.value })}>
          <option value="">{race === "" ? "Pick a race first" : "Choose…"}</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.class_name}</option>)}
        </select>
      </div>
    </>
  );
});

function Recent() {
  const list = recentPlans();
  if (list.length === 0) return null;
  return (
    <section className="panel">
      <p className="label">Recently opened</p>
      <nav className="recent">
        {list.map((p) => (
          <RecentRow key={p.id} id={p.id} editable={p.editable} />
        ))}
      </nav>
    </section>
  );
}

const RecentRow = observer(({ id, editable }: { id: string; editable: boolean }) => {
  const db = useDb();
  const ref = useMemo(() => db.plans.ref(id), [db, id]);
  const { value, status } = useRecord(ref);
  if (status === "missing") return null;
  return (
    <Link to={`/p/${id}`}>
      <span className="recent-name">{value?.name ?? id}</span>
      <span className="muted">
        {editable ? "unlocked on this device last time" : "view only"} · <span className="mono">{id}</span>
      </span>
    </Link>
  );
});
