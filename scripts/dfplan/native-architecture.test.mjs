import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { seedTasks } from "../../dfplan/src/domain/seed-tasks.mjs";
import { createStore } from "../../dfplan/src/application/store.mjs";
import { createLocalStoragePort } from "../../dfplan/src/adapters/local-storage.mjs";
import {
  addAssertion,
  changeAssertion,
} from "../../dfplan/src/domain/project-commands.mjs";
import {
  readAssertions,
  writeAssertions,
  replaceOutcomeText,
} from "../../dfplan/src/domain/stewardship-model.mjs";
import { html, raw } from "../../dfplan/src/ui/html.mjs";
import { projectJSON, projectCSV } from "../../dfplan/src/domain/exports.mjs";
import { captureCatalog } from "../../dfplan/src/domain/capture-catalog.mjs";
import { estimateCatalogue } from "../../dfplan/src/domain/digitization-calc.mjs";
import { defaultUnitRates } from "../../dfplan/src/domain/unit-pricing.mjs";
const root = resolve(import.meta.dirname, "../../dfplan");
async function files(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    result.push(...(entry.isDirectory() ? await files(path) : [path]));
  }
  return result;
}
const project = () => ({
  startDate: "",
  tasks: structuredClone(seedTasks),
  history: [],
});
test("domain has no browser globals and imports directly in Node", async () => {
  for (const path of await files(root + "/src/domain")) {
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(source, /\b(?:window|document|localStorage)\b/);
    await import(pathToFileURL(path));
  }
});
test("one import map covers every source module and source imports have no versions", async () => {
  const index = await readFile(root + "/index.html", "utf8"),
    map = JSON.parse(
      index.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1],
    ).imports;
  const sourceFiles = await files(root + "/src");
  for (const path of sourceFiles) {
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(source, /(?:from\s*|import\s*\(?)["'][^"']*\?v=/);
    const key = "./" + path.slice(root.length + 1);
    assert.ok(map[key], key);
    assert.match(map[key], /\?v=/);
    const layer = path.split("/src/")[1].split("/")[0];
    for (const match of source.matchAll(
      /(?:from\s*|import\s*\()["'](\.[^"']+)["']/g,
    )) {
      const target = resolve(dirname(path), match[1]);
      if (layer === "domain")
        assert.ok(target.startsWith(root + "/src/domain/"));
      if (layer === "application")
        assert.ok(/\/src\/(domain|application)\//.test(target));
      if (layer === "adapters") assert.ok(!target.includes("/src/ui/"));
    }
  }
  assert.ok(
    (await readFile(root + "/src/app.mjs", "utf8")).split("\n").length < 150,
  );
});
test("CSS layers and required touch tokens, no old specificity overrides", async () => {
  for (const file of await files(root + "/styles")) {
    const css = await readFile(file, "utf8");
    assert.doesNotMatch(
      css,
      /!important|body\.(phone-layout|larger-text)|cat >|^JS$/m,
    );
  }
  const css = await readFile(root + "/styles/tokens.css", "utf8");
  for (const value of ["48px", "54px", "16px", "20px", "24px", "12px"])
    assert.ok(css.includes(value));
  assert.match(
    await readFile(root + "/styles/main.css", "utf8"),
    /@layer tokens, base, components, layout, a11y/,
  );
});
test("safe templates escape unknown values, including nested arrays", () => {
  assert.equal(
    String(html`<p>${'<img onerror="x">'}${["'", html`<b>${"&"}</b>`]}</p>`),
    "<p>&lt;img onerror=&quot;x&quot;&gt;&#39;<b>&amp;</b></p>",
  );
  assert.equal(String(html`${raw("<hr>")}`), "<hr>");
});
test("navigation remembers each tab independently and leaves project untouched", () => {
  const original = project(),
    store = createStore({ project: original });
  let count = 0;
  const stop = store.subscribe(() => count++);
  store.navigate("list", 240);
  store.navigate("facts", 120);
  store.navigate("overview", 65);
  assert.deepEqual(store.getState().scrollTop, {
    overview: 240,
    list: 120,
    facts: 65,
  });
  assert.equal(store.getState().project, original);
  assert.equal(count, 3);
  stop();
  store.update({ message: "x" });
  assert.equal(count, 3);
});
test("assertions preserve legacy outcomes and task acceptance; JSON/CSV retain metadata", () => {
  const initial = project();
  initial.tasks[0].outcomes = "旧有笔记\n含有不同说法";
  const original = structuredClone(initial.tasks[0]);
  const next = addAssertion(
    initial,
    "WU-01",
    "日期尚待核实",
    "REF-01",
    "保留原始叙述",
  );
  const parsed = readAssertions(next.tasks[0].outcomes);
  assert.equal(parsed.text, original.outcomes);
  assert.equal(parsed.assertions.length, 1);
  const confirmed = changeAssertion(next, "WU-01", parsed.assertions[0].id, {
    status: "confirmed",
  });
  assert.equal(confirmed.tasks[0].accepted, original.accepted);
  assert.equal(confirmed.tasks[0].status, original.status);
  assert.deepEqual(initial.tasks[0], original);
  assert.equal(
    readAssertions(
      replaceOutcomeText(confirmed.tasks[0].outcomes, "更新旧笔记"),
    ).assertions[0].status,
    "confirmed",
  );
  assert.deepEqual(JSON.parse(projectJSON(confirmed)).tasks, confirmed.tasks);
  assert.ok(projectCSV(confirmed).includes("REF-01"));
  assert.equal(
    readAssertions("old\n\n[DeepFamily assertions v1]\ninvalid").text,
    "old\n\n[DeepFamily assertions v1]\ninvalid",
  );
  assert.throws(() => writeAssertions("x".repeat(12000), parsed.assertions));
});
test("demo storage is isolated and history is never truncated by local saves", async () => {
  const values = new Map([["deepfamily.dfplan.v1", "LIVE"]]),
    storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
  const port = createLocalStoragePort(storage, true),
    next = await port.load();
  next.history = Array.from({ length: 4999 }, (_, i) => ({
    id: String(i),
    at: "2026-11-19T00:00:00Z",
    actor: "test",
    text: "event",
  }));
  const saved = await port.save(next, "edit", "edit");
  assert.equal(saved.project.history.length, 5000);
  await assert.rejects(port.save(saved.project, "one more", "one more"));
  assert.equal(JSON.parse(values.get(port.key)).history.length, 5000);
  assert.equal(values.get("deepfamily.dfplan.v1"), "LIVE");
  assert.equal((await port.loadPeople()).length, 5);
});
test("corrupt local data blocks silent overwrite; explicit valid import recovers", async () => {
  const values = new Map([["deepfamily.dfplan.demo.v1", "bad-json"]]),
    storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
  const port = createLocalStoragePort(storage);
  await assert.rejects(port.load());
  await assert.rejects(port.save(project(), "edit", "edit"));
  assert.equal(values.get(port.key), "bad-json");
  await port.replace(project(), "import", "import");
  assert.equal((await port.load()).tasks.length, 10);
});
test("twelve rows aggregate to the unchanged six rate keys and baseline capacity", () => {
  assert.equal(captureCatalog.length, 12);
  const capture = Object.fromEntries(
    captureCatalog.map((row) => [row.id, row.quantity]),
  );
  const estimate = estimateCatalogue(capture, defaultUnitRates, 4);
  assert.equal(estimate.days, 20);
  assert.ok(Math.abs(estimate.gb - 1791.04) < 0.1);
  assert.ok(estimate.unitQuoteCents > 0);
});
