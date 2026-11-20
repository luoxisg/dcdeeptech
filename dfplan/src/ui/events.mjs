import { commands } from "../application/command-bus.mjs";
import { store } from "../application/store.mjs";
import { getStoragePort } from "../application/actions.mjs";
import { projectJSON, projectCSV } from "../domain/exports.mjs";
import { validateProject, today } from "../domain/task-schema.mjs";
import { t, s } from "./i18n.mjs";
function download(data, type) {
  const url = URL.createObjectURL(
      new Blob([data], {
        type: type === "csv" ? "text/csv;charset=utf-8" : "application/json",
      }),
    ),
    link = document.createElement("a");
  link.href = url;
  link.download = `DeepFamily_Plan_${today()}.${type}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  store.update({
    message: s(
      "已交给浏览器下载，请查看下载文件夹。",
      "Sent to the browser; check Downloads.",
    ),
  });
}
async function copy(text) {
  try {
    if (!navigator.clipboard?.writeText) throw Error("Clipboard unavailable");
    await navigator.clipboard.writeText(text);
    store.update({ message: s("已复制。", "Copied.") });
  } catch {
    store.update({ dialog: { kind: "copy", data: { text } }, error: "" });
  }
}
export function installUIEvents() {
  commands.register("export-json", () =>
    download(projectJSON(store.getState().project), "json"),
  );
  commands.register("export-csv", () =>
    download(
      projectCSV(store.getState().project, store.getState().language),
      "csv",
    ),
  );
  commands.register("export-raw", () => {
    const data = getStoragePort()?.rawBackup?.();
    if (!data) throw Error(s("没有旧本机记录。", "No earlier device records."));
    download(data, "json");
  });
  commands.register("copy-invite", () =>
    copy(store.getState().accountData?.link || ""),
  );
  commands.register("copy-login-url", () =>
    copy(location.origin + location.pathname),
  );
  commands.register("copy-access-request", () =>
    copy(
      s(
        "【DeepFamily 权限申请】请为我的 Google 邮箱开通访问：",
        "[DeepFamily access request] Please authorize my Google email: ",
      ) +
        (store.getState().session.user?.email || "") +
        " " +
        location.origin +
        location.pathname,
    ),
  );
  commands.register("read-import", async ({ file, confirmImport }) => {
    if (!file || confirmImport !== "true")
      throw Error(
        s("请选择文件并确认导入。", "Choose a file and confirm import."),
      );
    const project = validateProject(JSON.parse(await file.text()));
    await commands.run("import-project", { project });
  });
  document.addEventListener("click", async (event) => {
    const button = /** @type {HTMLElement|null} */ (
      event.target instanceof Element
        ? event.target.closest("[data-cmd]")
        : null
    );
    if (
      !button ||
      button.matches("form") ||
      (button.closest("form") && button.getAttribute("type") === "submit") ||
      button.matches(":disabled")
    )
      return;
    const menu = button.closest(".site-menu");
    if (menu instanceof HTMLDetailsElement) {
      menu.open = false;
      if (button.dataset.cmd === "account")
        /** @type {HTMLElement} */ (menu.querySelector("summary"))?.focus();
    }
    const payload = { ...button.dataset };
    delete payload.cmd;
    if (button.dataset.cmd === "handover-export")
      payload.includeSealed = String(
        /** @type {HTMLInputElement|null} */ (
          document.querySelector("[data-handover-sealed]")
        )?.checked === true,
      );
    if (button.dataset.cmd === "navigate")
      payload.scrollTop = /** @type {any} */ (
        document.querySelector('[data-slot="viewport"]')?.scrollTop || 0
      );
    try {
      await commands.run(button.dataset.cmd, payload);
      if (button.dataset.cmd === "account") await commands.run("load-account");
      if (menu && button.dataset.cmd === "language")
        /** @type {HTMLElement} */ (
          document.querySelector(".site-menu > summary")
        )?.focus();
    } catch (error) {
      store.update({ error: String(error.message || error) });
    }
  });
  document.addEventListener("click", (event) => {
    document.querySelectorAll(".site-menu[open]").forEach((menu) => {
      if (event.target instanceof Node && !menu.contains(event.target))
        /** @type {HTMLDetailsElement} */ (menu).open = false;
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const menu = /** @type {HTMLDetailsElement|null} */ (
      document.querySelector(".site-menu[open]")
    );
    if (menu) {
      event.preventDefault();
      menu.open = false;
      /** @type {HTMLElement} */ (menu.querySelector("summary"))?.focus();
    }
  });
  document.addEventListener("submit", async (event) => {
    const form = /** @type {HTMLFormElement} */ (event.target);
    if (!form.matches("form[data-cmd]")) return;
    event.preventDefault();
    const data = new FormData(form),
      fields = Object.fromEntries(data);
    if (form.dataset.cmd === "read-import") {
      fields.file = /** @type {any} */ (data.get("backupFile"));
    }
    try {
      await commands.run(form.dataset.cmd, fields);
    } catch (error) {
      store.update({ error: String(error.message || error) });
    }
  });
  document.addEventListener("input", (event) => {
    const element = /** @type {HTMLInputElement} */ (event.target);
    if (element.closest('form[data-cmd="save-pricing"]')) {
      const form = element.form;
      store.update({
        pricing: {
          ...store.getState().pricing,
          draft: Object.fromEntries(new FormData(form)),
        },
      });
      return;
    }
    if (element.dataset.input === "interview-draft")
      void commands.run("interview-edit", {
        language: store.getState().language,
        key: element.name,
        value: element.value,
      });
    if (element.dataset.input === "filter-query")
      commands.run("filter", { query: element.value });
    if (element.dataset.input === "capture-quantity")
      commands.run("capture-quantity", {
        id: element.dataset.quantity,
        value: element.value,
      });
  });
  document.addEventListener("change", (event) => {
    const element = /** @type {HTMLSelectElement} */ (event.target);
    const key = element.dataset.change;
    if (key === "filter-status")
      commands.run("filter", { status: element.value });
    if (key === "dashboard-person")
      commands.run("filter", { person: element.value });
    if (key === "dashboard-priority")
      commands.run("filter", { priority: element.value });
    if (key === "capture-team")
      commands.run("capture-team", { value: element.value });
  });
  let dragged = "";
  document.addEventListener("dragstart", (event) => {
    const card =
      event.target instanceof Element
        ? event.target.closest("[data-task-id]")
        : null;
    if (card) {
      dragged = card.getAttribute("data-task-id");
      event.dataTransfer?.setData("text/plain", dragged);
    }
  });
  document.addEventListener("dragover", (event) => {
    if (
      event.target instanceof Element &&
      event.target.closest("[data-drop-status]")
    )
      event.preventDefault();
  });
  document.addEventListener("drop", async (event) => {
    const column =
      event.target instanceof Element
        ? event.target.closest("[data-drop-status]")
        : null;
    if (!column || !dragged) return;
    event.preventDefault();
    try {
      await commands.run("task-status", {
        id: dragged,
        status: column.getAttribute("data-drop-status"),
      });
    } catch (error) {
      store.update({ error: String(error.message || error) });
    }
    dragged = "";
  });
}
