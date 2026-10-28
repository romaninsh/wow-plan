// Read-only views for the desktop plan pages (table/plan_target_row.yaml,
// table/plan_place_group.yaml, table/plan_bracket_row.yaml, table/plan_character_row.yaml). Run after
// schema.js; the Update guides schema action runs both (mongo/guides.sh <local|prod> schema).
// Only the desktop admin reads these views (the wowplan API reads the collections).
//
// Vantage has no query tables on MongoDB, and dotted columns are joins, so embedded leaves,
// owners and done state are computed here. Dropped and re-created on every run. No data is
// written.
//
// plan_target_rows: one row per target, with
//   place_key / place_name / place_kind  the place lifted out of `place` ("none" / "No place")
//   group_id         "<block_id>|<place_key>": one place group inside one bracket
//   owners           the target's characters, or every character of the plan when it names none
//   who              character names (who = "Everyone" when the target names none)
//   done             the target's own flag: done once for the whole plan (false when absent)
//   group_total / group_done / place_done  the same figures over the target's place group
//   sort_key         bracket order, then place group (by its first target), then target order
db.getCollection("plan_places").drop(); // retired: the To-dos page filters with search and chips
db.getCollection("plan_place_groups").drop();
db.getCollection("plan_target_rows").drop();

const namesOf = (keys) => ({
  $map: {
    input: keys, as: "k",
    in: {
      $let: {
        vars: { c: { $first: { $filter: { input: "$_chars", cond: { $eq: ["$$this.key", "$$k"] } } } } },
        in: { $ifNull: ["$$c.name", "$$k"] },
      },
    },
  },
});
const joined = (arr) => ({
  $reduce: {
    input: arr, initialValue: "",
    in: { $cond: [{ $eq: ["$$value", ""] }, "$$this", { $concat: ["$$value", ", ", "$$this"] }] },
  },
});
const has = (path) => ({ $ne: [{ $type: path }, "missing"] });

db.createView("plan_target_rows", "plan_targets", [
  { $lookup: { from: "plan_characters", localField: "plan_id", foreignField: "plan_id", as: "_chars" } },
  { $lookup: { from: "plan_blocks", localField: "block_id", foreignField: "_id", as: "_block" } },
  { $set: {
      _chars: { $sortArray: { input: "$_chars", sortBy: { order: 1 } } },
      characters: { $ifNull: ["$characters", []] },
      done: { $eq: ["$done", true] },
      block_order: { $ifNull: [{ $first: "$_block.order" }, 0] },
      block_title: { $first: "$_block.title" },
      block_levels: { $concat: [
        { $toString: { $first: "$_block.min_level" } }, "-", { $toString: { $first: "$_block.max_level" } },
      ] },
      ref_name: "$ref.name",
      place_kind: { $switch: { branches: [
        { case: has("$place.zone_id"), then: "zone" },
        { case: has("$place.lfg_dungeon_id"), then: "dungeon" },
        { case: has("$place.area_id"), then: "area" },
      ], default: "none" } },
      place_name: { $ifNull: ["$place.name", "No place"] },
  } },
  { $set: {
      place_key: { $switch: { branches: [
        { case: { $eq: ["$place_kind", "zone"] }, then: { $concat: ["zone:", { $toString: "$place.zone_id" }] } },
        { case: { $eq: ["$place_kind", "dungeon"] }, then: { $concat: ["dungeon:", { $toString: "$place.lfg_dungeon_id" }] } },
        { case: { $eq: ["$place_kind", "area"] }, then: { $concat: ["area:", { $toString: "$place.area_id" }] } },
      ], default: "none" } },
      owners: { $cond: [{ $gt: [{ $size: "$characters" }, 0] }, "$characters", "$_chars.key"] },
  } },
  { $set: {
      group_id: { $concat: ["$block_id", "|", "$place_key"] },
      who: { $cond: [{ $gt: [{ $size: "$characters" }, 0] }, joined(namesOf("$characters")), "Everyone"] },
  } },
  { $setWindowFields: {
      partitionBy: "$group_id",
      output: {
        group_total: { $sum: 1 },
        group_done: { $sum: { $cond: ["$done", 1, 0] } },
        group_first: { $min: { $ifNull: ["$order", 0] } },
      },
  } },
  { $set: {
      place_done: { $eq: ["$group_total", "$group_done"] },
      place_status: { $cond: [{ $eq: ["$group_total", "$group_done"] }, "done", "open"] },
      done_status: { $cond: ["$done", "done", "open"] },
      sort_key: { $add: [
        { $multiply: ["$block_order", 1000000] },
        { $multiply: ["$group_first", 1000] },
        { $ifNull: ["$order", 0] },
      ] },
  } },
  { $project: { _chars: 0, _block: 0 } },
  { $sort: { sort_key: 1 } },
]);

// plan_place_groups: one row per place inside a bracket; status "done" once every target there is
db.createView("plan_place_groups", "plan_target_rows", [
  { $group: {
      _id: "$group_id",
      plan_id: { $first: "$plan_id" },
      block_id: { $first: "$block_id" },
      block_order: { $first: "$block_order" },
      block_title: { $first: "$block_title" },
      block_levels: { $first: "$block_levels" },
      place_key: { $first: "$place_key" },
      place_kind: { $first: "$place_kind" },
      place_name: { $first: "$place_name" },
      targets: { $sum: 1 },
      done_count: { $sum: { $cond: ["$done", 1, 0] } },
      first_order: { $min: { $ifNull: ["$order", 0] } },
  } },
  { $set: {
      status: { $cond: [{ $eq: ["$targets", "$done_count"] }, "done", "open"] },
      progress: { $concat: [{ $toString: "$done_count" }, " of ", { $toString: "$targets" }, " done"] },
      sort_key: { $add: [{ $multiply: ["$block_order", 1000] }, "$first_order"] },
  } },
  { $sort: { sort_key: 1 } },
]);
// plan_bracket_rows: one row per bracket (empty ones too) with its to-do figures, for the plan
// overview's bracket list
db.getCollection("plan_bracket_rows").drop();
db.createView("plan_bracket_rows", "plan_blocks", [
  { $lookup: { from: "plan_target_rows", localField: "_id", foreignField: "block_id", as: "_t" } },
  { $set: {
      levels: { $concat: [{ $toString: "$min_level" }, "-", { $toString: "$max_level" }] },
      todo_count: { $size: "$_t" },
      done_count: { $size: { $filter: { input: "$_t", cond: "$$this.done" } } },
      place_count: { $size: { $setDifference: [{ $setUnion: ["$_t.place_key", []] }, ["none"]] } },
  } },
  { $set: {
      status: { $cond: [{ $and: [{ $gt: ["$todo_count", 0] }, { $eq: ["$todo_count", "$done_count"] }] }, "done", "open"] },
      progress: { $concat: [{ $toString: "$done_count" }, " of ", { $toString: "$todo_count" }, " done"] },
  } },
  { $unset: "_t" },
  { $sort: { plan_id: 1, order: 1 } },
]);
// plan_character_rows: characters with professions and start place as text
db.getCollection("plan_character_rows").drop();
db.createView("plan_character_rows", "plan_characters", [
  { $set: {
      primary_text: joined({ $ifNull: ["$professions.primary.name", []] }),
      secondary_text: joined({ $ifNull: ["$professions.secondary.name", []] }),
      start_name: "$start.name",
  } },
  { $sort: { plan_id: 1, order: 1 } },
]);
print("views: plan_target_rows, plan_place_groups, plan_bracket_rows, plan_character_rows in place");
