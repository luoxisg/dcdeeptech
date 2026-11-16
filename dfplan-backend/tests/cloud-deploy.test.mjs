import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  validateInputs,
  renderRules,
  createRulesApi,
  deployRules,
  assertOwnerCompatible,
  initializeRecords,
} from "../scripts/deploy-core.mjs";
const template = await readFile(
  new URL("../firestore.rules", import.meta.url),
  "utf8",
);
const { seedTasks } = await import(
  "data:text/javascript," +
    encodeURIComponent(
      await readFile(new URL("../../dfplan/data.js", import.meta.url), "utf8"),
    )
);
const email = "owner@example.com",
  projectId = "demo-dfplan",
  prefix = "projects/" + projectId;
const source = renderRules(template, email),
  ruleset = {
    source: { files: [{ name: "firestore.rules", content: source }] },
  },
  newName = prefix + "/rulesets/generated-new-id",
  oldName = prefix + "/rulesets/generated-old-id";
const settings = {
  projectId,
  ownerEmail: email,
  displayName: "Owner",
  activeAccount: email,
};
function apiScenario(previous, failCreate = false) {
  const calls = [];
  let current = previous;
  const api = async (method, path, body) => {
    calls.push({ method, path, body });
    if (method === "GET" && path.endsWith("/releases/cloud.firestore"))
      return current;
    if (method === "GET" && path === oldName)
      return {
        source: { files: [{ name: "firestore.rules", content: "old rules" }] },
      };
    if (method === "GET" && path === newName) return ruleset;
    if (method === "POST" && path.endsWith("/rulesets")) {
      if (failCreate) throw Error("Compilation rejected");
      assert.deepEqual(body, {
        source: { files: [{ name: "firestore.rules", content: source }] },
      });
      return { name: newName };
    }
    if (method === "PATCH") {
      assert.deepEqual(body, {
        release: {
          name: prefix + "/releases/cloud.firestore",
          rulesetName: newName,
        },
      });
      current = body.release;
      return current;
    }
    if (method === "POST" && path.endsWith("/releases")) {
      assert.deepEqual(body, {
        name: prefix + "/releases/cloud.firestore",
        rulesetName: newName,
      });
      current = body;
      return current;
    }
    throw Error("Unexpected Rules API request");
  };
  return { api, calls };
}
class FakeDb {
  constructor(entries = []) {
    this.records = new Map(entries.map(([k, v]) => [k, structuredClone(v)]));
  }
  doc(path) {
    return {
      path,
      collection: (name) => this.collection(path + "/" + name),
      get: async () => this.snapshot(path),
    };
  }
  collection(path) {
    const query = {
      path,
      filters: [],
      count: Infinity,
      doc: (id) => this.doc(path + "/" + id),
      where: (key, op, value) => ({
        ...query,
        filters: [[key, op, value]],
        limit: (n) => ({ ...query, filters: [[key, op, value]], count: n }),
      }),
      limit: (n) => ({ ...query, count: n }),
    };
    return query;
  }
  snapshot(path) {
    const value = this.records.get(path);
    return {
      id: path.split("/").at(-1),
      exists: value !== undefined,
      data: () => structuredClone(value),
    };
  }
  async runTransaction(fn) {
    const writes = [];
    const tx = {
      get: async (ref) => {
        if (!("filters" in ref)) return this.snapshot(ref.path);
        const docs = [...this.records.keys()]
          .filter(
            (k) =>
              k.startsWith(ref.path + "/") &&
              !k.slice(ref.path.length + 1).includes("/"),
          )
          .filter((k) =>
            ref.filters.every(
              ([key, , value]) => this.records.get(k)[key] === value,
            ),
          )
          .slice(0, ref.count)
          .map((k) => this.snapshot(k));
        return { docs };
      },
      create: (ref, data) => {
        if (this.records.has(ref.path) || writes.some(([k]) => k === ref.path))
          throw Error("Already exists");
        writes.push([ref.path, structuredClone(data)]);
      },
    };
    await fn(tx);
    for (const [k, v] of writes) this.records.set(k, v);
  }
}
const options = {
  email,
  displayName: "Owner",
  seedTasks,
  serverTimestamp: () => "SERVER_TIME",
};
const owner = { email, displayName: "Owner", role: "owner", active: true };
test("deployment normalizes the selected account and rejects account mismatch", () => {
  assert.equal(
    validateInputs({ ...settings, ownerEmail: " Owner@Example.com " }).email,
    email,
  );
  assert.throws(
    () => validateInputs({ ...settings, activeAccount: "other@example.com" }),
    /different account/,
  );
});
test("project, owner email and display name cannot inject paths or rule code", () => {
  for (const bad of [
    { projectId: "../wrong" },
    { ownerEmail: "x' || true@example.com" },
    { displayName: "" },
  ])
    assert.throws(() => validateInputs({ ...settings, ...bad }));
  assert.throws(() => renderRules(template, "x' || true@example.com"));
});
test("rendered policy binds exactly one initial owner and keeps default-deny", () => {
  assert.ok(source.includes("email() == 'owner@example.com'"));
  assert.ok(!source.includes("__DFPLAN_INITIAL_OWNER_EMAIL__"));
  assert.ok(
    source.includes("match /{document=**} { allow read,write: if false; }"),
  );
  assert.throws(() =>
    renderRules(
      template.replace("__DFPLAN_INITIAL_OWNER_EMAIL__", "none"),
      email,
    ),
  );
  assert.throws(() =>
    renderRules(template + "\n'__DFPLAN_INITIAL_OWNER_EMAIL__'", email),
  );
});
test("existing release uses verified native PATCH format and opaque ruleset name", async () => {
  const { api, calls } = apiScenario({ rulesetName: oldName });
  const result = await deployRules(api, projectId, source);
  assert.equal(result.rulesetName, newName);
  assert.equal(result.unchanged, false);
  assert.equal(result.sha256.length, 64);
  assert.equal(calls.filter((c) => c.method === "PATCH").length, 1);
});
test("new release uses native create format", async () => {
  const { api, calls } = apiScenario(null);
  await deployRules(api, projectId, source);
  assert.equal(
    calls.filter((c) => c.method === "POST" && c.path.endsWith("/releases"))
      .length,
    1,
  );
  assert.ok(!calls.some((c) => c.method === "PATCH"));
});
test("equivalent deployed source performs no writes", async () => {
  const calls = [];
  const api = async (method, path) => {
    calls.push(method);
    return path.endsWith("/releases/cloud.firestore")
      ? { rulesetName: newName }
      : ruleset;
  };
  assert.equal((await deployRules(api, projectId, source)).unchanged, true);
  assert.deepEqual(calls, ["GET", "GET"]);
});
test("compiler rejection cannot change the active release", async () => {
  const { api, calls } = apiScenario({ rulesetName: oldName }, true);
  await assert.rejects(
    () => deployRules(api, projectId, source),
    /Compilation rejected/,
  );
  assert.ok(
    !calls.some((c) => c.method === "PATCH" || c.path.endsWith("/releases")),
  );
});
test("cross-project ruleset response is rejected before publication", async () => {
  const methods = [];
  const api = async (method) => {
    methods.push(method);
    return method === "GET"
      ? null
      : { name: "projects/other-project/rulesets/generated-id" };
  };
  await assert.rejects(
    () => deployRules(api, projectId, source),
    /unexpected ruleset/,
  );
  assert.deepEqual(methods, ["GET", "POST"]);
});
test("API access token is carried only in the authorization header", async () => {
  let observed;
  const api = createRulesApi({
    getAccessToken: async () => "test-token",
    fetchImpl: async (url, request) => {
      observed = { url, request };
      return { ok: true, status: 200, json: async () => ({ name: newName }) };
    },
  });
  await api("POST", prefix + "/rulesets", { source: { files: [] } });
  assert.equal(observed.request.headers.Authorization, "Bearer test-token");
  assert.ok(!observed.url.includes("test-token"));
  assert.ok(!observed.request.body.includes("test-token"));
});
test("rules API reports missing release and authorization failures safely", async () => {
  const missing = createRulesApi({
    getAccessToken: async () => "test-token",
    fetchImpl: async () => ({ status: 404, ok: false, json: async () => ({}) }),
  });
  assert.equal(await missing("GET", "missing", undefined, true), null);
  const denied = createRulesApi({
    getAccessToken: async () => "test-token",
    fetchImpl: async () => ({
      status: 403,
      ok: false,
      json: async () => ({ error: { message: "Permission denied" } }),
    }),
  });
  await assert.rejects(
    () => denied("POST", "rulesets", {}),
    /Permission denied/,
  );
});
test("fresh initialization atomically creates owner, ten tasks and audit", async () => {
  const db = new FakeDb();
  assert.deepEqual(await initializeRecords(db, options), {
    createdOwner: true,
    createdProject: true,
  });
  assert.equal(db.records.size, 13);
  assert.equal(db.records.get("dfplanAdmins/" + email).role, "owner");
  assert.equal(
    db.records.get("dfplanProjects/wu-family/history/0").actorEmail,
    email,
  );
  assert.equal(
    [...db.records.keys()].filter((k) =>
      k.startsWith("dfplanProjects/wu-family/tasks/"),
    ).length,
    10,
  );
});
test("a repeated initialization preserves all existing private data and history", async () => {
  const db = new FakeDb();
  await initializeRecords(db, options);
  db.records.get("dfplanProjects/wu-family").revision = 7;
  db.records.get("dfplanProjects/wu-family/tasks/WU-01").task.next =
    "Private family progress";
  const before = structuredClone([...db.records]);
  assert.deepEqual(await initializeRecords(db, options), {
    createdOwner: false,
    createdProject: false,
  });
  assert.deepEqual([...db.records], before);
});
test("conflicting or disabled memberships never get overwritten", async () => {
  for (const conflicting of [
    { ...owner, role: "admin" },
    { ...owner, active: false },
    { ...owner, email: "other@example.com" },
  ]) {
    const db = new FakeDb([["dfplanAdmins/" + email, conflicting]]),
      before = structuredClone([...db.records]);
    await assert.rejects(() => initializeRecords(db, options), /conflicts/);
    assert.deepEqual([...db.records], before);
  }
});
test("another initial owner blocks initialization without writes", async () => {
  const db = new FakeDb([
      [
        "dfplanAdmins/other@example.com",
        { ...owner, email: "other@example.com" },
      ],
    ]),
    before = structuredClone([...db.records]);
  await assert.rejects(
    () => initializeRecords(db, options),
    /different initial/,
  );
  assert.deepEqual([...db.records], before);
});
test("orphaned task or history records cannot be silently replaced", async () => {
  for (const path of [
    "dfplanProjects/wu-family/tasks/WU-01",
    "dfplanProjects/wu-family/history/0",
  ]) {
    const db = new FakeDb([[path, { private: "record" }]]),
      before = structuredClone([...db.records]);
    await assert.rejects(() => initializeRecords(db, options), /Orphaned/);
    assert.deepEqual([...db.records], before);
  }
});
