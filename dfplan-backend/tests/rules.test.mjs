import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { personId } from "../../dfplan/people-model.mjs";
import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  deleteDoc,
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
const testPersonId = await personId("Alex Example");
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
      rules: (
        await readFile(new URL("../firestore.rules", import.meta.url), "utf8")
      ).replaceAll("__DFPLAN_INITIAL_OWNER_EMAIL__", ownerEmail),
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

async function clearProject() {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await deleteDoc(doc(db, projectPath + "/tasks/WU-01"));
    await deleteDoc(doc(db, projectPath));
  });
}
function initializeProject(
  db,
  uid = "owner",
  email = ownerEmail,
  includeAudit = true,
) {
  const batch = writeBatch(db),
    at = serverTimestamp();
  batch.set(doc(db, projectPath), {
    startDate: "",
    revision: 0,
    updatedAt: at,
    updatedBy: uid,
  });
  batch.set(doc(db, projectPath + "/tasks/WU-01"), {
    task,
    revision: 0,
    updatedAt: at,
    updatedBy: uid,
  });
  if (includeAudit)
    batch.set(doc(db, projectPath + "/history/0"), {
      revision: 0,
      text: "Initialize",
      textEn: "Initialize",
      actor: "Owner",
      actorEmail: email,
      actorUid: uid,
      createdAt: at,
    });
  return batch.commit();
}
test("only the protected initial owner can bootstrap the fixed project once, with an audit record", async () => {
  await clearProject();
  await assertFails(
    initializeProject(client("member", adminEmail), "member", adminEmail),
  );
  await assertFails(initializeProject(client(), "owner", ownerEmail, false));
  await assertSucceeds(initializeProject(client()));
  await assertFails(initializeProject(client()));
  assert.equal((await getDoc(doc(client(), projectPath))).data().revision, 0);
});

test("owner can atomically initialize all ten actions with one backend audit record", async () => {
  await clearProject();
  const db = client(),
    batch = writeBatch(db),
    at = serverTimestamp();
  batch.set(doc(db, projectPath), {
    startDate: "",
    revision: 0,
    updatedAt: at,
    updatedBy: "owner",
  });
  for (let i = 1; i <= 10; i++) {
    const id = "WU-" + String(i).padStart(2, "0");
    batch.set(doc(db, projectPath + "/tasks/" + id), {
      task: { ...task, id },
      revision: 0,
      updatedAt: at,
      updatedBy: "owner",
    });
  }
  batch.set(doc(db, projectPath + "/history/0"), {
    revision: 0,
    text: "Initialize",
    textEn: "Initialize",
    actor: "Owner",
    actorEmail: ownerEmail,
    actorUid: "owner",
    createdAt: at,
  });
  await assertSucceeds(batch.commit());
  assert.equal(
    (await getDocs(collection(db, projectPath + "/tasks"))).size,
    10,
  );
});

test("only the configured verified Google account can claim the initial owner once", async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await deleteDoc(doc(c.firestore(), "dfplanAdmins/" + ownerEmail));
  });
  const record = adminRecord(ownerEmail, "Initial owner", "owner");
  await assertFails(
    setDoc(
      doc(
        client("outsider", "outsider@example.com"),
        "dfplanAdmins/outsider@example.com",
      ),
      {
        ...adminRecord("outsider@example.com", "Impostor", "owner"),
        createdBy: "outsider",
        updatedBy: "outsider",
      },
    ),
  );
  await assertFails(
    setDoc(
      doc(
        client("owner", ownerEmail, { email_verified: false }),
        "dfplanAdmins/" + ownerEmail,
      ),
      record,
    ),
  );
  await assertFails(
    setDoc(
      doc(
        client("owner", ownerEmail, {
          firebase: { sign_in_provider: "password" },
        }),
        "dfplanAdmins/" + ownerEmail,
      ),
      record,
    ),
  );
  await assertSucceeds(
    setDoc(doc(client(), "dfplanAdmins/" + ownerEmail), record),
  );
  await assertFails(
    setDoc(doc(client(), "dfplanAdmins/" + ownerEmail), record),
  );
});

const inviteId = "A".repeat(43);
const anonymous = (uid = "patrick-device") =>
  env
    .authenticatedContext(uid, { firebase: { sign_in_provider: "anonymous" } })
    .firestore();
const invitation = (overrides = {}) => ({
  displayName: "Patrick",
  projectKey: "wu-family",
  role: "editor",
  active: true,
  expiresAt: Timestamp.fromMillis(Date.now() + 86400000),
  claimedBy: "",
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  createdBy: "owner",
  updatedBy: "owner",
  ...overrides,
});
async function issueInvite(overrides = {}) {
  await assertSucceeds(
    setDoc(doc(client(), "dfplanInvites/" + inviteId), invitation(overrides)),
  );
}
function redeem(db, uid = "patrick-device", overrides = {}) {
  const batch = writeBatch(db),
    at = serverTimestamp();
  batch.set(doc(db, "dfplanGuests/" + uid), {
    uid,
    displayName: "Patrick",
    projectKey: "wu-family",
    role: "editor",
    active: true,
    inviteId,
    createdAt: at,
    updatedAt: at,
    createdBy: uid,
    updatedBy: uid,
    ...overrides,
  });
  batch.update(doc(db, "dfplanInvites/" + inviteId), {
    claimedBy: uid,
    updatedAt: at,
    updatedBy: uid,
  });
  return batch.commit();
}
function guestCommit(
  db,
  {
    actor = "Patrick",
    actorEmail = "",
    accepted = false,
    assignee,
    assigneeId,
  } = {},
) {
  const uid = "patrick-device",
    batch = writeBatch(db),
    at = serverTimestamp();
  batch.update(doc(db, projectPath), {
    startDate: "",
    revision: 1,
    updatedAt: at,
    updatedBy: uid,
  });
  batch.set(doc(db, projectPath + "/tasks/WU-01"), {
    task: {
      ...task,
      next: "Patrick updated the shared action",
      ...(assignee !== undefined ? { assignee } : {}),
      ...(assigneeId !== undefined ? { assigneeId } : {}),
      status: accepted ? "已完成" : "进行中",
    },
    revision: 1,
    updatedAt: at,
    updatedBy: uid,
  });
  batch.set(doc(db, projectPath + "/history/1"), {
    revision: 1,
    text: "Update",
    textEn: "Update",
    actor,
    actorEmail,
    actorUid: uid,
    createdAt: at,
  });
  return batch.commit();
}
test("only the owner can issue a bounded one-time Patrick invitation", async () => {
  await assertFails(
    setDoc(
      doc(client("member", adminEmail), "dfplanInvites/" + inviteId),
      invitation(),
    ),
  );
  await assertFails(
    setDoc(doc(anonymous(), "dfplanInvites/" + inviteId), invitation()),
  );
  await assertFails(
    setDoc(
      doc(client(), "dfplanInvites/" + inviteId),
      invitation({ role: "admin" }),
    ),
  );
  await assertFails(
    setDoc(
      doc(client(), "dfplanInvites/" + inviteId),
      invitation({
        expiresAt: Timestamp.fromMillis(Date.now() + 8 * 86400000),
      }),
    ),
  );
  await issueInvite();
  await assertSucceeds(getDoc(doc(anonymous(), "dfplanInvites/" + inviteId)));
  await assertFails(getDocs(collection(anonymous(), "dfplanInvites")));
  await assertFails(
    getDoc(
      doc(
        env.unauthenticatedContext().firestore(),
        "dfplanInvites/" + inviteId,
      ),
    ),
  );
  await assertFails(getDoc(doc(anonymous(), projectPath)));
});
test("one-time invitation binds to one anonymous device and permits audited edits", async () => {
  await issueInvite();
  const db = anonymous();
  await assertSucceeds(redeem(db));
  await assertSucceeds(getDoc(doc(db, projectPath)));
  await assertSucceeds(getDocs(collection(db, projectPath + "/tasks")));
  await assertSucceeds(guestCommit(db));
  await assertFails(redeem(anonymous("other-device"), "other-device"));
  await assertFails(getDoc(doc(anonymous("other-device"), projectPath)));
  await assertFails(getDocs(collection(db, "dfplanAdmins")));
  await assertFails(
    setDoc(
      doc(db, "dfplanAdmins/patrick@example.com"),
      adminRecord("patrick@example.com"),
    ),
  );
  await assertFails(getDoc(doc(db, "dfplanProjects/other")));
  await assertFails(
    updateDoc(doc(db, "dfplanGuests/patrick-device"), {
      active: true,
      role: "admin",
    }),
  );
});
test("invitation requires atomic claim and cannot elevate identity or role", async () => {
  await issueInvite();
  const db = anonymous();
  await assertFails(
    updateDoc(doc(db, "dfplanInvites/" + inviteId), {
      claimedBy: "patrick-device",
      updatedAt: serverTimestamp(),
      updatedBy: "patrick-device",
    }),
  );
  await assertFails(redeem(db, "patrick-device", { displayName: "Owner" }));
  await assertFails(redeem(db, "patrick-device", { role: "admin" }));
  await assertFails(redeem(db, "patrick-device", { projectKey: "other" }));
  await assertFails(redeem(client(), "owner"));
  await assertSucceeds(redeem(db));
  await assertFails(guestCommit(db, { actor: "Owner" }));
  await assertFails(guestCommit(db, { actorEmail: ownerEmail }));
  await assertFails(guestCommit(db, { accepted: true }));
});
test("revoking Patrick's invitation immediately denies existing-device reads and writes", async () => {
  await issueInvite();
  const db = anonymous();
  await assertSucceeds(redeem(db));
  await assertFails(
    updateDoc(doc(db, "dfplanInvites/" + inviteId), {
      active: false,
      updatedAt: serverTimestamp(),
      updatedBy: "patrick-device",
    }),
  );
  await assertSucceeds(
    updateDoc(doc(client(), "dfplanInvites/" + inviteId), {
      active: false,
      updatedAt: serverTimestamp(),
      updatedBy: "owner",
    }),
  );
  await assertFails(getDoc(doc(db, projectPath)));
  await assertFails(guestCommit(db));
  // The device can still observe the revoked invite to clear its private UI.
  await assertSucceeds(getDoc(doc(db, "dfplanInvites/" + inviteId)));
});
test("expired or disabled invitations cannot be redeemed", async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(
      doc(c.firestore(), "dfplanInvites/" + inviteId),
      invitation({ expiresAt: Timestamp.fromMillis(Date.now() - 10000) }),
    );
  });
  await assertFails(redeem(anonymous()));
  await env.withSecurityRulesDisabled(async (c) => {
    await updateDoc(doc(c.firestore(), "dfplanInvites/" + inviteId), {
      expiresAt: Timestamp.fromMillis(Date.now() + 86400000),
      active: false,
    });
  });
  await assertFails(redeem(anonymous()));
});

test("two devices racing for one invitation cannot both receive access", async () => {
  await issueInvite();
  const attempts = await Promise.allSettled([
    redeem(anonymous("device-one"), "device-one"),
    redeem(anonymous("device-two"), "device-two"),
  ]);
  assert.equal(attempts.filter((a) => a.status === "fulfilled").length, 1);
  assert.equal(attempts.filter((a) => a.status === "rejected").length, 1);
});
test("activation expiry does not remove an already bound device, while other membership stays private", async () => {
  await issueInvite();
  const db = anonymous();
  await assertSucceeds(redeem(db));
  await env.withSecurityRulesDisabled(async (c) => {
    await updateDoc(doc(c.firestore(), "dfplanInvites/" + inviteId), {
      expiresAt: Timestamp.fromMillis(Date.now() - 10000),
    });
  });
  await assertSucceeds(getDoc(doc(db, projectPath)));
  await assertFails(
    getDoc(doc(anonymous("other-device"), "dfplanGuests/patrick-device")),
  );
  await assertFails(getDocs(collection(db, "dfplanGuests")));
});

test("optional assignee names are writable without changing responsibility, and invalid names are rejected", async () => {
  const db = client();
  await addTestPerson();
  await assertFails(
    commit(db, { changedTask: { ...task, assignee: { name: "Invalid" } } }),
  );
  await assertFails(
    commit(db, { changedTask: { ...task, assignee: "x".repeat(121) } }),
  );
  await assertSucceeds(
    commit(db, {
      changedTask: {
        ...task,
        assignee: "Alex Example",
        assigneeId: testPersonId,
      },
    }),
  );
  const saved = (await getDoc(doc(db, projectPath + "/tasks/WU-01"))).data()
    .task;
  assert.equal(saved.assignee, "Alex Example");
  assert.equal(saved.owner, task.owner);
});
test("an invited Patrick device can update named assignees under the same project rules", async () => {
  await issueInvite();
  await addTestPerson();
  const db = anonymous();
  await assertSucceeds(redeem(db));
  await assertSucceeds(
    guestCommit(db, { assignee: "Alex Example", assigneeId: testPersonId }),
  );
  assert.equal(
    (await getDoc(doc(db, projectPath + "/tasks/WU-01"))).data().task.assignee,
    "Alex Example",
  );
});

test("older clients cannot drop an imported assignee while an explicit clear remains possible", async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await updateDoc(doc(c.firestore(), projectPath + "/tasks/WU-01"), {
      task: { ...task, assignee: "Alex Example" },
    });
  });
  const db = client();
  await assertFails(
    commit(db, { changedTask: { ...task, next: "Old page editing progress" } }),
  );
  await assertSucceeds(commit(db, { changedTask: { ...task, assignee: "" } }));
  assert.equal(
    (await getDoc(doc(db, projectPath + "/tasks/WU-01"))).data().task.assignee,
    "",
  );
});

function testPerson(uid = "owner") {
  return {
    displayName: "Alex Example",
    nameKey: "alex example",
    responsibility: "Archives",
    active: true,
    createdAt: serverTimestamp(),
    createdBy: uid,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  };
}
async function addTestPerson() {
  await assertSucceeds(
    setDoc(
      doc(client(), projectPath + "/people/" + testPersonId),
      testPerson(),
    ),
  );
}
test("only active Google administrators can add, remove and restore directory people", async () => {
  await issueInvite();
  const guest = anonymous();
  await assertSucceeds(redeem(guest));
  await assertFails(
    setDoc(
      doc(guest, projectPath + "/people/" + testPersonId),
      testPerson("patrick-device"),
    ),
  );
  await assertFails(
    setDoc(
      doc(
        env.unauthenticatedContext().firestore(),
        projectPath + "/people/" + testPersonId,
      ),
      testPerson(),
    ),
  );
  const admin = client("member", adminEmail);
  await assertSucceeds(
    setDoc(
      doc(admin, projectPath + "/people/" + testPersonId),
      testPerson("member"),
    ),
  );
  await assertSucceeds(getDocs(collection(guest, projectPath + "/people")));
  await assertFails(
    updateDoc(doc(guest, projectPath + "/people/" + testPersonId), {
      active: false,
      updatedAt: serverTimestamp(),
      updatedBy: "patrick-device",
    }),
  );
  await assertSucceeds(
    updateDoc(doc(admin, projectPath + "/people/" + testPersonId), {
      active: false,
      updatedAt: serverTimestamp(),
      updatedBy: "member",
    }),
  );
  await assertSucceeds(
    updateDoc(doc(client(), projectPath + "/people/" + testPersonId), {
      active: true,
      updatedAt: serverTimestamp(),
      updatedBy: "owner",
    }),
  );
  await assertFails(
    deleteDoc(doc(client(), projectPath + "/people/" + testPersonId)),
  );
  await assertFails(
    getDoc(doc(client("alex", "alex@example.com"), projectPath)),
  );
});
test("directory records reject credential fields and immutable identity edits", async () => {
  await assertFails(
    setDoc(doc(client(), projectPath + "/people/" + testPersonId), {
      ...testPerson(),
      role: "owner",
    }),
  );
  await assertFails(
    setDoc(doc(client(), projectPath + "/people/" + testPersonId), {
      ...testPerson(),
      displayName: " ".repeat(3),
    }),
  );
  await addTestPerson();
  await assertFails(
    updateDoc(doc(client(), projectPath + "/people/" + testPersonId), {
      displayName: "Someone else",
      updatedAt: serverTimestamp(),
      updatedBy: "owner",
    }),
  );
  await assertFails(
    updateDoc(doc(client(), projectPath + "/people/" + testPersonId), {
      nameKey: "owner",
      updatedAt: serverTimestamp(),
      updatedBy: "owner",
    }),
  );
});
test("new assignments require an active directory person, while removed people's old assignments survive", async () => {
  await addTestPerson();
  const db = client();
  await assertFails(
    commit(db, { changedTask: { ...task, assignee: "Unregistered person" } }),
  );
  await assertFails(
    commit(db, {
      changedTask: {
        ...task,
        assignee: "Other name",
        assigneeId: testPersonId,
      },
    }),
  );
  await assertSucceeds(
    updateDoc(doc(db, projectPath + "/people/" + testPersonId), {
      active: false,
      updatedAt: serverTimestamp(),
      updatedBy: "owner",
    }),
  );
  await assertFails(
    commit(db, {
      changedTask: {
        ...task,
        assignee: "Alex Example",
        assigneeId: testPersonId,
      },
    }),
  );
  await env.withSecurityRulesDisabled(async (c) => {
    await updateDoc(doc(c.firestore(), projectPath + "/tasks/WU-01"), {
      task: { ...task, assignee: "Alex Example", assigneeId: testPersonId },
    });
  });
  await assertSucceeds(
    commit(db, {
      changedTask: {
        ...task,
        assignee: "Alex Example",
        assigneeId: testPersonId,
        next: "Keep historical assignment",
      },
    }),
  );
});
