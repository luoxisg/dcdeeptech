const graph = {
  IDLE: ["LISTENING"],
  LISTENING: ["THINKING", "REVIEWING", "IDLE"],
  THINKING: ["SPEAKING", "LISTENING", "REVIEWING", "IDLE"],
  SPEAKING: ["LISTENING", "REVIEWING", "IDLE"],
  REVIEWING: ["LISTENING", "IDLE"],
};
export function createSession(lang = "zh") {
  return { state: "IDLE", lang: lang === "en" ? "en" : "zh", turns: [], entities: [], draft: null };
}
export function transition(session, state) {
  if (session.state === state) return session;
  if (!graph[session.state]?.includes(state)) throw new Error(`Invalid voice transition: ${session.state} → ${state}`);
  return { ...session, state };
}
export function interrupt(session) {
  return ["THINKING", "SPEAKING"].includes(session.state) ? transition(session, "LISTENING") : session;
}
export function appendTurn(session, role, text) {
  if (!["user", "assistant"].includes(role) || !String(text).trim()) return session;
  return { ...session, turns: [...session.turns, { role, text: String(text).trim() }] };
}
export function addEntity(session, kind, value) {
  value = String(value ?? "").trim();
  if (!["time", "person", "place"].includes(kind) || !value) return session;
  const key = (v) => v.normalize("NFKC").replace(/\s+/g, " ").toLocaleLowerCase();
  if (session.entities.some((e) => e.kind === kind && key(e.value) === key(value))) return session;
  return { ...session, entities: [...session.entities, { kind, value }] };
}
export function setDraft(session, title, markdown) {
  return { ...session, draft: { title: String(title), markdown: String(markdown) } };
}
