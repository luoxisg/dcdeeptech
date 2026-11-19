import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  assertPricingOnlyChange,
  publishPricingRules,
} from "../scripts/deploy-pricing-rules.mjs";
const source = await readFile(
  new URL("../firestore.rules", import.meta.url),
  "utf8",
);
const start = source.indexOf("      // Prices are independent"),
  end = source.indexOf("      // END UNIT PRICING\n");
const baseline =
  source.slice(0, start) +
  source.slice(end + "      // END UNIT PRICING\n".length);
assert.equal(
  createHash("sha256").update(baseline).digest("hex"),
  "e5eeea92769fc8b791392f37885080c043f04f734b4d52b0d5a87367933d710a",
);
test("pricing deployment cannot alter old auth/task rules and never accesses family records", async () => {
  assert.doesNotThrow(() => assertPricingOnlyChange(source, baseline));
  assert.throws(() =>
    assertPricingOnlyChange(
      source.replace("function admin()", "function adminChanged()"),
      baseline,
    ),
  );
  const calls = [];
  const api = async (method, path) => {
    calls.push({ method, path });
    if (calls.length === 1)
      return { rulesetName: "projects/test/rulesets/current" };
    return { source: { files: [{ content: "Unexpected deployed rules" }] } };
  };
  await assert.rejects(
    publishPricingRules({ api, projectId: "test", source, baseline }),
    /Live rules differ/,
  );
  assert.equal(calls.length, 2);
  assert.ok(calls.every((c) => c.method === "GET"));
  assert.ok(calls.every((c) => !c.path.includes("documents")));
});

test('already-published pricing rules return a verified idempotent result without writes',async()=>{
 const calls=[];
 const api=async(method,path)=>{calls.push({method,path});return path.endsWith('/releases/cloud.firestore')?{rulesetName:'projects/test/rulesets/current'}:{source:{files:[{name:'firestore.rules',content:source}]}};};
 const result=await publishPricingRules({api,projectId:'test',source,baseline});
 assert.equal(result.status,'DFPLAN_PRICING_RULES_READY');assert.equal(result.unchanged,true);
 assert.equal(result.familyRecordsRead,false);assert.equal(result.familyRecordsWritten,false);assert.ok(calls.every(c=>c.method==='GET'));
});
