// Exercises the real web client with an in-memory Firebase SDK boundary.
// Firestore authorization is tested separately against the official emulator.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderPeople } from "../../dfplan/people-ui.mjs";
const roster = (session) => renderPeople({ tasks: [] }, [], {
  ready: true, canManage: session.admin?.canManagePeople === true,
}, { s: (zh) => zh, esc: (value) => String(value), icon: () => "" });
const root = new URL("../../dfplan/", import.meta.url);
const { seedTasks } = await import(
  "data:text/javascript," +
    encodeURIComponent(await readFile(new URL("data.js", root), "utf8"))
);
const token = "A".repeat(43),
  project = "dfplanProjects/wu-family";
const tick = async () => {
  for (let i = 0; i < 12; i++) await new Promise((r) => setTimeout(r, 0));
};
let serial = 0;
async function harness({
  hash = "",
  user = null,
  claimed = false,
  directory = false,
  canManagePeople = false,
  googleRole = "owner",
} = {}) {
  const time = (millis = Date.now()) => ({
    toMillis: () => millis,
    toDate: () => new Date(millis),
  });
  const records = new Map([
    [project, { startDate: "", revision: 0, updatedAt: time() }],
    [
      "dfplanAdmins/owner@example.com",
      {
        email: "owner@example.com",
        displayName: "Owner",
        role: googleRole,
        active: true,
      },
    ],
    [
      "dfplanInvites/" + token,
      {
        displayName: "Patrick",
        canManagePeople,
        projectKey: "wu-family",
        role: "editor",
        active: true,
        expiresAt: time(Date.now() + 86400000),
        claimedBy: claimed ? "patrick-device" : "",
        createdAt: time(),
      },
    ],
    ...seedTasks.map((task) => [
      project + "/tasks/" + task.id,
      { task, revision: 0 },
    ]),
  ]);
  if (claimed)
    records.set("dfplanGuests/patrick-device", {
      displayName: "Patrick",
      projectKey: "wu-family",
      role: "editor",
      active: true,
      inviteId: token,
    });
  const snapshots = new Map(),
    authListeners = new Set(),
    auth = { currentUser: user };
  let signIns = 0,
    localPersistence = false;
  const ref = (path) => ({ path });
  const snap = (r) =>
    r.path === project + "/people"
      ? {
          docs: [...records.keys()]
            .filter((p) => p.startsWith(r.path + "/"))
            .map((p) => ({
              id: p.split("/").at(-1),
              data: () => records.get(p),
            })),
          metadata: { fromCache: false, hasPendingWrites: false },
        }
      : {
          id: r.path.split("/").at(-1),
          exists: () => records.has(r.path),
          data: () => records.get(r.path),
          metadata: { fromCache: false, hasPendingWrites: false },
        };
  const emit = (path) => {
    for (const cb of snapshots.get(path) || [])
      queueMicrotask(() => cb(snap(ref(path))));
  };
  const write = (r, data, merge = false) => {
    records.set(r.path, merge ? { ...records.get(r.path), ...data } : data);
    emit(r.path);
    emit(r.path.split("/").slice(0, -1).join("/"));
  };
  const emitAuth = () => {
    for (const cb of authListeners) queueMicrotask(() => cb(auth.currentUser));
  };
  const anonymous = { uid: "patrick-device", email: null, isAnonymous: true };
  const authSdk = {
    getAuth: () => auth,
    browserLocalPersistence: "LOCAL",
    setPersistence: async (a, p) => {
      localPersistence = p === "LOCAL";
    },
    onAuthStateChanged: (a, cb) => {
      authListeners.add(cb);
      queueMicrotask(() => cb(a.currentUser));
    },
    signInAnonymously: async () => {
      signIns++;
      auth.currentUser = anonymous;
      emitAuth();
      return { user: anonymous };
    },
    signOut: async () => {
      auth.currentUser = null;
      emitAuth();
    },
    GoogleAuthProvider: class {
      setCustomParameters() {}
    },
    signInWithPopup: async () => {
      throw Error("Unexpected Google login");
    },
  };
  const dbSdk = {
    initializeFirestore: () => ({}),
    memoryLocalCache: () => ({}),
    doc: (base, ...parts) =>
      ref([base.path, ...parts].filter(Boolean).join("/")),
    collection: (base, ...parts) =>
      ref([base.path, ...parts].filter(Boolean).join("/")),
    query: (r) => r,
    orderBy: () => null,
    limit: () => null,
    serverTimestamp: () => time(),
    Timestamp: { fromMillis: time },
    getDocFromServer: async (r) => snap(r),
    getDocsFromServer: async (r) => ({
      docs: [...records.keys()]
        .filter(
          (p) =>
            p.startsWith(r.path + "/") &&
            !p.slice(r.path.length + 1).includes("/"),
        )
        .map((p) => snap(ref(p))),
    }),
    onSnapshot: (r, options, cb) => {
      const list = snapshots.get(r.path) || new Set();
      list.add(cb);
      snapshots.set(r.path, list);
      queueMicrotask(() => {
        if (list.has(cb)) cb(snap(r));
      });
      return () => list.delete(cb);
    },
    setDoc: async (r, data) => write(r, data),
    updateDoc: async (r, data) => write(r, data, true),
    runTransaction: async (db, cb) => {
      const writes = [];
      await cb({
        get: async (r) => snap(r),
        set: (r, d) => writes.push([r, d, false]),
        update: (r, d) => writes.push([r, d, true]),
      });
      for (const args of writes) write(...args);
    },
  };
  globalThis.__dfplanTestSdk = {
    app: { initializeApp: () => ({}) },
    auth: authSdk,
    firestore: dbSdk,
  };
  globalThis.location = new URL("https://dcdeeptech.com/dfplan/" + hash);
  const initialLocation = location.href;
  globalThis.window = {
    history: {
      replaceState: (a, b, url) => {
        globalThis.location = new URL(url, location.href);
      },
    },
  };
  let source = await readFile(new URL("backend-client.js", root), "utf8");
  for (const name of [
    "data.js",
    "model.mjs",
    "stewardship.mjs",
    "people-model.mjs?v=20261116-people-directory",
  ])
    source = source.replace(
      '"./' + name + '"',
      JSON.stringify(new URL(name, root).href),
    );
  source = source.replace(
    /"\.\/backend-config\.js\?v=[^"]+"/,
    JSON.stringify(
      "data:text/javascript," +
        encodeURIComponent(
          await readFile(new URL("backend-config.js", root), "utf8"),
        ),
    ),
  );
  for (const [file, key] of [
    ["app", "app"],
    ["auth", "auth"],
    ["firestore", "firestore"],
  ])
    source = source.replace(
      'import(base + "firebase-' + file + '.js")',
      "Promise.resolve(globalThis.__dfplanTestSdk." + key + ")",
    );
  const module = await import(
    "data:text/javascript," + encodeURIComponent(source) + "#case" + serial++
  );
  const sessions = [],
    projects = [],
    errors = [],
    peopleEvents = [];
  const client = await module.connectBackend(
    (s) => sessions.push(s),
    (p) => projects.push(p),
    (e) => errors.push(e),
    directory ? (rows) => peopleEvents.push(rows) : null,
  );
  await tick();
  return {
    client,
    records,
    sessions,
    projects,
    errors,
    peopleEvents,
    emit,
    auth,
    signIns: () => signIns,
    persistence: () => localPersistence,
    initialLocation,
  };
}
test("Patrick clicks once to claim, saves with his own audit identity, and revocation clears access", async () => {
  const h = await harness({ hash: "#invite=" + token });
  assert.equal(h.sessions.at(-1).phase, "invited");
  assert.equal(h.records.has("dfplanGuests/patrick-device"), false);
  assert.equal(location.hash, "");
  assert.equal(h.persistence(), true);
  await h.client.loginWithLink();
  await tick();
  assert.equal(h.signIns(), 1);
  assert.equal(h.sessions.at(-1).phase, "ready");
  assert.equal(h.sessions.at(-1).admin.role, "editor");
  assert.equal(
    h.records.get("dfplanInvites/" + token).claimedBy,
    "patrick-device",
  );
  assert.equal(h.projects.at(-1).project.tasks.length, 10);
  const next = structuredClone(h.projects.at(-1).project);
  next.tasks[0].next = "Patrick added a family memory";
  next.tasks[0].assignee = "Alex Example";
  await h.client.save(next, 0, "修改行动", "Updated action");
  await tick();
  assert.equal(
    h.records.get(project + "/tasks/WU-01").task.assignee,
    "Alex Example",
  );
  assert.equal(h.records.get(project + "/history/1").actor, "Patrick");
  assert.equal(h.records.get(project + "/history/1").actorEmail, "");
  await assert.rejects(
    h.client.listAdmins(),
    (e) => e.code === "dfplan/not-admin",
  );
  await assert.rejects(
    h.client.addAdmin("new@example.com", "New"),
    (e) => e.code === "dfplan/not-admin",
  );
  await assert.rejects(
    h.client.createPatrickLink(),
    (e) => e.code === "dfplan/not-admin",
  );
  h.records.get("dfplanInvites/" + token).active = false;
  h.emit("dfplanInvites/" + token);
  await tick();
  assert.equal(h.sessions.at(-1).phase, "denied");
  await assert.rejects(h.client.reload(), (e) => e.code === "dfplan/not-admin");
});
test("the same browser returns directly without reusing the invitation or creating another anonymous user", async () => {
  const h = await harness({
    user: { uid: "patrick-device", email: null, isAnonymous: true },
    claimed: true,
  });
  assert.equal(h.sessions.at(-1).phase, "ready");
  assert.equal(h.signIns(), 0);
  assert.equal(h.projects.at(-1).project.tasks.length, 10);
  assert.equal(h.errors.length, 0);
  await h.client.logout();
  await tick();
  assert.equal(h.sessions.at(-1).phase, "signed-out");
});
test("Google owner access stays available and creates or revokes private Patrick links", async () => {
  const h = await harness({
    user: {
      uid: "owner",
      email: "owner@example.com",
      emailVerified: true,
      isAnonymous: false,
      providerData: [{ providerId: "google.com" }],
    },
  });
  assert.equal(h.sessions.at(-1).admin.role, "owner");
  const link = await h.client.createPatrickLink();
  const newToken = new URLSearchParams(new URL(link).hash.slice(1)).get(
    "invite",
  );
  assert.match(newToken, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(h.records.get("dfplanInvites/" + newToken).role, "editor");
  await h.client.revokeInvite(newToken);
  assert.equal(h.records.get("dfplanInvites/" + newToken).active, false);
  assert.equal((await h.client.listAdmins())[0].role, "owner");
});
test("a used invitation on a different browser does not create a membership or load private records", async () => {
  const h = await harness({ hash: "#invite=" + token });
  h.records.get("dfplanInvites/" + token).claimedBy = "another-device";
  await h.client.loginWithLink();
  await tick();
  assert.equal(h.sessions.at(-1).phase, "denied");
  assert.equal(h.projects.length, 0);
  assert.equal(h.records.has("dfplanGuests/patrick-device"), false);
});

test("editing an older task with an empty assignee preserves its legacy task schema", async () => {
  const h = await harness({
    user: { uid: "patrick-device", email: null, isAnonymous: true },
    claimed: true,
  });
  delete h.records.get(project + "/tasks/WU-01").task.assignee;
  await h.client.reload();
  const next = structuredClone(h.projects.at(-1).project);
  next.tasks[0].next = "A progress edit before the name migration";
  next.tasks[0].assignee = "";
  await h.client.save(next, 0, "Progress", "Progress");
  assert.equal(
    Object.hasOwn(h.records.get(project + "/tasks/WU-01").task, "assignee"),
    false,
  );
});

test("stewardship records survive cloud save and reload without changing progress", async () => {
  const h = await harness({
    user: { uid: "patrick-device", email: null, isAnonymous: true },
    claimed: true,
  });
  const next = structuredClone(h.projects.at(-1).project);
  const original = structuredClone(next.tasks[0]);
  const records = {
    reviewer: "Family reviewer (pending agreement)",
    backup: "Archive custodian (pending agreement)",
    claimedOn: "2026-11-17",
    effort: "1 hour per week (proposal)",
    blockers: "Budget decision pending",
    outcomes: "Controlled register batch-001",
    recovery: "2026-11-17: sample audio restored; record R-001",
  };
  Object.assign(next.tasks[0], records);
  await h.client.save(next, 0, "Planning records", "Planning records");
  await h.client.reload();
  const saved = h.projects.at(-1).project.tasks.find(t => t.id === original.id);
  for (const [key, value] of Object.entries(records)) assert.equal(saved[key], value);
  for (const key of ["status", "accepted", "completed", "evidence", "assignee"])
    assert.equal(saved[key], original[key]);
});

test("an intentional assignee clear is explicit so the backend can distinguish an older client", async () => {
  const h = await harness({
    user: { uid: "patrick-device", email: null, isAnonymous: true },
    claimed: true,
  });
  h.records.get(project + "/tasks/WU-01").task.assignee = "Alex Example";
  await h.client.reload();
  const next = structuredClone(h.projects.at(-1).project);
  next.tasks[0].assignee = "";
  await h.client.save(next, 0, "Clear person", "Clear person");
  assert.equal(
    Object.hasOwn(h.records.get(project + "/tasks/WU-01").task, "assignee"),
    true,
  );
  assert.equal(h.records.get(project + "/tasks/WU-01").task.assignee, "");
});

test("Google owner directory changes stream independently while existing task assignments stay unchanged", async () => {
  const h = await harness({
    directory: true,
    user: {
      uid: "owner",
      email: "owner@example.com",
      emailVerified: true,
      isAnonymous: false,
      providerData: [{ providerId: "google.com" }],
    },
  });
  assert.deepEqual(h.peopleEvents.at(-1), []);
  const before = JSON.stringify(h.records.get(project + "/tasks/WU-01"));
  const id = await h.client.addPerson("Alex Example", "Archives");
  await tick();
  assert.match(id, /^[a-f0-9]{64}$/);
  assert.equal(h.peopleEvents.at(-1)[0].displayName, "Alex Example");
  await assert.rejects(
    h.client.addPerson(" ALEX  Example ", "Other"),
    (e) => e.code === "dfplan/person-exists",
  );
  await h.client.setPersonActive(id, false);
  await tick();
  assert.equal(h.peopleEvents.at(-1)[0].active, false);
  assert.equal(JSON.stringify(h.records.get(project + "/tasks/WU-01")), before);
  await assert.rejects(
    h.client.addPerson("Alex Example", "Other"),
    (e) => e.code === "dfplan/person-removed",
  );
  await h.client.setPersonActive(id, true);
  await tick();
  assert.equal(h.peopleEvents.at(-1)[0].active, true);
  await h.client.logout();
  await tick();
  const count = h.peopleEvents.length;
  h.emit(project + "/people");
  await tick();
  assert.equal(h.peopleEvents.length, count);
});
test("an ordinary invitation named Patrick cannot add, remove or restore personnel through the real client", async () => {
  const h = await harness({
    directory: true,
    user: { uid: "patrick-device", email: null, isAnonymous: true },
    claimed: true,
  });
  assert.deepEqual(await h.client.listPeople(), []);
  assert.equal(h.sessions.at(-1).admin.canManagePeople, false);
  assert.ok(!roster(h.sessions.at(-1)).includes('id="person-form"'));
  await assert.rejects(
    h.client.addPerson("New person", ""),
    (e) => e.code === "dfplan/not-admin",
  );
  await assert.rejects(
    h.client.setPersonActive("a".repeat(64), false),
    (e) => e.code === "dfplan/not-admin",
  );
  await assert.rejects(
    h.client.setPersonActive("a".repeat(64), true),
    (e) => e.code === "dfplan/not-admin",
  );
});

test("authorized Patrick manages people using a protected invitation, without admin or invitation powers", async () => {
  const h = await harness({ directory: true, canManagePeople: true,
    user: { uid: "patrick-device", email: null, isAnonymous: true }, claimed: true });
  assert.equal(h.sessions.at(-1).admin.canManagePeople, true);
  assert.ok(roster(h.sessions.at(-1)).includes('id="person-form"'));
  const id = await h.client.addPerson("Alex Example", "Archives");
  await h.client.setPersonActive(id, false);
  await h.client.setPersonActive(id, true);
  assert.equal(h.records.get(project + "/people/" + id).active, true);
  for (const operation of [() => h.client.listAdmins(), () => h.client.addAdmin("new@example.com", "New"),
    () => h.client.setAdminActive("owner@example.com", false), () => h.client.createPatrickLink(),
    () => h.client.listInvites(), () => h.client.revokeInvite(token)])
    await assert.rejects(operation, e => e.code === "dfplan/not-admin");
  h.records.get("dfplanInvites/" + token).canManagePeople = false;
  h.emit("dfplanInvites/" + token);
  await tick();
  assert.equal(h.sessions.at(-1).phase, "ready");
  assert.equal(h.sessions.at(-1).admin.canManagePeople, false);
  assert.ok(!roster(h.sessions.at(-1)).includes('id="person-form"'));
  await assert.rejects(h.client.addPerson("Other", ""), e => e.code === "dfplan/not-admin");
  await assert.rejects(h.client.setPersonActive(id, false), e => e.code === "dfplan/not-admin");
  // A guest membership field cannot grant the permission back.
  h.records.get("dfplanGuests/patrick-device").canManagePeople = true;
  h.emit("dfplanGuests/patrick-device");
  await tick();
  assert.equal(h.sessions.at(-1).admin.canManagePeople, false);
});

test("an authorized invitation remains effective after a display-name change and loses access on revocation", async () => {
  const h = await harness({ directory: true, canManagePeople: true,
    user: { uid: "patrick-device", email: null, isAnonymous: true }, claimed: true });
  h.records.get("dfplanGuests/patrick-device").displayName = "Different display name";
  h.emit("dfplanGuests/patrick-device");
  await tick();
  const id = await h.client.addPerson("Example", "");
  h.records.get("dfplanInvites/" + token).active = false;
  h.emit("dfplanInvites/" + token);
  await tick();
  assert.equal(h.sessions.at(-1).phase, "denied");
  await assert.rejects(h.client.setPersonActive(id, false), e => e.code === "dfplan/not-admin");
});

test("both Google owner and admin retain all personnel actions and matching page controls", async () => {
  for (const googleRole of ["owner", "admin"]) {
    const h = await harness({ directory: true, googleRole,
      user: { uid: "owner", email: "owner@example.com", emailVerified: true,
        isAnonymous: false, providerData: [{ providerId: "google.com" }] } });
    assert.equal(h.sessions.at(-1).admin.canManagePeople, true);
    assert.ok(roster(h.sessions.at(-1)).includes('id="person-form"'));
    const id = await h.client.addPerson("Google test", "");
    await h.client.setPersonActive(id, false);
    await h.client.setPersonActive(id, true);
    assert.equal(h.records.get(project + "/people/" + id).active, true);
  }
});
