import { test } from "node:test";
import assert from "node:assert/strict";
import { deployWithPreservationCheck } from "../scripts/deploy-rules-only.mjs";

function harness({ live = "old", mutateAfter = false, empty = false } = {}) {
  const state = { release: "projects/demo-dfplan/rulesets/old", writes: [], reads: 0 };
  const db = { collection(name) { return { async get() {
    state.reads++;
    const changed = mutateAfter && state.reads > 7;
    return { docs: empty ? [] : [{ id: "private-reference", data: () => ({ active: true, value: changed ? 2 : 1 }) }] };
  } }; } };
  const api = async (method, path, body) => {
    if (method === "GET" && path.endsWith("releases/cloud.firestore")) return { rulesetName: state.release };
    if (method === "GET") return { source: { files: [{ name: "firestore.rules", content: path.endsWith("/old") ? live : "new" }] } };
    state.writes.push({ method, path, body });
    if (method === "POST") return { name: "projects/demo-dfplan/rulesets/new" };
    if (method === "PATCH") { state.release = body.release.rulesetName; return body.release; }
    throw Error("Unexpected request");
  };
  return { state, args: { db, api, projectId: "demo-dfplan", source: "new", baseline: "old" } };
}

test("rules-only deployment hashes every data group and writes only rules management resources", async () => {
  const { state, args } = harness();
  const result = await deployWithPreservationCheck(args);
  assert.equal(result.recordsUnchanged, true);
  assert.equal(result.status, "DFPLAN_RULES_ONLY_VERIFIED");
  assert.equal(Object.keys(result.counts).length, 7);
  assert.equal(state.reads, 14);
  assert.equal(state.writes.length, 2);
  assert.ok(state.writes.every(row => /\/rulesets$|\/releases\/cloud.firestore$/.test(row.path)));
  assert.ok(!JSON.stringify(result).includes("private-reference"));
});

test("unreviewed live policy and an uninitialized plan stop before any writes", async () => {
  for (const options of [{ live: "unexpected policy" }, { empty: true }]) {
    const { state, args } = harness(options);
    await assert.rejects(deployWithPreservationCheck(args));
    assert.equal(state.writes.length, 0);
  }
});

test("concurrent record edits never produce an unchanged-data assertion", async () => {
  const { args } = harness({ mutateAfter: true });
  await assert.rejects(deployWithPreservationCheck(args), /concurrent data changes/);
});
