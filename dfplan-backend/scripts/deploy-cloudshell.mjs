// Run in the user's own Google Cloud Shell. Credentials stay inside that session.
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { Firestore, FieldValue } from "@google-cloud/firestore";
import { GoogleAuth, OAuth2Client } from "google-auth-library";
import {
  getAuthenticatedEmail,
  validateInputs,
  renderRules,
  createRulesApi,
  deployRules,
  inspectOwner,
  initializeRecords,
} from "./deploy-core.mjs";
const args = process.argv.slice(2);
function option(name) {
  const i = args.indexOf(name);
  return i < 0 ? "" : args[i + 1] || "";
}
function gcloud(...args) {
  return execFileSync("gcloud", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
}
async function main() {
  if (!process.env.CLOUD_SHELL)
    console.log(
      "Use your own authorized Google Cloud Shell account for this command.",
    );
  // This first token request triggers Cloud Shell's native authorization dialog.
  const getAccessToken = async () => gcloud("auth", "print-access-token");
  const activeAccount = await getAuthenticatedEmail({ getAccessToken });
  const settings = validateInputs({
    projectId: option("--project"),
    ownerEmail: option("--owner-email"),
    displayName: option("--display-name") || "luoxi",
    activeAccount,
  });
  const { projectId, email, displayName } = settings;
  const configSource = await readFile(
    new URL("../../dfplan/backend-config.js", import.meta.url),
    "utf8",
  );
  const { backendConfig } = await import(
    "data:text/javascript," + encodeURIComponent(configSource)
  );
  if (projectId !== backendConfig.firebase.projectId)
    throw Error(
      "The requested project does not match DFplan web configuration.",
    );
  if (process.env.FIRESTORE_EMULATOR_HOST)
    throw Error("Unset FIRESTORE_EMULATOR_HOST before deploying production.");
  console.log(
    `Deploying DFplan to ${projectId} for the selected administrator. Existing project records will be preserved.`,
  );
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)`,
    {
      headers: {
        Authorization: "Bearer " + (await getAccessToken()),
        "x-goog-user-project": projectId,
      },
      signal: AbortSignal.timeout(45000),
    },
  );
  if (!response.ok)
    throw Error(
      `Cannot access the existing Firestore database (${response.status}). Authorize Cloud Shell for this project and retry.`,
    );
  const database = await response.json();
  if (
    database.locationId !== "asia-southeast1" ||
    database.type !== "FIRESTORE_NATIVE"
  )
    throw Error(
      "The database is not the expected Singapore native database. No changes made.",
    );
  const accountClient = new OAuth2Client();
  accountClient.quotaProjectId = projectId;
  accountClient.refreshHandler = async () => ({
    access_token: await getAccessToken(),
    expiry_date: Date.now() + 240000,
  });
  accountClient.setCredentials(await accountClient.refreshHandler());
  const db = new Firestore({
    projectId,
    auth: new GoogleAuth({
      projectId,
      quotaProjectId: projectId,
      authClient: accountClient,
    }),
  });
  try {
    await inspectOwner(db, email);
    const template = await readFile(
        new URL("../firestore.rules", import.meta.url),
        "utf8",
      ),
      source = renderRules(template, email);
    // Firebase Rules is a free management API. No billing or paid products are enabled.
    gcloud(
      "services",
      "enable",
      "firebaserules.googleapis.com",
      "--project",
      projectId,
      "--quiet",
    );
    const policy = await deployRules(
      createRulesApi({ projectId, getAccessToken }),
      projectId,
      source,
    );
    console.log("Security rules verified: " + policy.sha256.slice(0, 16));
    const taskSource = await readFile(
      new URL("../../dfplan/data.js", import.meta.url),
      "utf8",
    );
    const { seedTasks } = await import(
      "data:text/javascript," + encodeURIComponent(taskSource)
    );
    const initialized = await initializeRecords(db, {
      email,
      displayName,
      seedTasks,
      serverTimestamp: () => FieldValue.serverTimestamp(),
    });
    const [owner, project, tasks] = await Promise.all([
      db.doc("dfplanAdmins/" + email).get(),
      db.doc("dfplanProjects/wu-family").get(),
      db.collection("dfplanProjects/wu-family/tasks").get(),
    ]);
    if (
      !owner.exists ||
      owner.data().role !== "owner" ||
      owner.data().active !== true ||
      !project.exists
    )
      throw Error(
        "Backend verification failed. Do not enable the web cloud switch yet.",
      );
    console.log(
      JSON.stringify(
        {
          status: "DFPLAN_BACKEND_READY",
          projectId,
          administrator: owner.data().displayName,
          ownerActive: true,
          taskCount: tasks.size,
          revision: project.data().revision,
          ...initialized,
        },
        null,
        2,
      ),
    );
    console.log(
      "后端已部署并验证。回到聊天告诉我“后端已部署”，即可继续切换网站的云端保存。",
    );
  } finally {
    await db.terminate();
  }
}
main().catch((error) => {
  console.error("部署未完成：" + error.message);
  process.exitCode = 1;
});
