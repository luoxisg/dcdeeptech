import { statuses, targetDate, today } from "./task-schema.mjs";
import { stewardshipSummary } from "./stewardship-model.mjs";
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
  const workload = Array.from(groups.values())
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
