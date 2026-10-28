// Step 2 of tests/plan_actions.rhai, run with MCP run_data_script (limit 50; writes on): checks
// what the actions stored on the newest "zz action test" plan, then deletes every
// "zz action test" plan with its characters, brackets and targets. Returns
// #{ result: "PASS"|"FAIL", checks: [...], deleted: [...] }.

fn joined(a) {
  if a == () { return "()"; }
  let s = "";
  for x in a { if s.len() > 0 { s += ","; } s += `${x}`; }
  s
}

let plans = table("plan").search("zz action test").list();
let plan = ();
for p in plans {
  if p.name.starts_with("zz action test") && (plan == () || `${p.created_at}` > `${plan.created_at}`) { plan = p; }
}
if plan == () { return #{ result: "FAIL", checks: ["no zz action test plan found; run the button first"] }; }
let id = plan._id;

let checks = [];
let check = |name, ok, detail| {
  if ok { checks.push(`ok - ${name}`); } else { checks.push(`FAIL - ${name}: ${detail}`); }
};

let blocks = table("plan_block").where("plan_id", id).sort("order").list();
let ranges = "";
for b in blocks { ranges += `${b.order}:${b.min_level}-${b.max_level}:${b.title};`; }
check.call("brackets renumbered by level", ranges == "1:1-10:Levels 1-10;2:10-20:Barrens;3:20-25:Silverpine and SFK;", ranges);

let robes = table("plan_target").get(`${id}.t301`);
check.call("robes stored", robes != (), "missing");
if robes != () {
  check.call("robes title is the snapshot name", robes.title == "Robes of Arugal", robes.title);
  check.call("robes ref snapshot (id, name, quality)",
    robes.ref.item_id == 6324 && robes.ref.name == "Robes of Arugal" && robes.ref.quality == 3, robes.ref.to_json());
  check.call("robes for vinnie, done for the plan", joined(robes.characters) == "vinnie" && robes.done == true && robes.done_at != (),
    `${joined(robes.characters)} / ${robes.done} ${robes.done_at}`);
  check.call("robes place changed to The Sepulcher", robes.place.area_id == 228 && robes.place.name == "The Sepulcher", robes.place.to_json());
  check.call("robes count and notes", robes.count == 1 && robes.notes == "Arugal, Shadowfang Keep", `${robes.count} / ${robes.notes}`);
  check.call("robes in the 20-25 bracket", robes.block_id == blocks[2]._id, robes.block_id);
}
let in_b3 = table("plan_target").where("plan_id", id).where("block_id", blocks[2]._id).sort("order").list();
let sfk = ();
for t in in_b3 { if t.kind == "run_dungeon" { sfk = t; } }
check.call("dungeon stored in 20-25", sfk != (), "missing");
if sfk != () {
  check.call("dungeon: title, count, everyone, open again",
    sfk.title == "Shadowfang Keep" && sfk.count == 2 && sfk.characters.len() == 0 && sfk.done == false && sfk.done_at == (),
    `${sfk.title} ${sfk.count} [${joined(sfk.characters)}] ${sfk.done}`);
  check.call("dungeon place = the dungeon", sfk.place.lfg_dungeon_id == 7 && sfk.place.name == "Shadowfang Keep", sfk.place.to_json());
}

let order_of = |bid| {
  let s = "";
  for t in table("plan_target").where("plan_id", id).where("block_id", bid).sort("order").list() { s += `${t.order}:${t.title};`; }
  s
};
let o1 = order_of.call(blocks[0]._id);
check.call("1-10 after move and remove", o1 == "1:Reach level 8;", o1);
let o2 = order_of.call(blocks[1]._id);
check.call("10-20 after the move in", o2 == "1:Buy a fishing pole;2:Tailoring 75;3:Reach level 10;", o2);
let o3 = order_of.call(blocks[2]._id);
check.call("20-25 orders", o3 == "1:Robes of Arugal;2:Shadowfang Keep;", o3);

let lvl8 = ();
for t in table("plan_target").where("plan_id", id).where("block_id", blocks[0]._id).list() { lvl8 = t; }
if lvl8 != () { check.call("reach_level place Durotar", lvl8.place.zone_id == 14 && lvl8.place.name == "Durotar", lvl8.place.to_json()); }
let note = ();
for t in table("plan_target").where("plan_id", id).where("kind", "note").list() { note = t; }
if note != () { check.call("note for grak, no place", joined(note.characters) == "grak" && note.place == (), `${joined(note.characters)} ${note.place}`); }

let v = table("plan_character").get(`${id}.vinnie`);
check.call("vinnie renamed", v.name == "Vinnie Grr", v.name);
let prim = "";
for s in v.professions.primary { prim += `${s.skill_line_id}:${s.name};`; }
let sec = "";
for s in v.professions.secondary { sec += `${s.skill_line_id}:${s.name};`; }
check.call("vinnie professions", prim == "182:Herbalism;197:Tailoring;" && sec == "129:First Aid;", `${prim} | ${sec}`);
check.call("vinnie starts in Deathknell", v.start.area_id == 154 && v.start.name == "Deathknell", v.start.to_json());

check.call("plan description", plan.description == "Throwaway plan of tests/plan_actions.rhai", plan.description);
check.call("plan updated_at bumped", plan.updated_at != () && `${plan.updated_at}` >= `${plan.created_at}`, `${plan.updated_at}`);
check.call("edit key stored as a hash", plan.edit_code_hash.len() == 64, "bad hash");

// clean up every throwaway plan
let deleted = [];
for p in plans {
  if !p.name.starts_with("zz action test") { continue; }
  for t in table("plan_target").where("plan_id", p._id).ids() { table("plan_target").delete(t); }
  for b in table("plan_block").where("plan_id", p._id).ids() { table("plan_block").delete(b); }
  for c in table("plan_character").where("plan_id", p._id).ids() { table("plan_character").delete(c); }
  table("plan").delete(p._id);
  deleted.push(`${p._id} ${p.name}`);
}

let failed = checks.filter(|c| c.starts_with("FAIL")).len();
#{ result: if failed == 0 { `PASS: ${checks.len()} stored checks on ${id}` } else { `FAIL: ${failed} of ${checks.len()}` }, checks: checks, deleted: deleted }
