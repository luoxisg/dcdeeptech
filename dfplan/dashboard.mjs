import { statuses, targetDate, today } from "./model.mjs";
import { stewardshipSummary, stewardshipDashboard } from "./stewardship.mjs";
import { isAccepted, assigneeGroup } from "./people-model.mjs";
export function matchesDashboardTask(
  task,
  project,
  people = [],
  selection = {},
  asOf = today(),
) {
  const { person = "all", priority = "all", focus = "all" } = selection;
  const date = targetDate(task, project.startDate),
    done = isAccepted(task);
  if (person !== "all" && assigneeGroup(task, people).key !== person)
    return false;
  if (priority !== "all" && task.priority !== priority) return false;
  if (focus === "overdue") return !done && !!date && date < asOf;
  if (focus === "blocked") return task.status === "受阻";
  if (focus === "review") return task.status === "待家族确认";
  if (focus === "unassigned") return !task.assignee?.trim();
  if (focus === "completed") return done;
  if (focus === "open") return !done;
  if (focus.startsWith("status:")) return task.status === focus.slice(7);
  return true;
}
export function dashboardData(
  project,
  people = [],
  selection = {},
  asOf = today(),
) {
  const tasks = project.tasks.filter((t) =>
    matchesDashboardTask(t, project, people, selection, asOf),
  );
  const done = tasks.filter(isAccepted).length;
  const statusesCount = statuses.map((status) => ({
    status,
    count: tasks.filter((t) => t.status === status).length,
  }));
  const stages = ["P0", "P1", "P2"].map((priority) => {
    const list = tasks.filter((t) => t.priority === priority),
      completed = list.filter(isAccepted).length;
    return {
      priority,
      total: list.length,
      completed,
      percent: list.length ? Math.round((completed / list.length) * 100) : 0,
    };
  });
  const groups = new Map();
  for (const p of people.filter((p) => p.active))
    groups.set(p.id, { key: p.id, name: p.displayName, person: p, tasks: [] });
  for (const task of tasks) {
    const group = assigneeGroup(task, people);
    if (!groups.has(group.key)) groups.set(group.key, { ...group, tasks: [] });
    groups.get(group.key).tasks.push(task);
  }
  const workload = [...groups.values()]
    .map((g) => ({
      ...g,
      total: g.tasks.length,
      completed: g.tasks.filter(isAccepted).length,
      overdue: g.tasks.filter((t) =>
        matchesDashboardTask(t, project, people, { focus: "overdue" }, asOf),
      ).length,
    }))
    .filter(
      (g) =>
        selection.person === "all" ||
        !selection.person ||
        g.key === selection.person,
    )
    .sort(
      (a, b) =>
        b.overdue - a.overdue ||
        b.total - a.total ||
        a.name.localeCompare(b.name),
    );
  return {
    stewardship: stewardshipSummary(tasks),
    tasks,
    total: tasks.length,
    done,
    open: tasks.length - done,
    percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
    overdue: tasks.filter((t) =>
      matchesDashboardTask(t, project, people, { focus: "overdue" }, asOf),
    ).length,
    blocked: tasks.filter((t) => t.status === "受阻").length,
    review: tasks.filter((t) => t.status === "待家族确认").length,
    unassigned: tasks.filter((t) => !t.assignee?.trim()).length,
    noDue: tasks.filter(
      (t) => !isAccepted(t) && !targetDate(t, project.startDate),
    ).length,
    statuses: statusesCount,
    stages,
    workload,
  };
}
export function renderDashboard(project, people, selection, h) {
  const { s, esc, icon, lang = "zh" } = h,
    data = dashboardData(project, people, selection);
  const allGroups = new Map();
  for (const p of people.filter((p) => p.active || selection.person === p.id))
    allGroups.set(p.id, { key: p.id, name: p.displayName, person: p });
  for (const t of project.tasks) {
    const g = assigneeGroup(t, people);
    if (!allGroups.has(g.key)) allGroups.set(g.key, g);
  }
  const labels =
    lang === "en"
      ? [
          "To verify",
          "Not started",
          "In progress",
          "Family review",
          "Blocked",
          "Completed",
        ]
      : statuses;
  return `<section class="df-dashboard" aria-labelledby="dashboard-title"><div class="module-heading"><div><span class="module-kicker">FAMILY DASHBOARD</span><h1 id="dashboard-title">${s("传承仪表盘", "Family dashboard")}</h1><p>${s("一眼看进度，一起把下一步做好。", "A clear view of progress and the next step together.")}</p></div><button class="module-button" data-view="people">${icon("people")}${s("人员名单", "People")}</button></div>
  <div class="dashboard-filters"><label>${s("按人员查看", "View by person")}<select id="dashboard-person-filter"><option value="all">${s("全部人员", "Everyone")}</option>${[...allGroups.values()].map((g) => `<option value="${esc(g.key)}" ${selection.person === g.key ? "selected" : ""}>${esc(g.name || s("未指定人员", "Unassigned"))}${g.person?.active === false ? s("（已移除）", " (removed)") : ""}</option>`).join("")}</select></label><label>${s("按阶段查看", "View by stage")}<select id="dashboard-priority-filter"><option value="all">${s("全部阶段", "All stages")}</option>${["P0", "P1", "P2"].map((p, i) => `<option value="${p}" ${selection.priority === p ? "selected" : ""}>${[s("P0 保护资料", "P0 Safeguard"), s("P1 采集与完善", "P1 Collect & improve"), s("P2 审阅与交接", "P2 Review & handover")][i]}</option>`).join("")}</select></label></div>
  <div class="dashboard-top"><section class="dashboard-progress" aria-label="${s("已验收完成比例", "Accepted completion rate")}"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="48" class="dash-ring-track"/><circle cx="60" cy="60" r="48" class="dash-ring-fill" pathLength="100" stroke-dasharray="${data.percent} 100"/></svg><div><strong>${data.percent}%</strong><span>${s("已验收完成", "Accepted and complete")}</span><b>${data.done} / ${data.total}</b></div></section><div class="dashboard-kpis">${[
    ["all", "list", data.total, s("全部任务", "All actions")],
    ["open", "play", data.open, s("尚未完成", "Still open")],
    ["overdue", "clock", data.overdue, s("已逾期", "Overdue")],
    ["review", "people", data.review, s("等家人确认", "Family review")],
    ["blocked", "pause", data.blocked, s("需要帮助", "Needs help")],
    ["unassigned", "question", data.unassigned, s("待指定人员", "Unassigned")],
  ]
    .map(
      ([focus, picture, count, label]) =>
        `<button class="dashboard-kpi ${focus === "overdue" && count ? "attention" : ""}" data-dashboard-focus="${focus}">${icon(picture)}<strong>${count}</strong><span>${label}</span>${icon("chevron")}</button>`,
    )
    .join("")}</div></div>
  ${data.noDue ? `<p class="module-notice">${icon("calendar")}${s(`${data.noDue} 项未完成任务尚无截止日期；设置启动日或任务截止日后，可计算是否逾期。`, `${data.noDue} open actions have no due date. Set the start date or an action’s due date to calculate overdue status.`)}</p>` : ""}
  ${stewardshipDashboard(data.tasks, { s })}
  <div class="dashboard-charts"><section class="dashboard-panel"><h2>${s("现在走到哪一步", "Where things stand")}</h2><div class="status-chart" aria-label="${s("任务状态分布", "Action status distribution")}">${data.statuses.map((row, i) => `<button class="status-chart-row" data-dashboard-status="${esc(row.status)}"><span><i class="dash-dot dash-status-${i}"></i>${esc(labels[i])}</span><span class="dash-bar"><i class="dash-status-${i}" style="width:${data.total ? (row.count / data.total) * 100 : 0}%"></i></span><b>${row.count}</b></button>`).join("")}</div></section>
  <section class="dashboard-panel"><h2>${s("三个阶段，逐步推进", "Three stages, one shared journey")}</h2>${data.stages.map((stage, i) => `<button class="dashboard-stage" data-dashboard-stage="${stage.priority}"><span>${icon(["shield", "tree", "handover"][i])}<strong>${[s("保护资料", "Safeguard"), s("采集与完善", "Collect & improve"), s("审阅与交接", "Review & handover")][i]}</strong><b>${stage.completed} / ${stage.total}</b></span><span class="dash-bar"><i style="width:${stage.percent}%"></i></span><small>${stage.percent}% ${s("已验收", "accepted")}</small></button>`).join("")}<button class="module-button" data-view="timeline">${icon("tree")}${s("打开传承时间线", "Open the legacy timeline")}</button></section></div>
  <section class="dashboard-panel"><h2>${s("每个人的任务", "Workload by person")}</h2><p>${s("点击一位家人，查看对应任务。", "Tap a person to open their actions.")}</p><div class="workload-list">${data.workload.map((row) => `<button class="workload-row" data-dashboard-person="${esc(row.key)}"><span class="person-avatar">${row.name ? esc([...row.name][0]) : icon("question")}</span><span class="workload-name"><strong>${esc(row.name || s("待指定人员", "Unassigned"))}</strong><small>${row.person?.active === false ? s("已移出人员名单", "Removed from the directory") : !row.person && row.name ? s("原有任务人名", "Existing assignment") : row.person ? s("已登记人员", "Registered person") : s("等待指定负责人", "Awaiting an assignee")}</small><span class="dash-bar"><i style="width:${row.total ? (row.completed / row.total) * 100 : 0}%"></i></span></span><span class="workload-count"><b>${row.completed} / ${row.total}</b><small class="${row.overdue ? "dash-late" : ""}">${row.overdue ? s(`${row.overdue} 项逾期`, `${row.overdue} overdue`) : s("项已验收", "accepted")}</small></span>${icon("chevron")}</button>`).join("") || `<p class="module-empty">${s("暂无任务。可以先增加一件事。", "No actions yet. Start by adding an action.")}</p>`}</div></section></section>`;
}
