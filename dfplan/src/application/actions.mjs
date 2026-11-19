import { store } from "./store.mjs";
import { commands } from "./command-bus.mjs";
import { validateProject } from "../domain/task-schema.mjs";
import {
  taskFromFields,
  nextTaskId,
  changeAssertion,
  addAssertion,
} from "../domain/project-commands.mjs";
import {
  canEditUnitPricing,
  unitRateKeys,
  centsFromSGD,
  validateUnitRates,
} from "../domain/unit-pricing.mjs";
/** @type {any} */ let port = null;
export function setStoragePort(value) {
  port = value;
}
export function getStoragePort() {
  return port;
}
export async function commitProject(
  next,
  text = "Updated project",
  textEn = text,
  replace = false,
) {
  const current = store.getState();
  if (
    (!current.ready && !(replace && current.mode !== "formal")) ||
    current.busy ||
    !port
  )
    throw Error("Wait for authorized records to load.");
  validateProject(next);
  store.update({ busy: true, error: "" });
  try {
    const result = await (replace && port.replace
      ? port.replace(next, text, textEn)
      : port.save(next, text, textEn));
    if (
      current.mode === "formal" &&
      (!store.getState().ready ||
        store.getState().session.user?.uid !== current.session.user?.uid)
    )
      return;
    if (result?.project) store.update({ project: result.project, ready: true });
    store.update({ dialog: null, message: textEn });
  } catch (error) {
    store.update({ error: error.message || String(error) });
    throw error;
  } finally {
    store.update({ busy: false });
  }
}
export function canManagePeople() {
  const state = store.getState();
  return (
    state.ready &&
    (state.mode === "demo"
      ? state.demoPatrick
      : state.session.admin?.canManagePeople === true)
  );
}
export function installCommands() {
  commands.register("navigate", ({ view, scrollTop = 0 }) =>
    store.navigate(view, scrollTop),
  );
  commands.register("language", ({ value }) => {
    const language = value === "en" ? "en" : "zh";
    store.update({ language });
    port?.writePreference("deepfamily.dfplan.language", language);
  });
  commands.register("text-scale", () => {
    const elder = !store.getState().elder;
    store.update({ elder });
    port?.writePreference("deepfamily.dfplan.largeText", String(elder));
  });
  commands.register("dashboard-focus", (payload) => {
    store.navigate("list", 0);
    store.update({ filter: { ...store.getState().filter, ...payload } });
  });
  commands.register("person-dialog", () =>
    store.update({ dialog: { kind: "person" }, error: "" }),
  );
  commands.register("filter", (payload) =>
    store.update({ filter: { ...store.getState().filter, ...payload } }),
  );
  commands.register("editor", ({ id }) => {
    const state = store.getState(),
      task = state.project.tasks.find((t) => t.id === id);
    store.update({
      dialog: {
        kind: "editor",
        taskId: id || nextTaskId(state.project.tasks),
        data: {
          revision: state.revision,
          updatedAt: task?.updatedAt,
          wasNew: !task,
        },
      },
      error: "",
    });
  });
  for (const kind of ["start", "import", "account", "assertion"])
    commands.register(kind, (payload) =>
      store.update({ dialog: { kind, ...payload }, error: "" }),
    );
  commands.register("close", () =>
    store.update({ dialog: null, accountData: null, error: "" }),
  );
  commands.register("save-task", async (fields) => {
    const state = store.getState(),
      baseline = state.dialog.data,
      task = state.project.tasks.find((t) => t.id === state.dialog.taskId);
    if (
      baseline &&
      (baseline.wasNew
        ? !!task
        : task?.updatedAt !== baseline.updatedAt ||
          (state.mode === "formal" && state.revision !== baseline.revision))
    )
      throw Error("This action changed elsewhere. Reopen it before saving.");
    const next = taskFromFields(
      state.project,
      fields,
      state.dialog.taskId,
      state.people,
    );
    await commitProject(next, "更新行动", "Updated action");
  });
  commands.register("task-status", async ({ id, status }) => {
    const state = store.getState(),
      task = state.project.tasks.find((t) => t.id === id);
    if (!task) throw Error("Task not found.");
    const next = {
      ...state.project,
      tasks: state.project.tasks.map((t) =>
        t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t,
      ),
    };
    try {
      validateProject(next);
    } catch {
      store.update({
        dialog: { kind: "editor", taskId: id },
        error:
          "Confirm evidence, completion date and task acceptance before marking complete.",
      });
      return;
    }
    await commitProject(next, "更新任务状态", "Updated action status");
  });
  commands.register("save-start", async (fields) =>
    commitProject(
      { ...store.getState().project, startDate: fields.startDate },
      "调整启动日期",
      "Updated start date",
    ),
  );
  commands.register("import-project", async ({ project }) =>
    commitProject(
      validateProject(project),
      "导入项目备份",
      "Imported project backup",
      true,
    ),
  );
  commands.register("demo-patrick", () => {
    if (store.getState().mode !== "demo") return;
    store.update({
      demoPatrick: !store.getState().demoPatrick,
      view: "people",
    });
  });
  commands.register("add-person", async (fields) => {
    if (!canManagePeople()) throw Error("Directory permission required.");
    await port.addPerson(fields.displayName, fields.responsibility);
    store.update({ people: await port.loadPeople(), dialog: null });
  });
  commands.register("person-active", async ({ id, active }) => {
    if (!canManagePeople()) throw Error("Directory permission required.");
    await port.setPersonActive(id, active === "true" || active === true);
    store.update({ people: await port.loadPeople() });
  });
  commands.register("capture-quantity", ({ id, value }) => {
    const quantity = Math.max(0, Math.min(100000, Number(value) || 0));
    store.update({ capture: { ...store.getState().capture, [id]: quantity } });
  });
  commands.register("capture-step", ({ id, delta }) =>
    commands.run("capture-quantity", {
      id,
      value: (store.getState().capture[id] || 0) + Number(delta),
    }),
  );
  commands.register("capture-category", ({ value }) =>
    store.update({
      captureCategory: Math.max(0, Math.min(3, Number(value) || 0)),
    }),
  );
  commands.register("capture-team", ({ value }) =>
    store.update({ team: Number(value) === 2 ? 2 : 4 }),
  );
  commands.register("fact-status", async ({ taskId, id, status }) => {
    if (!["confirmed", "conflict"].includes(status))
      throw Error("Invalid fact status.");
    await commitProject(
      changeAssertion(store.getState().project, taskId, id, { status }),
      "更新事实核实",
      "Updated fact verification",
    );
  });
  commands.register("fact-note", ({ taskId, id }) =>
    store.update({
      dialog: {
        kind: "assertion",
        taskId,
        assertionId: id,
        data: {
          outcomes: store.getState().project.tasks.find((t) => t.id === taskId)
            ?.outcomes,
        },
      },
      error: "",
    }),
  );
  commands.register("save-assertion", async (fields) => {
    const state = store.getState(),
      dialog = state.dialog;
    if (
      dialog.assertionId &&
      state.project.tasks.find((t) => t.id === dialog.taskId)?.outcomes !==
        dialog.data?.outcomes
    )
      throw Error("Fact records changed elsewhere. Reopen before saving.");
    const next = dialog.assertionId
      ? changeAssertion(
          state.project,
          fields.taskId || dialog.taskId,
          dialog.assertionId,
          { note: fields.note, source: fields.source },
        )
      : addAssertion(
          state.project,
          fields.taskId,
          fields.text,
          fields.source,
          fields.note,
        );
    await commitProject(next, "记录事实笔记", "Recorded fact notes");
  });
  commands.register("refresh-pricing", async () => {
    const owner = store.getState(),
      storagePort = port;
    if (owner.mode !== "formal" || !owner.ready || !storagePort?.api) return;
    store.update({
      pricing: { ...store.getState().pricing, loading: true, error: "" },
    });
    try {
      const record = await storagePort.api.getPricing();
      if (
        port === storagePort &&
        store.getState().ready &&
        store.getState().session.user?.uid === owner.session.user?.uid
      )
        store.update({
          pricing: {
            ready: true,
            loading: false,
            record,
            draft: null,
            error: "",
          },
        });
    } catch (error) {
      if (
        port !== storagePort ||
        store.getState().session.user?.uid !== owner.session.user?.uid
      )
        return;
      store.update({
        pricing: {
          ready: false,
          loading: false,
          record: null,
          draft: null,
          error: error.message || "Cannot read shared pricing.",
        },
      });
    }
  });
  commands.register("save-pricing", async (fields) => {
    const state = store.getState();
    if (
      !canEditUnitPricing(state.session, state.mode === "demo") ||
      !state.pricing.ready
    )
      throw Error("Google administrator permission required.");
    const rates = validateUnitRates(
      Object.fromEntries(unitRateKeys.map((k) => [k, centsFromSGD(fields[k])])),
    );
    const record = await port.api.savePricing(
      rates,
      state.pricing.record?.revision || 0,
      fields.reason,
    );
    if (
      !canEditUnitPricing(
        store.getState().session,
        store.getState().mode === "demo",
      ) ||
      store.getState().session.user?.uid !== state.session.user?.uid
    )
      return;
    store.update({
      pricing: { ...state.pricing, record, error: "" },
      message: "Shared rates published.",
    });
  });
  for (const [command, method] of [
    ["login", "login"],
    ["invite-enter", "loginWithLink"],
    ["logout", "logout"],
    ["initialize", "initialize"],
  ])
    commands.register(command, async () => {
      if (!port?.api) throw Error("Cloud access is not ready.");
      await port.api[method]();
    });
  commands.register("refresh", async () => {
    if (port?.api) {
      await port.api.refresh();
      store.update({ people: await port.loadPeople() });
    } else if (port)
      store.update({
        project: await port.load(),
        people: await port.loadPeople(),
      });
  });
  commands.register("load-account", async () => {
    const state = store.getState();
    if (state.mode !== "formal" || !state.session.admin) return;
    const admin = ["owner", "admin"].includes(state.session.admin.role);
    const members = admin ? await port.api.listAdmins() : [];
    const invites =
      state.session.admin.role === "owner" ? await port.api.listInvites() : [];
    store.update({ accountData: { members, invites } });
  });
  commands.register("add-admin", async (fields) => {
    await port.api.addAdmin(fields.email, fields.displayName);
    await commands.run("load-account");
  });
  commands.register("admin-active", async ({ email, active }) => {
    await port.api.setAdminActive(email, active === "true");
    await commands.run("load-account");
  });
  commands.register("create-invite", async () => {
    const link = await port.api.createPatrickLink();
    await commands.run("load-account");
    store.update({ accountData: { ...store.getState().accountData, link } });
  });
  commands.register("revoke-invite", async ({ id }) => {
    await port.api.revokeInvite(id);
    await commands.run("load-account");
  });
}
