import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  taskProgress,
  weeklyFocus,
  renderWeeklyFocus,
  renderFormalAcceptance,
  environmentState,
  renderEnvironmentNotice,
  renderDashboard,
  dashboardData,
} from "../../dfplan/dashboard.mjs";
import { validateProject, csvCell, targetDate } from "../../dfplan/model.mjs";
import { isAccepted } from "../../dfplan/people-model.mjs";
const loadSource = async (path) => {
  const url = new URL(path, import.meta.url);
  const source = readFileSync(url, "utf8").replace(
    /from "(\.\/[^\"]+)"/g,
    (_, p) => `from "${new URL(p, url).href}"`,
  );
  return import("data:text/javascript," + encodeURIComponent(source));
};
const { seedTasks } = await loadSource("../../dfplan/data.js");
const { renderPhone } = await loadSource("../../dfplan/phone-ui.js");
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const helper = (lang) => ({
  lang,
  s: (zh, en) => (lang === "en" ? en : zh),
  esc,
  icon: (name) =>
    `<svg class="icon" aria-hidden="true" data-icon="${name}"></svg>`,
  art: () => '<svg aria-hidden="true"></svg>',
  value: (t, k) => (lang === "en" && t[k + "En"] ? t[k + "En"] : t[k] || ""),
  complete: isAccepted,
  due: (t) => targetDate(t, ""),
  dateLabel: (d) => d || "—",
  fmt: (s) => s,
  filtered: () => [],
});
const fresh = () => ({
  startDate: "",
  tasks: structuredClone(seedTasks),
  history: [
    {
      id: "old-1",
      at: "2026-11-01T00:00:00Z",
      actor: "Earlier member",
      text: "Previous activity",
      textEn: "Previous activity",
    },
  ],
});
const freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

test("task status completion never establishes independent family acceptance", () => {
  const p = fresh();
  p.tasks[0].status = "已完成"; // No checkbox, evidence or review record.
  assert.deepEqual(taskProgress(p.tasks), {
    total: 10,
    completed: 1,
    percent: 10,
  });
  p.tasks.forEach((t) =>
    Object.assign(t, {
      status: "已完成",
      accepted: true,
      evidence: "Legacy checkbox evidence",
      completed: "2026-11-01",
    }),
  );
  assert.equal(taskProgress(p.tasks).percent, 100);
  for (const lang of ["zh", "en"]) {
    const html = renderFormalAcceptance(helper(lang));
    assert.match(html, lang === "zh" ? /未验证/ : /Unverified/);
    assert.doesNotMatch(html, /%|progressbar|aria-valuenow/);
    assert.match(
      html,
      lang === "zh" ? /独立审核数据/ : /independent review data/,
    );
  }
  assert.deepEqual(taskProgress([]), { total: 0, completed: 0, percent: null });
});
test("weekly focus orders open WU-01..05, reminds WU-10 early and never invents missing tasks", () => {
  const tasks = fresh().tasks.reverse();
  tasks.find((t) => t.id === "WU-02").status = "已完成";
  assert.deepEqual(
    weeklyFocus(tasks).priorities.map((t) => t.id),
    ["WU-01", "WU-03", "WU-04", "WU-05"],
  );
  assert.equal(weeklyFocus(tasks).handover.id, "WU-10");
  assert.deepEqual(weeklyFocus([]), { priorities: [], handover: null });
  const html = renderWeeklyFocus(tasks, helper("zh"));
  assert.match(html, /预算上限/);
  assert.match(html, /备份保管人/);
  assert.match(html, /接班安排/);
  assert.doesNotMatch(html, /data-id="WU-02"/);
  tasks.find((t) => t.id === "WU-01").title = "<img src=x onerror=alert(1)>";
  assert.doesNotMatch(renderWeeklyFocus(tasks, helper("zh")), /<img/);
});
test("legacy project, ten tasks, assignments, acceptance fields and history stay byte-for-byte unchanged", () => {
  const p = fresh();
  p.tasks[0].assignee = "Example person";
  const before = JSON.stringify(p);
  freeze(p);
  for (const lang of ["zh", "en"]) {
    taskProgress(p.tasks);
    weeklyFocus(p.tasks);
    renderWeeklyFocus(p.tasks, helper(lang));
    renderDashboard(p, [], { person: "all", priority: "all" }, helper(lang));
    renderPhone(
      {
        project: p,
        view: "overview",
        query: "",
        filter: "all",
        owner: "",
        category: "all",
        largeText: true,
        storageIssue: false,
        cloudEnabled: false,
        lang,
      },
      helper(lang),
    );
  }
  assert.equal(JSON.stringify(p), before);
  assert.equal(validateProject(p).tasks.length, 10);
  assert.equal(JSON.stringify(validateProject(JSON.parse(before))), before);
  assert.equal(csvCell('A,"B"'), '"A,""B"""');
});
test("dashboard filtering retains its charts and drilldowns; formal acceptance stays unverified", () => {
  const p = fresh();
  Object.assign(p.tasks[0], {
    status: "已完成",
    accepted: true,
    evidence: "E-1",
    completed: "2026-11-01",
  });
  const data = dashboardData(p, [], { person: "all", priority: "P0" });
  const html = renderDashboard(
    p,
    [],
    { person: "all", priority: "P0" },
    helper("en"),
  );
  assert.equal(data.done, 1);
  assert.match(html, /Task completion progress/);
  assert.match(html, /Unverified/);
  assert.match(html, /data-dashboard-stage/);
  assert.match(html, /data-dashboard-status/);
  assert.match(html, /data-dashboard-person/);
  assert.match(html, /project-wide reminders do not follow dashboard filters/);
  assert.match(html, /data-id="WU-05"/); // P1 reminder stays visible even with a P0 chart filter.
  assert.match(
    renderDashboard({ ...p, tasks: [] }, [], {}, helper("en")),
    /<strong>—<\/strong>/,
  );
});
test("demo, signed-out, restricted, checking, authorized and local notices stay distinct", () => {
  assert.equal(
    environmentState({
      demo: true,
      cloudEnabled: true,
      ready: true,
      phase: "ready",
    }),
    "demo",
  );
  assert.equal(
    environmentState({ cloudEnabled: true, phase: "signed-out" }),
    "signed-out",
  );
  assert.equal(
    environmentState({ cloudEnabled: true, phase: "denied" }),
    "restricted",
  );
  assert.equal(
    environmentState({ cloudEnabled: true, phase: "checking", ready: true }),
    "checking",
  );
  assert.equal(
    environmentState({ cloudEnabled: true, phase: "ready", ready: true }),
    "formal",
  );
  assert.equal(environmentState({ cloudEnabled: false }), "local");
  for (const lang of ["zh", "en"]) {
    const demo = renderEnvironmentNotice({ demo: true }, helper(lang));
    assert.match(demo, /data-environment="demo"/);
    assert.match(
      demo,
      lang === "zh"
        ? /不读取或写入正式家族记录/
        : /production family records are not read or updated/,
    );
    assert.match(
      renderEnvironmentNotice(
        { cloudEnabled: true, phase: "signed-out" },
        helper(lang),
      ),
      lang === "zh" ? /未登录/ : /Signed out/,
    );
  }
});
test("phone overview retains large-text controls, exports navigation, focus actions and bilingual separate summaries", () => {
  const p = fresh();
  for (const lang of ["zh", "en"]) {
    const html = renderPhone(
      {
        project: p,
        view: "overview",
        query: "",
        filter: "all",
        owner: "",
        category: "all",
        largeText: true,
        storageIssue: false,
        cloudEnabled: false,
        lang,
      },
      helper(lang),
    );
    assert.match(
      html,
      lang === "zh" ? /任务完成进度/ : /Task completion progress/,
    );
    assert.match(
      html,
      lang === "zh" ? /家族正式验收状态/ : /Formal family acceptance status/,
    );
    assert.match(html, lang === "zh" ? /未验证/ : /Unverified/);
    assert.match(html, /data-action="text-size" aria-pressed="true"/);
    assert.match(html, /data-view="dashboard"/);
    assert.match(html, /data-view="people"/);
    assert.match(html, /data-id="WU-10"/);
    const tools = renderPhone(
      {
        project: p,
        view: "history",
        query: "",
        filter: "all",
        owner: "",
        category: "all",
        largeText: true,
        storageIssue: false,
        cloudEnabled: false,
        lang,
      },
      helper(lang),
    );
    assert.match(tools, /data-action="export-json"/);
    assert.match(tools, /data-action="export-csv"/);
    assert.match(tools, /Previous activity/);
  }
  const html = renderPhone(
    {
      project: { ...p, tasks: [] },
      view: "overview",
      category: "all",
      lang: "en",
    },
    helper("en"),
  );
  assert.match(html, /aria-valuetext="No actions"/);
  assert.doesNotMatch(html, /aria-valuenow="null"|NaN%/);
});
