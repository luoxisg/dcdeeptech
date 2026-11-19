export const normalizePersonName = (name) =>
  String(name || "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en");
export async function personId(name) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(normalizePersonName(name)),
  );
  return Array.from(new Uint8Array(digest))
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
export function validatePersonName(name) {
  return (
    typeof name === "string" &&
    name.trim().length > 0 &&
    name.length <= 120 &&
    normalizePersonName(name).length <= 120
  );
}
export function isAccepted(task) {
  return (
    task.status === "已完成" &&
    task.accepted === true &&
    !!task.evidence?.trim() &&
    !!task.completed
  );
}
export function assigneeGroup(task, people = []) {
  if (!task.assignee?.trim())
    return { key: "unassigned", name: "", person: null };
  const person =
    people.find((p) => p.id === task.assigneeId) ||
    people.find(
      (p) =>
        normalizePersonName(p.displayName) ===
        normalizePersonName(task.assignee),
    );
  return {
    key: person?.id || "legacy:" + normalizePersonName(task.assignee),
    name: person?.displayName || task.assignee,
    person: person || null,
  };
}
