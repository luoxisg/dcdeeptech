import { seedTasks } from "./data.js";
import { backendConfig } from "./backend-config.js?v=20261116-cloud";
import { validateProject } from "./model.mjs";

export const cloudEnabled = backendConfig.enabled === true;
const codeError = (code) => Object.assign(new Error(code), { code });
const taskFields = [
  "id",
  "title",
  "titleEn",
  "priority",
  "owner",
  "ownerEn",
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
const cleanTask = (task) =>
  Object.fromEntries(
    taskFields.filter((k) => task[k] !== undefined).map((k) => [k, task[k]]),
  );

export async function connectBackend(onSession, onProject, onError) {
  if (!cloudEnabled) return null;
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
    stopAdmin = () => {},
    stopProject = () => {},
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
    stopAdmin = () => {};
    stopProject = () => {};
    member = null;
    last = null;
    ++loadGeneration;
  }
  authSdk.onAuthStateChanged(
    auth,
    (user) => {
      ++epoch;
      reset();
      if (!user) {
        onSession({ phase: "signed-out" });
        return;
      }
      onSession({ phase: "checking", user: { email: user.email } });
      if (
        !user.email ||
        !user.emailVerified ||
        !user.providerData.some((p) => p.providerId === "google.com")
      ) {
        onSession({ phase: "denied", user: { email: user.email } });
        return;
      }
      const myEpoch = epoch;
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
                if (myEpoch === epoch && !member)
                  onSession({ phase: "denied", user: { email: user.email } });
              });
            return;
          }
          const data = snapshot.exists() ? snapshot.data() : null;
          if (!data?.active || !["owner", "admin"].includes(data.role)) {
            member = null;
            last = null;
            stopProject();
            onSession({ phase: "denied", user: { email: user.email } });
            return;
          }
          const first = !member;
          member = {
            email: data.email,
            displayName: data.displayName,
            role: data.role,
          };
          onSession({
            phase: "ready",
            user: { uid: user.uid, email: user.email },
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
                load().catch(onError);
              },
              (error) => {
                member = null;
                last = null;
                onSession({ phase: "denied", user: { email: user.email } });
                onError(error);
              },
            );
        },
        (error) => {
          reset();
          onSession({ phase: "denied", user: { email: user.email } });
          onError(error);
        },
      );
    },
    onError,
  );
  return {
    login() {
      const provider = new authSdk.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      return authSdk.signInWithPopup(auth, provider);
    },
    logout() {
      return authSdk.signOut(auth);
    },
    reload: load,
    async initialize() {
      if (!member || member.role !== "owner" || !auth.currentUser)
        throw codeError("dfplan/not-admin");
      const uid = auth.currentUser.uid,
        email = auth.currentUser.email,
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
            task: cleanTask(task),
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
        email = auth.currentUser.email,
        baseline = structuredClone(last.project),
        myEpoch = epoch;
      if (baseline.tasks.some((t) => !project.tasks.some((n) => n.id === t.id)))
        throw codeError("dfplan/no-delete");
      if (project.tasks.some((t) => !/^[A-Za-z0-9_-]{1,80}$/.test(t.id)))
        throw codeError("dfplan/task-id");
      const changed = project.tasks.filter(
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
    async listAdmins() {
      if (!member) throw codeError("dfplan/not-admin");
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
      if (!member || !auth.currentUser) throw codeError("dfplan/not-admin");
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
    async setAdminActive(email, active) {
      if (!member || !auth.currentUser) throw codeError("dfplan/not-admin");
      if (email === member.email) throw codeError("dfplan/self-disable");
      return dbSdk.updateDoc(dbSdk.doc(admins, email), {
        active: !!active,
        updatedAt: dbSdk.serverTimestamp(),
        updatedBy: auth.currentUser.uid,
      });
    },
  };
}
