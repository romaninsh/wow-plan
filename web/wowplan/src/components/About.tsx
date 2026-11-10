import { useEffect, useRef, useState, type MouseEvent } from "react";
import { track } from "../analytics";
import { ABOUT } from "../about";
import { COMPARISON } from "../comparison";
import "../about.css";

// "About this demo": what wow-plan is, that an AI agent built it in Vantage UI, and how, in
// measured numbers (about.ts). It never opens by itself: only the small link at the foot of
// every page (AboutLink), or landing on /about.
//
// /about is its own address, so a refresh reopens it. The link pushes /about onto the history
// without telling the router, so the page underneath stays as it was and closing goes back to
// it. Landing on /about directly shows it over the intro page (main.tsx routes /about there);
// closing then goes to /.

const ABOUT_PATH = "/about";
const OPEN = "wowplan:about";
const atAbout = () => window.location.pathname === ABOUT_PATH;

export function openAbout() {
  if (!atAbout()) window.history.pushState({ wowplan_about: true }, "", ABOUT_PATH);
  window.dispatchEvent(new Event(OPEN));
  track("about_open", { trigger: "link" });
}

function leaveAbout() {
  if (!atAbout()) return;
  if (window.history.state?.wowplan_about) { window.history.back(); return; }
  window.history.replaceState(null, "", "/");
  window.dispatchEvent(new PopStateEvent("popstate")); // the router follows to the intro page
}

/** The link at the foot of every page: small and dim, out of the way. */
export function AboutLink() {
  const open = (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // a new tab gets /about itself
    e.preventDefault();
    openAbout();
  };
  return (
    <footer className="site-foot">
      <a href={ABOUT_PATH} onClick={open}>About this demo</a>
    </footer>
  );
}

// `code` in a comparison line renders as code
const withCode = (text: string) => text.split("`").map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part));

const fmt = (n: number) => n.toLocaleString("en-GB");
const s = ABOUT.session, b = ABOUT.build, d = ABOUT.data;
const days = Math.floor(s.wallHours / 24), hours = Math.round(s.wallHours - days * 24);

const STATS: [string, string, string][] = [
  [`${s.activeHours} h`, "active agent time", `over ${days} days ${hours} h, start to finish`],
  [fmt(s.typed), "messages typed", `of ${s.prompts} user entries; the rest are ${s.interrupted} interruptions and ${s.summaries} context carry-over`],
  [fmt(s.modelTurns), "model turns", `${fmt(s.toolCalls)} tool calls`],
  [`${(s.outputTokens / 1e6).toFixed(2)} M`, "output tokens", `${Math.round(s.inputTokens / 1e6)} M input, ${(s.cacheReadShare * 100).toFixed(1)}% from cache`],
  [`${b.tables} · ${b.pages} · ${b.actions}`, "tables · pages · actions", `${fmt(b.yamlLines)} lines of Vantage YAML`],
  [fmt(b.webLines), "lines of web app", `${b.webFiles} files, React + TypeScript, plain CSS`],
  [fmt(b.checks), "API and action checks", `and ${b.dataTests} dbt data tests on the game data`],
  [fmt(b.issuesReported), "issues reported to Vantage", "in FEEDBACK.md, each with its workaround"],
];

export function About() {
  const [open, setOpen] = useState(atAbout);
  const button = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); leaveAbout(); };

  useEffect(() => {
    const again = () => setOpen(true);
    // Back and Forward: arriving at /about opens it, leaving closes it
    const moved = () => setOpen(atAbout());
    window.addEventListener(OPEN, again);
    window.addEventListener("popstate", moved);
    return () => { window.removeEventListener(OPEN, again); window.removeEventListener("popstate", moved); };
  }, []);
  useEffect(() => {
    if (!open) return;
    const back = document.activeElement as HTMLElement | null;
    button.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); back?.focus?.(); };
  }, [open]);

  if (!open) return null;
  return (
    <div className="about" role="dialog" aria-modal="true" aria-labelledby="about-title">
      <div className="about-frame">
        <div className="about-card panel">
          <div className="about-top">
            <img src="/vantage-logo.svg" alt="Vantage" className="about-logo" />
            <p className="label">Demo built with Vantage UI {ABOUT.vantageVersion}</p>
          </div>

          <div className="about-hero">
            <div className="about-intro">
              <h1 id="about-title" className="brand">wow-<b>plan</b><small>.com</small></h1>
              <p className="about-tagline">Your playthrough. Your goals.</p>
              <p className="about-lead">
                Personal levelling plans for World of Warcraft: Forever, for one character or two playing together:
                a string of short goals (places to reach, things to make, gear to find), written by the player or by an
                AI agent over MCP. No ready-made guides.
              </p>
              <p>
                An AI agent ({ABOUT.agent}) built it in Vantage UI from one person's prompts: the pipeline that turns a
                game client's tables into the reference data, a Vantage desktop app to check that data and edit plans,
                the API with its MCP endpoint ({b.apiEntities} entities, {b.apiActions} actions), and this site. It runs
                on vantage-server {ABOUT.serverVersion}.
              </p>
              <p>
                The game data is client build {d.build}: {fmt(d.items)} items in {d.tables} tables, {fmt(d.rows)} rows,
                from wago.tools and players' game caches (opendata). Quests come only from those caches: {d.quests} at
                that import. Plans have no accounts: anyone with a plan's link reads it, and its edit key unlocks
                editing.
              </p>
              <div className="about-buttons">
                <button ref={button} type="button" className="btn primary" onClick={close}>Back to the planner</button>
                <a href="https://vantage-ui.com/download/" target="_blank" rel="noreferrer" className="btn subtle">
                  Build your own <span aria-hidden>↗</span>
                </a>
              </div>
              <button type="button" className="about-jump"
                onClick={() => document.getElementById("about-compare")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                Vantage vs. building it by hand <span aria-hidden>↓</span>
              </button>
            </div>

            <div className="about-numbers">
              <dl className="about-stats">
                {STATS.map(([value, label, note]) => (
                  <div key={label} className="about-stat">
                    <dd>{value}</dd>
                    <dt>{label}</dt>
                    <p>{note}</p>
                  </div>
                ))}
              </dl>
              <p className="about-note">
                Session numbers: the build session of 24 to 28 October, up to the first pull request. Later changes
                (pull requests 2 to 7) came from a session that also worked on Vantage itself, so they are in the code
                counts but not in the session numbers.
              </p>
            </div>
          </div>

          <section id="about-compare" className="about-compare" aria-labelledby="about-compare-title">
            <p className="label">Vantage vs. building it by hand</p>
            <h2 id="about-compare-title">What Vantage did here, and what you'd write without it</h2>
            <ol>
              {COMPARISON.map((c, i) => (
                <li key={c.title}>
                  <h3><span className="about-n">{String(i + 1).padStart(2, "0")}</span>{c.title}</h3>
                  <p className="by-hand"><span className="mark" aria-label="By hand">✕</span>
                    <span><b>By hand: </b>{withCode(c.byHand)}</span></p>
                  <p className="by-vantage"><span className="mark" aria-label="Vantage">✓</span>
                    <span><b>Vantage: </b>{withCode(c.vantage)}</span></p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
