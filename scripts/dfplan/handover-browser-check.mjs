import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
function unpack(bytes) {
  const files = new Map();
  let at = 0;
  while (bytes.readUInt32LE(at) === 0x04034b50) {
    const size = bytes.readUInt32LE(at + 18),
      nameLength = bytes.readUInt16LE(at + 26),
      extra = bytes.readUInt16LE(at + 28),
      name = bytes.subarray(at + 30, at + 30 + nameLength).toString("utf8"),
      start = at + 30 + nameLength + extra;
    files.set(name, bytes.subarray(start, start + size).toString("utf8"));
    at = start + size;
  }
  return files;
}
export async function checkHandover(page) {
  await page.evaluate(() => (location.hash = "handover"));
  await page.locator("[data-handover-readiness]").waitFor();
  await page.evaluate(async () => {
    const { commands } =
      await import("/dfplan/src/application/command-bus.mjs");
    await commands.run("navigate", { view: "overview" });
  });
  await page.locator(".weekly-focus").waitFor();
  await page.locator(".site-menu > summary").click();
  assert.equal(await page.locator(".handover-menu-entry").isVisible(), true);
  await page.locator(".handover-menu-entry").click();
  await page.locator("[data-handover-readiness]").waitFor();
  assert.equal(await page.locator(".mobile-tabs button").count(), 5);
  assert.match(
    await page.locator(".handover-boundary").innerText(),
    /不构成项目正式验收/,
  );
  assert.match(
    await page.locator(".handover-boundary").innerText(),
    /legal title, or a trust instrument/,
  );
  const baseline = await page.evaluate(async () => {
    const { store } = await import("/dfplan/src/application/store.mjs");
    const old = store.getState();
    window.__handoverPeople = old.people;
    store.update({
      people: old.people.map((p, i) =>
        i === 0
          ? {
              ...p,
              displayName: "BROWSER_SEALED_PERSON",
              sensitivity: "sealed",
            }
          : p,
      ),
    });
    return {
      tasks: JSON.stringify(old.project.tasks),
      history: old.project.history.length,
    };
  });
  await page.locator("[data-handover-sealed]").waitFor({ state: "visible" });
  assert.equal(await page.locator("[data-handover-sealed]").isChecked(), false);
  async function download(format) {
    const event = page.waitForEvent("download");
    await page
      .locator(`[data-cmd="handover-export"][data-format="${format}"]`)
      .click();
    const file = await event;
    const bytes = await readFile(await file.path());
    await page.waitForFunction(() =>
      document
        .querySelector("[data-handover-status]")
        ?.textContent?.includes("已记录"),
    );
    return { file, bytes };
  }
  const zipped = await download("zip");
  assert.match(
    zipped.file.suggestedFilename(),
    /^deepfamily-handover-dfplan-demo-\d{8}\.zip$/,
  );
  const files = unpack(zipped.bytes),
    manifest = JSON.parse(files.get("manifest.json"));
  assert.equal(manifest.schemaVersion, "1.0.0");
  assert.equal(manifest.role, "owner");
  const originalTask = await page.evaluate(async () => {
    const { store } = await import("/dfplan/src/application/store.mjs");
    return store.getState().project.tasks[0];
  });
  const exportedTask = JSON.parse(files.get("audit_and_tasks.json")).tasks.find(
    (task) => task.id === originalTask.id,
  );
  for (const key of [
    "ownerEn",
    "actionEn",
    "collaboratorsEn",
    "deliverableEn",
    "dependencyEn",
  ])
    if (originalTask[key] !== undefined)
      assert.equal(exportedTask[key], originalTask[key], key);
  assert.equal(manifest.includeSealed, false);
  assert.equal(
    [...files.values()].join("\n").includes("BROWSER_SEALED_PERSON"),
    false,
  );
  for (const row of manifest.files)
    assert.equal(
      row.sha256,
      createHash("sha256").update(files.get(row.path)).digest("hex"),
    );
  assert.ok(
    [...files.keys()].some((name) => name.startsWith("oral_histories/")),
  );
  await page.locator("[data-handover-sealed]").check();
  const json = await download("json"),
    single = JSON.parse(json.bytes.toString());
  assert.equal(single.schemaVersion, "1.0.0");
  const jsonManifest = JSON.parse(
    single.files.find((file) => file.path === "manifest.json").content,
  );
  for (const row of jsonManifest.files)
    assert.equal(
      row.sha256,
      createHash("sha256")
        .update(single.files.find((file) => file.path === row.path).content)
        .digest("hex"),
    );
  assert.ok(json.bytes.toString().includes("BROWSER_SEALED_PERSON"));
  const md = await download("md");
  assert.ok(md.bytes.toString().includes("本移交包仅作一阶段"));
  await page.locator(".site-menu > summary").click();
  await page.locator('[data-cmd="language"]').click();
  await page.locator("[data-handover-readiness]").waitFor();
  assert.equal(await page.locator("#page-title").innerText(), "Data Output");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.locator(".site-menu > summary").click();
  await page.locator('[data-cmd="language"]').click();
  const after = await page.evaluate(async () => {
    const { store } = await import("/dfplan/src/application/store.mjs");
    const state = store.getState();
    const result = {
      tasks: JSON.stringify(state.project.tasks),
      history: state.project.history,
    };
    store.update({ people: window.__handoverPeople });
    delete window.__handoverPeople;
    return result;
  });
  assert.equal(after.tasks, baseline.tasks);
  assert.equal(after.history.length, baseline.history + 3);
  const audits = after.history
    .slice(-3)
    .map((h) => JSON.parse(h.text.slice(h.text.indexOf("{"))));
  assert.deepEqual(
    audits.map((a) => a.format),
    ["zip", "json", "md"],
  );
  assert.equal(audits[0].includeSealed, false);
  assert.equal(audits[1].includeSealed, true);
  assert.equal(audits[2].includeSealed, false);
  if (process.env.DFPLAN_SCREENSHOT_DIR)
    await page.screenshot({
      path:
        process.env.DFPLAN_SCREENSHOT_DIR +
        `/handover-${page.viewportSize().width}.png`,
    });
  console.log(
    "PASS: highlighted handover entry, five mobile tabs, native ZIP/SHA, sealed default/opt-in, JSON/MD, export audit, EN/ZH and unchanged tasks.",
  );
}
