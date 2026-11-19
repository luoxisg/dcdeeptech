// Publishes additive pricing rules only. Never reads or writes family records.
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import {
  deployRules,
  createRulesApi,
  getAuthenticatedEmail,
  renderRules,
} from "./deploy-core.mjs";
export function assertPricingOnlyChange(source, baseline) {
  const start = source.indexOf("      // Prices are independent"),
    end = source.indexOf("      // END UNIT PRICING\n");
  if (
    start < 0 ||
    end < start ||
    source.slice(0, start) +
      source.slice(end + "      // END UNIT PRICING\n".length) !==
      baseline
  )
    throw Error(
      "Rules changes extend beyond the reviewed additive pricing block. Stopped.",
    );
}
export async function publishPricingRules({
  api,
  projectId,
  source,
  baseline,
}) {
  assertPricingOnlyChange(source, baseline);
  const release = await api(
    "GET",
    `projects/${projectId}/releases/cloud.firestore`,
  );
  const current = await api("GET", release.rulesetName);
  const files = current.source?.files;
  if (
    files?.length !== 1 ||
    ![source, baseline].some(
      (text) =>
        text.replaceAll("\r\n", "\n") ===
        files[0].content.replaceAll("\r\n", "\n"),
    )
  )
    throw Error(
      "Live rules differ from the reviewed baseline. Stopped without publishing.",
    );
  const result = await deployRules(api, projectId, source);
  return {
    status: "DFPLAN_PRICING_RULES_READY",
    rulesSha256: result.sha256,
    unchanged: result.unchanged,
    familyRecordsRead: false,
    familyRecordsWritten: false,
  };
}
async function main() {
  if (process.env.FIRESTORE_EMULATOR_HOST)
    throw Error(
      "Unset FIRESTORE_EMULATOR_HOST before production rule deployment.",
    );
  const projectId = "deepfamily-dfplan";
  let getAccessToken;
  if (process.env.CLOUD_SHELL)
    getAccessToken = async () =>
      execFileSync("gcloud", ["auth", "print-access-token"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();
  else {
    const require = createRequire(import.meta.url),
      auth = require("firebase-tools/lib/auth.js"),
      account = auth.getGlobalDefaultAccount();
    if (!account?.tokens?.refresh_token)
      throw Error(
        "No deployment login. Run this script in your authorized Google Cloud Shell.",
      );
    getAccessToken = async () =>
      (
        await auth.getAccessToken(account.tokens.refresh_token, [
          "https://www.googleapis.com/auth/cloud-platform",
          "https://www.googleapis.com/auth/userinfo.email",
        ])
      ).access_token;
  }
  const owner = await getAuthenticatedEmail({ getAccessToken });
  const source = renderRules(
    await readFile(new URL("../firestore.rules", import.meta.url), "utf8"),
    owner,
  );
  const baseline = renderRules(
    execFileSync(
      "git",
      [
        "show",
        "e21d678524922a796becdb9f575ef137ee715ae7:dfplan-backend/firestore.rules",
      ],
      { encoding: "utf8" },
    ),
    owner,
  );
  console.log(
    JSON.stringify(
      await publishPricingRules({
        api: createRulesApi({ projectId, getAccessToken }),
        projectId,
        source,
        baseline,
      }),
      null,
      2,
    ),
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
