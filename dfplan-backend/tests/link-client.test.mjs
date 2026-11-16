// Exercises the real web client with an in-memory Firebase SDK boundary.
// Firestore authorization is tested separately against the official emulator.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
async function harness({ hash = "", user = null, claimed = false } = {}) {
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
        role: "owner",
        active: true,
      },
    ],
    [
      "dfplanInvites/" + token,
      {
        displayName: "Patrick",
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
  const snap = (r) => ({
    id: r.path.split("/").at(-1),
    exists: () => records.has(r.path),
    data: () => records.get(r.path),
    metadata: { fromCache: false, hasPendingWrites: false },
  });
  const emit = (path) => {
    for (const cb of snapshots.get(path) || [])
      queueMicrotask(() => cb(snap(ref(path))));
  };
  const write = (r, data, merge = false) => {
    records.set(r.path, merge ? { ...records.get(r.path), ...data } : data);
    emit(r.path);
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
  for (const name of ["data.js", "model.mjs"])
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
    errors = [];
  const client = await module.connectBackend(
    (s) => sessions.push(s),
    (p) => projects.push(p),
    (e) => errors.push(e),
  );
  await tick();
  return {
    client,
    records,
    sessions,
    projects,
    errors,
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
  await h.client.save(next, 0, "修改行动", "Updated action");
  await tick();
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
