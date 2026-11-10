// On the About screen, below the numbers: each thing wow-plan needed, what a hand-built backend
// (Node, a MongoDB and a Postgres driver, a WebSocket server) would have to do for it, and what
// it took here. Every Vantage line names something in this repository; the counts were measured
// on 9 November 2026 (application.yaml, api/wowplan.yaml, datasource/plans.yaml, action/,
// table/, page/, composer.yaml, Dockerfile, src/vantage.gen.ts, src/components/GameRef.tsx).
// The hand-built side is what you'd have to write, not an estimate of hours.

export type Comparison = { title: string; byHand: string; vantage: string };

export const COMPARISON: Comparison[] = [
  {
    title: "A plan page that updates while it's open",
    byHand: "A WebSocket server, a subscription per open plan, change capture from MongoDB, diffs per client, reconnect and replay.",
    vantage: "The plan page reads characters, brackets and to-dos with `useCollection`; `composer.yaml` runs MongoDB as a replica set, so other writers' changes arrive live.",
  },
  {
    title: "Anyone with the link reads; only the key holder edits",
    byHand: "A session store, tokens to issue and resume, a permission check in every write route, and revoking a key on clients already connected.",
    vantage: "`session: { anonymous: true }` in `application.yaml` and one `plan_id` rule in `datasource/plans.yaml`. A new edit key locks out live sessions; `tests/sessions_and_mcp.mjs` checks it.",
  },
  {
    title: "AI agents that build a plan",
    byHand: "A separate MCP server: tool schemas, auth, rate limits, kept in step with the web API.",
    vantage: "`mcp: { mount: main }` in `api/wowplan.yaml`: the same 17 entities and 14 actions at `/mcp`, with the same sessions and limits as the site.",
  },
  {
    title: "The API itself",
    byHand: "Routes, request validation and response shapes for 17 resources and 14 actions.",
    vantage: "`api/wowplan.yaml`, 210 lines, its description included: the text agents read first.",
  },
  {
    title: "A typed client for this site",
    byHand: "An OpenAPI spec and a client, kept in step with the server by hand.",
    vantage: "Generated from the API's schema into `src/vantage.gen.ts` (1,489 lines), never edited. A renamed column fails the build.",
  },
  {
    title: "Item, zone and dungeon cards on hover",
    byHand: "An endpoint per kind of record, a client cache, and batching so a page of links doesn't send a request each.",
    vantage: "`GameRef.tsx` reads each card with `db.items.ref(id)` and `useRecord`; the records are entities in `api/wowplan.yaml`, with no endpoint of their own.",
  },
  {
    title: "Rate limits against guessing keys",
    byHand: "A limiter keyed by address and session, set per route.",
    vantage: "`rate_limit:` in `api/wowplan.yaml`, and one line in each of 11 write actions (`unlock_plan`: 5 tries, then one per 5 s).",
  },
  {
    title: "Rebuilding the game data from a new client build",
    byHand: "A job runner, a page to start it, its log, an import history and a rollback.",
    vantage: "`fetch_build` and `import_build` run in the `pipeline` container from `composer.yaml`; `table/import_history.yaml` and `rollback_import` on the desktop. The 74 dbt models are the same work either way.",
  },
  {
    title: "A back-office app to check the data",
    byHand: "A second front end, or a paid admin tool wired to two databases.",
    vantage: "The desktop app, from the same tables: 19 pages, a menu and 44 actions over Postgres and MongoDB.",
  },
  {
    title: "Local and production settings",
    byHand: "A config loader and per-environment secret handling.",
    vantage: "Two profiles in `application.yaml`, each naming an env file; the datasources read `${secret.…}`.",
  },
  {
    title: "Serving and deploying it",
    byHand: "Images for the API and the site, static hosting with deep-link fallback, and a health check that knows the databases are up.",
    vantage: "One 26-line `Dockerfile` on vantage-server, serving the built site from the API's origin (`--static`); `deploy.sh` checks the server's own `/v1/ready` after each deploy.",
  },
  {
    title: "The agent checking its own work",
    byHand: "Reading code and screenshots, and guessing what the server did.",
    vantage: "MCP tools to run queries, read the logs and press buttons in the running app; `tests/plan_actions.rhai` runs that way.",
  },
];
