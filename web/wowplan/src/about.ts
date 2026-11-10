// What the About screen (components/About.tsx) says about how this app was made. Every number
// is measured, not estimated; refresh them rather than editing by hand:
//   session: python3 -I scripts/session_stats.py <the agent's session .jsonl>; typed is
//            prompts - interrupted - summaries; agent is the "models" line
//   code:    git ls-files counts of table/ page/ action/ (*.yaml), and the lines of every *.yaml
//            in table/ page/ action/ view/ menu/ api/ datasource/ form/ layout/ plus
//            application.yaml; web/wowplan/src without vantage.gen.ts (generated) and without
//            the About screen's own files (About.tsx, about.ts, comparison.ts, about.css)
//   tests:   check( calls in tests/api_actions.mjs and tests/sessions_and_mcp.mjs, and
//            check.call( / refused.call( in tests/*.rhai (helpers' own calls left out); dbt:
//            data_tests entries in dbt/models/**/*.yml and seeds/_seeds.yml, plus dbt/tests/*.sql
//   issues:  "## " headings in FEEDBACK.md (git-ignored; the working copy)
//   data:    a row of wow_meta.import_history (the desktop's Imports page): here the import of
//            28 October on the local stack, as the build session printed it; the item count
//            matches agents/BRIEF.md
//
// Measured on 9 November 2026. The build session is the one in this folder's Claude Code
// project that started the repository (24 October) and ran to PR #1 (28 October). Later work
// (PRs #2 to #7: share-link sessions, MCP, the quest card) came from a session that worked on
// Vantage itself at the same time, so it can't be measured apart and isn't in these numbers.

export const ABOUT = {
  // the session ran Vantage UI 1.9.0 to 1.9.16 (check_version; 1.9.16 was a main-branch build);
  // the app now needs 1.10 (application.yaml) and runs on vantage-server 1.10.2 (Dockerfile)
  vantageVersion: "1.9.16",
  serverVersion: "1.10.2",
  agent: "Claude Opus 5.5",
  session: {
    wallHours: 101.5,         // first to last entry of the session log
    activeHours: 6.9,         // gaps between log entries, pauses over 10 minutes left out
    prompts: 141,             // user entries with text, as the script counts them
    interrupted: 15,          // of those: "[Request interrupted…]" markers
    summaries: 1,             // and context carry-overs
    typed: 125,               // what the person typed
    modelTurns: 1027,
    toolCalls: 1686,
    outputTokens: 785_643,
    inputTokens: 510_627_716, // 99.4% of it read back from the prompt cache
    cacheReadShare: 0.994,
  },
  build: {
    tables: 35, pages: 19, actions: 44, yamlLines: 5722,   // the Vantage app (YAML)
    apiEntities: 17, apiActions: 14,                         // api/wowplan.yaml
    webFiles: 10, webLines: 1600,                            // this site (TypeScript, CSS)
    generatedLines: 1489,                                    // src/vantage.gen.ts, as committed
    checks: 160,                                             // tests/: API, MCP and plan actions
    dataTests: 105,                                          // dbt
    dbtModels: 74,                                           // dbt/models/**/*.sql
    issuesReported: 37,                                      // FEEDBACK.md, back to Vantage
  },
  data: {
    build: "1.60.1.70532",
    tables: 28, rows: 103_848, items: 24_174, quests: 46,
  },
} as const;
