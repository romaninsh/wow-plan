import { createContext, useCallback, useContext, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { observer, useCollection, useConnection, useRecord } from "@vantage-ui/client/react";
import { useDb } from "../db";
import type { PlanBlocks, PlanCharacters, PlanTargets } from "../vantage.gen";
import { editKeyFor, forgetEditKey, rememberEditKey, rememberPlan, takeOldEditCode } from "../local";
import { asKeys, asProfessions, asRef, asRefs, type GameRef } from "../shapes";
import { GameRefLink } from "../components/GameRef";

/** character key -> name and class colour, for target badges */
interface Who { name: string; cls: string }
const WhoContext = createContext<Map<string, Who>>(new Map());

/** Whether this session may edit the plan (the server's plan_access); edit controls show only then. */
interface Access { unlocked: boolean; recheck: () => void }
const AccessContext = createContext<Access>({ unlocked: false, recheck: () => {} });

/** CSS class for a class's colour (styles.css: .cls-warlock …) */
const clsOf = (className: string | null) => `cls-${(className ?? "").toLowerCase().replace(/[^a-z]/g, "")}`;

type Db = ReturnType<typeof useDb>;
type Outcome = { ok: true; value: unknown } | { ok: false; error: { message: string } };

/** Runs one of the API's actions and waits for its outcome. The generated run types carry no
 *  args for script actions, hence the cast. */
function act(db: Db, action: keyof Db["run"], args: Record<string, unknown>): Promise<Outcome> {
  const run = db.run[action] as unknown as { start(a: unknown): { done: Promise<Outcome> } };
  return run.start(args).done;
}

export function PlanPage() {
  const { id = "" } = useParams();
  return <Plan id={id} />;
}

const Plan = observer(({ id }: { id: string }) => {
  const db = useDb();
  const ref = useMemo(() => db.plans.ref(id), [db, id]);
  const { value: plan, status } = useRecord(ref);
  const characters = useCollection(db.plan_characters.where({ plan_id: id }));
  const blocks = useCollection(db.plan_blocks.where({ plan_id: id }));
  const targets = useCollection(db.plan_targets.where({ plan_id: id }));
  // a plan made a moment ago: its key, for the AI prompt. Read on the first render, before
  // Share takes it out of the history entry.
  const location = useLocation();
  const [newKey] = useState(() => (location.state as { editKey?: string } | null)?.editKey);

  // the padlock: whether this session unlocked the plan, as the server says
  const [unlocked, setUnlocked] = useState(false);
  const recheck = useCallback(() => {
    void act(db, "plan_access", { plan_id: id }).then((r) => {
      const open = r.ok && (r.value as { unlocked?: boolean }).unlocked === true;
      setUnlocked(open);
      rememberPlan(id, open);
      // a key is kept only while the plan is unlocked here
      if (r.ok && !open) forgetEditKey(id);
    });
  }, [db, id]);
  useEffect(() => {
    // an edit key kept from before the unlock (an old `#edit=` link or its cookie) unlocks once
    const old = takeOldEditCode(id);
    if (old) {
      void act(db, "unlock_plan", { plan_id: id, key: old }).then((r) => {
        if (r.ok) rememberEditKey(id, old);
        recheck();
      });
    }
    else recheck();
  }, [db, id, recheck]);
  // Edits wait for the socket, so with it down nothing is editable. A reconnect may land in a
  // new session (the server restarted, or the session timed out), so ask again once it's back.
  const { status: connection } = useConnection();
  const online = connection === "open";
  const [wasOnline, setWasOnline] = useState(online);
  useEffect(() => {
    if (online && !wasOnline) recheck();
    setWasOnline(online);
  }, [online, wasOnline, recheck]);
  const access = useMemo(() => ({ unlocked: unlocked && online, recheck }), [unlocked, online, recheck]);

  const who = useMemo(() => {
    const m = new Map<string, Who>();
    characters.items.forEach((c) => m.set(c.key ?? c.id, { name: c.name ?? "?", cls: clsOf(c.class_name) }));
    return m;
  }, [characters.items]);

  if (status === "missing") {
    return (
      <div className="wrap">
        <TopBar />
        <p className="notice">There is no plan <span className="mono">{id}</span>. Check the link.</p>
      </div>
    );
  }
  if (!plan) return <p className="notice">Opening plan…</p>;

  return (
    <AccessContext.Provider value={access}>
    <WhoContext.Provider value={who}>
      <div className="wrap">
        <TopBar />
        {!online && (
          <p className="offline" role="status">
            Lost the connection to wow-plan; reconnecting… Changes wait until it's back.
          </p>
        )}
        <header className="plan-head row">
          <div className="grow">
            <p className="label">
              {plan.side && <span className={`crest ${plan.side.toLowerCase()}`}>{plan.side}</span>}
              World of Warcraft: Forever · build {plan.game_build}
            </p>
            <h1>{plan.name}</h1>
            {plan.description && <p className="lead">{plan.description}</p>}
          </div>
          <Share id={id} />
        </header>

        <section className="chars">
          {characters.items.map((c) => (
            <CharacterCard key={c.id} character={c} />
          ))}
        </section>

        {targets.loadState !== "loading" && targets.items.length === 0 && (
          <QuestPrompt id={id} editKey={newKey} />
        )}
        {blocks.items.map((b) => (
          <Block key={b.id} block={b} />
        ))}
      </div>
    </WhoContext.Provider>
    </AccessContext.Provider>
  );
});

function TopBar() {
  return (
    <div className="topbar">
      <Link to="/" className="brand">wow-<b>plan</b><small>.com</small></Link>
      <Link to="/" className="muted">New plan</Link>
    </div>
  );
}

/** Share link for everyone, and the padlock: unlock with the plan's edit key, lock again. The
 *  server keeps the unlock in this browser's session and refuses edits to a locked plan. */
function Share({ id }: { id: string }) {
  const db = useDb();
  const { unlocked, recheck } = useContext(AccessContext);
  // a plan made a moment ago on the intro screen: its key, shown this once. Taken out of the
  // history entry at once, so a reload or Back doesn't show it again.
  const location = useLocation();
  const navigate = useNavigate();
  const [newKey] = useState(() => (location.state as { editKey?: string } | null)?.editKey);
  useEffect(() => {
    if (newKey) navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [typing, setTyping] = useState(false);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: "unlock_plan" | "lock_plan", args: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    const r = await act(db, action, { plan_id: id, ...args });
    setBusy(false);
    if (!r.ok) setError(r.error.message);
    else {
      if (action === "unlock_plan") rememberEditKey(id, key.trim());
      else forgetEditKey(id);
      setTyping(false);
      setKey("");
    }
    recheck();
  };

  const origin = window.location.origin;
  return (
    <div className="panel share">
      <span className="label">Share</span>
      <CopyLine text={`${origin}/p/${id}`} />
      {unlocked && newKey && (
        <>
          <span className="label">Edit key: it unlocks the plan on another device. Copy it now, it isn't shown again</span>
          <CopyLine text={newKey} />
        </>
      )}
      {typing && !unlocked ? (
        <form className="row" onSubmit={(e) => { e.preventDefault(); void run("unlock_plan", { key }); }}>
          <input className="input grow mono" value={key} maxLength={20} placeholder="Edit key" autoFocus aria-label="Edit key"
            onChange={(e) => setKey(e.target.value)} />
          <button type="submit" className="btn primary" disabled={busy || key.trim() === ""}>Unlock</button>
          <button type="button" className="btn subtle" onClick={() => { setTyping(false); setError(null); }}>Cancel</button>
        </form>
      ) : (
        <span className="row">
          <span className={`share-note grow ${unlocked ? "editor" : ""}`}>
            {unlocked ? "Unlocked: you can edit this plan on this device." : "Locked: view only."}
          </span>
          {unlocked ? (
            <button type="button" className="btn subtle" disabled={busy} onClick={() => void run("lock_plan", {})}>Lock</button>
          ) : (
            <button type="button" className="btn subtle" onClick={() => setTyping(true)}>Unlock</button>
          )}
        </span>
      )}
      {error && <span className="error" role="alert">{error}</span>}
    </div>
  );
}

/** What a player does on one AI platform to let it fill a plan: connect wow-plan's MCP server,
 *  optionally add the planner skill, then ask. More platforms go in PLATFORMS. */
interface Platform {
  key: string;
  name: string;
  /** a glyph for the reward slot's icon square */
  icon: string;
  steps: (s: { mcp: string; skillZip: string; skillMd: string; ask: string }) => { label: string; text?: string; body?: string; wrap?: boolean; link?: string }[];
}
const PLATFORMS: Platform[] = [
  {
    key: "claude-ai",
    name: "Claude.ai",
    icon: "☁",
    steps: ({ mcp, skillZip, ask }) => [
      { label: "Add the connector", body: "Settings → Connectors → Add custom connector. Name it wow-plan, with this URL; no sign-in.", text: mcp },
      { label: "Optional: the planner skill", body: "It keeps the plan short and leaves the exploring to you. Download it, then Customize → Skills → + → Upload a skill.", link: skillZip },
      { label: "Then, in a chat with wow-plan switched on, ask", text: ask, wrap: true },
    ],
  },
  {
    key: "claude-code",
    name: "Claude Code",
    icon: ">_",
    steps: ({ mcp, skillMd, ask }) => [
      { label: "Add the server", text: `claude mcp add --transport http wow-plan ${mcp}`, wrap: true },
      { label: "Optional: the planner skill", text: `curl -fsSL --create-dirs -o ~/.claude/skills/wow-plan-planner/SKILL.md ${skillMd}`, wrap: true },
      { label: "Then ask", text: ask, wrap: true },
    ],
  },
];

/** A plan with no goals yet, laid out like the game's quest window: a dark frame with the quest
 *  giver's portrait and name, a parchment page with the quest text, the assistants to choose
 *  from as reward slots, then the chosen one's steps as the objectives. It asks the player to let
 *  their AI assistant fill the plan over wow-plan's MCP server (`/mcp` on this same host). */
function QuestPrompt({ id, editKey }: { id: string; editKey?: string }) {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const { unlocked } = useContext(AccessContext);
  const origin = window.location.origin;
  // the key goes in only while the plan is unlocked here (made here, or unlocked with it)
  const key = (unlocked ? editKey ?? editKeyFor(id) : undefined) ?? "<your edit key>";
  // an example request the player can send as it is or reword; it names this plan and its key
  const ask = "I want to make a wow-plan: level a level 19 twink. I prefer Alliance. Not decided on "
    + `class yet, but not a rogue. What do you think? Use my plan ${origin}/p/${id}, `
    + `edit key ${key}.`;
  const skill = `${origin}/agent-skills/wow-plan-planner`;
  const steps = platform?.steps({ mcp: `${origin}/mcp`, skillZip: `${skill}.zip`, skillMd: `${skill}/SKILL.md`, ask });
  return (
    <section className="quest" aria-labelledby="quest-title">
      <div className="quest-bar">
        <span className="quest-portrait" aria-hidden="true">!</span>
        <span className="quest-giver">wow-plan</span>
      </div>
      <div className="quest-page">
        <h2 className="quest-title" id="quest-title">Plan! Not a guide</h2>
        <p className="quest-text">
          This plan has no goals yet. Your AI assistant can write them: it looks the items, zones
          and dungeons up in the game data and adds them here, while you play.
        </p>
        <h3 className="quest-section">Your assistant</h3>
        <p className="quest-text">Choose your assistant:</p>
        <div className="quest-choices" role="radiogroup" aria-label="AI assistant">
          {PLATFORMS.map((p) => (
            <button key={p.key} type="button" role="radio" aria-checked={platform?.key === p.key}
              className={`quest-choice ${platform?.key === p.key ? "chosen" : ""}`} onClick={() => setPlatform(p)}>
              <span className="quest-icon" aria-hidden="true">{p.icon}</span>
              <span className="quest-choice-name">{p.name}</span>
            </button>
          ))}
        </div>
        {steps && (
          <>
            <h3 className="quest-section">Objectives</h3>
            <ol className="quest-steps">
              {steps.map((s) => (
                <li key={s.label}>
                  <span className="quest-step-label">{s.label}</span>
                  {s.body && <span className="quest-text">{s.body}</span>}
                  {s.text && <CopyLine text={s.text} wrap={s.wrap} mark={key} />}
                  {s.link && <a className="btn subtle quest-download" href={s.link} download>Download wow-plan-planner.zip</a>}
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </section>
  );
}

/** Text with a Copy button. `mark`, when it occurs in the text, shows in red (an edit key):
 *  only the look changes, Copy takes the whole text. */
function CopyLine({ text, wrap = false, mark }: { text: string; wrap?: boolean; mark?: string }) {
  const [copied, setCopied] = useState(false);
  const at = mark ? text.indexOf(mark) : -1;
  const shown = at < 0 || !mark ? text : (
    <>
      {text.slice(0, at)}
      <span className="secret">{mark}</span>
      {text.slice(at + mark.length)}
    </>
  );
  return (
    <span className="row">
      <code className="grow mono" style={wrap ? { whiteSpace: "normal" } : { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shown}</code>
      <button type="button" className="btn subtle" onClick={() => {
        void navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
      }}>{copied ? "Copied" : "Copy"}</button>
    </span>
  );
}

const CharacterCard = observer(({ character: c }: { character: PlanCharacters }) => {
  const professions = asProfessions(c.professions);
  const start = asRef(c.start);
  return (
    <article className={`panel char ${clsOf(c.class_name)}`}>
      <div className="char-head">
        <span className="sigil" aria-hidden="true">{(c.class_name ?? "?").slice(0, 1)}</span>
        <div>
          <h2>{c.name}</h2>
          <span className="race">{c.race_name} {c.class_name}</span>
        </div>
      </div>
      <dl>
        {start && (
          <>
            <dt>Starts</dt>
            <dd><GameRefLink value={start} /></dd>
          </>
        )}
        {professions.primary.length > 0 && (
          <>
            <dt>Professions</dt>
            <dd><RefList refs={professions.primary} /></dd>
          </>
        )}
        {professions.secondary.length > 0 && (
          <>
            <dt>Secondary</dt>
            <dd><RefList refs={professions.secondary} /></dd>
          </>
        )}
        {c.notes && (
          <>
            <dt>Notes</dt>
            <dd>{c.notes}</dd>
          </>
        )}
      </dl>
    </article>
  );
});

function RefList({ refs }: { refs: ReturnType<typeof asRefs> }) {
  return (
    <>
      {refs.map((r, i) => (
        <span key={i}>
          {i > 0 && ", "}
          <GameRefLink value={r} />
        </span>
      ))}
    </>
  );
}

/** A to-do is done once for the whole plan, whoever it is for: the page can't know who is
 *  looking, so its characters are only a label. */
const isDone = (t: PlanTargets) => t.done === true;

/** A bracket's targets under one place (null: no place). */
interface PlaceGroup { key: string; place: GameRef | null; targets: PlanTargets[] }

function placeKey(p: GameRef | null): string {
  if (!p) return "";
  if (p.zone_id != null) return `zone:${p.zone_id}`;
  if (p.lfg_dungeon_id != null) return `dungeon:${p.lfg_dungeon_id}`;
  if (p.area_id != null) return `area:${p.area_id}`;
  return "";
}

/** Presentation only: the server's order is kept; groups appear where their first target is,
 *  except the unlabeled group, which comes first. */
function groupByPlace(targets: readonly PlanTargets[]): PlaceGroup[] {
  const none: PlaceGroup = { key: "", place: null, targets: [] };
  const groups = new Map<string, PlaceGroup>();
  for (const t of targets) {
    const place = asRef(t.place);
    const key = placeKey(place);
    if (!key) { none.targets.push(t); continue; }
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { key, place, targets: [] }));
    g.targets.push(t);
  }
  return [...(none.targets.length > 0 ? [none] : []), ...groups.values()];
}

const Block = observer(({ block }: { block: PlanBlocks }) => {
  const db = useDb();
  // to-dos are served only under their plan (`via: plans`), so the plan narrows first
  const targets = useCollection(db.plan_targets.where({ plan_id: block.plan_id ?? "", block_id: block.id }));
  const groups = groupByPlace(targets.items);
  const zones = asRefs(block.zones);
  return (
    <section className="panel block">
      <div className="block-head">
        <h3>
          <span className="levels tnum">{block.min_level}–{block.max_level}</span>
          {block.title}
        </h3>
        {zones.length > 0 && <span className="block-zones"><RefList refs={zones} /></span>}
      </div>
      {block.notes && <p className="block-notes">{block.notes}</p>}
      <div className="places">
        {groups.map((g) =>
          g.place ? (
            <Place key={g.key} place={g.place} targets={g.targets} />
          ) : (
            <TargetList key="none" targets={g.targets} />
          ),
        )}
      </div>
    </section>
  );
});

function TargetList({ targets }: { targets: PlanTargets[] }) {
  return (
    <ul className="targets">
      {targets.map((t) => (
        <Target key={t.id} target={t} />
      ))}
    </ul>
  );
}

/** One place in a bracket: open while any of its targets is open; once all are done it folds
 *  to a single line that opens again on click. */
const Place = observer(({ place, targets }: { place: GameRef; targets: PlanTargets[] }) => {
  const doneCount = targets.filter(isDone).length;
  const allDone = doneCount === targets.length;
  // null follows the state (done folds); a click overrides it until the page reloads
  const [unfolded, setUnfolded] = useState<boolean | null>(null);
  const folded = allDone && unfolded !== true;
  const toggle = () => { if (allDone) setUnfolded(folded); };

  return (
    <div className={`place ${allDone ? "done" : ""} ${folded ? "folded" : ""}`}>
      <div
        className="place-head"
        role={allDone ? "button" : undefined}
        tabIndex={allDone ? 0 : undefined}
        aria-expanded={allDone ? !folded : undefined}
        onClick={toggle}
        onKeyDown={(e) => { if (allDone && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle(); } }}
      >
        <span className="place-mark" aria-hidden="true" />
        <span className="place-name"><GameRefLink value={place} /></span>
        <PlaceLevels place={place} />
        <span className="place-state tnum">
          {allDone ? "— done" : `${doneCount} of ${targets.length} done`}
        </span>
        {allDone && <span className="place-fold" aria-hidden="true">{folded ? "▸" : "▾"}</span>}
      </div>
      {!folded && <TargetList targets={targets} />}
    </div>
  );
});

/** The place's level range as the game data has it (zone, dungeon) or its exploration level (area). */
const PlaceLevels = observer(({ place }: { place: GameRef }) => {
  if (place.zone_id != null) return <ZoneLevels id={place.zone_id} />;
  if (place.lfg_dungeon_id != null) return <DungeonLevels id={place.lfg_dungeon_id} />;
  if (place.area_id != null) return <AreaLevel id={place.area_id} />;
  return null;
});

function Range({ min, max }: { min: number | null | undefined; max: number | null | undefined }) {
  if (min == null && max == null) return null;
  return <span className="place-levels tnum">{min == null || max == null || min === max ? `level ${min ?? max}` : `${min}–${max}`}</span>;
}

const ZoneLevels = observer(({ id }: { id: number }) => {
  const db = useDb();
  const ref = useMemo(() => db.zones.ref(String(id)), [db, id]);
  const { value } = useRecord(ref);
  return value ? <Range min={value.min_level} max={value.max_level} /> : null;
});

const DungeonLevels = observer(({ id }: { id: number }) => {
  const db = useDb();
  const ref = useMemo(() => db.dungeons.ref(String(id)), [db, id]);
  const { value } = useRecord(ref);
  return value ? <Range min={value.min_level} max={value.max_level} /> : null;
});

const AreaLevel = observer(({ id }: { id: number }) => {
  const db = useDb();
  const ref = useMemo(() => db.areas.ref(String(id)), [db, id]);
  const { value } = useRecord(ref);
  return value && (value.exploration_level ?? 0) > 0 ? <Range min={value.exploration_level} max={value.exploration_level} /> : null;
});

const KIND: Record<string, string> = {
  travel_to_zone: "Travel",
  acquire_item: "Acquire",
  complete_quest: "Quest",
  reach_profession_level: "Profession",
  craft_item: "Craft",
  run_dungeon: "Dungeon",
  reach_level: "Level",
  note: "Note",
};
const PURPOSE: Record<string, string> = { sell: "for the auction house", use: "to use", give: "to give" };

/** Props that make text open an editor on click, Enter or Space, with no button of its own. */
function editable(open: () => void, className = "") {
  return {
    className: `${className} editable`.trim(),
    role: "button",
    tabIndex: 0,
    title: "Click to edit the notes",
    onClick: open,
    onKeyDown: (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } },
  };
}

const Target = observer(({ target: t }: { target: PlanTargets }) => {
  const db = useDb();
  const who = useContext(WhoContext);
  const { unlocked, recheck } = useContext(AccessContext);
  const assigned = asKeys(t.characters);
  const everyone = [...who.keys()];
  const done = isDone(t);
  const ref = asRef(t.ref);
  const forWho = t.for_character ? who.get(t.for_character)?.name : null;
  const [notes, setNotes] = useState<string | null>(null); // null: not editing
  const [error, setError] = useState<string | null>(null);

  // a refusal (the plan was locked elsewhere, a new key) shows here and re-reads the padlock
  const refused = (message: string) => { setError(message); recheck(); };
  const tick = async () => {
    setError(null);
    const r = await act(db, "tick_todo", { target_id: t.id, done: !done });
    if (!r.ok) refused(r.error.message);
  };
  const saveNotes = async () => {
    setError(null);
    const r = await act(db, "set_target_notes", { target_id: t.id, notes: notes ?? "" });
    if (r.ok) setNotes(null);
    else refused(r.error.message);
  };

  return (
    <li className={`target ${done ? "done" : ""}`}>
      {unlocked ? (
        <button type="button" className={`tick ${done ? "done" : ""}`} aria-label={done ? "Open again" : "Done"}
          aria-pressed={done} onClick={() => void tick()} />
      ) : (
        <span className={`tick ${done ? "done" : ""}`} />
      )}
      <div>
        {/* unlocked: a click on the notes edits them, and on the title of a to-do without notes
            adds them; no button */}
        <div {...(unlocked && notes === null && !t.notes ? editable(() => setNotes(""), "target-title") : { className: "target-title" })}>{t.title}</div>
        <div className="target-meta">
          <span className="kind">{KIND[t.kind ?? ""] ?? t.kind}</span>
          {ref && <GameRefLink value={ref} />}
          {t.count != null && t.count > 1 && <span className="tnum">×{t.count}</span>}
          {t.level != null && <span className="tnum">to {t.level}</span>}
          {t.purpose && <span>{t.purpose === "give" && forWho ? `for ${forWho}` : PURPOSE[t.purpose]}</span>}
          {notes === null && t.notes && (
            <span {...(unlocked ? editable(() => setNotes(t.notes ?? "")) : {})}>{t.notes}</span>
          )}
        </div>
        {notes !== null && (
          <form className="row" onSubmit={(e) => { e.preventDefault(); void saveNotes(); }}>
            <input className="input grow" value={notes} maxLength={1000} autoFocus aria-label="Notes"
              onChange={(e) => setNotes(e.target.value)} />
            <button type="submit" className="btn primary">Save</button>
            <button type="button" className="btn subtle" onClick={() => setNotes(null)}>Cancel</button>
          </form>
        )}
        {error && <div className="error" role="alert">{error}</div>}
      </div>
      <div className="badges">
        {assigned.length === 0 && everyone.length > 1 ? (
          <span className="badge both">Both</span>
        ) : (
          assigned.map((k) => (
            <span key={k} className={`badge ${who.get(k)?.cls ?? ""}`}>{who.get(k)?.name ?? k}</span>
          ))
        )}
      </div>
    </li>
  );
});
