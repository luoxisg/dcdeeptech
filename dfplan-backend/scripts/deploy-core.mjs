import { createHash, randomBytes } from "node:crypto";

export function parseAssigneeUpdates(raw) {
  if (typeof raw !== "string" || raw.length > 256000)
    throw Error("Invalid assignee update.");
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    throw Error("Assignee update must be a JSON object of task IDs and names.");
  }
  if (!input || Array.isArray(input) || typeof input !== "object")
    throw Error("Invalid assignee update.");
  const entries = Object.entries(input);
  if (!entries.length || entries.length > 300)
    throw Error("Assignee update must contain 1–300 tasks.");
  for (const [id, name] of entries)
    if (
      !/^[A-Za-z0-9_-]{1,80}$/.test(id) ||
      typeof name !== "string" ||
      name.length > 120
    )
      throw Error("Invalid task ID or assignee name (maximum 120 characters).");
  return entries.map(([id, name]) => [id, name.trim()]);
}

export async function mergeAssignees(
  db,
  { assignments, email, serverTimestamp, now = () => new Date().toISOString() },
) {
  const checked = parseAssigneeUpdates(
    JSON.stringify(Object.fromEntries(assignments)),
  );
  const root = db.doc("dfplanProjects/wu-family"),
    ownerRef = db.doc("dfplanAdmins/" + email);
  return db.runTransaction(async (tx) => {
    const [project, owner, ...tasks] = await Promise.all([
      tx.get(root),
      tx.get(ownerRef),
      ...checked.map(([id]) =>
        tx.get(db.doc("dfplanProjects/wu-family/tasks/" + id)),
      ),
    ]);
    if (
      !project.exists ||
      !owner.exists ||
      owner.data().email !== email ||
      owner.data().role !== "owner" ||
      owner.data().active !== true
    )
      throw Error(
        "An initialized project and its active protected owner are required.",
      );
    const baseline = project.data().revision;
    if (
      !Number.isSafeInteger(baseline) ||
      baseline < 0 ||
      baseline >= Number.MAX_SAFE_INTEGER
    )
      throw Error("Invalid project revision; no names were changed.");
    const changed = [];
    checked.forEach(([id, name], i) => {
      if (!tasks[i].exists || tasks[i].data().task?.id !== id)
        throw Error("A referenced task does not exist; no names were changed.");
      const task = tasks[i].data().task;
      if ((task.assignee || "") !== name)
        changed.push({ ...task, assignee: name });
    });
    if (!changed.length) return { changedTaskCount: 0, revision: baseline };
    const revision = baseline + 1,
      at = serverTimestamp(),
      updatedAt = now();
    tx.update(root, { revision, updatedAt: at, updatedBy: "cloud-shell" });
    for (const task of changed)
      tx.update(db.doc("dfplanProjects/wu-family/tasks/" + task.id), {
        task: { ...task, updatedAt },
        revision,
        updatedAt: at,
        updatedBy: "cloud-shell",
      });
    tx.create(db.doc("dfplanProjects/wu-family/history/" + revision), {
      revision,
      text: `根据手工更新表格更新具体人名（${changed.length}项）`,
      textEn: `Updated named assignees from the edited workbook (${changed.length} actions)`,
      actor: owner.data().displayName,
      actorEmail: email,
      actorUid: "cloud-shell",
      createdAt: at,
    });
    return { changedTaskCount: changed.length, revision };
  });
}

export async function enableAnonymousAuth({
  projectId,
  getAccessToken,
  fetchImpl = fetch,
}) {
  if (!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(projectId || ""))
    throw Error("Invalid Firebase project ID.");
  const base = `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`;
  const request = async (method, suffix = "", body) => {
    const response = await fetchImpl(base + suffix, {
      method,
      headers: {
        Authorization: "Bearer " + (await getAccessToken()),
        "x-goog-user-project": projectId,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok)
      throw Error(
        `Cannot configure Patrick’s passwordless access (${response.status}).`,
      );
    return response.json();
  };
  const existing = await request("GET");
  if (!existing.signIn?.anonymous?.enabled) {
    // A field mask preserves every existing sign-in provider, including Google.
    await request("PATCH", "?updateMask=signIn.anonymous.enabled", {
      signIn: { anonymous: { enabled: true } },
    });
    const verified = await request("GET");
    if (verified.signIn?.anonymous?.enabled !== true)
      throw Error("Anonymous sign-in was not enabled.");
  }
}

export async function createPatrickInvitation(
  db,
  { serverTimestamp, expiresAt },
) {
  const token = randomBytes(32).toString("base64url"),
    at = serverTimestamp();
  await db.doc("dfplanInvites/" + token).create({
    displayName: "Patrick",
    projectKey: "wu-family",
    role: "editor",
    active: true,
    expiresAt,
    claimedBy: "",
    createdAt: at,
    updatedAt: at,
    createdBy: "cloud-shell",
    updatedBy: "cloud-shell",
  });
  return "https://dcdeeptech.com/dfplan/#invite=" + token;
}

// Cloud Shell can supply temporary credentials without any `gcloud auth list`
// entries. Resolve the identity from the same access token used for deployment.
export async function getAuthenticatedEmail({
  getAccessToken,
  fetchImpl = fetch,
}) {
  const response = await fetchImpl(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: { Authorization: "Bearer " + (await getAccessToken()) },
      signal: AbortSignal.timeout(45000),
    },
  );
  if (!response.ok)
    throw Error(
      `Google account verification failed (${response.status}). Run gcloud auth login in Cloud Shell, authorize the administrator account, then retry.`,
    );
  const identity = await response.json();
  if (
    identity.verified_email !== true ||
    typeof identity.email !== "string" ||
    !identity.email.trim()
  )
    throw Error(
      "Google did not return a verified email. Run gcloud auth login in Cloud Shell, then retry.",
    );
  return identity.email.trim().toLowerCase();
}

export function validateInputs({
  projectId,
  ownerEmail,
  displayName,
  activeAccount,
}) {
  if (!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(projectId || ""))
    throw Error("Invalid Firebase project ID.");
  const email = String(ownerEmail || "")
      .trim()
      .toLowerCase(),
    name = String(displayName || "").trim();
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email))
    throw Error("A valid initial administrator email is required.");
  if (!name || name.length > 120)
    throw Error("Administrator name must have 1–120 characters.");
  if (
    String(activeAccount || "")
      .trim()
      .toLowerCase() !== email
  )
    throw Error(
      "Google Cloud Shell is signed into a different account. Select the requested administrator account and retry.",
    );
  return { projectId, email, displayName: name };
}
export function renderRules(template, email) {
  const checked = validateInputs({
    projectId: "demo-dfplan",
    ownerEmail: email,
    displayName: "Owner",
    activeAccount: email,
  });
  if (template.split("__DFPLAN_INITIAL_OWNER_EMAIL__").length !== 2)
    throw Error(
      "The rules template must contain exactly one initial-owner placeholder.",
    );
  if (
    !template.includes("match /{document=**} { allow read,write: if false; }")
  )
    throw Error("Default-deny policy is missing.");
  return template.replace("__DFPLAN_INITIAL_OWNER_EMAIL__", checked.email);
}
export function createRulesApi({
  projectId,
  getAccessToken,
  fetchImpl = fetch,
}) {
  if (!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(projectId || ""))
    throw Error("A valid quota project ID is required for Firebase Rules.");
  return async (method, path, body, allowMissing = false) => {
    const response = await fetchImpl(
      "https://firebaserules.googleapis.com/v1/" + path,
      {
        method,
        headers: {
          Authorization: "Bearer " + (await getAccessToken()),
          "x-goog-user-project": projectId,
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(45000),
      },
    );
    if (allowMissing && response.status === 404) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = String(
        data.error?.message || "Google API request failed",
      ).slice(0, 400);
      throw Error(
        `Firebase Rules ${method} failed (${response.status}): ${message}`,
      );
    }
    return data;
  };
}
const hasSource = (ruleset, source) =>
  ruleset?.source?.files?.length === 1 &&
  ruleset.source.files[0].name === "firestore.rules" &&
  ruleset.source.files[0].content.replaceAll("\r\n", "\n") ===
    source.replaceAll("\r\n", "\n");
export async function deployRules(api, projectId, source) {
  const prefix = "projects/" + projectId,
    releaseName = prefix + "/releases/cloud.firestore";
  const previous = await api("GET", releaseName, undefined, true);
  if (previous?.rulesetName) {
    const existing = await api("GET", previous.rulesetName);
    if (hasSource(existing, source))
      return {
        rulesetName: previous.rulesetName,
        unchanged: true,
        sha256: createHash("sha256").update(source).digest("hex"),
      };
  }
  const created = await api("POST", prefix + "/rulesets", {
    source: { files: [{ name: "firestore.rules", content: source }] },
  });
  if (
    typeof created.name !== "string" ||
    !created.name.startsWith(prefix + "/rulesets/")
  )
    throw Error(
      "Google returned an unexpected ruleset identifier. No release was changed.",
    );
  const release = { name: releaseName, rulesetName: created.name };
  if (previous) await api("PATCH", releaseName, { release });
  else await api("POST", prefix + "/releases", release);
  const verified = await api("GET", releaseName);
  if (
    verified.rulesetName !== created.name ||
    !hasSource(await api("GET", created.name), source)
  )
    throw Error("Published rules did not match the verified source.");
  return {
    rulesetName: created.name,
    unchanged: false,
    sha256: createHash("sha256").update(source).digest("hex"),
  };
}
export function assertOwnerCompatible(owner, owners, email) {
  if (owners.docs.some((d) => d.id !== email))
    throw Error(
      "A different initial administrator already exists. Existing records were preserved.",
    );
  if (
    owner.exists &&
    (owner.data().role !== "owner" ||
      owner.data().email !== email ||
      owner.data().active !== true)
  )
    throw Error(
      "Existing membership conflicts with the requested initial administrator. Existing records were preserved.",
    );
}
export async function inspectOwner(db, email) {
  const [owner, owners] = await Promise.all([
    db.doc("dfplanAdmins/" + email).get(),
    db.collection("dfplanAdmins").where("role", "==", "owner").limit(2).get(),
  ]);
  assertOwnerCompatible(owner, owners, email);
}
export async function initializeRecords(
  db,
  { email, displayName, seedTasks, serverTimestamp },
) {
  const project = db.doc("dfplanProjects/wu-family"),
    owner = db.doc("dfplanAdmins/" + email);
  let createdProject = false,
    createdOwner = false;
  await db.runTransaction(async (tx) => {
    createdOwner = false;
    createdProject = false;
    const [p, o, owners, taskProbe, historyProbe] = await Promise.all([
      tx.get(project),
      tx.get(owner),
      tx.get(
        db.collection("dfplanAdmins").where("role", "==", "owner").limit(2),
      ),
      tx.get(project.collection("tasks").limit(1)),
      tx.get(project.collection("history").limit(1)),
    ]);
    assertOwnerCompatible(o, owners, email);
    if (!p.exists && (taskProbe.docs.length || historyProbe.docs.length))
      throw Error(
        "Orphaned project records exist. Review them before initialization; no records were overwritten.",
      );
    const at = serverTimestamp();
    if (!o.exists) {
      tx.create(owner, {
        email,
        displayName,
        role: "owner",
        active: true,
        createdAt: at,
        updatedAt: at,
        createdBy: "cloud-shell",
        updatedBy: "cloud-shell",
      });
      createdOwner = true;
    }
    if (!p.exists) {
      tx.create(project, {
        startDate: "",
        revision: 0,
        updatedAt: at,
        updatedBy: "cloud-shell",
      });
      for (const task of seedTasks)
        tx.create(project.collection("tasks").doc(task.id), {
          task,
          revision: 0,
          updatedAt: at,
          updatedBy: "cloud-shell",
        });
      tx.create(project.collection("history").doc("0"), {
        revision: 0,
        text: "初始化家族传承计划",
        textEn: "Initialized the family legacy plan",
        actor: displayName,
        actorEmail: email,
        actorUid: "cloud-shell",
        createdAt: at,
      });
      createdProject = true;
    }
  });
  return { createdOwner, createdProject };
}
