// Sample guides for development and API tests. Replaces only these sample plans (and their
// characters, blocks and targets); any other plan in the database is left alone.
//   mongosh "mongodb://localhost:<port>/wowplan?directConnection=true" --file mongo/seed.js
//
// IDs and names are from build 1.60.1.70532 (Postgres schema `wow`). Sample 1 follows the user's
// "House of Grr" planner, levels 1-22; sample 2 is a clone of it; sample 3 a small solo plan.

const BUILD = "1.60.1.70532";
const now = new Date();

// Edit codes of the sample plans (for tests; documented in mongo/README.md). Only the SHA-256
// hex is stored, the same hash Vantage's hash_secret() makes.
const crypto = require("crypto");
const editHash = (code) => crypto.createHash("sha256").update(code).digest("hex");
const EDIT_CODES = { k3Fq9xZ: "GrrDemoEdit2", p8Lm2Tw: "VinnieSolo34", Zt4n0Ra: "GrakEditMe56" };

// game data references (Blizzard id + name snapshot)
const item = (item_id, name, quality = 1) => ({ item_id: NumberInt(item_id), name, quality: NumberInt(quality) });
const zone = (zone_id, name) => ({ zone_id: NumberInt(zone_id), name });
const area = (area_id, name) => ({ area_id: NumberInt(area_id), name });
const skill = (skill_line_id, name) => ({ skill_line_id: NumberInt(skill_line_id), name });
const dungeon = (lfg_dungeon_id, name) => ({ lfg_dungeon_id: NumberInt(lfg_dungeon_id), name });

const HERBALISM = skill(182, "Herbalism"), TAILORING = skill(197, "Tailoring");
const SKINNING = skill(393, "Skinning"), LEATHERWORKING = skill(165, "Leatherworking");
const FIRST_AID = skill(129, "First Aid"), COOKING = skill(185, "Cooking"), FISHING = skill(356, "Fishing");
const TIRISFAL = zone(85, "Tirisfal Glades"), SILVERPINE = zone(130, "Silverpine Forest");
const UNDERCITY = zone(1497, "Undercity"), HILLSBRAD = zone(267, "Hillsbrad Foothills");

function character(plan_id, order, key, name, race, cls, primary, secondary, start, notes = null) {
  return {
    _id: `${plan_id}.${key}`, plan_id, key, order: NumberInt(order), name,
    race_id: NumberInt(race[0]), race_name: race[1], class_id: NumberInt(cls[0]), class_name: cls[1],
    professions: { primary, secondary }, start, notes,
  };
}

function block(plan_id, n, min_level, max_level, title, zones, notes = null) {
  return {
    _id: `${plan_id}.b${n}`, plan_id, order: NumberInt(n), title,
    min_level: NumberInt(min_level), max_level: NumberInt(max_level), zones, notes,
  };
}

// targets(plan_id, block_n, [...]) numbers them t<block><nn> in the order given
function targets(plan_id, block_n, list) {
  return list.map((t, i) => {
    const doc = {
      _id: `${plan_id}.t${block_n}${String(i + 1).padStart(2, "0")}`,
      plan_id, block_id: `${plan_id}.b${block_n}`, order: NumberInt(i + 1),
      characters: [], done_by: [], notes: null, ...t,
    };
    for (const f of ["count", "level"]) if (doc[f] !== undefined) doc[f] = NumberInt(doc[f]);
    return doc;
  });
}

// ── 1. House of Grr: Vinnie (Undead Warlock) and Lin (Windshaper Skyborne Druid) ──────────────
const GRR = "k3Fq9xZ";
const grr = {
  plan: {
    _id: GRR, name: "House of Grr", game_build: BUILD, forked_from: null, side: "Horde",
    edit_code_hash: editHash(EDIT_CODES[GRR]), created_at: now, updated_at: now,
    description: "Vinnie and Lin level together on the Horde side: Tirisfal, Silverpine, Hillsbrad. "
      + "Vinnie gathers herbs and tailors, Lin skins and works leather; both run the early dungeons.",
  },
  characters: [
    character(GRR, 1, "vinnie", "Vinnie Grr", [5, "Undead"], [9, "Warlock"],
      [HERBALISM, TAILORING], [FIRST_AID, COOKING, FISHING], area(154, "Deathknell")),
    character(GRR, 2, "lin", "Lin Grr", [96, "Windshaper Skyborne"], [11, "Druid"],
      [SKINNING, LEATHERWORKING], [], TIRISFAL, "Starts on the Skyborne isle and runs to Tirisfal at level 1."),
  ],
  blocks: [
    block(GRR, 1, 1, 6, "Deathknell", [area(154, "Deathknell")]),
    block(GRR, 2, 6, 12, "Brill, Tirisfal", [TIRISFAL]),
    block(GRR, 3, 12, 15, "Silverpine, The Sepulcher", [SILVERPINE]),
    block(GRR, 4, 15, 18, "Silverpine and Undercity", [SILVERPINE, UNDERCITY]),
    block(GRR, 5, 18, 22, "Hillsbrad, Tarren Mill", [HILLSBRAD]),
  ],
  targets: [
    ...targets(GRR, 1, [
      { kind: "note", title: "Lin meets Vinnie in Tirisfal" },
      { kind: "reach_profession_level", title: "Tailoring 25", characters: ["vinnie"], ref: TAILORING, level: 25 },
      { kind: "reach_profession_level", title: "Skinning 20", characters: ["lin"], ref: SKINNING, level: 20 },
      { kind: "craft_item", title: "Linen Bags for self", characters: ["vinnie"], ref: item(4238, "Linen Bag"), count: 2, purpose: "use", for_character: "vinnie" },
      { kind: "craft_item", title: "Light Armor Kits for the auction house", characters: ["lin"], ref: item(2304, "Light Armor Kit"), count: 5, purpose: "sell" },
    ]),
    ...targets(GRR, 2, [
      { kind: "craft_item", title: "Linen Bags for Lin", characters: ["vinnie"], ref: item(4238, "Linen Bag"), count: 2, purpose: "give", for_character: "lin" },
      { kind: "craft_item", title: "Camp Tent", characters: ["lin"], ref: item(279978, "Camp Tent"), count: 1, purpose: "use", notes: "Leatherworking 20, 5 Light Leather" },
      { kind: "complete_quest", title: "Voidwalker quest at 10, Undercity", characters: ["vinnie"] },
      { kind: "complete_quest", title: "Bear Form and Teleport: Moonglade quests at 10", characters: ["lin"] },
      { kind: "reach_profession_level", title: "Herbalism 60", characters: ["vinnie"], ref: HERBALISM, level: 60 },
      { kind: "reach_profession_level", title: "Tailoring 75", characters: ["vinnie"], ref: TAILORING, level: 75 },
      { kind: "reach_profession_level", title: "Leatherworking 60", characters: ["lin"], ref: LEATHERWORKING, level: 60 },
      { kind: "reach_level", title: "Reach level 10, train Journeyman ranks", level: 10 },
      { kind: "reach_level", title: "Reach level 12, move to Silverpine", level: 12 },
    ]),
    ...targets(GRR, 3, [
      { kind: "travel_to_zone", title: "Move to The Sepulcher", ref: area(228, "The Sepulcher") },
      { kind: "craft_item", title: "Red Linen Bags to replace the Linen Bags", characters: ["vinnie"], ref: item(5762, "Red Linen Bag"), count: 4, purpose: "use" },
      { kind: "craft_item", title: "Linen Reagent Bag", characters: ["vinnie"], ref: item(253664, "Linen Reagent Bag"), count: 1, purpose: "sell" },
      { kind: "craft_item", title: "Minor Healing Potions at First Aid 55", characters: ["vinnie"], ref: item(118, "Minor Healing Potion"), count: 10, purpose: "use" },
      { kind: "note", title: "Pick up Ruins of Lordaeron quests in Undercity" },
    ]),
    ...targets(GRR, 4, [
      { kind: "run_dungeon", title: "Ruins of Lordaeron, twice (15-16 and 17-18)", ref: dungeon(3272, "Ruins of Lordaeron"), count: 2 },
      { kind: "acquire_item", title: "Rotmender's Leggings", characters: ["vinnie"], ref: item(271207, "Rotmender's Leggings", 3), count: 1 },
      { kind: "acquire_item", title: "Rotmender's Treads", characters: ["vinnie"], ref: item(271214, "Rotmender's Treads", 3), count: 1 },
      { kind: "acquire_item", title: "Tuskwrap Belt", characters: ["vinnie"], ref: item(271210, "Tuskwrap Belt", 3), count: 1 },
      { kind: "acquire_item", title: "Coldspire Staff", characters: ["vinnie"], ref: item(271215, "Coldspire Staff", 3), count: 1 },
      { kind: "acquire_item", title: "Bloodied Chestwraps (tank set)", characters: ["lin"], ref: item(271212, "Bloodied Chestwraps", 3), count: 1 },
      { kind: "acquire_item", title: "Witherbite Bracers (tank set)", characters: ["lin"], ref: item(271202, "Witherbite Bracers", 3), count: 1 },
      { kind: "craft_item", title: "Light Leather Quivers for the auction house", characters: ["lin"], ref: item(7278, "Light Leather Quiver"), count: 5, purpose: "sell" },
      { kind: "craft_item", title: "Lesser Healing Potions at First Aid 85", characters: ["vinnie"], ref: item(858, "Lesser Healing Potion"), count: 10, purpose: "use" },
    ]),
    ...targets(GRR, 5, [
      { kind: "travel_to_zone", title: "Move to Hillsbrad at 18, Tarren Mill", ref: area(272, "Tarren Mill") },
      { kind: "reach_level", title: "Reach level 20, train Expert ranks", level: 20 },
      { kind: "complete_quest", title: "Succubus quest at 20", characters: ["vinnie"] },
      { kind: "complete_quest", title: "Cat Form quest at 20", characters: ["lin"] },
      { kind: "craft_item", title: "Woolen Bags and Woolen Reagent Bags", characters: ["vinnie"], ref: item(253667, "Woolen Reagent Bag"), count: 4, purpose: "sell" },
      { kind: "reach_profession_level", title: "Skinning 140", characters: ["lin"], ref: SKINNING, level: 140 },
      { kind: "reach_profession_level", title: "Leatherworking 140", characters: ["lin"], ref: LEATHERWORKING, level: 140 },
    ]),
  ],
};
// some progress, so "done" can be tested
grr.targets.find((t) => t._id === `${GRR}.t101`).done_by = ["vinnie", "lin"];
grr.targets.find((t) => t._id === `${GRR}.t104`).done_by = ["vinnie"];

// ── 2. A clone of House of Grr, renamed, Vinnie only, first two blocks ─────────────────────────
const FORK = "p8Lm2Tw";
const reId = (doc) => ({ ...doc, _id: doc._id.replace(GRR, FORK), plan_id: FORK,
  ...(doc.block_id ? { block_id: doc.block_id.replace(GRR, FORK) } : {}) });
const fork = {
  plan: { _id: FORK, name: "Vinnie goes solo", game_build: BUILD, forked_from: GRR, side: "Horde",
    edit_code_hash: editHash(EDIT_CODES[FORK]), created_at: now, updated_at: now,
    description: "Cloned from House of Grr: the warlock half, levelled alone." },
  characters: [reId(grr.characters[0])],
  blocks: grr.blocks.filter((b) => b.order <= 2).map(reId),
  targets: grr.targets
    .filter((t) => t.block_id.endsWith(".b1") || t.block_id.endsWith(".b2"))
    .filter((t) => t.characters.length === 0 || t.characters.includes("vinnie"))
    .map((t) => ({ ...reId(t), done_by: [] })),
};

// ── 3. Solo Orc Hunter in Durotar: a hunter starts in leather and learns mail at 40 ──────────
const HUNT = "Zt4n0Ra";
const hunt = {
  plan: { _id: HUNT, name: "Grak the patient", game_build: BUILD, forked_from: null, side: "Horde",
    edit_code_hash: editHash(EDIT_CODES[HUNT]), created_at: now, updated_at: now,
    description: "An orc hunter, solo, taking every side quest in Durotar and the Barrens." },
  characters: [
    character(HUNT, 1, "grak", "Grak", [2, "Orc"], [3, "Hunter"], [SKINNING, LEATHERWORKING], [COOKING, FIRST_AID], zone(14, "Durotar")),
  ],
  blocks: [
    block(HUNT, 1, 1, 10, "Durotar", [zone(14, "Durotar")]),
    block(HUNT, 2, 10, 20, "The Barrens", [zone(17, "The Barrens")]),
  ],
  targets: [
    ...targets(HUNT, 1, [
      { kind: "reach_level", title: "Reach level 10 and tame a pet", level: 10 },
      { kind: "craft_item", title: "Small Leather Ammo Pouch", ref: item(7279, "Small Leather Ammo Pouch"), count: 1, purpose: "use" },
    ]),
    ...targets(HUNT, 2, [
      { kind: "travel_to_zone", title: "Cross into the Barrens", ref: zone(17, "The Barrens") },
      { kind: "run_dungeon", title: "Wailing Caverns", ref: dungeon(1, "Wailing Caverns") },
      { kind: "reach_profession_level", title: "Leatherworking 100", ref: LEATHERWORKING, level: 100 },
    ]),
  ],
};

// ── write ──────────────────────────────────────────────────────────────────────────────────
const samples = [grr, fork, hunt];
const ids = samples.map((s) => s.plan._id);
db.plans.deleteMany({ _id: { $in: ids } });
for (const c of ["plan_characters", "plan_blocks", "plan_targets"]) db.getCollection(c).deleteMany({ plan_id: { $in: ids } });
for (const s of samples) {
  db.plans.insertOne(s.plan);
  db.plan_characters.insertMany(s.characters);
  db.plan_blocks.insertMany(s.blocks);
  db.plan_targets.insertMany(s.targets);
  print(`${s.plan._id} ${s.plan.name}: ${s.characters.length} character(s), ${s.blocks.length} blocks, ${s.targets.length} targets`);
}
