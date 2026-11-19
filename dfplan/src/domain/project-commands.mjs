import { validateProject, today } from "./task-schema.mjs";
import {
  readAssertions,
  writeAssertions,
  replaceOutcomeText,
} from "./stewardship-model.mjs";
/** @param {import('./types.mjs').Project} project */
export function taskFromFields(project, fields, id, people = []) {
  const old = project.tasks.find((task) => task.id === id);
  const task = {
    ...(old || {}),
    ...fields,
    id,
    weekStart: Number(fields.weekStart),
    weekEnd: Number(fields.weekEnd),
    accepted: fields.accepted === "true",
    updatedAt: new Date().toISOString(),
  };
  task.title = String(fields.title || fields.titleEn || "").trim();
  task.completed = String(fields.completed || "");
  task.evidence = String(fields.evidence || "");
  task.outcomes = replaceOutcomeText(
    old?.outcomes || "",
    String(fields.outcomes || ""),
  );
  const person = people.find((p) => p.id === fields.assigneeId && p.active);
  if (fields.assigneeId === "__historic__" && old?.assignee) {
    task.assignee = old.assignee;
    if (old.assigneeId === undefined) delete task.assigneeId;
    else task.assigneeId = old.assigneeId;
  } else if (person) {
    task.assignee = person.displayName;
    task.assigneeId = person.id;
  } else if (!fields.assigneeId) {
    task.assignee = "";
    task.assigneeId = "";
  } else if (fields.assigneeId !== old?.assigneeId)
    throw Error("Choose an active person.");
  for (const key of [
    "owner",
    "collaborators",
    "action",
    "deliverable",
    "dependency",
    "next",
    "due",
  ])
    task[key] = String(task[key] || "");
  task.status = String(task.status || "未开始");
  task.priority = String(task.priority || "P1");
  const next = {
    ...project,
    tasks: old
      ? project.tasks.map((t) => (t.id === id ? task : t))
      : [...project.tasks, task],
  };
  return validateProject(next);
}
export function nextTaskId(tasks) {
  return (
    "WU-" +
    String(
      Math.max(0, ...tasks.map((t) => Number(t.id.replace("WU-", "")) || 0)) +
        1,
    ).padStart(2, "0")
  );
}
export function changeAssertion(project, taskId, assertionId, change) {
  const task = project.tasks.find((t) => t.id === taskId);
  if (!task) throw Error("Task not found.");
  const parsed = readAssertions(task.outcomes || "");
  if (!parsed.assertions.some((a) => a.id === assertionId))
    throw Error("Fact not found.");
  const assertions = parsed.assertions.map((a) =>
    a.id === assertionId
      ? { ...a, ...change, updatedAt: new Date().toISOString() }
      : a,
  );
  return validateProject({
    ...project,
    tasks: project.tasks.map((t) =>
      t.id === taskId
        ? { ...t, outcomes: writeAssertions(parsed.text, assertions) }
        : t,
    ),
  });
}
export function addAssertion(project, taskId, text, source, note) {
  const task = project.tasks.find((t) => t.id === taskId);
  if (!task || !text.trim()) throw Error("A task and fact text are required.");
  const parsed = readAssertions(task.outcomes || "");
  const assertion = {
    id: crypto.randomUUID(),
    text: text.trim(),
    source: source.trim(),
    note: note.trim(),
    status: "unverified",
    updatedAt: new Date().toISOString(),
  };
  return validateProject({
    ...project,
    tasks: project.tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            outcomes: writeAssertions(parsed.text, [
              ...parsed.assertions,
              assertion,
            ]),
          }
        : t,
    ),
  });
}
