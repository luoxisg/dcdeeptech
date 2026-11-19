import { stewardshipFields } from "./stewardship-model.mjs";

export const statuses = [
  "待核实",
  "未开始",
  "进行中",
  "待家族确认",
  "受阻",
  "已完成",
];
export const statusEn = [
  "To verify",
  "Not started",
  "In progress",
  "Family review",
  "Blocked",
  "Completed",
];
export function targetDate(task, start) {
  if (task.due) return task.due;
  if (!start) return "";
  const d = new Date(start + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + task.weekEnd * 7 - 1);
  return d.toISOString().slice(0, 10);
}
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const validDate = (s) =>
  typeof s === "string" &&
  (s === "" ||
    (/^\d{4}-\d{2}-\d{2}$/.test(s) &&
      new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s));
export function validateProject(p) {
  if (
    !p ||
    !validDate(p.startDate) ||
    !Array.isArray(p.tasks) ||
    p.tasks.length > 300 ||
    !Array.isArray(p.history) ||
    p.history.length > 5000
  )
    throw Error("format");
  const ids = new Set();
  for (const t of p.tasks) {
    if (
      !t ||
      [
        "id",
        "title",
        "owner",
        "collaborators",
        "action",
        "deliverable",
        "dependency",
        "next",
        "evidence",
        "updatedAt",
        "status",
        "priority",
      ].some((k) => typeof t[k] !== "string" || t[k].length > 12000) ||
      !t.id ||
      !t.title.trim() ||
      ids.has(t.id) ||
      !statuses.includes(t.status) ||
      !["P0", "P1", "P2"].includes(t.priority) ||
      !Number.isInteger(t.weekStart) ||
      !Number.isInteger(t.weekEnd) ||
      t.weekStart < 1 ||
      t.weekEnd < t.weekStart ||
      t.weekEnd > 104 ||
      typeof t.accepted !== "boolean" ||
      !validDate(t.due) ||
      !validDate(t.completed)
    )
      throw Error("format");
    for (const [key, , , type, limit] of stewardshipFields) {
      if (
        t[key] !== undefined &&
        (type === "date"
          ? !validDate(t[key])
          : typeof t[key] !== "string" || t[key].length > (limit || 12000))
      )
        throw Error("format");
    }
    if (
      t.assignee !== undefined &&
      (typeof t.assignee !== "string" || t.assignee.length > 120)
    )
      throw Error("format");
    if (
      t.assigneeId !== undefined &&
      (typeof t.assigneeId !== "string" ||
        !/^([a-f0-9]{64})?$/.test(t.assigneeId))
    )
      throw Error("format");
    for (const k of [
      "titleEn",
      "ownerEn",
      "collaboratorsEn",
      "actionEn",
      "deliverableEn",
      "dependencyEn",
    ])
      if (
        t[k] !== undefined &&
        (typeof t[k] !== "string" || t[k].length > 12000)
      )
        throw Error("format");
    if (
      t.status === "已完成" &&
      (!t.accepted || !t.evidence.trim() || !t.completed)
    )
      throw Error("acceptance");
    ids.add(t.id);
  }
  for (const h of p.history)
    if (
      !h ||
      ["id", "at", "actor", "text"].some(
        (k) => typeof h[k] !== "string" || h[k].length > 20000,
      ) ||
      Number.isNaN(Date.parse(h.at))
    )
      throw Error("format");
  return { startDate: p.startDate, tasks: p.tasks, history: p.history };
}
export function csvCell(v) {
  let s = String(v ?? "");
  if (/^[\s\uFEFF]*[=+@-]/.test(s) || /^[\t\r\n]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}

export const taskStorageFields = [
  ...stewardshipFields.map(([key]) => key),
  "id",
  "title",
  "titleEn",
  "priority",
  "owner",
  "ownerEn",
  "assignee",
  "assigneeId",
  "collaborators",
  "collaboratorsEn",
  "action",
  "actionEn",
  "deliverable",
  "deliverableEn",
  "dependency",
  "dependencyEn",
  "weekStart",
  "weekEnd",
  "status",
  "due",
  "completed",
  "next",
  "evidence",
  "accepted",
  "updatedAt",
];

/** @returns {import('./types.mjs').Task} */
export function createTask(id) {
  return {
    id,
    title: "",
    titleEn: "",
    priority: "P1",
    owner: "",
    ownerEn: "",
    assignee: "",
    collaborators: "",
    collaboratorsEn: "",
    action: "",
    actionEn: "",
    deliverable: "",
    deliverableEn: "",
    dependency: "",
    dependencyEn: "",
    weekStart: 1,
    weekEnd: 1,
    status: "未开始",
    due: "",
    completed: "",
    next: "",
    evidence: "",
    accepted: false,
    updatedAt: "",
  };
}
