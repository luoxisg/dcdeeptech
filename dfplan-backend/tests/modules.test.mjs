import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dashboardData,
  matchesDashboardTask,
  renderDashboard,
} from "../../dfplan/dashboard.mjs";
import {
  normalizePersonName,
  personId,
  assigneeGroup,
} from "../../dfplan/people-model.mjs";
import { renderPeople, assigneeSelect } from "../../dfplan/people-ui.mjs";
const alex = await personId("Alex Example"),
  ben = await personId("Ben Example"),
  carol = await personId("Carol Example");
const people = [
  { id: alex, displayName: "Alex Example", active: true },
  { id: ben, displayName: "Ben Example", active: false },
  { id: carol, displayName: "Carol Example", active: true },
];
const base = {
  title: "Action",
  evidence: "",
  accepted: false,
  completed: "",
  weekEnd: 1,
  due: "",
  assignee: "",
  priority: "P0",
  status: "未开始",
};
const project = {
  startDate: "",
  history: [],
  tasks: [
    {
      ...base,
      id: "one",
      priority: "P0",
      status: "进行中",
      assignee: "Alex Example",
      assigneeId: alex,
      due: "2026-11-10",
    },
    {
      ...base,
      id: "two",
      priority: "P1",
      status: "已完成",
      assignee: "Alex Example",
      accepted: true,
      evidence: "Reviewed",
      completed: "2026-11-09",
      due: "2026-11-10",
    },
    { ...base, id: "three", priority: "P2", status: "受阻" },
    {
      ...base,
      id: "four",
      priority: "P1",
      status: "待家族确认",
      assignee: "Ben Example",
      assigneeId: ben,
      due: "2026-11-25",
    },
  ],
};
const asOf = "2026-11-16";
test("dashboard counts use accepted completion, computed due dates and unassigned people consistently", () => {
  const data = dashboardData(project, people, {}, asOf);
  assert.equal(data.total, 4);
  assert.equal(data.done, 1);
  assert.equal(data.percent, 25);
  assert.equal(data.open, 3);
  assert.equal(data.overdue, 1);
  assert.equal(data.blocked, 1);
  assert.equal(data.review, 1);
  assert.equal(data.unassigned, 1);
  assert.equal(data.noDue, 1);
  assert.equal(
    data.statuses.reduce((n, s) => n + s.count, 0),
    4,
  );
  assert.equal(data.workload.find((p) => p.key === alex).total, 2);
  assert.equal(data.workload.find((p) => p.key === ben).person.active, false);
  assert.equal(data.workload.find((p) => p.key === carol).total, 0);
  assert.deepEqual(
    data.stages.map((s) => [s.total, s.completed]),
    [
      [1, 0],
      [2, 1],
      [1, 0],
    ],
  );
  assert.equal(
    matchesDashboardTask(
      { ...base, due: "2026-11-16" },
      project,
      people,
      { focus: "overdue" },
      asOf,
    ),
    false,
  );
  assert.equal(
    matchesDashboardTask(
      { ...base, due: "", weekEnd: 1 },
      { ...project, startDate: "2026-11-01" },
      people,
      { focus: "overdue" },
      asOf,
    ),
    true,
  );
});
test("dashboard filters and drilldown select exactly the person, stage and metric requested", () => {
  assert.deepEqual(
    dashboardData(
      project,
      people,
      { person: alex, priority: "P1" },
      asOf,
    ).tasks.map((t) => t.id),
    ["two"],
  );
  assert.deepEqual(
    project.tasks
      .filter((t) =>
        matchesDashboardTask(
          t,
          project,
          people,
          { person: alex, focus: "overdue" },
          asOf,
        ),
      )
      .map((t) => t.id),
    ["one"],
  );
  assert.deepEqual(
    project.tasks
      .filter((t) =>
        matchesDashboardTask(
          t,
          project,
          people,
          { focus: "status:待家族确认" },
          asOf,
        ),
      )
      .map((t) => t.id),
    ["four"],
  );
  assert.deepEqual(
    project.tasks
      .filter((t) =>
        matchesDashboardTask(t, project, people, { focus: "unassigned" }, asOf),
      )
      .map((t) => t.id),
    ["three"],
  );
  const empty = dashboardData({ ...project, tasks: [] }, people, {}, asOf);
  assert.equal(empty.percent, 0);
  assert.equal(empty.total, 0);
  assert.ok(empty.stages.every((s) => s.percent === 0));
});
test("person keys are stable across case, whitespace and full-width input while old assignments still resolve", async () => {
  assert.equal(normalizePersonName("  ＡＬＥＸ   Example  "), "alex example");
  assert.equal(await personId("ＡＬＥＸ  Example"), alex);
  assert.match(alex, /^[a-f0-9]{64}$/);
  assert.equal(assigneeGroup({ assignee: " alex example " }, people).key, alex);
  assert.equal(assigneeGroup({ assignee: "" }, people).key, "unassigned");
});
const h = {
  s: (zh, en) => en,
  esc: (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    ),
  icon: () => "",
  lang: "en",
};
test("personnel controls require directory capability and removed assignees stay visible without appearing as new choices", () => {
  const viewer = renderPeople(
    project,
    people,
    { canManage: false, ready: true },
    h,
  );
  assert.ok(!viewer.includes('id="person-form"'));
  assert.ok(!viewer.includes("data-person-id="));
  assert.ok(viewer.includes("Ben Example"));
  const admin = renderPeople(
    project,
    people,
    { canManage: true, ready: true },
    h,
  );
  assert.ok(admin.includes('id="person-form"'));
  assert.ok(admin.includes('data-person-active="false"'));
  assert.ok(admin.includes('data-person-active="true"'));
  const fresh = assigneeSelect({ assignee: "" }, people, h);
  assert.ok(!fresh.includes("Ben Example"));
  const old = assigneeSelect({ assignee: "Ben Example" }, people, h);
  assert.ok(old.includes("Ben Example"));
  assert.ok(old.includes("Existing assignment"));
});
test("dashboard and personnel views escape names and render an empty project without invalid chart values", () => {
  const malicious = [
    { id: alex, displayName: "<img src=x onerror=alert(1)>", active: true },
  ];
  const html = renderDashboard(
    { ...project, tasks: [] },
    malicious,
    { person: "all", priority: "all" },
    h,
  );
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;img"));
  assert.ok(!/NaN|Infinity/.test(html));
  const roster = renderPeople(
    project,
    malicious,
    { canManage: true, ready: true },
    h,
  );
  assert.ok(!roster.includes("<img"));
  assert.ok(roster.includes("&lt;img"));
});

test("a failed or pending read never renders an empty directory, stale names or enabled write controls", () => {
  for (const error of ["", "Cannot read: permission denied", "Network unavailable"]) {
    const html = renderPeople(project, people, { canManage: true, ready: false, error }, h);
    assert.ok(!html.includes('class="module-empty"'));
    assert.ok(!html.includes('class="people-list"'));
    assert.ok(!html.includes('id="person-form"'));
    assert.ok(!html.includes("Alex Example"));
    if (error) {
      assert.ok(html.includes('role="alert"'));
      assert.ok(html.includes(error));
    }
  }
  const empty = renderPeople(project, [], { ready: true }, h);
  assert.ok(empty.includes("The directory is empty."));
});
