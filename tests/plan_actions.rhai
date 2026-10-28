// Plan editing actions, exercised on a throwaway plan (desktop, local profile only).
//
// MCP data scripts have no `actions`, and the editing actions are not in api/wowplan.yaml, so this
// runs as the body of the button on page/zz_plan_action_tests.yaml:
//   1. ui_navigate zz_plan_action_tests, ui_tree for its instance
//   2. ui_interact { instance, element: "run_tests", action: "click" }  (needs "Allow MCP agents
//      to write data")
//   3. list_logs level info, contains "checks on plan": the toast holds every ok/FAIL line and a
//      last line "PASS: …" or "FAIL: …"
//   4. run_data_script with tests/plan_actions_stored.rhai (limit 50): checks what was stored
//      and deletes the throwaway plan with its characters, brackets and targets
// A button body has `actions` but no `table(…)`; stored documents are checked in step 4.

fn plain(e) {
  let s = `${e}`;
  loop {
    let changed = false;
    if s.starts_with("actions.") {
      let i = s.index_of(": ");
      if i > 0 { s = s.sub_string(i + 2, s.len() - i - 2); changed = true; }
    }
    if s.starts_with("Runtime error: ") { s = s.sub_string(15, s.len() - 15); changed = true; }
    if !changed { break; }
  }
  let i = s.index_of(" (line ");
  if i > 0 { s = s.sub_string(0, i); }
  s
}

fn joined(a) {
  let s = "";
  for x in a { if s.len() > 0 { s += ","; } s += `${x}`; }
  s
}

let report = [];
let fails = [0];
let check = |name, ok, detail| {
  if ok { report.push(`ok - ${name}`); } else { report.push(`FAIL - ${name}: ${detail}`); fails[0] += 1; }
};
// runs f, expects a refusal whose plain message contains `want`
let refused = |name, f, want| {
  let msg = "";
  let went = false;
  try { f.call(); went = true; } catch (e) { msg = plain(e); }
  if went { check.call(name, false, "went through"); } else { check.call(name, msg.contains(want), `"${msg}"`); }
};

let p = actions.create_plan(#{
  name: `zz action test ${now()}`,
  characters: [#{ name: "Vinnie", race_id: 5, class_id: 9 }, #{ name: "Grak", race_id: 2, class_id: 3 }],
});
let plan = p.id;
check.call("create_plan gives a 4-character key", p.edit_code.len() == 4, p.edit_code);

let b1 = actions.add_block(#{ plan_id: plan, min_level: 10, max_level: 20, title: "Barrens" });
let b0 = actions.add_block(#{ plan_id: plan, min_level: 1, max_level: 10 });
check.call("add_block sorts brackets by level", b0.order == 1, b0.to_json());
refused.call("add_block refuses an overlap", || actions.add_block(#{ plan_id: plan, min_level: 15, max_level: 25 }),
  "overlap the 10-20 bracket");
refused.call("add_block refuses min > max", || actions.add_block(#{ plan_id: plan, min_level: 30, max_level: 20 }),
  "can't start at 30 and end at 20");
refused.call("add_block refuses level 61", || actions.add_block(#{ plan_id: plan, min_level: 50, max_level: 61 }),
  "Levels go from 1 to 60");

// Robes of Arugal: required level 23, the plan has 1-10 and 10-20
refused.call("add_target asks for a bracket when none covers the level",
  || actions.add_target(#{ plan_id: plan, kind: "acquire_item", ref: #{ item_id: 6324 }, characters: ["Vinnie"] }),
  "No bracket covers level 23; say which bracket it goes in (this plan has 1-10, 10-20)");
refused.call("add_target refuses an unknown character",
  || actions.add_target(#{ plan_id: plan, kind: "reach_level", level: 5, characters: ["Thrall"] }),
  "This plan has no character \"Thrall\"; its characters are Vinnie (vinnie) and Grak (grak)");
refused.call("add_target refuses an unknown item",
  || actions.add_target(#{ plan_id: plan, kind: "acquire_item", ref: #{ item_id: 99999999 } }),
  "There is no item 99999999");
refused.call("add_target refuses a free-text place",
  || actions.add_target(#{ plan_id: plan, kind: "reach_level", level: 5, place: "Shadowfang Keep" }),
  "Give the place as zone_id, lfg_dungeon_id or area_id");
refused.call("add_target refuses a ref the kind doesn't take",
  || actions.add_target(#{ plan_id: plan, kind: "acquire_item", ref: #{ quest_id: 19 } }),
  "can't refer to quest_id");
refused.call("add_target: a note needs a bracket",
  || actions.add_target(#{ plan_id: plan, kind: "note", title: "Buy a fishing pole" }),
  "Say which bracket \"Buy a fishing pole\" goes in; this plan has 1-10, 10-20");
// level fit is loose: a named bracket is accepted and the mismatch comes back as a note
let loose = actions.add_target(#{ plan_id: plan, kind: "reach_level", level: 15, block_id: b0.id });
check.call("add_target accepts a named bracket that doesn't cover the level",
  loose.block_id == b0.id && loose.level_note == "level 15 is outside the 1-10 bracket", loose.to_json());
actions.remove_target(#{ target_id: loose.id });
refused.call("add_target refuses a place given only by name",
  || actions.add_target(#{ plan_id: plan, kind: "reach_level", level: 5, place: #{ name: "Shadowfang Keep" } }),
  "Pick the place as a zone, dungeon or area from the game data");
refused.call("add_target refuses a place with an empty id",
  || actions.add_target(#{ plan_id: plan, kind: "reach_level", level: 5, place: #{ zone_id: "" } }),
  "Pick the place as a zone, dungeon or area from the game data");
refused.call("add_block refuses a one-level bracket on an edge",
  || actions.add_block(#{ plan_id: plan, min_level: 10, max_level: 10 }),
  "share level 10 with the 1-10 bracket");
refused.call("create_plan refuses names that differ only in case",
  || actions.create_plan(#{ name: "zz action test dup", characters: [#{ name: "Grak", race_id: 2, class_id: 3 }, #{ name: "grak", race_id: 2, class_id: 3 }] }),
  "The two characters need different names");
// the page shows actions.plain_error(...) of a caught error: just the action's sentence
let wrapped = "";
try { actions.add_target(#{ plan_id: plan, kind: "acquire_item", ref: #{ item_id: 6324 } }); } catch (e) { wrapped = `${e}`; }
let pe = actions.plain_error(#{ error: wrapped }).message;
check.call("plain_error leaves only the sentence", pe == "No bracket covers level 23; say which bracket it goes in (this plan has 1-10, 10-20)", pe);

let b2 = actions.add_block(#{ plan_id: plan, min_level: 20, max_level: 30, title: "Silverpine" });
check.call("add_block 20-30 goes third", b2.order == 3, b2.to_json());

let robes = actions.add_target(#{
  plan_id: plan, kind: "acquire_item", ref: #{ item_id: 6324 }, characters: ["VINNIE"],
  place: #{ lfg_dungeon_id: 7 }, notes: "Arugal, Shadowfang Keep",
});
check.call("add_target puts the robes in 20-30", robes.block_id == b2.id, robes.to_json());
check.call("add_target snapshots the place", robes.place.lfg_dungeon_id == 7 && robes.place.name == "Shadowfang Keep", robes.to_json());
check.call("add_target id follows <plan>.t<order><nn>", robes.id == `${plan}.t301`, robes.id);

let sfk = actions.add_target(#{ plan_id: plan, kind: "run_dungeon", ref: #{ lfg_dungeon_id: 7 }, count: 2 });
check.call("run_dungeon defaults its place to the dungeon", sfk.place.lfg_dungeon_id == 7 && sfk.block_id == b2.id, sfk.to_json());
let lvl5 = actions.add_target(#{ plan_id: plan, kind: "reach_level", level: 5 });
let lvl8 = actions.add_target(#{ plan_id: plan, kind: "reach_level", level: 8, place: #{ zone_id: 14 } });
check.call("reach_level picks the first bracket covering it", lvl5.block_id == b0.id && lvl8.block_id == b0.id, lvl8.to_json());
let edge = actions.add_target(#{ plan_id: plan, kind: "reach_level", level: 10 });
check.call("an edge level goes in the first bracket by order", edge.block_id == b0.id, edge.to_json());
let note = actions.add_target(#{ plan_id: plan, kind: "note", title: "Buy a fishing pole", block_id: b1.id, characters: "grak" });
check.call("a note goes in the bracket given", note.block_id == b1.id && note.place == (), note.to_json());

// other kinds
let brill = actions.add_target(#{ plan_id: plan, kind: "travel_to_zone", ref: #{ area_id: 159 } });
check.call("travel to Brill: exploration level 5, place = Brill", brill.block_id == b0.id && brill.place.area_id == 159, brill.to_json());
let kit = actions.add_target(#{ plan_id: plan, kind: "craft_item", ref: #{ recipe_spell_id: 2152 }, count: 5,
  purpose: "Sell", characters: ["grak"], block_id: b0.id });
check.call("craft from a recipe fills the item", kit.block_id == b0.id, kit.to_json());
refused.call("craft refuses a recipe that makes something else",
  || actions.add_target(#{ plan_id: plan, kind: "craft_item", ref: #{ recipe_spell_id: 2152, item_id: 6324 } }),
  "Light Armor Kit doesn't make item 6324");
refused.call("craft refuses an unknown purpose",
  || actions.add_target(#{ plan_id: plan, kind: "craft_item", ref: #{ item_id: 2304 }, purpose: "hoard", block_id: b0.id }),
  "The purpose is sell, use or give");
refused.call("a profession target needs a bracket",
  || actions.add_target(#{ plan_id: plan, kind: "reach_profession_level", ref: #{ skill_line_id: 197 }, level: 50 }),
  "Say which bracket \"Tailoring 50\" goes in");
refused.call("a weapon skill isn't a profession",
  || actions.add_target(#{ plan_id: plan, kind: "reach_profession_level", ref: #{ skill_line_id: 43 }, level: 50, block_id: b1.id }),
  "isn't a profession");
let prof = actions.add_target(#{ plan_id: plan, kind: "reach_profession_level", ref: #{ skill_line_id: 197 }, level: 50, block_id: b1.id, characters: ["vinnie"] });
let prof2 = actions.update_target(#{ target_id: prof.id, level: 75 });
check.call("profession target in the bracket given", prof2.block_id == b1.id, prof2.to_json());
let quest = actions.add_target(#{ plan_id: plan, kind: "complete_quest", ref: #{ quest_id: 19 } });
check.call("quest at min level 18 goes in 10-20", quest.block_id == b1.id, quest.to_json());
let q2 = actions.add_target(#{ plan_id: plan, kind: "complete_quest", title: "Voidwalker quest", block_id: b1.id, characters: ["Vinnie"] });
check.call("a quest not in the data: title and bracket", q2.block_id == b1.id, q2.to_json());
refused.call("a quest target can't drop its quest",
  || actions.update_target(#{ target_id: quest.id, ref: #{} }), "can't drop its quest");
// a needed level is a minimum: Disciple's Vest (required 8) fits 10-20 and stays editable there
let vest = actions.add_target(#{ plan_id: plan, kind: "acquire_item", ref: #{ item_id: 6266 }, block_id: b1.id });
check.call("a lower needed level fits a later bracket", vest.block_id == b1.id, vest.to_json());
let vest2 = actions.update_target(#{ target_id: vest.id, notes: "from a vendor" });
check.call("a notes edit doesn't re-check the bracket", vest2.block_id == b1.id, vest2.to_json());
refused.call("update_target refuses clearing a place with a name only",
  || actions.update_target(#{ target_id: vest.id, place: #{ name: "Brill" } }), "a name on its own isn't enough");
// the profession target stays (its title is checked in step 4); the rest go
for t in [brill.id, kit.id, quest.id, q2.id, vest.id] { actions.remove_target(#{ target_id: t }); }

// ticking: one flag for the whole plan, whoever the to-do is for (the dungeon is everyone's,
// the robes Vinnie's)
// (a button body has no table(): the stored flags and times are checked by
// tests/plan_actions_stored.rhai)
let t1 = actions.tick_target(#{ target_id: sfk.id, done: true });
check.call("tick: done for the plan", t1.done == true, t1.to_json());
let t2 = actions.tick_target(#{ target_id: sfk.id, done: false });
check.call("open again", t2.done == false, t2.to_json());
let t3 = actions.tick_target(#{ target_id: robes.id, done: true });
check.call("tick a to-do for one character", t3.done, t3.to_json());
refused.call("tick needs done true or false",
  || actions.tick_target(#{ target_id: robes.id, done: "yes" }), "true or false");

// moving
let early = actions.move_target(#{ target_id: robes.id, block_id: b0.id });
check.call("move_target accepts an earlier bracket with a note",
  early.block_id == b0.id && early.level_note == "\"Robes of Arugal\" needs level 23, above the 1-10 bracket", early.to_json());
let back = actions.move_target(#{ target_id: robes.id, block_id: b2.id, order: 1 });
check.call("move_target back to 20-30 has no note", back.block_id == b2.id && back.level_note == (), back.to_json());
let m = actions.move_target(#{ target_id: lvl8.id, order: 1 });
check.call("move_target to first place", m.order == 1 && m.block_id == b0.id, m.to_json());
let m2 = actions.move_target(#{ target_id: edge.id, block_id: b1.id });
check.call("move_target across brackets (10 fits 10-20)", m2.block_id == b1.id && m2.order == 3, m2.to_json());

// changing a target
let u1 = actions.update_target(#{ target_id: robes.id, place: #{} });
check.call("update_target clears the place", u1.place == (), u1.to_json());
let u2 = actions.update_target(#{ target_id: robes.id, place: #{ area_id: 228 }, count: 1 });
check.call("update_target sets an area place", u2.place.area_id == 228 && u2.place.name == "The Sepulcher", u2.to_json());
refused.call("update_target refuses a level on an item", || actions.update_target(#{ target_id: robes.id, level: 25 }),
  "Only character-level and profession targets take a level");
refused.call("update_target refuses a kind change", || actions.update_target(#{ target_id: robes.id, kind: "note" }),
  "kind can't change");
let u15 = actions.update_target(#{ target_id: lvl5.id, level: 15 });
check.call("update_target accepts a level outside the bracket with a note",
  u15.block_id == b0.id && u15.level_note == "level 15 is outside the 1-10 bracket", u15.to_json());
let u3 = actions.update_target(#{ target_id: lvl5.id, level: 7 });
check.call("update_target keeps the bracket for a level that fits", u3.block_id == b0.id, u3.to_json());

// brackets
let narrow = actions.update_block(#{ block_id: b2.id, max_level: 22 });
check.call("update_block narrows past a target and names it in a note",
  narrow.max_level == 22 && narrow.level_note == "Levels 20-22 no longer cover \"Robes of Arugal\" (level 23)", narrow.to_json());
actions.update_block(#{ block_id: b2.id, max_level: 30 });
refused.call("update_block refuses an overlap", || actions.update_block(#{ block_id: b1.id, max_level: 22 }),
  "overlap the 20-30 bracket");
let ub = actions.update_block(#{ block_id: b2.id, max_level: 25, title: "Silverpine and SFK" });
check.call("update_block narrows a range that keeps its targets", ub.max_level == 25 && ub.order == 3, ub.to_json());
refused.call("remove_block refuses a bracket with targets", || actions.remove_block(#{ block_id: b2.id }),
  "The 20-25 bracket still has 2 targets; move or remove them first");
let b3 = actions.add_block(#{ plan_id: plan, min_level: 40, max_level: 50, zones: [#{ zone_id: 17 }] });
let ub3 = actions.update_block(#{ block_id: b3.id, min_level: 45 });
check.call("a default bracket title follows the range", ub3.title == "Levels 45-50", ub3.to_json());
let rb = actions.remove_block(#{ block_id: b3.id });
check.call("remove_block removes an empty bracket", rb.id == b3.id, rb.to_json());

let rt = actions.remove_target(#{ target_id: lvl5.id });
check.call("remove_target", rt.id == lvl5.id, rt.to_json());

// plan and characters
refused.call("update_plan refuses an empty name", || actions.update_plan(#{ plan_id: plan, name: "  " }), "Give the plan a name");
let up = actions.update_plan(#{ plan_id: plan, description: "Throwaway plan of tests/plan_actions.rhai" });
check.call("update_plan sets the description", up.description == "Throwaway plan of tests/plan_actions.rhai", up.to_json());
refused.call("update_character refuses an unknown character",
  || actions.update_character(#{ plan_id: plan, character: "Lin", notes: "x" }), "This plan has no character \"Lin\"");
refused.call("update_character refuses three primary professions",
  || actions.update_character(#{ plan_id: plan, character: "vinnie", professions: #{ primary: [182, 197, 165] } }),
  "at most two primary professions");
refused.call("update_character refuses a secondary skill as primary",
  || actions.update_character(#{ plan_id: plan, character: "vinnie", professions: #{ primary: [129] } }),
  "First Aid is a secondary profession");
refused.call("update_character refuses an empty name",
  || actions.update_character(#{ plan_id: plan, character: "vinnie", name: "" }), "Every character needs a name");
let uc = actions.update_character(#{ plan_id: plan, character: "Vinnie", name: "Vinnie Grr",
  professions: #{ primary: [182, 197], secondary: [129] }, start: #{ area_id: 154 } });
check.call("update_character renames and keeps the key", uc.key == "vinnie" && uc.name == "Vinnie Grr", uc.to_json());

// edit key
let old_key = p.edit_code;
let k = actions.rotate_edit_key(#{ plan_id: plan });
check.call("rotate_edit_key gives a new 4-character key", k.edit_key.len() == 4 && k.edit_key != old_key, k.to_json());
let c_old = actions.check_edit_code(#{ plan_id: plan, code: old_key });
let c_new = actions.check_edit_code(#{ plan_id: plan, code: k.edit_key });
check.call("the old key stops working", c_old.found && !c_old.editable, c_old.to_json());
check.call("the new key works", c_new.editable, c_new.to_json());

let n = fails[0];
let last = if n == 0 { `PASS: ${report.len()} checks on plan ${plan}` } else { `FAIL: ${n} of ${report.len()} checks on plan ${plan}` };
let text = "";
for l in report { text += l + "\n"; }
text += last;
state.report = text;
toast(text, if n == 0 { "success" } else { "error" });
