import { csvCell, statuses, statusEn, targetDate } from "./task-schema.mjs";
import { stewardshipFields } from "./stewardship-model.mjs";
export function projectCSV(project, language = "zh") {
  const value = (task, key) =>
    language === "en" && task[key + "En"] ? task[key + "En"] : task[key] || "";
  const header =
    language === "en"
      ? [
          "ID",
          "Action",
          "Priority",
          "Responsibility",
          "Assignee",
          "Collaborators",
          "Status",
          "Start week",
          "End week",
          "Due date",
          "Completed on",
          "Action steps",
          "Deliverables",
          "Dependencies",
          "Next steps",
          "Evidence",
          "Task accepted",
        ]
      : [
          "编号",
          "行动",
          "优先级",
          "负责人职责",
          "具体人名",
          "配合人员",
          "状态",
          "开始周",
          "结束周",
          "截止日",
          "完成日",
          "具体行动",
          "交付物",
          "前置条件",
          "下一步",
          "凭据",
          "任务已确认",
        ];
  const rows = [
    [
      ...header,
      ...stewardshipFields.map(([, zh, en]) => (language === "en" ? en : zh)),
    ],
    ...project.tasks.map((task) => [
      task.id,
      value(task, "title"),
      task.priority,
      value(task, "owner"),
      task.assignee || "",
      value(task, "collaborators"),
      language === "en"
        ? statusEn[statuses.indexOf(task.status)] || task.status
        : task.status,
      task.weekStart,
      task.weekEnd,
      targetDate(task, project.startDate),
      task.completed,
      value(task, "action"),
      value(task, "deliverable"),
      value(task, "dependency"),
      task.next,
      task.evidence,
      task.accepted
        ? language === "en"
          ? "Yes"
          : "是"
        : language === "en"
          ? "No"
          : "否",
      ...stewardshipFields.map(([key]) => task[key] || ""),
    ]),
  ];
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
export function projectJSON(project, exportedAt = new Date().toISOString()) {
  return JSON.stringify({ schemaVersion: 1, exportedAt, ...project }, null, 2);
}
