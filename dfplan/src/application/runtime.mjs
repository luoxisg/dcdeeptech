import { store } from "./store.mjs";
import { setStoragePort, getStoragePort } from "./actions.mjs";
const routes = new Set([
  "handover",
  "overview",
  "board",
  "list",
  "timeline",
  "history",
  "dashboard",
  "people",
  "security",
  "interview",
  "facts",
  "digitization",
]);
/** Storage and cloud factories are injected; application code never imports UI. */
export async function startApplication(env, factories) {
  const demo = env.url.searchParams.get("demo") === "1",
    mode = demo ? "demo" : factories.cloudEnabled ? "formal" : "local";
  const preferences = factories.local(env.storage, demo);
  const language =
    env.url.searchParams.get("lang") === "en"
      ? "en"
      : env.url.searchParams.get("lang") === "zh"
        ? "zh"
        : preferences.readPreference("deepfamily.dfplan.language", "zh") ===
            "en"
          ? "en"
          : "zh";
  const hash = env.url.hash.slice(1),
    view = routes.has(hash) ? hash : "overview";
  store.update({
    mode,
    language,
    elder:
      preferences.readPreference("deepfamily.dfplan.largeText", "true") !==
      "false",
    view,
    demoPatrick: demo && env.url.searchParams.get("role") === "patrick",
    session: { phase: mode === "formal" ? "connecting" : "local" },
  });
  if (mode !== "formal") {
    setStoragePort(preferences);
    try {
      const project = await preferences.load();
      store.update({ project, ready: true });
    } catch (error) {
      store.update({
        ready: false,
        error:
          language === "en"
            ? "Saved records could not be read. Export them before importing a valid backup."
            : "无法读取原有记录。请先导出原记录，再导入有效备份。",
      });
    }
    try {
      store.update({
        people: await preferences.loadPeople(),
        peopleReady: true,
      });
    } catch (error) {
      store.update({ peopleError: String(error.message || error) });
    }
    return;
  }
  setStoragePort(null);
  try {
    const port = await factories.cloud(
      {
        invitation: env.invitation,
        getRevision: () => store.getState().revision,
        onSession(session) {
          if (session.phase !== "ready")
            store.update({
              session,
              ready: false,
              project: { startDate: "", tasks: [], history: [] },
              people: [],
              dialog: null,
              accountData: null,
              pricing: {
                ready: false,
                loading: false,
                record: null,
                draft: null,
                error: "",
              },
            });
          else store.update({ session });
        },
        onProject(data) {
          store.update({
            project: data.project,
            revision: data.revision,
            ready: true,
            session: { ...store.getState().session, phase: "ready" },
            error: "",
          });
        },
        onError(error) {
          store.update({ error: String(error.message || error) });
        },
        onPeople(people) {
          store.update({ people, peopleReady: true, peopleError: "" });
        },
        onPeopleError(error) {
          store.update({
            peopleReady: false,
            peopleError: String(error.message || error),
          });
        },
      },
      preferences,
    );
    setStoragePort(port);
    store.update({});
  } catch (error) {
    store.update({
      ready: false,
      session: { phase: "error" },
      error: String(error.message || error),
    });
  }
}
export async function receiveStorageEvent(key) {
  const state = store.getState(),
    port = getStoragePort();
  if (state.mode !== "formal" && port && key === port.key) {
    try {
      store.update({
        project: await port.load(),
        people: await port.loadPeople(),
      });
    } catch (error) {
      store.update({ error: String(error.message || error) });
    }
  }
}
