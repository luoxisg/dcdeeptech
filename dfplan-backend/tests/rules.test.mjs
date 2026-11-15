import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  setDoc,
  updateDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
  runTransaction,
} from "firebase/firestore";
let env;
const ownerEmail = "owner@example.com",
  adminEmail = "admin@example.com";
const claims = (email) => ({
  email,
  email_verified: true,
  firebase: { sign_in_provider: "google.com" },
});
const client = (uid = "owner", email = ownerEmail, extra = {}) =>
  env.authenticatedContext(uid, { ...claims(email), ...extra }).firestore();
const task = {
  id: "WU-01",
  title: "Confirm family contact",
  priority: "P0",
  owner: "Family",
  collaborators: "Coordinator",
  action: "Agree on contacts",
  deliverable: "One-page brief",
  dependency: "",
  weekStart: 1,
  weekEnd: 1,
  status: "待核实",
  due: "",
  completed: "",
  next: "",
  evidence: "",
  accepted: false,
  updatedAt: "",
};
const projectPath = "dfplanProjects/wu-family";
const adminRecord = (
  email,
  displayName = "Admin",
  role = "admin",
  active = true,
) => ({
  email,
  displayName,
  role,
  active,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  createdBy: "owner",
  updatedBy: "owner",
});
async function commit(
  db,
  {
    revision = 1,
    changedTask = { ...task, next: "Made contact" },
    startDate = "",
    includeAudit = true,
  } = {},
) {
  const batch = writeBatch(db);
  batch.update(doc(db, projectPath), {
    startDate,
    revision,
    updatedAt: serverTimestamp(),
    updatedBy: "owner",
  });
  if (changedTask)
    batch.set(doc(db, projectPath + "/tasks/" + changedTask.id), {
      task: changedTask,
      revision,
      updatedAt: serverTimestamp(),
      updatedBy: "owner",
    });
  if (includeAudit)
    batch.set(doc(db, projectPath + "/history/" + revision), {
      revision,
      text: "Updated action",
      textEn: "Updated action",
      actor: "Owner",
      actorEmail: ownerEmail,
      actorUid: "owner",
      createdAt: serverTimestamp(),
    });
  return batch.commit();
}
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-dfplan",
    firestore: {
      host: "127.0.0.1",
      port: 8088,
      rules: await readFile(
        new URL("../firestore.rules", import.meta.url),
        "utf8",
      ),
    },
  });
});
after(async () => {
  await env?.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore(),
      at = Timestamp.now();
    await setDoc(doc(db, "dfplanAdmins/" + ownerEmail), {
      ...adminRecord(ownerEmail, "Owner", "owner"),
      createdAt: at,
      updatedAt: at,
      createdBy: "bootstrap",
      updatedBy: "bootstrap",
    });
    await setDoc(doc(db, "dfplanAdmins/" + adminEmail), {
      ...adminRecord(adminEmail),
      createdAt: at,
      updatedAt: at,
    });
    await setDoc(doc(db, projectPath), {
      startDate: "",
      revision: 0,
      updatedAt: at,
      updatedBy: "bootstrap",
    });
    await setDoc(doc(db, projectPath + "/tasks/WU-01"), {
      task,
      revision: 0,
      updatedAt: at,
      updatedBy: "bootstrap",
    });
  });
});
test("anonymous and unapproved Google accounts cannot read private project data", async () => {
  await assertFails(
    getDoc(doc(env.unauthenticatedContext().firestore(), projectPath)),
  );
  await assertFails(
    getDoc(doc(client("other", "other@example.com"), projectPath)),
  );
  await assertFails(
    getDocs(
      collection(client("other", "other@example.com"), projectPath + "/tasks"),
    ),
  );
});
test("email must be verified and sign-in provider must be Google", async () => {
  await assertFails(
    getDoc(
      doc(client("owner", ownerEmail, { email_verified: false }), projectPath),
    ),
  );
  await assertFails(
    getDoc(
      doc(
        client("owner", ownerEmail, {
          firebase: { sign_in_provider: "password" },
        }),
        projectPath,
      ),
    ),
  );
  await assertSucceeds(getDoc(doc(client(), projectPath)));
});
test("an unapproved user can inspect only their own membership and cannot self-enroll", async () => {
  const db = client("other", "other@example.com");
  assert.equal(
    (
      await assertSucceeds(getDoc(doc(db, "dfplanAdmins/other@example.com")))
    ).exists(),
    false,
  );
  await assertFails(getDoc(doc(db, "dfplanAdmins/" + ownerEmail)));
  await assertFails(
    setDoc(
      doc(db, "dfplanAdmins/other@example.com"),
      adminRecord("other@example.com"),
    ),
  );
});
test("active administrator can add another Google email and owner cannot be disabled", async () => {
  const db = client();
  await assertSucceeds(
    setDoc(
      doc(db, "dfplanAdmins/new@example.com"),
      adminRecord("new@example.com", "New admin"),
    ),
  );
  await assertSucceeds(
    getDoc(doc(client("new", "new@example.com"), projectPath)),
  );
  await assertFails(
    updateDoc(doc(db, "dfplanAdmins/" + ownerEmail), {
      active: false,
      updatedAt: serverTimestamp(),
      updatedBy: "owner",
    }),
  );
  await assertFails(
    setDoc(
      doc(db, "dfplanAdmins/second@example.com"),
      adminRecord("second@example.com", "Second", "owner"),
    ),
  );
});
test("disabled member immediately loses backend access and can be re-enabled", async () => {
  const db = client();
  await assertSucceeds(
    updateDoc(doc(db, "dfplanAdmins/" + adminEmail), {
      active: false,
      updatedAt: serverTimestamp(),
      updatedBy: "owner",
    }),
  );
  await assertFails(getDoc(doc(client("member", adminEmail), projectPath)));
  await assertFails(commit(client("member", adminEmail)));
  await assertSucceeds(
    updateDoc(doc(db, "dfplanAdmins/" + adminEmail), {
      active: true,
      updatedAt: serverTimestamp(),
      updatedBy: "owner",
    }),
  );
  await assertSucceeds(getDoc(doc(client("member", adminEmail), projectPath)));
});
test("project changes require an atomic revision and an immutable actor-stamped audit event", async () => {
  const db = client();
  await assertFails(
    updateDoc(doc(db, projectPath + "/tasks/WU-01"), {
      task: { ...task, next: "Bypass" },
    }),
  );
  await assertFails(commit(db, { includeAudit: false }));
  await assertSucceeds(commit(db));
  assert.equal((await getDoc(doc(db, projectPath))).data().revision, 1);
  await assertFails(
    updateDoc(doc(db, projectPath + "/history/1"), { text: "Rewrite history" }),
  );
});
test("completion needs evidence, family acceptance and a completion date", async () => {
  const db = client(),
    complete = { ...task, status: "已完成" };
  for (const changedTask of [
    complete,
    { ...complete, accepted: true },
    { ...complete, accepted: true, evidence: "Delivered" },
    {
      ...complete,
      accepted: true,
      evidence: " \t\n ",
      completed: "2026-11-15",
    },
  ])
    await assertFails(commit(db, { changedTask }));
  await assertSucceeds(
    commit(db, {
      changedTask: {
        ...complete,
        accepted: true,
        evidence: "Delivered\nReview record 001",
        completed: "2026-11-15",
      },
    }),
  );
});
test("task schema, ID, priority, week range and immutable history are enforced", async () => {
  const db = client();
  for (const changedTask of [
    { ...task, weekEnd: 0 },
    { ...task, weekEnd: 105 },
    { ...task, priority: "P9" },
    { ...task, accepted: "yes" },
    { ...task, unknown: "injected" },
    { ...task, title: "  \t\n " },
  ])
    await assertFails(commit(db, { changedTask }));
  await assertFails(
    setDoc(doc(db, projectPath + "/history/1"), { text: "Forged" }),
  );
});
test("stale writes cannot overwrite another admin revision", async () => {
  const db = client();
  await assertSucceeds(commit(db));
  await assertFails(
    commit(db, { revision: 1, changedTask: { ...task, next: "stale" } }),
  );
  assert.equal(
    (await getDoc(doc(db, projectPath + "/tasks/WU-01"))).data().task.next,
    "Made contact",
  );
});
test("client cannot create a different private project or overwrite public owner identity", async () => {
  const db = client();
  await assertFails(
    setDoc(doc(db, "dfplanProjects/other"), {
      startDate: "",
      revision: 0,
      updatedAt: serverTimestamp(),
      updatedBy: "owner",
    }),
  );
  await assertFails(
    updateDoc(doc(db, "dfplanAdmins/" + ownerEmail), {
      email: "other@example.com",
    }),
  );
});

test("calendar dates are validated by the backend", async () => {
  const db = client();
  await assertFails(commit(db, { startDate: "2026-02-30" }));
  await assertFails(
    commit(db, { changedTask: { ...task, due: "2026-99-99" } }),
  );
  await assertSucceeds(commit(db, { startDate: "2028-02-29" }));
});
