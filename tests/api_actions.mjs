// Checks the wowplan API's actions over the WebSocket (Node 22+, no packages):
//   node tests/api_actions.mjs <api url>        e.g. http://127.0.0.1:61094
// Creates one plan named "api test …"; remove it afterwards with
//   db.plans.deleteMany({name: /^api test /}); db.plan_characters.deleteMany({plan_id: {$in: [...]}})
// (mongo/README.md has the mongosh command).

const base = process.argv[2];
if (!base) { console.error("usage: node tests/api_actions.mjs <api url>"); process.exit(2); }
const ws = new WebSocket(base.replace(/^http/, "ws") + "/v1/ws");

let nextId = 1;
const waiting = new Map(); // run id -> resolve
const send = (frame) => ws.send(JSON.stringify({ id: nextId++, ...frame }));

ws.onmessage = (m) => {
  const f = JSON.parse(String(m.data));
  if (f.t === "run" && (f.status === "done" || f.status === "failed") && waiting.has(f.run)) {
    waiting.get(f.run)(f);
    waiting.delete(f.run);
  }
};

function invoke(action, args) {
  const run = crypto.randomUUID();
  return new Promise((resolve) => {
    waiting.set(run, resolve);
    send({ t: "invoke", run, action, args });
  });
}

let failed = 0;
function check(name, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failed++;
}

ws.onopen = async () => {
  send({ t: "hello", protocol: 1 });
  await new Promise((r) => setTimeout(r, 300));

  const stamp = new Date().toISOString().slice(11, 19);
  const made = await invoke("create_plan", {
    name: `api test ${stamp}`,
    characters: [
      { name: "Testa Grr", race_id: 5, class_id: 9 },   // Undead Warlock (Horde)
      { name: "Testb", race_id: 96, class_id: 11 },     // Windshaper Skyborne Druid (Horde)
    ],
  });
  const res = made.result ?? {};
  check("create_plan with two Horde characters",
    made.status === "done" && /^[0-9A-Za-z]{7}$/.test(res.id ?? "") && /^[0-9A-Za-z]{4}$/.test(res.edit_code ?? ""),
    made.error ? JSON.stringify(made.error) : `id ${res.id}, edit code ${res.edit_code}`);

  const mixed = await invoke("create_plan", {
    name: "api test mixed",
    characters: [{ name: "A", race_id: 1, class_id: 1 }, { name: "B", race_id: 2, class_id: 1 }],
  });
  check("create_plan refuses Alliance + Horde", mixed.status === "failed", mixed.error?.message);

  const bad = await invoke("create_plan", { name: "api test bad", characters: [{ name: "C", race_id: 7, class_id: 11 }] });
  check("create_plan refuses Gnome Druid", bad.status === "failed", bad.error?.message);

  const none = await invoke("create_plan", { name: "  ", characters: [{ name: "D", race_id: 2, class_id: 3 }] });
  check("create_plan refuses an empty name", none.status === "failed", none.error?.message);

  // unlocking, locking and the write rule: tests/sessions_and_mcp.mjs
  if (res.id) {
    const mine = await invoke("plan_access", { plan_id: res.id });
    check("create_plan unlocks the new plan in this session", mine.result?.unlocked === true, JSON.stringify(mine.result));
  }
  const sample = await invoke("plan_access", { plan_id: "k3Fq9xZ" });
  check("the sample plan is locked until unlocked", sample.result?.unlocked === false, JSON.stringify(sample.result));

  ws.close();
  process.exit(failed ? 1 : 0);
};
