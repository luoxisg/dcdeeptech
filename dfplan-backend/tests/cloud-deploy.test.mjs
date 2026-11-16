import { test } from "node:test";
import assert from "node:assert/strict";
import { personId } from "../../dfplan/people-model.mjs";
import { readFile } from "node:fs/promises";
import {
  getAuthenticatedEmail,
  validateInputs,
  renderRules,
  createRulesApi,
  deployRules,
  assertOwnerCompatible,
  initializeRecords,
  enableAnonymousAuth,
  createPatrickInvitation,
  parseAssigneeUpdates,
  mergeAssignees,
  syncPeopleFromTasks,
  grantPeopleInvitation,
  parseInitialPeople,
  verifyPeopleInitialization,
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
export class FakeDb {
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
      get: async () => ({
        docs: [...this.records.keys()]
          .filter(
            (k) =>
              k.startsWith(path + "/") &&
              !k.slice(path.length + 1).includes("/"),
          )
          .map((k) => this.snapshot(k)),
      }),
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
      update: (ref, data) => {
        if (!this.records.has(ref.path)) throw Error("Missing document");
        writes.push([
          ref.path,
          {
            ...structuredClone(this.records.get(ref.path)),
            ...structuredClone(data),
          },
        ]);
      },
      create: (ref, data) => {
        if (this.records.has(ref.path) || writes.some(([k]) => k === ref.path))
          throw Error("Already exists");
        writes.push([ref.path, structuredClone(data)]);
      },
    };
    const result = await fn(tx);
    for (const [k, v] of writes) this.records.set(k, v);
    return result;
  }
}
const options = {
  email,
  displayName: "Owner",
  seedTasks,
  serverTimestamp: () => "SERVER_TIME",
};
const owner = { email, displayName: "Owner", role: "owner", active: true };
test("Cloud Shell resolves identity through the deployment token without listing local accounts", async () => {
  let authorized = false;
  const actual = await getAuthenticatedEmail({
    getAccessToken: async () => {
      authorized = true;
      return "temporary-credential";
    },
    fetchImpl: async (url, options) => {
      assert.equal(authorized, true);
      assert.equal(url, "https://www.googleapis.com/oauth2/v2/userinfo");
      assert.equal(
        options.headers.Authorization,
        "Bearer temporary-credential",
      );
      assert.ok(!url.includes("temporary-credential"));
      return new Response(
        JSON.stringify({ email: " Owner@Example.com ", verified_email: true }),
      );
    },
  });
  assert.equal(actual, email);
  assert.equal(
    validateInputs({ ...settings, activeAccount: actual }).email,
    email,
  );
});
test("Cloud Shell rejects denied identity access and unverified or missing emails", async () => {
  for (const response of [
    new Response("denied", { status: 403 }),
    new Response(JSON.stringify({ email, verified_email: false })),
    new Response(JSON.stringify({ verified_email: true })),
  ]) {
    await assert.rejects(
      getAuthenticatedEmail({
        getAccessToken: async () => "temporary-credential",
        fetchImpl: async () => response,
      }),
      /gcloud auth login/,
    );
  }
});
test("Cloud Shell never queries identity when native authorization fails", async () => {
  await assert.rejects(
    getAuthenticatedEmail({
      getAccessToken: async () => {
        throw Error("Authorization cancelled");
      },
      fetchImpl: async () => {
        assert.fail("Must not query identity");
      },
    }),
    /Authorization cancelled/,
  );
});
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
    projectId,
    getAccessToken: async () => "test-token",
    fetchImpl: async (url, request) => {
      observed = { url, request };
      return { ok: true, status: 200, json: async () => ({ name: newName }) };
    },
  });
  await api("POST", prefix + "/rulesets", { source: { files: [] } });
  assert.equal(observed.request.headers.Authorization, "Bearer test-token");
  assert.equal(observed.request.headers["x-goog-user-project"], projectId);
  assert.ok(!observed.url.includes("test-token"));
  assert.ok(!observed.request.body.includes("test-token"));
});
test("rules API reports missing release and authorization failures safely", async () => {
  const missing = createRulesApi({
    projectId,
    getAccessToken: async () => "test-token",
    fetchImpl: async () => ({ status: 404, ok: false, json: async () => ({}) }),
  });
  assert.equal(await missing("GET", "missing", undefined, true), null);
  const denied = createRulesApi({
    projectId,
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
test("Rules reads and publications always identify the quota project", async () => {
  const requests = [];
  const api = createRulesApi({
    projectId,
    getAccessToken: async () => "test-token",
    fetchImpl: async (url, request) => {
      requests.push(request);
      return new Response("{}");
    },
  });
  for (const method of ["GET", "POST", "PATCH"])
    await api(
      method,
      prefix + "/releases/cloud.firestore",
      method === "GET" ? undefined : {},
    );
  assert.equal(requests.length, 3);
  assert.ok(
    requests.every((r) => r.headers["x-goog-user-project"] === projectId),
  );
  for (const invalid of [undefined, "", "../other-project", "wrong\r\nheader"])
    assert.throws(
      () => createRulesApi({ projectId: invalid }),
      /quota project/,
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

test("Patrick setup enables only anonymous sign-in with the correct quota project and verifies it", async () => {
  const calls = [];
  let enabled = false;
  await enableAnonymousAuth({
    projectId,
    getAccessToken: async () => "private-test-token",
    fetchImpl: async (url, request) => {
      calls.push({ url, request });
      assert.equal(request.headers["x-goog-user-project"], projectId);
      assert.equal(request.headers.Authorization, "Bearer private-test-token");
      assert.ok(!url.includes("private-test-token"));
      if (request.method === "PATCH") {
        assert.equal(
          new URL(url).searchParams.get("updateMask"),
          "signIn.anonymous.enabled",
        );
        assert.deepEqual(JSON.parse(request.body), {
          signIn: { anonymous: { enabled: true } },
        });
        enabled = true;
      }
      return new Response(
        JSON.stringify({
          signIn: { anonymous: { enabled }, google: { enabled: true } },
        }),
      );
    },
  });
  assert.deepEqual(
    calls.map((c) => c.request.method),
    ["GET", "PATCH", "GET"],
  );
});
test("already enabled anonymous sign-in does not rewrite the authentication settings", async () => {
  await enableAnonymousAuth({
    projectId,
    getAccessToken: async () => "test",
    fetchImpl: async (url, request) => {
      assert.equal(request.method, "GET");
      return new Response(
        JSON.stringify({ signIn: { anonymous: { enabled: true } } }),
      );
    },
  });
  await assert.rejects(
    enableAnonymousAuth({
      projectId,
      getAccessToken: async () => "test",
      fetchImpl: async () => new Response("denied", { status: 403 }),
    }),
    /403/,
  );
});
test("Patrick invitations are private one-time capabilities with a fixed editor role", async () => {
  let record, path;
  const link = await createPatrickInvitation(
    {
      doc: (p) => {
        path = p;
        return {
          create: async (r) => {
            record = r;
          },
        };
      },
    },
    { serverTimestamp: () => "SERVER_TIME", expiresAt: "EXPIRY" },
  );
  const url = new URL(link),
    token = new URLSearchParams(url.hash.slice(1)).get("invite");
  assert.equal(url.origin, "https://dcdeeptech.com");
  assert.equal(url.pathname, "/dfplan/");
  assert.equal(url.search, "");
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(path, "dfplanInvites/" + token);
  assert.equal(record.claimedBy, "");
  assert.equal(record.role, "editor");
  assert.equal(record.displayName, "Patrick");
  assert.equal(record.canManagePeople, true);
  assert.equal(record.expiresAt, "EXPIRY");
});

const assignmentFixture = () =>
  new FakeDb([
    ["dfplanAdmins/" + email, { ...owner }],
    [
      "dfplanProjects/wu-family",
      { startDate: "2026-11-15", revision: 4, updatedAt: "old" },
    ],
    [
      "dfplanProjects/wu-family/tasks/WU-01",
      {
        task: {
          ...seedTasks[0],
          status: "进行中",
          next: "Saved online progress",
          owner: "Online role",
          updatedAt: "old",
        },
        revision: 4,
      },
    ],
    [
      "dfplanProjects/wu-family/tasks/WU-05",
      { task: { ...seedTasks[4] }, revision: 0 },
    ],
    ["dfplanProjects/wu-family/history/2", { text: "Earlier private history" }],
  ]);
const assignmentOptions = {
  email,
  serverTimestamp: () => "SERVER_TIME",
  now: () => "2026-11-16T00:00:00.000Z",
};
test("private name input validates task IDs and bounded strings before deployment", () => {
  assert.deepEqual(
    parseAssigneeUpdates('{"WU-01":"  Alex Example  ","WU-05":""}'),
    [
      ["WU-01", "Alex Example"],
      ["WU-05", ""],
    ],
  );
  for (const value of [
    "null",
    "[]",
    "{}",
    "not-json",
    '{"../other":"Name"}',
    '{"WU-01":123}',
    JSON.stringify({ "WU-01": "x".repeat(121) }),
  ])
    assert.throws(() => parseAssigneeUpdates(value));
});
test("private assignee merge preserves all online progress, roles, dates and history", async () => {
  const db = assignmentFixture();
  const result = await mergeAssignees(db, {
    ...assignmentOptions,
    assignments: [
      ["WU-01", "Alex Example"],
      ["WU-05", ""],
    ],
  });
  assert.deepEqual(result, { changedTaskCount: 1, revision: 5 });
  const task = db.records.get("dfplanProjects/wu-family/tasks/WU-01").task;
  assert.equal(task.assignee, "Alex Example");
  assert.equal(task.status, "进行中");
  assert.equal(task.next, "Saved online progress");
  assert.equal(task.owner, "Online role");
  assert.equal(task.updatedAt, "old");
  assert.equal(task.assigneeId, await personId("Alex Example"));
  assert.equal(
    db.records.get("dfplanProjects/wu-family").startDate,
    "2026-11-15",
  );
  assert.equal(
    db.records.get("dfplanProjects/wu-family/history/2").text,
    "Earlier private history",
  );
  assert.equal(
    db.records.get("dfplanProjects/wu-family/history/5").actorEmail,
    email,
  );
  assert.equal(
    db.records.get("dfplanProjects/wu-family/tasks/WU-05").revision,
    0,
  );
  const before = JSON.stringify([...db.records]);
  assert.deepEqual(
    await mergeAssignees(db, {
      ...assignmentOptions,
      assignments: [["WU-01", "Alex Example"]],
    }),
    { changedTaskCount: 0, revision: 5 },
  );
  assert.equal(JSON.stringify([...db.records]), before);
});
test("missing tasks or inactive owners stop the whole assignee merge without partial writes", async () => {
  for (const type of ["missing-task", "disabled-owner"]) {
    const db = assignmentFixture();
    if (type === "disabled-owner")
      db.records.get("dfplanAdmins/" + email).active = false;
    const before = JSON.stringify([...db.records]);
    const assignments =
      type === "missing-task"
        ? [
            ["WU-01", "Alex Example"],
            ["WU-99", "New person"],
          ]
        : [["WU-01", "Alex Example"]];
    await assert.rejects(
      mergeAssignees(db, { ...assignmentOptions, assignments }),
    );
    assert.equal(JSON.stringify([...db.records]), before);
  }
});

test("people initialization deduplicates current assignments and never reactivates removed people", async () => {
  const db = assignmentFixture();
  db.records.get("dfplanProjects/wu-family/tasks/WU-01").task.assignee =
    "Alex Example";
  db.records.get("dfplanProjects/wu-family/tasks/WU-05").task.assignee =
    " ALEX   EXAMPLE ";
  const first = await syncPeopleFromTasks(db, {
    email,
    serverTimestamp: () => "SERVER_TIME",
  });
  assert.deepEqual(first, { createdPersonCount: 1, existingPersonCount: 0 });
  const id = await personId("Alex Example"),
    path = "dfplanProjects/wu-family/people/" + id;
  assert.equal(db.records.get(path).displayName, "Alex Example");
  db.records.get(path).active = false;
  assert.deepEqual(
    await syncPeopleFromTasks(db, {
      email,
      serverTimestamp: () => "SERVER_TIME",
    }),
    { createdPersonCount: 0, existingPersonCount: 1 },
  );
  assert.equal(db.records.get(path).active, false);
  assert.equal(db.records.get("dfplanProjects/wu-family").revision, 4);
  assert.equal(
    db.records.get("dfplanProjects/wu-family/tasks/WU-01").task.status,
    "进行中",
  );
});
test("directory initialization refuses an inactive owner without partial writes", async () => {
  const db = assignmentFixture();
  db.records.get("dfplanAdmins/" + email).active = false;
  db.records.get("dfplanProjects/wu-family/tasks/WU-01").task.assignee =
    "Alex Example";
  const before = JSON.stringify([...db.records]);
  await assert.rejects(
    syncPeopleFromTasks(db, { email, serverTimestamp: () => "SERVER_TIME" }),
  );
  assert.equal(JSON.stringify([...db.records]), before);
});

test("a private ten-task mapping atomically creates five people and stable task links, preserving original case and removed records", async () => {
  const names = ["Alex Example", "KT Example", "Ben Example", "Carol Example", "Dana Example"];
  const assignmentNames = [names[0], names[1], names[2], names[3], "", names[4], names[0], names[2], names[0], names[1]];
  const db = new FakeDb([
    ["dfplanAdmins/" + email, { ...owner }],
    ["dfplanProjects/wu-family", { startDate: "2026-11-15", revision: 4 }],
    ...seedTasks.map(task => ["dfplanProjects/wu-family/tasks/" + task.id,
      { task: { ...task, due: "2027-01-01", updatedAt: "original date", evidence: "Existing evidence" }, revision: 4 }]),
    ["dfplanProjects/wu-family/history/2", { text: "Earlier history" }],
  ]);
  const assignments = seedTasks.map((task, i) => [task.id, assignmentNames[i]]);
  await mergeAssignees(db, { ...assignmentOptions, assignments });
  const directory = [...db.records].filter(([path]) => path.includes("/people/"));
  assert.equal(directory.length, 5);
  assert.deepEqual(new Set(directory.map(([, p]) => p.displayName)), new Set(names));
  for (const [id, name] of assignments) {
    const task = db.records.get("dfplanProjects/wu-family/tasks/" + id).task;
    assert.equal(task.assignee || "", name);
    assert.equal(task.assigneeId || "", name ? await personId(name) : "");
    assert.equal(task.due, "2027-01-01");
    assert.equal(task.updatedAt, "original date");
    assert.equal(task.evidence, "Existing evidence");
  }
  assert.equal(db.records.get("dfplanProjects/wu-family/history/2").text, "Earlier history");
  const removed = directory[0][0];
  db.records.get(removed).active = false;
  const before = JSON.stringify([...db.records]);
  const repeated = await mergeAssignees(db, { ...assignmentOptions, assignments });
  assert.equal(repeated.changedTaskCount, 0);
  assert.equal(JSON.stringify([...db.records]), before);
  assert.equal(db.records.get(removed).active, false);
});

test("only a protected owner can grant the explicitly selected existing invitation directory permission", async () => {
  const inviteId = "A".repeat(43), path = "dfplanInvites/" + inviteId;
  const db = new FakeDb([["dfplanAdmins/" + email, { ...owner }],
    [path, { displayName: "Any display label", projectKey: "wu-family", role: "editor", active: true, claimedBy: "device" }]]);
  const options = { email, inviteId, serverTimestamp: () => "SERVER_TIME" };
  assert.deepEqual(await grantPeopleInvitation(db, options), { changed: true });
  assert.equal(db.records.get(path).canManagePeople, true);
  assert.equal(db.records.get(path).claimedBy, "device");
  const before = JSON.stringify([...db.records]);
  assert.deepEqual(await grantPeopleInvitation(db, options), { changed: false });
  assert.equal(JSON.stringify([...db.records]), before);
  db.records.get("dfplanAdmins/" + email).role = "admin";
  await assert.rejects(grantPeopleInvitation(db, options), /protected owner/);
  db.records.get("dfplanAdmins/" + email).role = "owner";
  db.records.get(path).active = false;
  await assert.rejects(grantPeopleInvitation(db, options), /active invitation/);
});

test("private roster initializes responsibilities, preserves removed state and task contents, and verifies server reads", async () => {
  const db = assignmentFixture();
  const initialPeople = parseInitialPeople(JSON.stringify([
    { displayName: "Alex Example", responsibility: "Family representative" },
    { displayName: "Ben Example", responsibility: "Technical lead" },
  ]));
  const assignments = [["WU-01", "Alex Example"], ["WU-05", ""]];
  const removedPath = "dfplanProjects/wu-family/people/" + await personId("Alex Example");
  db.records.set(removedPath, { displayName: "Alex Example", responsibility: "", active: false });
  const original = structuredClone(db.records.get("dfplanProjects/wu-family/tasks/WU-01").task);
  delete original.assignee;
  delete original.assigneeId;
  await mergeAssignees(db, { ...assignmentOptions, assignments, initialPeople });
  assert.equal(db.records.get(removedPath).active, false);
  assert.equal(db.records.get(removedPath).responsibility, "Family representative");
  const { assignee, assigneeId, ...remaining } = db.records.get("dfplanProjects/wu-family/tasks/WU-01").task;
  assert.deepEqual(remaining, original);
  const verification = await verifyPeopleInitialization(db, { assignments, initialPeople, requireExactPeople: true });
  assert.equal(verification.personCount, 2);
  assert.equal(verification.activePersonCount, 1);
  assert.equal(verification.verifiedTaskCount, 2);
  const before = JSON.stringify([...db.records]);
  await mergeAssignees(db, { ...assignmentOptions, assignments, initialPeople });
  assert.equal(JSON.stringify([...db.records]), before);
  db.records.get(removedPath).responsibility = "Wrong";
  await assert.rejects(verifyPeopleInitialization(db, { assignments, initialPeople }), /directory read-back/);
});

test("private roster rejects duplicate/credential data and read failures cannot pass verification", async () => {
  for (const rows of [[], [{ displayName: "Alex", responsibility: "", role: "owner" }],
    [{ displayName: "Alex", responsibility: "" }, { displayName: "ＡＬＥＸ", responsibility: "" }]])
    assert.throws(() => parseInitialPeople(JSON.stringify(rows)));
  const denied = new Error("permission-denied");
  await assert.rejects(verifyPeopleInitialization({ collection: () => ({ get: async () => { throw denied; } }) },
    { assignments: [], initialPeople: [] }), error => error === denied);
  const db = assignmentFixture(), before = JSON.stringify([...db.records]);
  await assert.rejects(mergeAssignees(db, { ...assignmentOptions, assignments: [["WU-01", "Alex Example"]],
    initialPeople: [{ displayName: "Ben Example", responsibility: "Technical lead" }] }), /missing from/);
  assert.equal(JSON.stringify([...db.records]), before);
});
