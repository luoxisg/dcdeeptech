// Run manually with Application Default Credentials. Never put credentials in Git.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { readFile } from "node:fs/promises";
const index = process.argv.indexOf("--project");
const projectId = index >= 0 ? process.argv[index + 1] : "";
if (!projectId || !/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(projectId))
  throw Error("Provide --project YOUR_FIREBASE_PROJECT_ID");
const prompt = createInterface({ input: stdin, output: stdout });
let email, displayName;
try {
  email = (await prompt.question("Initial owner Google email: "))
    .trim()
    .toLowerCase();
  displayName = (await prompt.question("Owner display name: ")).trim();
} finally {
  prompt.close();
}
if (
  !/^[^/@\s]+@[^/@\s]+\.[^/@\s]+$/.test(email) ||
  !displayName ||
  displayName.length > 120
)
  throw Error("A valid owner email and display name are required.");
const confirm = createInterface({ input: stdin, output: stdout });
let answer;
try {
  answer = await confirm.question(
    `Initialize private DFplan records in project ${projectId}? Type INITIALIZE: `,
  );
} finally {
  confirm.close();
}
if (answer !== "INITIALIZE") throw Error("Cancelled without changes.");
const data = await readFile(
  new URL("../../dfplan/src/domain/seed-tasks.mjs", import.meta.url),
  "utf8",
);
const { seedTasks } = await import(
  "data:text/javascript," + encodeURIComponent(data)
);
initializeApp({ projectId, credential: applicationDefault() });
const db = getFirestore(),
  project = db.doc("dfplanProjects/wu-family"),
  owner = db.doc("dfplanAdmins/" + email);
await db.runTransaction(async (tx) => {
  const [projectSnapshot, ownerSnapshot, owners] = await Promise.all([
    tx.get(project),
    tx.get(owner),
    tx.get(db.collection("dfplanAdmins").where("role", "==", "owner").limit(2)),
  ]);
  if (owners.docs.some((d) => d.id !== email))
    throw Error("An initial owner already exists. No changes made.");
  if (ownerSnapshot.exists && ownerSnapshot.data().role !== "owner")
    throw Error("This email already has an admin entry. No changes made.");
  if (!ownerSnapshot.exists)
    tx.create(owner, {
      email,
      displayName,
      role: "owner",
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: "bootstrap",
      updatedBy: "bootstrap",
    });
  if (!projectSnapshot.exists) {
    const at = FieldValue.serverTimestamp();
    tx.create(project, {
      startDate: "",
      revision: 0,
      updatedAt: at,
      updatedBy: "bootstrap",
    });
    for (const task of seedTasks)
      tx.create(project.collection("tasks").doc(task.id), {
        task,
        revision: 0,
        updatedAt: at,
        updatedBy: "bootstrap",
      });
  }
});
console.log(
  "Initialization complete. Existing project records were preserved. Sign in with the configured Google account.",
);
