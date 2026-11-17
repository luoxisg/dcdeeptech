import {
  normalizePersonName,
  personId,
  validatePersonName,
} from "./people-model.mjs?v=20261116-people-directory";
import { seedTasks } from "./data.js";
import { backendConfig } from "./backend-config.js?v=20261116-people-directory";
import { validateProject } from "./model.mjs";
import { stewardshipFields } from "./stewardship.mjs";

export const cloudEnabled = backendConfig.enabled === true;
const codeError = (code) => Object.assign(new Error(code), { code });
const taskFields = [
  ...stewardshipFields.map(([key]) => key),
  "id",
  "title",
  "titleEn",
  "priority",
  "owner",
  "ownerEn",
  "assignee",
  "assigneeId",
  "collaborators",
  "collaboratorsEn",
  "action",
  "actionEn",
  "deliverable",
  "deliverableEn",
  "dependency",
  "dependencyEn",
  "weekStart",
  "weekEnd",
  "status",
  "due",
  "completed",
  "next",
  "evidence",
  "accepted",
  "updatedAt",
];
const cleanTask = (task, preserveEmptyAssignee = true) =>
  Object.fromEntries(
    taskFields
      .filter(
        (k) =>
          task[k] !== undefined &&
          (k !== "assignee" || task[k] !== "" || preserveEmptyAssignee),
      )
      .map((k) => [k, task[k]]),
  );

export async function connectBackend(
  onSession,
  onProject,
  onError,
  onPeople = null,
  onPeopleError = () => {},
) {
  if (!cloudEnabled) return null;
  const fragment = new URLSearchParams(location.hash.slice(1));
  let pendingToken = fragment.get("invite") || "",
    redeeming = false;
  if (fragment.has("invite")) {
    window.history.replaceState(null, "", location.pathname + location.search);
    if (!/^[A-Za-z0-9_-]{43}$/.test(pendingToken))
      throw codeError("dfplan/link-invalid");
  }
  const config = backendConfig.firebase;
  if (
    !config.apiKey ||
    !config.authDomain ||
    !config.projectId ||
    !config.appId ||
    !/^[a-z0-9-]{1,60}$/.test(backendConfig.projectKey)
  )
    throw codeError("dfplan/config");
  const version = "13.3.0",
    base = `https://www.gstatic.com/firebasejs/${version}/`;
  const [appSdk, authSdk, dbSdk] = await Promise.all([
    import(base + "firebase-app.js"),
    import(base + "firebase-auth.js"),
    import(base + "firebase-firestore.js"),
  ]);
  const app = appSdk.initializeApp(config, "dfplan"),
    auth = authSdk.getAuth(app),
    db = dbSdk.initializeFirestore(app, {
      localCache: dbSdk.memoryLocalCache(),
    });
  await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);
  const projectRef = dbSdk.doc(db, "dfplanProjects", backendConfig.projectKey);
  const admins = dbSdk.collection(db, "dfplanAdmins"),
    tasks = dbSdk.collection(projectRef, "tasks"),
    history = dbSdk.collection(projectRef, "history");
  let member = null,
    guestPeopleAllowed = false,
    stopAdmin = () => {},
    stopProject = () => {},
    stopLink = () => {},
    stopPeople = () => {},
    epoch = 0,
    loadGeneration = 0,
    last = null;
  async function load() {
    const myEpoch = epoch,
      loadId = ++loadGeneration;
    if (!member || !auth.currentUser) throw codeError("dfplan/not-admin");
    for (let attempt = 0; attempt < 3; attempt++) {
      const start = await dbSdk.getDocFromServer(projectRef);
      if (!start.exists()) throw codeError("dfplan/not-initialized");
      const [taskRows, events] = await Promise.all([
        dbSdk.getDocsFromServer(tasks),
        dbSdk.getDocsFromServer(
          dbSdk.query(
            history,
            dbSdk.orderBy("revision", "desc"),
            dbSdk.limit(5000),
          ),
        ),
      ]);
      const end = await dbSdk.getDocFromServer(projectRef);
      if (!end.exists() || end.data().revision !== start.data().revision)
        continue;
      if (epoch !== myEpoch || loadId !== loadGeneration || !member)
        return null;
      const data = validateProject({
        startDate: start.data().startDate,
        tasks: taskRows.docs
          .map((d) => cleanTask(d.data().task))
          .sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true })),
        history: events.docs.map((d) => {
          const e = d.data();
          return {
            id: d.id,
            at: e.createdAt.toDate().toISOString(),
            actor: e.actor,
            text: e.text,
            textEn: e.textEn,
          };
        }),
      });
      last = {
        project: data,
        revision: start.data().revision,
        updatedAt: start.data().updatedAt.toDate().toISOString(),
      };
      onProject(structuredClone(last));
      return structuredClone(last);
    }
    throw codeError("dfplan/conflict");
  }
  function reset() {
    stopAdmin();
    stopProject();
    stopLink();
    stopPeople();
    stopPeople = () => {};
    stopLink = () => {};
    stopAdmin = () => {};
    stopProject = () => {};
    member = null;
    guestPeopleAllowed = false;
    last = null;
    ++loadGeneration;
  }
  function denied(user, error) {
    ++epoch;
    reset();
    onSession({
      phase: "denied",
      invite: !!pendingToken,
      user: {
        uid: user.uid,
        email: user.email || "",
        isGuest: user.isAnonymous,
      },
    });
    if (error) onError(error);
  }
  function useMembership(user, data, myEpoch) {
    if (
      !data?.active ||
      (user.isAnonymous
        ? data.role !== "editor" || data.projectKey !== backendConfig.projectKey
        : !["owner", "admin"].includes(data.role))
    ) {
      denied(user, user.isAnonymous ? codeError("dfplan/link-invalid") : null);
      return false;
    }
    const first = !member;
    member = {
      email: data.email || "",
      displayName: data.displayName,
      role: data.role,
      inviteId: data.inviteId || "",
      canManagePeople: user.isAnonymous ? guestPeopleAllowed : true,
    };
    onSession({
      phase: "ready",
      user: {
        uid: user.uid,
        email: user.email || "",
        isGuest: user.isAnonymous,
      },
      admin: { ...member },
    });
    if (first)
      stopProject = dbSdk.onSnapshot(
        projectRef,
        { includeMetadataChanges: true },
        (snap) => {
          if (
            snap.metadata.fromCache ||
            snap.metadata.hasPendingWrites ||
            myEpoch !== epoch
          )
            return;
          load().catch((error) => {
            if (myEpoch === epoch) onError(error);
          });
        },
        (error) => {
          if (myEpoch === epoch) denied(user, error);
        },
      );
    if (first && onPeople)
      stopPeople = dbSdk.onSnapshot(
        dbSdk.collection(projectRef, "people"),
        { includeMetadataChanges: true },
        (snap) => {
          if (
            myEpoch !== epoch ||
            snap.metadata.fromCache ||
            snap.metadata.hasPendingWrites
          )
            return;
          onPeople(
            snap.docs
              .map((d) => ({
                id: d.id,
                displayName: d.data().displayName,
                nameKey: d.data().nameKey,
                responsibility: d.data().responsibility,
                active: d.data().active,
              }))
              .sort((a, b) => a.displayName.localeCompare(b.displayName)),
          );
        },
        (error) => {
          if (myEpoch === epoch) onPeopleError(error);
        },
      );
    return first;
  }
  async function claimLink(user, myEpoch) {
    const token = pendingToken,
      invitation = dbSdk.doc(db, "dfplanInvites", token),
      guest = dbSdk.doc(db, "dfplanGuests", user.uid);
    await dbSdk.runTransaction(db, async (tx) => {
      const [link, existing] = await Promise.all([
        tx.get(invitation),
        tx.get(guest),
      ]);
      if (myEpoch !== epoch || auth.currentUser?.uid !== user.uid)
        throw codeError("dfplan/link-invalid");
      const data = link.exists() ? link.data() : null;
      if (existing.exists()) {
        if (
          existing.data().inviteId === token &&
          data?.claimedBy === user.uid &&
          data.active &&
          existing.data().active
        )
          return;
        throw codeError("dfplan/link-invalid");
      }
      if (
        !data?.active ||
        data.claimedBy ||
        data.expiresAt.toMillis() <= Date.now() ||
        data.projectKey !== backendConfig.projectKey ||
        data.role !== "editor"
      )
        throw codeError("dfplan/link-invalid");
      const at = dbSdk.serverTimestamp();
      tx.set(guest, {
        uid: user.uid,
        displayName: data.displayName,
        projectKey: data.projectKey,
        role: "editor",
        active: true,
        inviteId: token,
        createdAt: at,
        createdBy: user.uid,
        updatedAt: at,
        updatedBy: user.uid,
      });
      tx.update(invitation, {
        claimedBy: user.uid,
        updatedAt: at,
        updatedBy: user.uid,
      });
    });
    if (myEpoch === epoch) {
      pendingToken = "";
      redeeming = false;
    }
  }
  async function handleUser(user) {
    const myEpoch = ++epoch;
    reset();
    if (!user) {
      onSession({
        phase: pendingToken ? "invited" : "signed-out",
        invite: !!pendingToken,
      });
      return;
    }
    if (user.isAnonymous && pendingToken && !redeeming) {
      onSession({
        phase: "invited",
        invite: true,
        user: { uid: user.uid, email: "", isGuest: true },
      });
      return;
    }
    onSession({
      phase: "checking",
      user: {
        uid: user.uid,
        email: user.email || "",
        isGuest: user.isAnonymous,
      },
    });
    if (user.isAnonymous) {
      if (pendingToken && redeeming) {
        try {
          await claimLink(user, myEpoch);
        } catch (error) {
          if (myEpoch === epoch)
            denied(
              user,
              ["permission-denied", "dfplan/link-invalid"].includes(error.code)
                ? codeError("dfplan/link-invalid")
                : error,
            );
          return;
        }
      }
      if (myEpoch !== epoch) return;
      stopAdmin = dbSdk.onSnapshot(
        dbSdk.doc(db, "dfplanGuests", user.uid),
        { includeMetadataChanges: true },
        (snap) => {
          if (
            myEpoch !== epoch ||
            snap.metadata.fromCache ||
            snap.metadata.hasPendingWrites
          )
            return;
          const data = snap.exists() ? snap.data() : null;
          if (useMembership(user, data, myEpoch)) {
            stopLink = dbSdk.onSnapshot(
              dbSdk.doc(db, "dfplanInvites", data.inviteId),
              { includeMetadataChanges: true },
              (link) => {
                if (
                  myEpoch !== epoch ||
                  link.metadata.fromCache ||
                  link.metadata.hasPendingWrites
                )
                  return;
                if (
                  !link.exists() ||
                  !link.data().active ||
                  link.data().claimedBy !== user.uid
                )
                  denied(user, codeError("dfplan/link-invalid"));
                else if (
                  link.data().projectKey !== backendConfig.projectKey ||
                  link.data().role !== "editor"
                )
                  denied(user, codeError("dfplan/link-invalid"));
                else {
                  guestPeopleAllowed = link.data().canManagePeople === true;
                  useMembership(user, data, myEpoch);
                }
              },
              (error) => {
                if (myEpoch === epoch) denied(user, error);
              },
            );
          }
        },
        (error) => {
          if (myEpoch === epoch) denied(user, error);
        },
      );
      return;
    }
    if (
      !user.email ||
      !user.emailVerified ||
      !user.providerData.some((p) => p.providerId === "google.com")
    ) {
      denied(user);
      return;
    }
    let initialClaimAttempted = false;
    stopAdmin = dbSdk.onSnapshot(
      dbSdk.doc(admins, user.email.toLowerCase()),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (
          myEpoch !== epoch ||
          snapshot.metadata.fromCache ||
          snapshot.metadata.hasPendingWrites
        )
          return;
        if (!snapshot.exists() && !initialClaimAttempted) {
          initialClaimAttempted = true;
          const at = dbSdk.serverTimestamp(),
            address = user.email.toLowerCase();
          dbSdk
            .setDoc(dbSdk.doc(admins, address), {
              email: address,
              displayName:
                backendConfig.bootstrapDisplayName || "Initial administrator",
              role: "owner",
              active: true,
              createdAt: at,
              updatedAt: at,
              createdBy: user.uid,
              updatedBy: user.uid,
            })
            .catch(() => {
              if (myEpoch === epoch && !member) denied(user);
            });
          return;
        }
        useMembership(
          user,
          snapshot.exists() ? snapshot.data() : null,
          myEpoch,
        );
      },
      (error) => {
        if (myEpoch === epoch) denied(user, error);
      },
    );
  }
  authSdk.onAuthStateChanged(
    auth,
    (user) => {
      handleUser(user).catch((error) => {
        if (auth.currentUser?.uid === user?.uid && user) denied(user, error);
        else onError(error);
      });
    },
    onError,
  );
  return {
    login() {
      const provider = new authSdk.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      return authSdk.signInWithPopup(auth, provider);
    },
    async loginWithLink() {
      if (!pendingToken) throw codeError("dfplan/link-invalid");
      redeeming = true;
      if (auth.currentUser?.isAnonymous) {
        const prior = await dbSdk.getDocFromServer(
          dbSdk.doc(db, "dfplanGuests", auth.currentUser.uid),
        );
        if (!prior.exists() || prior.data().inviteId === pendingToken)
          return handleUser(auth.currentUser);
      }
      if (auth.currentUser) await authSdk.signOut(auth);
      return authSdk.signInAnonymously(auth);
    },
    logout() {
      return authSdk.signOut(auth);
    },
    reload: load,
    async initialize() {
      if (!member || member.role !== "owner" || !auth.currentUser)
        throw codeError("dfplan/not-admin");
      const uid = auth.currentUser.uid,
        email = auth.currentUser.email || "",
        actor = member.displayName,
        myEpoch = epoch;
      await dbSdk.runTransaction(db, async (transaction) => {
        const existing = await transaction.get(projectRef);
        if (existing.exists()) return;
        if (epoch !== myEpoch || member?.role !== "owner")
          throw codeError("dfplan/not-admin");
        const at = dbSdk.serverTimestamp();
        transaction.set(projectRef, {
          startDate: "",
          revision: 0,
          updatedAt: at,
          updatedBy: uid,
        });
        for (const task of seedTasks)
          transaction.set(dbSdk.doc(tasks, task.id), {
            task: cleanTask(task, false),
            revision: 0,
            updatedAt: at,
            updatedBy: uid,
          });
        transaction.set(dbSdk.doc(history, "0"), {
          revision: 0,
          text: "初始化家族传承计划",
          textEn: "Initialized the family legacy plan",
          actor,
          actorEmail: email,
          actorUid: uid,
          createdAt: at,
        });
      });
      return load();
    },
    async save(project, expectedRevision, text, textEn) {
      validateProject(project);
      if (!member || !last || !auth.currentUser)
        throw codeError("dfplan/not-admin");
      const actor = { ...member },
        uid = auth.currentUser.uid,
        email = auth.currentUser.email || "",
        baseline = structuredClone(last.project),
        myEpoch = epoch;
      if (baseline.tasks.some((t) => !project.tasks.some((n) => n.id === t.id)))
        throw codeError("dfplan/no-delete");
      if (project.tasks.some((t) => !/^[A-Za-z0-9_-]{1,80}$/.test(t.id)))
        throw codeError("dfplan/task-id");
      const changed = project.tasks
        .map((task) => {
          const original =
            baseline.tasks.find((old) => old.id === task.id) || {};
          return cleanTask(task, Object.hasOwn(original, "assignee"));
        })
        .filter(
          (t) =>
            JSON.stringify(cleanTask(t)) !==
            JSON.stringify(
              cleanTask(baseline.tasks.find((old) => old.id === t.id) || {}),
            ),
        );
      if (!changed.length && project.startDate === baseline.startDate)
        return load();
      await dbSdk.runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(projectRef);
        if (!snapshot.exists() || snapshot.data().revision !== expectedRevision)
          throw codeError("dfplan/conflict");
        if (myEpoch !== epoch || !member) throw codeError("dfplan/not-admin");
        const revision = expectedRevision + 1,
          updatedAt = dbSdk.serverTimestamp();
        transaction.update(projectRef, {
          startDate: project.startDate,
          revision,
          updatedAt,
          updatedBy: uid,
        });
        for (const task of changed)
          transaction.set(dbSdk.doc(tasks, task.id), {
            task: cleanTask(task),
            revision,
            updatedAt,
            updatedBy: uid,
          });
        transaction.set(dbSdk.doc(history, String(revision)), {
          revision,
          text,
          textEn,
          actor: actor.displayName,
          actorEmail: email,
          actorUid: uid,
          createdAt: updatedAt,
        });
      });
      return load();
    },
    async listPeople() {
      if (!member) throw codeError("dfplan/not-admin");
      const rows = await dbSdk.getDocsFromServer(
        dbSdk.collection(projectRef, "people"),
      );
      return rows.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
    async addPerson(displayName, responsibility = "") {
      if (
        !member ||
        member.canManagePeople !== true ||
        !auth.currentUser
      )
        throw codeError("dfplan/not-admin");
      const name = String(displayName || "").trim(),
        description = String(responsibility || "").trim();
      if (!validatePersonName(name) || description.length > 240)
        throw codeError("dfplan/person-format");
      const myEpoch = epoch,
        uid = auth.currentUser.uid,
        id = await personId(name),
        ref = dbSdk.doc(projectRef, "people", id);
      await dbSdk.runTransaction(db, async (tx) => {
        const existing = await tx.get(ref);
        if (epoch !== myEpoch || member?.canManagePeople !== true)
          throw codeError("dfplan/not-admin");
        if (existing.exists())
          throw codeError(
            existing.data().active
              ? "dfplan/person-exists"
              : "dfplan/person-removed",
          );
        const at = dbSdk.serverTimestamp();
        tx.set(ref, {
          displayName: name,
          nameKey: normalizePersonName(name),
          responsibility: description,
          active: true,
          createdAt: at,
          createdBy: uid,
          updatedAt: at,
          updatedBy: uid,
        });
      });
      return id;
    },
    async setPersonActive(id, active) {
      if (
        !member ||
        member.canManagePeople !== true ||
        !auth.currentUser
      )
        throw codeError("dfplan/not-admin");
      if (!/^[a-f0-9]{64}$/.test(id)) throw codeError("dfplan/person-format");
      return dbSdk.updateDoc(dbSdk.doc(projectRef, "people", id), {
        active: !!active,
        updatedAt: dbSdk.serverTimestamp(),
        updatedBy: auth.currentUser.uid,
      });
    },
    async listAdmins() {
      if (!member || !["owner", "admin"].includes(member.role))
        throw codeError("dfplan/not-admin");
      const rows = await dbSdk.getDocsFromServer(admins);
      return rows.docs
        .map((d) => ({
          email: d.data().email,
          displayName: d.data().displayName,
          active: d.data().active,
          role: d.data().role,
        }))
        .sort((a, b) =>
          a.role === "owner" ? -1 : a.email.localeCompare(b.email),
        );
    },
    async addAdmin(email, displayName) {
      const address = email.trim().toLowerCase(),
        name = displayName.trim();
      if (
        !member ||
        !auth.currentUser ||
        !["owner", "admin"].includes(member.role)
      )
        throw codeError("dfplan/not-admin");
      if (
        !/^[^/@\s]+@[^/@\s]+\.[^/@\s]+$/.test(address) ||
        !name ||
        name.length > 120
      )
        throw codeError("dfplan/admin-format");
      const ref = dbSdk.doc(admins, address);
      await dbSdk.runTransaction(db, async (transaction) => {
        const existing = await transaction.get(ref);
        if (existing.exists()) throw codeError("dfplan/admin-exists");
        const at = dbSdk.serverTimestamp();
        transaction.set(ref, {
          email: address,
          displayName: name,
          role: "admin",
          active: true,
          createdAt: at,
          updatedAt: at,
          createdBy: auth.currentUser.uid,
          updatedBy: auth.currentUser.uid,
        });
      });
    },
    async listInvites() {
      if (member?.role !== "owner") throw codeError("dfplan/not-admin");
      const rows = await dbSdk.getDocsFromServer(
        dbSdk.collection(db, "dfplanInvites"),
      );
      return rows.docs
        .map((d) => ({
          id: d.id,
          displayName: d.data().displayName,
          active: d.data().active,
          claimed: !!d.data().claimedBy,
          expired: d.data().expiresAt.toMillis() <= Date.now(),
          createdAt: d.data().createdAt.toMillis(),
        }))
        .sort((a, b) => b.createdAt - a.createdAt);
    },
    async createPatrickLink() {
      if (member?.role !== "owner" || !auth.currentUser)
        throw codeError("dfplan/not-admin");
      const bytes = crypto.getRandomValues(new Uint8Array(32)),
        token = btoa(String.fromCharCode(...bytes))
          .replaceAll("+", "-")
          .replaceAll("/", "_")
          .replaceAll("=", "");
      const at = dbSdk.serverTimestamp();
      await dbSdk.setDoc(dbSdk.doc(db, "dfplanInvites", token), {
        displayName: "Patrick",
        canManagePeople: true,
        projectKey: backendConfig.projectKey,
        role: "editor",
        active: true,
        claimedBy: "",
        expiresAt: dbSdk.Timestamp.fromMillis(Date.now() + 6 * 86400000),
        createdAt: at,
        updatedAt: at,
        createdBy: auth.currentUser.uid,
        updatedBy: auth.currentUser.uid,
      });
      return new URL("./#invite=" + token, location.href).href;
    },
    async revokeInvite(id) {
      if (member?.role !== "owner" || !auth.currentUser)
        throw codeError("dfplan/not-admin");
      await dbSdk.updateDoc(dbSdk.doc(db, "dfplanInvites", id), {
        active: false,
        updatedAt: dbSdk.serverTimestamp(),
        updatedBy: auth.currentUser.uid,
      });
    },
    async setAdminActive(email, active) {
      if (
        !member ||
        !auth.currentUser ||
        !["owner", "admin"].includes(member.role)
      )
        throw codeError("dfplan/not-admin");
      if (email === member.email) throw codeError("dfplan/self-disable");
      return dbSdk.updateDoc(dbSdk.doc(admins, email), {
        active: !!active,
        updatedAt: dbSdk.serverTimestamp(),
        updatedBy: auth.currentUser.uid,
      });
    },
  };
}
