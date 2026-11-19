import { seedTasks } from "../domain/seed-tasks.mjs";
import { validateProject } from "../domain/task-schema.mjs";
import {
  normalizePersonName,
  personId,
  validatePersonName,
} from "../domain/people-model.mjs";
/** Browser storage is injected, making isolation testable with an in-memory fake. */
export function createLocalStoragePort(storage, demo = true) {
  const key = demo ? "deepfamily.dfplan.demo.v1" : "deepfamily.dfplan.v1";
  const peopleKey = demo
    ? "deepfamily.dfplan.demo.people.v1"
    : "deepfamily.dfplan.local.people.v1";
  let corrupt = false;
  const base = () => ({
    startDate: "",
    tasks: structuredClone(seedTasks),
    history: [],
  });
  const initialPeople = () =>
    demo
      ? Array.from({ length: 5 }, (_, i) => ({
          id: String(i + 1).padStart(64, "0"),
          displayName: "示例成员 " + (i + 1),
          responsibility: [
            "家族协调",
            "资料整理",
            "技术支持",
            "采访记录",
            "家族审阅",
          ][i],
          active: true,
        }))
      : [];
  function readPeople() {
    const text = storage.getItem(peopleKey);
    if (!text) return initialPeople();
    const rows = JSON.parse(text);
    if (
      !Array.isArray(rows) ||
      rows.some(
        (p) =>
          !p ||
          !validatePersonName(p.displayName) ||
          typeof p.active !== "boolean" ||
          !/^([a-f0-9]{64})$/.test(p.id),
      )
    )
      throw Error("Invalid saved directory.");
    return rows;
  }
  async function save(next, text, textEn) {
    if (corrupt)
      throw Error(
        "Saved records could not be read. Import a valid backup before saving.",
      );
    validateProject(next);
    const history = [
      ...next.history,
      {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        actor: demo ? "Demo browser" : "This device",
        text,
        textEn,
      },
    ];
    const updated = validateProject({ ...next, history });
    storage.setItem(key, JSON.stringify(updated));
    return { project: updated };
  }
  return {
    key,
    peopleKey,
    async load() {
      try {
        const text = storage.getItem(key);
        return text ? validateProject(JSON.parse(text)) : base();
      } catch (error) {
        corrupt = true;
        throw error;
      }
    },
    rawBackup: () => storage.getItem(key) || "",
    save,
    async replace(next, text, textEn) {
      validateProject(next);
      const prior = corrupt;
      corrupt = false;
      try {
        return await save(next, text, textEn);
      } catch (error) {
        corrupt = prior;
        throw error;
      }
    },
    loadPeople: async () => readPeople(),
    async addPerson(name, responsibility = "") {
      const displayName = String(name)
        .normalize("NFKC")
        .trim()
        .replace(/\s+/g, " ");
      if (!validatePersonName(displayName) || responsibility.length > 240)
        throw Error("Invalid person.");
      const people = readPeople(),
        old = people.find(
          (p) =>
            normalizePersonName(p.displayName) ===
            normalizePersonName(displayName),
        );
      if (old)
        throw Error(
          old.active ? "Person already exists." : "Restore the removed person.",
        );
      people.push({
        id: await personId(displayName),
        displayName,
        responsibility,
        active: true,
      });
      storage.setItem(peopleKey, JSON.stringify(people));
    },
    async setPersonActive(id, active) {
      const people = readPeople();
      if (!people.some((p) => p.id === id)) throw Error("Person not found.");
      storage.setItem(
        peopleKey,
        JSON.stringify(people.map((p) => (p.id === id ? { ...p, active } : p))),
      );
    },
    readPreference(key, fallback) {
      try {
        return storage.getItem(key) ?? fallback;
      } catch {
        return fallback;
      }
    },
    writePreference(key, value) {
      try {
        storage.setItem(key, value);
      } catch {}
    },
  };
}
