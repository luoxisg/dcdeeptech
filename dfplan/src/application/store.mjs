import { captureCatalog } from "../domain/capture-catalog.mjs";
/** @typedef {import('../domain/types.mjs').AppState} AppState */
/** @param {Partial<AppState>} seed */
export function createStore(seed = {}) {
  /** @type {AppState} */
  let state = {
    mode: "demo",
    project: { startDate: "", tasks: [], history: [] },
    people: [],
    session: { phase: "signed-out" },
    ready: false,
    language: "zh",
    elder: true,
    view: "overview",
    scrollTop: {},
    filter: {
      query: "",
      status: "all",
      person: "all",
      priority: "all",
      focus: "all",
    },
    dialog: null,
    message: "",
    error: "",
    busy: false,
    revision: 0,
    peopleReady: false,
    peopleError: "",
    pricing: {
      ready: false,
      loading: false,
      record: null,
      error: "",
      draft: null,
    },
    capture: Object.fromEntries(
      captureCatalog.map((row) => [row.id, row.quantity]),
    ),
    team: 4,
    captureCategory: 0,
    demoPatrick: false,
    accountData: null,
    ...seed,
  };
  const listeners = new Set();
  return {
    getState: () => state,
    /** @param {Partial<AppState> | ((s:AppState)=>Partial<AppState>)} change */
    update(change) {
      const previous = state;
      state = {
        ...state,
        ...(typeof change === "function" ? change(state) : change),
      };
      listeners.forEach((listener) => listener(state, previous));
      return state;
    },
    /** @param {(state:AppState,previous:AppState)=>void} listener */
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    navigate(view, scrollTop = 0) {
      const previous = state;
      state = {
        ...state,
        view,
        filter: {
          query: "",
          status: "all",
          person: "all",
          priority: "all",
          focus: "all",
        },
        scrollTop: { ...state.scrollTop, [state.view]: scrollTop },
      };
      listeners.forEach((listener) => listener(state, previous));
    },
  };
}
export const store = createStore();
