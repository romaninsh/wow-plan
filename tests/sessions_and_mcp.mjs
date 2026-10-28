// The share-link model end to end, over the WebSocket API and MCP (Node 22+, no packages):
//   node tests/sessions_and_mcp.mjs [test name …]
// Each test starts its own vantage-server on free ports (fresh sessions and rate limits) over
// the project's running docker services (`docker compose -f composer.yaml up -d`, or Vantage's
// Services). The binary: $VANTAGE_SERVER, else ../../vantage-server/target/debug/vantage-server.
// Plans it creates are named "api test …" and deleted at the end (docker exec mongosh), with
// those tests/api_actions.mjs made. The sample plan House of Grr (k3Fq9xZ, key Grr4) is changed
// only inside try/finally blocks that put it back.

import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import path from "node:path";

const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BIN = process.env.VANTAGE_SERVER ?? path.resolve(PROJECT, "../../vantage-server/target/debug/vantage-server");
const SAMPLE = { id: "k3Fq9xZ", key: "Grr4" };
const TEST_SECS = 5;

// ── a server per test ─────────────────────────────────────────────────────────────────────
function freePort() {
  return new Promise((resolve) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

/** --service flags for the project's compose services, from the running containers. */
function serviceFlags() {
  const out = execFileSync("docker", ["ps", "--filter", `label=com.docker.compose.project.working_dir=${PROJECT}`,
    "--format", '{{.Label "com.docker.compose.service"}} {{.Ports}}'], { encoding: "utf8" });
  const flags = [];
  for (const line of out.trim().split("\n").filter(Boolean)) {
    const [service, ports] = line.split(" ");
    const m = /:(\d+)->(\d+)\/tcp/.exec(ports ?? "");
    if (m) flags.push("--service", `${service}:${m[2]}=${m[1]}`);
  }
  if (flags.length === 0) throw new Error("the project's docker services aren't running");
  return flags;
}

/** MCP is on the API's own port (`mcp: { mount: main }`), as on Cloud Run. */
async function startServer() {
  const port = await freePort();
  const child = spawn(BIN, ["--project", PROJECT, "--api", "wowplan", "--profile", "local",
    "--port", String(port), ...serviceFlags()], { stdio: ["ignore", "pipe", "pipe"] });
  let err = "";
  child.stderr.on("data", (d) => { err += d; });
  const started = new Promise((resolve, reject) => {
    child.stdout.on("data", (d) => { if (String(d).includes('"message":"started"')) resolve(); });
    child.on("exit", (code) => reject(new Error(`vantage-server exited ${code}: ${err.slice(-2000)}`)));
  });
  await started;
  return { http: `http://127.0.0.1:${port}`, mcp: `http://127.0.0.1:${port}/mcp`, stop: () => child.kill("SIGKILL") };
}

// ── WebSocket client ─────────────────────────────────────────────────────────────────────
async function wsConnect(base, token) {
  const ws = new WebSocket(base.replace(/^http/, "ws") + "/v1/ws");
  let nextId = 1;
  const replies = new Map(); // request id -> resolve
  const runs = new Map(); // run id -> resolve
  let welcome;
  const welcomed = new Promise((resolve, reject) => {
    ws.onmessage = (m) => {
      const f = JSON.parse(String(m.data));
      if (f.t === "welcome") { welcome = f; resolve(f); return; }
      if (f.t === "run" && (f.status === "done" || f.status === "failed") && runs.has(f.run)) {
        runs.get(f.run)(f); runs.delete(f.run); return;
      }
      if (f.t === "result" && f.status !== undefined) return; // run started; the run frame follows
      if (f.id !== undefined && replies.has(f.id)) { replies.get(f.id)(f); replies.delete(f.id); }
    };
    ws.onerror = () => reject(new Error("socket error"));
  });
  await new Promise((resolve) => { ws.onopen = resolve; });
  ws.send(JSON.stringify({ t: "hello", id: nextId++, protocol: 1, ...(token ? { token } : {}) }));
  await welcomed;
  const request = (frame) => new Promise((resolve) => {
    const id = nextId++;
    replies.set(id, resolve);
    ws.send(JSON.stringify({ id, ...frame }));
  });
  return {
    welcome,
    token: welcome.session_token,
    request,
    /** a run's last frame (done or failed), or the error frame that refused it */
    invoke: (action, args) => new Promise((resolve) => {
      const run = crypto.randomUUID();
      const id = nextId++;
      runs.set(run, resolve);
      replies.set(id, (f) => { if (f.t === "error") { runs.delete(run); resolve(f); } });
      ws.send(JSON.stringify({ id, t: "invoke", run, action, args }));
    }),
    close: () => ws.close(),
  };
}

// ── MCP client (Streamable HTTP) ─────────────────────────────────────────────────────────
async function mcpConnect(url, token) {
  let session;
  let nextId = 1;
  const auth = token ? { authorization: `Bearer ${token}` } : {};
  async function post(body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream",
        ...(session ? { "mcp-session-id": session } : auth) },
      body: JSON.stringify(body),
    });
    if (!session) session = res.headers.get("mcp-session-id") ?? undefined;
    const vantage = res.headers.get("x-vantage-session");
    const text = await res.text();
    if (!text) return { status: res.status, vantage };
    if ((res.headers.get("content-type") ?? "").includes("text/event-stream")) {
      const data = text.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).filter(Boolean);
      return { status: res.status, vantage, ...JSON.parse(data.at(-1)) };
    }
    return { status: res.status, vantage, ...JSON.parse(text) };
  }
  const init = await post({ jsonrpc: "2.0", id: nextId++, method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "wowplan-test", version: "0" } } });
  await post({ jsonrpc: "2.0", method: "notifications/initialized" });
  return {
    token: init.vantage,
    tools: async () => (await post({ jsonrpc: "2.0", id: nextId++, method: "tools/list" })).result.tools,
    /** { ok, value } for a result, { ok: false, error } for a tool error */
    call: async (name, args) => {
      const r = await post({ jsonrpc: "2.0", id: nextId++, method: "tools/call", params: { name, arguments: args } });
      if (r.error) return { ok: false, error: r.error };
      const value = r.result.structuredContent ?? JSON.parse(r.result.content?.[0]?.text ?? "null");
      return r.result.isError ? { ok: false, error: value } : { ok: true, value };
    },
  };
}

// ── checks ───────────────────────────────────────────────────────────────────────────────
let failed = 0;
function check(name, ok, detail) {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failed++;
}
const brief = (v) => JSON.stringify(v)?.slice(0, 200);
const refusal = (f) => f?.error?.message ?? f?.message ?? f?.reason ?? f?.error?.detail ?? brief(f);
const isLocked = (msg) => /locked/i.test(msg ?? "");

async function makePlan(ws) {
  const stamp = new Date().toISOString().slice(11, 19);
  const made = await ws.invoke("create_plan", {
    name: `api test ${stamp}`,
    characters: [{ name: "Testa Grr", race_id: 5, class_id: 9 }],
  });
  if (made.status !== "done") throw new Error(`create_plan: ${brief(made)}`);
  return made.result; // { id, edit_code }
}

function mongoContainer() {
  return execFileSync("docker", ["ps", "-q", "--filter", `label=com.docker.compose.project.working_dir=${PROJECT}`,
    "--filter", "label=com.docker.compose.service=mongo"], { encoding: "utf8" }).trim();
}

/** A level bracket for plan `planId`, written straight to MongoDB (the API has no action for it). */
function addBlock(planId) {
  const id = `apitest-${planId}`;
  const script = `db.plan_blocks.insertOne({ _id: ${JSON.stringify(id)}, plan_id: ${JSON.stringify(planId)}, order: 1, title: "api test", min_level: 1, max_level: 60 })`;
  execFileSync("docker", ["exec", mongoContainer(), "mongosh", "--quiet", "wowplan", "--eval", script], { encoding: "utf8" });
  return id;
}

/** Deletes the plans the tests made ("api test …") and their parts, in the project's MongoDB. */
function deleteTestPlans() {
  const container = mongoContainer();
  if (!container) return "no mongo container";
  const script = `const ids = db.plans.find({ name: /^api test / }, { _id: 1 }).toArray().map((p) => p._id);
    for (const c of ["plan_characters", "plan_blocks", "plan_targets"]) db[c].deleteMany({ plan_id: { $in: ids } });
    print(db.plans.deleteMany({ _id: { $in: ids } }).deletedCount);`;
  return execFileSync("docker", ["exec", container, "mongosh", "--quiet", "wowplan", "--eval", script], { encoding: "utf8" }).trim();
}

// ── tests ────────────────────────────────────────────────────────────────────────────────
const tests = {
  async plans_read_by_id_only(s) {
    const ws = await wsConnect(s.http);
    check("a tokenless hello gets an anonymous session", /^anon_/.test(ws.token ?? ""), ws.token?.slice(0, 9));
    const rec = await ws.request({ t: "open_records", table: "plans", ids: [SAMPLE.id] });
    check("plans: a plan by its id", rec.records?.[0]?.name === "House of Grr", brief(rec.records?.[0]?.name));
    check("plans: no edit_code_hash", rec.records?.[0] && !("edit_code_hash" in rec.records[0]));
    const list = await ws.request({ t: "open_table", table: "plans" });
    check("plans: the list is refused", list.t === "error", refusal(list));
    const all = await ws.request({ t: "open_table", table: "plan_targets" });
    check("plan_targets: all of them refused", all.t === "error", refusal(all));
    const byBlock = await ws.request({ t: "open_table", table: "plan_targets", where: [["kind", "eq", "acquire_item"]] });
    check("plan_targets: by another column refused", byBlock.t === "error", refusal(byBlock));
    const under = await ws.request({ t: "open_table", table: "plan_targets", where: [["plan_id", "eq", SAMPLE.id]] });
    check("plan_targets: under the plan", under.t === "rows" && under.total > 0, `${under.total} targets`);
    const block = under.records?.[0]?.block_id;
    const inBlock = await ws.request({ t: "open_table", table: "plan_targets", where: [["plan_id", "eq", SAMPLE.id], ["block_id", "eq", block]] });
    check("plan_targets: under the plan, one bracket", inBlock.t === "rows" && inBlock.total > 0 && inBlock.total < under.total, `${inBlock.total} in ${block}`);
    const otherPlan = await ws.request({ t: "open_table", table: "plan_targets", where: [["plan_id", "eq", "Nope123"]] });
    check("plan_targets: under a plan that doesn't exist", otherPlan.t === "error" || otherPlan.total === 0, otherPlan.t === "error" ? refusal(otherPlan) : `${otherPlan.total} rows`);
    const chars = await ws.request({ t: "open_table", table: "plan_characters", where: [["plan_id", "eq", SAMPLE.id]] });
    check("plan_characters: under the plan", chars.t === "rows" && chars.total === 2, `${chars.total} characters`);
    ws.close();

    const mcp = await mcpConnect(s.mcp);
    const plan = await mcp.call("get_plans", { id: SAMPLE.id });
    check("MCP get_plans by id", plan.ok && plan.value.name === "House of Grr", brief(plan.value?.name ?? plan.error));
    const listed = await mcp.call("list_plans", {});
    check("MCP has no list_plans", !listed.ok, brief(listed.error));
    const targets = await mcp.call("list_plan_targets", { parent_id: SAMPLE.id, limit: 3 });
    check("MCP list_plan_targets under the plan", targets.ok && targets.value.total > 0, `${targets.value?.total} targets`);
    const orphan = await mcp.call("list_plan_targets", { limit: 3 });
    check("MCP list_plan_targets without the plan refused", !orphan.ok, brief(orphan.error));
  },

  async locked_plan_refuses_writes_on_every_kind(s) {
    // a session that unlocked the sample plan only to put it back as it was, whatever happens
    const fixer = await wsConnect(s.http);
    await fixer.invoke("unlock_plan", { plan_id: SAMPLE.id, key: SAMPLE.key });
    const owner = await wsConnect(s.http);
    const own = await makePlan(owner);
    const access0 = await owner.invoke("plan_access", { plan_id: own.id });
    check("create_plan unlocks the new plan for its maker", access0.result?.unlocked === true, brief(access0.result));
    owner.close();

    // a target to write to: the sample plan's first open one; its bracket's order to compare
    const rows = (await fixer.request({ t: "open_table", table: "plan_targets", where: [["plan_id", "eq", SAMPLE.id]] })).records ?? [];
    const target = rows.find((t) => t.done !== true);
    const bracketOrder = async () => ((await fixer.request({ t: "open_table", table: "plan_targets",
      where: [["plan_id", "eq", SAMPLE.id], ["block_id", "eq", target.block_id]] })).records ?? []).map((t) => `${t.id}:${t.order}`).join(",");
    const orderBefore = await bracketOrder();
    const character = (await fixer.request({ t: "open_table", table: "plan_characters", where: [["plan_id", "eq", SAMPLE.id]] })).records?.[0];
    const added = [];

    try {
      // ── a visitor with the link only, over the WebSocket API ──
      const ws = await wsConnect(s.http);
      const writes = [
        ["plan_targets", { t: "flash", table: "plan_targets", rid: target.id, patch: { notes: "x" } }],
        ["plan_targets insert", { t: "flash", table: "plan_targets", patch: { plan_id: SAMPLE.id, block_id: target.block_id, kind: "note", title: "x" } }],
        ["plan_targets delete", { t: "delete", table: "plan_targets", rid: target.id }],
        ["plan_characters", { t: "flash", table: "plan_characters", rid: character.id, patch: { notes: "x" } }],
        ["plan_characters delete", { t: "delete", table: "plan_characters", rid: character.id }],
        ["plan_blocks", { t: "flash", table: "plan_blocks", rid: target.block_id, patch: { notes: "x" } }],
        ["plan_blocks delete", { t: "delete", table: "plan_blocks", rid: target.block_id }],
        ["plans", { t: "flash", table: "plans", rid: SAMPLE.id, patch: { name: "x" } }],
      ];
      const lockedActions = [
        ["tick_todo", { target_id: target.id, done: true }],
        ["set_target_notes", { target_id: target.id, notes: "x" }],
        ["add_target", { plan_id: SAMPLE.id, kind: "note", title: "x", block_id: target.block_id }],
        ["update_target", { target_id: target.id, notes: "x" }],
        ["move_target", { target_id: target.id, order: 1 }],
        ["remove_target", { target_id: target.id }],
        ["rotate_edit_key", { plan_id: SAMPLE.id }],
      ];
      const refusedAll = async (label) => {
        for (const [name, frame] of writes) {
          const r = await ws.request(frame);
          check(`WS ${label}: record write (${name}) refused`, r.t === "rejected", `${r.t}: ${refusal(r)}`);
        }
        for (const [name, args] of lockedActions) {
          const r = await ws.invoke(name, args);
          check(`WS ${label}: ${name} refused`, r.status === "failed" && isLocked(refusal(r)), refusal(r));
        }
      };
      await refusedAll("locked");

      // the visitor unlocks the new plan only: a sample target still can't be changed, even
      // when the call names the unlocked plan
      const other = await ws.invoke("unlock_plan", { plan_id: own.id, key: own.edit_code });
      const cross = await ws.invoke("update_target", { target_id: target.id, plan_id: own.id, notes: "x" });
      check("WS a target of a locked plan refused while another plan is unlocked",
        other.result?.unlocked === true && cross.status === "failed" && isLocked(refusal(cross)), refusal(cross));
      // nor moved out of its locked plan into a bracket of the unlocked one
      const ownBlock = addBlock(own.id);
      const out = await ws.invoke("move_target", { target_id: target.id, block_id: ownBlock });
      const still = (await ws.request({ t: "open_records", table: "plan_targets", ids: [target.id] })).records?.[0];
      check("WS moving a target out of a locked plan is refused",
        out.status === "failed" && still?.plan_id === SAMPLE.id && still?.block_id === target.block_id,
        `${refusal(out)}; now in ${still?.plan_id}/${still?.block_id}`);

      const unlock = await ws.invoke("unlock_plan", { plan_id: SAMPLE.id, key: SAMPLE.key });
      check("WS unlock_plan with the key", unlock.result?.unlocked === true, brief(unlock.result ?? unlock));
      const tick = await ws.invoke("tick_todo", { target_id: target.id, done: true });
      check("WS tick_todo accepted", tick.status === "done" && tick.result?.done === true, brief(tick.result ?? tick));
      const notes = await ws.invoke("set_target_notes", { target_id: target.id, notes: "  unlocked note  " });
      check("WS set_target_notes accepted, trimmed", notes.result?.notes === "unlocked note", brief(notes.result ?? notes));
      const long = await ws.invoke("set_target_notes", { target_id: target.id, notes: "x".repeat(1001) });
      check("WS set_target_notes refuses 1001 characters", long.status === "failed" && /too long/.test(refusal(long)), refusal(long));
      const add = await ws.invoke("add_target", { plan_id: SAMPLE.id, kind: "note", title: "api test note", block_id: target.block_id });
      if (add.result?.id) added.push(add.result.id);
      check("WS add_target accepted", add.status === "done" && add.result?.id, brief(add.result ?? add));
      const upd = await ws.invoke("update_target", { target_id: add.result?.id, title: "api test note, changed" });
      check("WS update_target accepted", upd.status === "done", brief(upd.result ?? upd));
      const move = await ws.invoke("move_target", { target_id: add.result?.id, order: 1 });
      check("WS move_target accepted", move.status === "done" && move.result?.order === 1, brief(move.result ?? move));
      const rm = await ws.invoke("remove_target", { target_id: add.result?.id });
      if (rm.status === "done") added.pop();
      check("WS remove_target accepted", rm.status === "done", brief(rm.result ?? rm));
      for (const [name, frame] of writes) {
        const r = await ws.request(frame);
        check(`WS unlocked: record write (${name}) still refused (read-only)`, r.t === "rejected", `${r.t}: ${refusal(r)}`);
      }

      const lock = await ws.invoke("lock_plan", { plan_id: SAMPLE.id });
      const access = await ws.invoke("plan_access", { plan_id: SAMPLE.id });
      check("WS lock_plan, plan_access says locked", lock.result?.unlocked === false && access.result?.unlocked === false, brief(access.result));
      await refusedAll("locked again");
      ws.close();

      // ── an MCP agent with the link only ──
      const mcp = await mcpConnect(s.mcp);
      for (const [name, args] of lockedActions) {
        const r = await mcp.call(name, args);
        check(`MCP locked: ${name} refused`, !r.ok && isLocked(r.error?.detail), brief(r.error));
      }
      const munlock = await mcp.call("unlock_plan", { plan_id: SAMPLE.id, key: SAMPLE.key });
      check("MCP unlock_plan with the key", munlock.ok && munlock.value?.unlocked === true, brief(munlock.value ?? munlock.error));
      const madd = await mcp.call("add_target", { plan_id: SAMPLE.id, kind: "note", title: "api test mcp", block_id: target.block_id });
      if (madd.value?.id) added.push(madd.value.id);
      check("MCP add_target accepted in a later call of the same MCP session", madd.ok && madd.value?.id, brief(madd.value ?? madd.error));
      const mnotes = await mcp.call("set_target_notes", { target_id: madd.value?.id, notes: "from mcp" });
      check("MCP set_target_notes accepted", mnotes.ok && mnotes.value?.notes === "from mcp", brief(mnotes.value ?? mnotes.error));
      const mrm = await mcp.call("remove_target", { target_id: madd.value?.id });
      if (mrm.ok) added.pop();
      check("MCP remove_target accepted", mrm.ok, brief(mrm.error));
      await mcp.call("lock_plan", { plan_id: SAMPLE.id });
      const mafter = await mcp.call("tick_todo", { target_id: target.id, done: false });
      check("MCP tick_todo refused again after lock_plan", !mafter.ok && isLocked(mafter.error?.detail), brief(mafter.error));
    } finally {
      for (const id of added) await fixer.invoke("remove_target", { target_id: id });
      await fixer.invoke("tick_todo", { target_id: target.id, done: false });
      await fixer.invoke("set_target_notes", { target_id: target.id, notes: target.notes ?? "" });
      const orderAfter = await bracketOrder();
      check("the sample plan is put back as it was", orderAfter === orderBefore, orderAfter === orderBefore ? "same order" : `${orderBefore} -> ${orderAfter}`);
      fixer.close();
    }
  },

  async rotate_edit_key_revokes_live_sessions(s) {
    const owner = await wsConnect(s.http);
    const { id, edit_code } = await makePlan(owner);
    const ws = await wsConnect(s.http);
    const mcp = await mcpConnect(s.mcp);
    const w = await ws.invoke("unlock_plan", { plan_id: id, key: edit_code });
    const m = await mcp.call("unlock_plan", { plan_id: id, key: edit_code });
    check("a WS and an MCP session unlock the plan", w.result?.unlocked === true && m.ok, `${brief(w.result)} ${brief(m.value)}`);

    const rot = await owner.invoke("rotate_edit_key", { plan_id: id });
    const key = rot.result?.edit_key;
    check("rotate_edit_key gives a new key", rot.status === "done" && /^[0-9A-Za-z]{4}$/.test(key ?? "") && key !== edit_code, brief(rot.result ?? rot));
    const mine = await owner.invoke("plan_access", { plan_id: id });
    check("the rotating session stays unlocked", mine.result?.unlocked === true, brief(mine.result));

    const wa = await ws.invoke("plan_access", { plan_id: id });
    check("the live WS session is locked out", wa.result?.unlocked === false, brief(wa.result));
    const ma = await mcp.call("plan_access", { plan_id: id });
    check("the live MCP session is locked out", ma.ok && ma.value?.unlocked === false, brief(ma.value ?? ma.error));
    const old = await ws.invoke("unlock_plan", { plan_id: id, key: edit_code });
    check("the old key unlocks nothing", old.status === "failed", refusal(old));
    const fresh = await mcp.call("unlock_plan", { plan_id: id, key });
    check("the new key unlocks", fresh.ok && fresh.value?.unlocked === true, brief(fresh.value ?? fresh.error));
    owner.close(); ws.close();
  },

  async unlock_limit_holds_across_new_sessions(s) {
    // wrong keys, each from a new session: the address runs out after five
    const outcomes = [];
    for (let i = 0; i < 6; i++) {
      const ws = await wsConnect(s.http);
      const r = await ws.invoke("unlock_plan", { plan_id: SAMPLE.id, key: `zz${i}x` });
      outcomes.push(r.t === "error" ? r.code : r.status);
      ws.close();
    }
    check("five tries, then rate_limited (WS, a new session each)",
      outcomes.slice(0, 5).every((o) => o === "failed") && outcomes[5] === "rate_limited", outcomes.join(" "));
    const ws = await wsConnect(s.http);
    const right = await ws.invoke("unlock_plan", { plan_id: SAMPLE.id, key: SAMPLE.key });
    check("the right key is refused too while limited", right.t === "error" && right.code === "rate_limited" && right.retry_after > 0,
      `${right.code} retry_after ${right.retry_after}`);
    ws.close();
    const mcp = await mcpConnect(s.mcp);
    const m = await mcp.call("unlock_plan", { plan_id: SAMPLE.id, key: SAMPLE.key });
    check("MCP from the same address is limited too", !m.ok && m.error?.status === 429, brief(m.error));
  },

  async mcp_agent_adds_and_ticks_a_target(s) {
    const mcp = await mcpConnect(s.mcp);
    const names = new Set((await mcp.tools()).map((t) => t.name));
    const want = ["get_items", "list_items", "get_zones", "list_zones", "get_areas", "get_dungeons", "get_skill_lines",
      "find_game_data", "get_plans", "list_plan_characters", "list_plan_blocks", "list_plan_targets", "unlock_plan",
      "lock_plan", "plan_access", "add_target", "update_target", "move_target", "remove_target", "tick_todo",
      "set_target_notes", "create_plan", "rotate_edit_key"];
    const missing = want.filter((n) => !names.has(n));
    check("tools/list: game data, plan reads and plan actions", missing.length === 0, missing.length ? `missing ${missing}` : `${names.size} tools`);
    const writes = [...names].filter((n) => /^(list|create|update|delete)_plans$|^(create|update|delete)_plan_/.test(n));
    check("tools/list: no list_plans and no record writes on plans or their parts", writes.length === 0, writes.join(" ") || "none");

    const found = await mcp.call("find_game_data", { kind: "items", text: "robes of arugal" });
    const robes = found.value?.rows?.[0];
    check("find_game_data finds Robes of Arugal", found.ok && robes?.name === "Robes of Arugal", brief(found.value ?? found.error));
    const sfk = await mcp.call("find_game_data", { kind: "dungeons", text: "shadowfang" });
    const dungeon = sfk.value?.rows?.[0];
    check("find_game_data finds Shadowfang Keep", sfk.ok && /Shadowfang/.test(dungeon?.name ?? ""), brief(sfk.value ?? sfk.error));
    const item = await mcp.call("get_items", { id: robes?.item_id });
    check("get_items reads the item", item.ok && item.value?.name === "Robes of Arugal", brief(item.value?.required_level ?? item.error));

    const plan = await mcp.call("get_plans", { id: SAMPLE.id });
    const chars = await mcp.call("list_plan_characters", { parent_id: SAMPLE.id });
    check("get the plan and its characters", plan.ok && chars.ok && chars.value.total === 2, brief(chars.value?.rows?.map((c) => c.name)));
    check("get_plans has no edit_code_hash", plan.ok && !("edit_code_hash" in plan.value), Object.keys(plan.value ?? {}).join(" "));
    const blocks = await mcp.call("list_plan_blocks", { parent_id: SAMPLE.id });
    check("list_plan_blocks", blocks.ok && blocks.value.total > 0, brief(blocks.value?.rows?.map((b) => `${b.min_level}-${b.max_level}`)));
    const args = { plan_id: SAMPLE.id, kind: "acquire_item", ref: { item_id: robes?.item_id }, characters: ["Lin Grr"],
      place: { lfg_dungeon_id: dungeon?.lfg_dungeon_id }, notes: "api test", block_id: blocks.value?.rows?.at(-1)?.id };

    const locked = await mcp.call("add_target", args);
    check("add_target before unlocking refused", !locked.ok && isLocked(locked.error?.detail), brief(locked.error));
    const unlock = await mcp.call("unlock_plan", { plan_id: SAMPLE.id, key: SAMPLE.key });
    check("unlock_plan", unlock.ok, brief(unlock.value ?? unlock.error));
    let id;
    try {
      const added = await mcp.call("add_target", args);
      id = added.value?.id;
      check("add_target once unlocked; a level above the bracket is a note, not a refusal",
        added.ok && id && /needs level 23/.test(added.value.level_note ?? ""), brief(added.value ?? added.error));
      const tick = await mcp.call("tick_todo", { target_id: id, done: true });
      check("tick_todo the new target", tick.ok && tick.value?.done === true, brief(tick.value ?? tick.error));

      // the write lands: a fresh visitor reads it over the WebSocket API
      const ws = await wsConnect(s.http);
      const rec = await ws.request({ t: "open_records", table: "plan_targets", ids: [id] });
      const t = rec.records?.[0];
      check("the target is there for every reader, done, with the name snapshot",
        t?.title === "Robes of Arugal" && t?.done === true && t?.ref?.name === "Robes of Arugal" && t?.characters?.[0] === "lin", brief(t));
      ws.close();
      const bad = await mcp.call("add_target", { plan_id: SAMPLE.id, kind: "acquire_item", ref: { item_id: 99999999 } });
      check("add_target checks the game id", !bad.ok && /no item/.test(bad.error?.detail ?? ""), brief(bad.error));
      // a refusal naming a title with ": " in it reaches the agent whole (fail(), not a 500)
      const colon = await mcp.call("add_target", { plan_id: SAMPLE.id, kind: "note", title: "api test: no bracket" });
      check("a fail() message with \": \" reaches the agent as a 422",
        !colon.ok && colon.error?.status === 422 && (colon.error?.detail ?? "").startsWith('Say which bracket "api test: no bracket" goes in'),
        brief(colon.error));
    } finally {
      if (id) {
        const gone = await mcp.call("remove_target", { target_id: id });
        check("clean up: remove_target", gone.ok, brief(gone.error));
      }
    }
  },

  async create_plan_is_rate_limited(s) {
    const ws = await wsConnect(s.http);
    const outcomes = [];
    for (let i = 0; i < 6; i++) {
      const r = await ws.invoke("create_plan", { name: `api test limit ${i}`, characters: [{ name: "Testa", race_id: 5, class_id: 9 }] });
      outcomes.push(r.t === "error" ? r.code : r.status);
    }
    check("five plans, then rate_limited", outcomes.slice(0, 5).every((o) => o === "done") && outcomes[5] === "rate_limited", outcomes.join(" "));
    ws.close();
  },
};

// ── run ──────────────────────────────────────────────────────────────────────────────────
const wanted = process.argv.slice(2);
const unknown = wanted.filter((n) => !(n in tests));
if (unknown.length) { console.error(`unknown tests: ${unknown}; known: ${Object.keys(tests)}`); process.exit(2); }
for (const name of wanted.length ? wanted : Object.keys(tests)) {
  const t0 = Date.now();
  const server = await startServer();
  console.log(name);
  try {
    await Promise.race([
      tests[name](server),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`took over ${TEST_SECS} s`)), TEST_SECS * 1000)),
    ]);
  } catch (e) {
    check(name, false, e.message);
  } finally {
    server.stop();
  }
  console.log(`  (${Date.now() - t0} ms)`);
}
console.log(`deleted ${deleteTestPlans()} "api test" plans`);
process.exit(failed ? 1 : 0);
