import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateProject, targetDate, csvCell } from "../../dfplan/model.mjs";
const { seedTasks } = await import(
  "data:text/javascript," +
    encodeURIComponent(
      readFileSync(new URL("../../dfplan/src/domain/seed-tasks.mjs", import.meta.url), "utf8"),
    )
);
const fresh = () => ({
  startDate: "2026-11-15",
  tasks: structuredClone(seedTasks),
  history: [],
});
assert.equal(validateProject(fresh()).tasks.length, 10);
assert.equal(targetDate(fresh().tasks[0], "2026-11-15"), "2026-11-21");
assert.equal(
  targetDate({ ...fresh().tasks[0], due: "2026-12-01" }, "2026-11-15"),
  "2026-12-01",
);
assert.equal(targetDate(fresh().tasks[0], ""), "");
for (const mutate of [
  (p) => (p.tasks[0].status = "已完成"),
  (p) => {
    p.tasks[0].status = "已完成";
    p.tasks[0].accepted = true;
    p.tasks[0].completed = "2026-11-15";
  },
  (p) => p.tasks.push({ ...p.tasks[0] }),
  (p) => (p.tasks[0].weekEnd = 0),
  (p) => (p.tasks[0].weekEnd = 105),
  (p) => (p.startDate = "2026-02-30"),
  (p) => (p.tasks[0].due = "2026-99-99"),
  (p) => (p.tasks[0].titleEn = {}),
  (p) => (p.tasks[0].assignee = {}),
  (p) => (p.tasks[0].assigneeId = "not-a-person-id"),
  (p) => (p.tasks[0].assignee = "x".repeat(121)),
  (p) => (p.tasks[0].reviewer = "x".repeat(121)),
  (p) => (p.tasks[0].backup = {}),
  (p) => (p.tasks[0].claimedOn = "2026-02-30"),
  (p) => (p.tasks[0].effort = "x".repeat(501)),
  (p) => (p.tasks[0].outcomes = true),
  (p) => (p.tasks[0].recovery = "x".repeat(12001)),
  (p) =>
    p.history.push({ id: "x", at: "invalid", actor: "test", text: "test" }),
]) {
  const p = fresh();
  mutate(p);
  assert.throws(() => validateProject(p));
}
const completed = fresh();
Object.assign(completed.tasks[0], {
  status: "已完成",
  accepted: true,
  completed: "2026-11-15",
  evidence: "Reviewed record 001",
});
assert.doesNotThrow(() => validateProject(completed));
const named = fresh();
named.tasks[0].assignee = "Alex Example";
assert.doesNotThrow(() => validateProject(named));
const oldExport = fresh();
oldExport.tasks.forEach((t) => delete t.assignee);
oldExport.tasks.forEach((t) =>
  Object.keys(t)
    .filter((k) => k.endsWith("En"))
    .forEach((k) => delete t[k]),
);
assert.doesNotThrow(() =>
  validateProject(JSON.parse(JSON.stringify(oldExport))),
);
for (const unsafe of ["=SUM(1,2)", "  +cmd", "\t@evil", "\n-cmd", "\uFEFF=1"])
  assert.ok(csvCell(unsafe).startsWith("\"'"));
assert.equal(csvCell('A "family" story'), '"A ""family"" story"');
assert.equal(csvCell("Normal record"), '"Normal record"');
console.log(
  "PASS: 10-action template, due dates, acceptance gate, import validation, original-backup compatibility and CSV escaping.",
);
