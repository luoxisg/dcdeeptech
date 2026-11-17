// Updates only the Rules release. Never writes application, auth or invitation data.
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { Firestore } from "@google-cloud/firestore";
import { GoogleAuth, OAuth2Client } from "google-auth-library";
import { createRulesApi, deployRules, getAuthenticatedEmail, renderRules } from "./deploy-core.mjs";

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    if (typeof value.toJSON === "function") return canonical(value.toJSON());
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

export async function snapshotRecords(db) {
  const collections = ["dfplanAdmins", "dfplanInvites", "dfplanGuests", "dfplanProjects",
    ...["tasks", "people", "history"].map(key => "dfplanProjects/wu-family/" + key)];
  const result = {};
  for (const name of collections) {
    const rows = await db.collection(name).get();
    const records = rows.docs.map(row => [row.id, canonical(row.data())]).sort(([a], [b]) => a.localeCompare(b));
    result[name] = { count: records.length, sha256: createHash("sha256").update(JSON.stringify(records)).digest("hex") };
  }
  return result;
}

export async function deployWithPreservationCheck({ db, api, projectId, source, baseline }) {
  const release = await api("GET", `projects/${projectId}/releases/cloud.firestore`);
  const current = await api("GET", release.rulesetName);
  const files = current.source?.files;
  if (files?.length !== 1 || ![source, baseline].some(text =>
    text.replaceAll("\r\n", "\n") === files[0].content.replaceAll("\r\n", "\n")))
    throw Error("Live rules differ from the reviewed baseline; no deployment performed.");
  const before = await snapshotRecords(db);
  if (!before["dfplanProjects/wu-family/tasks"].count || !before.dfplanAdmins.count)
    throw Error("Existing plan and administrators must be present. Initialization is forbidden here.");
  const policy = await deployRules(api, projectId, source);
  const after = await snapshotRecords(db);
  if (JSON.stringify(before) !== JSON.stringify(after))
    throw Error("Rules published, but concurrent data changes prevent an unchanged-data assertion. No data was written by this script.");
  return { status: "DFPLAN_RULES_ONLY_VERIFIED", rulesSha256: policy.sha256, unchanged: policy.unchanged,
    counts: Object.fromEntries(Object.entries(after).map(([name, info]) => [name, info.count])), recordsUnchanged: true };
}

async function main() {
  if (process.env.FIRESTORE_EMULATOR_HOST) throw Error("Unset FIRESTORE_EMULATOR_HOST before production deployment.");
  const configSource = await readFile(new URL("../../dfplan/backend-config.js", import.meta.url), "utf8");
  const { backendConfig } = await import("data:text/javascript," + encodeURIComponent(configSource));
  const projectId = backendConfig.firebase.projectId;
  if (projectId !== "deepfamily-dfplan") throw Error("Unexpected Firebase project.");
  let getAccessToken;
  if (process.env.CLOUD_SHELL) {
    getAccessToken = async () => execFileSync("gcloud", ["auth", "print-access-token"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } else {
    const require = createRequire(import.meta.url);
    const auth = require("firebase-tools/lib/auth.js");
    const account = auth.getGlobalDefaultAccount();
    if (!account?.tokens?.refresh_token) throw Error("Firebase login required: run node dfplan-backend/node_modules/firebase-tools/lib/bin/firebase.js login --no-localhost");
    getAccessToken = async () => (await auth.getAccessToken(account.tokens.refresh_token, ["https://www.googleapis.com/auth/cloud-platform", "https://www.googleapis.com/auth/userinfo.email"])).access_token;
  }
  const email = await getAuthenticatedEmail({ getAccessToken });
  const authClient = new OAuth2Client();
  authClient.quotaProjectId = projectId;
  authClient.refreshHandler = async () => ({ access_token: await getAccessToken(), expiry_date: Date.now() + 240000 });
  authClient.setCredentials(await authClient.refreshHandler());
  const db = new Firestore({ projectId, auth: new GoogleAuth({ projectId, quotaProjectId: projectId, authClient }) });
  try {
    const owners = await db.collection("dfplanAdmins").where("role", "==", "owner").get();
    if (owners.size !== 1 || owners.docs[0].id !== email || !owners.docs[0].data().active)
      throw Error("The existing active protected owner must authorize this deployment.");
    const source = renderRules(await readFile(new URL("../firestore.rules", import.meta.url), "utf8"), email);
    const baseline = renderRules(execFileSync("git", ["show", "origin/main:dfplan-backend/firestore.rules"], { encoding: "utf8" }), email);
    console.log(JSON.stringify(await deployWithPreservationCheck({ db, projectId, source, baseline,
      api: createRulesApi({ projectId, getAccessToken }) }), null, 2));
  } finally {
    await db.terminate();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
