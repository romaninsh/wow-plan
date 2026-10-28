// wow-plan guides: collections, validation and indexes for database `wowplan`.
// Idempotent: run it again after editing to update validators and add indexes.
//   mongosh "mongodb://localhost:<port>/wowplan?directConnection=true" --file mongo/schema.js
//
// Model (draft): one plan, 1-2 characters, level-range blocks, targets inside blocks.
// Every reference to game data is a Blizzard ID (the Postgres `wow` schema) plus a small
// snapshot (`name`, sometimes `quality`) so a target still reads well if the item is renamed or
// removed in a later build. Validation checks what must be there and lets anything else in:
// guides will grow (role preferences, level-60 profession choices) without migrations.

const PLAN_ID = "^[0-9A-Za-z]{7}$"; // short share id: 7 random base62 characters

const TARGET_KINDS = [
  "travel_to_zone",          // ref.zone_id (or ref.area_id for a town or hub); place = the same
  "acquire_item",            // ref.item_id, count
  "complete_quest",          // ref.quest_id when the quest is in the data, else title only
  "reach_profession_level",  // ref.skill_line_id, level
  "craft_item",              // ref.item_id (+ ref.recipe_spell_id), count, purpose
  "run_dungeon",             // ref.lfg_dungeon_id; place = the same dungeon
  "reach_level",             // level (character level)
  "note",                    // free text, no reference
];

const ref = {
  bsonType: "object",
  description: "game data reference: Blizzard id field(s) plus a name snapshot",
  properties: {
    name: { bsonType: "string" },
    item_id: { bsonType: ["int", "long"] },
    zone_id: { bsonType: ["int", "long"] },
    area_id: { bsonType: ["int", "long"] },
    quest_id: { bsonType: ["int", "long"] },
    skill_line_id: { bsonType: ["int", "long"] },
    recipe_spell_id: { bsonType: ["int", "long"] },
    lfg_dungeon_id: { bsonType: ["int", "long"] },
    quality: { bsonType: ["int", "long"] },
  },
};

// Where a target is done: always a game reference, never free text. Exactly one of zone_id,
// lfg_dungeon_id or area_id, plus a name snapshot; null or absent = no place. Pages group a
// block's targets by place; a place is done once all its targets are.
const ID = { bsonType: ["int", "long"] };
const placeOf = (field) => ({
  bsonType: "object", required: [field, "name"], additionalProperties: false,
  properties: { [field]: ID, name: { bsonType: "string", minLength: 1 } },
});
const place = {
  description: "zone, dungeon or area the target is done in (id + name snapshot), or null",
  oneOf: [{ bsonType: "null" }, placeOf("zone_id"), placeOf("lfg_dungeon_id"), placeOf("area_id")],
};

const collections = {
  plans: {
    required: ["_id", "name", "game_build", "created_at"],
    properties: {
      _id: { bsonType: "string", pattern: PLAN_ID },
      name: { bsonType: "string", minLength: 1, maxLength: 120 },
      description: { bsonType: ["string", "null"] },
      game_build: { bsonType: "string", description: "client build the plan was made against" },
      forked_from: { bsonType: ["string", "null"], description: "plan this one was cloned from" },
      side: { enum: ["Alliance", "Horde"], description: "every character's side (one per plan)" },
      edit_code_hash: {
        bsonType: "string", pattern: "^[0-9a-f]{64}$",
        description: "SHA-256 hex of the edit code (Vantage hash_secret); the code itself is never stored",
      },
      // edit codes are 4 characters from generate_password(4) (create_plan, rotate_edit_key);
      // plans made before 2026-10-28 keep their 12-character codes, which still work

      // Vantage action bodies write now() as RFC 3339 text; the seed writes BSON dates
      created_at: { bsonType: ["date", "string"] },
      updated_at: { bsonType: ["date", "string", "null"] },
    },
    indexes: [
      [{ forked_from: 1 }, { name: "forked_from" }],
      [{ created_at: -1 }, { name: "created_at" }],
    ],
  },

  plan_characters: {
    required: ["_id", "plan_id", "key", "name", "race_id", "class_id"],
    properties: {
      _id: { bsonType: "string", description: "<plan_id>.<key>" },
      plan_id: { bsonType: "string", pattern: PLAN_ID },
      key: { bsonType: "string", pattern: "^[a-z0-9_]{1,20}$", description: "short handle targets use" },
      order: { bsonType: ["int", "long"] },
      name: { bsonType: "string", minLength: 1, maxLength: 40 },
      race_id: { bsonType: ["int", "long"] },
      race_name: { bsonType: "string" },
      class_id: { bsonType: ["int", "long"] },
      class_name: { bsonType: "string" },
      professions: {
        bsonType: "object",
        properties: {
          primary: { bsonType: "array", maxItems: 2, items: ref },
          secondary: { bsonType: "array", items: ref },
        },
      },
      start: { ...ref, description: "where the character starts (area or zone)" },
      notes: { bsonType: ["string", "null"] },
    },
    indexes: [
      [{ plan_id: 1, key: 1 }, { name: "plan_key", unique: true }],
      [{ class_id: 1 }, { name: "class_id" }],
    ],
  },

  plan_blocks: {
    required: ["_id", "plan_id", "order", "min_level", "max_level"],
    properties: {
      _id: { bsonType: "string", description: "<plan_id>.b<n>" },
      plan_id: { bsonType: "string", pattern: PLAN_ID },
      order: { bsonType: ["int", "long"] },
      title: { bsonType: ["string", "null"] },
      min_level: { bsonType: ["int", "long"], minimum: 1, maximum: 60 },
      max_level: { bsonType: ["int", "long"], minimum: 1, maximum: 60 },
      zones: { bsonType: "array", items: ref },
      notes: { bsonType: ["string", "null"] },
    },
    indexes: [[{ plan_id: 1, order: 1 }, { name: "plan_order", unique: true }]],
  },

  plan_targets: {
    required: ["_id", "plan_id", "block_id", "kind", "title"],
    properties: {
      _id: { bsonType: "string", description: "<plan_id>.t<nnn>" },
      plan_id: { bsonType: "string", pattern: PLAN_ID },
      block_id: { bsonType: "string" },
      order: { bsonType: ["int", "long"] },
      kind: { enum: TARGET_KINDS },
      title: { bsonType: "string", minLength: 1, maxLength: 200 },
      characters: { bsonType: "array", items: { bsonType: "string" }, description: "character keys; empty = everyone" },
      ref: ref,
      place: place,
      place_key: {
        bsonType: "string", pattern: "^(none|(zone|dungeon|area):[0-9]+)$",
        description: "the place as one flat value (dungeon:7, zone:14, area:159, none), kept in step with place; pages filter on it",
      },
      count: { bsonType: ["int", "long"], minimum: 1 },
      level: { bsonType: ["int", "long"], minimum: 1, maximum: 300 },
      purpose: { enum: ["sell", "use", "give", null] },
      for_character: { bsonType: ["string", "null"], description: "character key a crafted item is for" },
      done: {
        bsonType: "bool",
        description: "done once for the whole plan, whoever it is for (the page can't know who is looking)",
      },
      done_at: { bsonType: ["date", "string", "null"], description: "when it was ticked done" },
      notes: { bsonType: ["string", "null"] },
    },
    // Grouping by place runs over one block's targets (tens of documents), which
    // plan_block_order already finds; no index of its own.
    indexes: [
      [{ plan_id: 1, block_id: 1, order: 1 }, { name: "plan_block_order" }],
      [{ kind: 1 }, { name: "kind" }],
      [{ "ref.item_id": 1 }, { name: "ref_item_id", sparse: true }],
    ],
  },
};

const existing = new Set(db.getCollectionNames());
for (const [name, spec] of Object.entries(collections)) {
  const validator = {
    $jsonSchema: { bsonType: "object", required: spec.required, properties: spec.properties },
  };
  if (existing.has(name)) {
    db.runCommand({ collMod: name, validator, validationLevel: "strict", validationAction: "error" });
  } else {
    db.createCollection(name, { validator, validationLevel: "strict", validationAction: "error" });
  }
  for (const [keys, options] of spec.indexes) db.getCollection(name).createIndex(keys, options);
  print(`${name}: validator and ${spec.indexes.length} index(es) in place`);
}

// The desktop's read-only views (plan_target_rows, plan_place_groups, plan_character_rows) are in
// mongo/views.js, applied with this file by the Update guides schema action (mongo/guides.sh).
