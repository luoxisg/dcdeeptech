import { store } from "../application/store.mjs";
import { commands } from "../application/command-bus.mjs";
import { getStoragePort } from "../application/actions.mjs";
import { html, mount } from "./html.mjs";
import { renderHeader } from "./shell-header.mjs";
import { renderMobileNav } from "./shell-nav-mobile.mjs";
import { modeNotice } from "./components.mjs";
import { t, s } from "./i18n.mjs";
import { installSwipeDismiss } from "./keyboard-viewport.mjs";
const views = {
  overview: () => import("./views/overview.mjs"),
  board: () => import("./views/board.mjs"),
  list: () => import("./views/list.mjs"),
  timeline: () => import("./views/timeline.mjs"),
  history: () => import("./views/history.mjs"),
  dashboard: () => import("./views/dashboard.mjs"),
  people: () => import("./views/people.mjs"),
  interview: () => import("./views/interview.mjs"),
  facts: () => import("./views/facts.mjs"),
  digitization: () => import("./views/digitization.mjs"),
  security: () => import("./views/security.mjs"),
  gate: () => import("./views/gate.mjs"),
};
const dialogs = {
  editor: () => import("./dialogs/editor.mjs"),
  start: () => import("./dialogs/start.mjs"),
  import: () => import("./dialogs/import.mjs"),
  account: () => import("./dialogs/account.mjs"),
  person: () => import("./dialogs/person.mjs"),
  assertion: () => import("./dialogs/assertion.mjs"),
  interview: () => import("./dialogs/interview.mjs"),
  "interview-reset": () => import("./dialogs/interview.mjs"),
  copy: () => import("./dialogs/copy.mjs"),
};
/** Four orthogonal mount regions; editing a field never rebuilds its form. */
export function installRenderer() {
  const header = document.querySelector('[data-slot="header"]'),
    viewport = /** @type {HTMLElement} */ (
      document.querySelector('[data-slot="viewport"]')
    ),
    tabbar = document.querySelector('[data-slot="mobile-tabbar"]'),
    overlay = document.querySelector('[data-slot="overlay"]');
  const measureTabbar = () =>
    document.documentElement.style.setProperty(
      "--mobile-nav-height",
      `${Math.ceil(tabbar.getBoundingClientRect().height)}px`,
    );
  const tabbarObserver = new ResizeObserver(measureTabbar);
  tabbarObserver.observe(tabbar);
  let viewEpoch = 0,
    dialogEpoch = 0,
    activeView = null,
    lastDialog = null,
    lastAccount = null,
    lastLanguage = "",
    opener = null,
    renderedRoute = "";
  const feedback = () => {
    const state = store.getState(),
      error = document.querySelector("[data-feedback]");
    if (error) {
      error.textContent = state.error;
      error.toggleAttribute("hidden", !state.error);
    }
    const sheetError = document.querySelector(".sheet-error");
    if (sheetError) sheetError.textContent = state.error;
    const status = document.querySelector("[data-live-message]");
    if (status) status.textContent = state.message;
    const submitStatus = document.querySelector("[data-submit-status]");
    if (submitStatus)
      submitStatus.textContent = state.busy ? s("正在保存…", "Saving…") : "";
    document
      .querySelectorAll('dialog[open] button[type="submit"]')
      .forEach((button) => {
        /** @type {HTMLButtonElement} */ (button).disabled = state.busy;
      });
  };
  async function renderViewport(state, previous, force = false) {
    const route = state.ready ? state.view : "gate",
      epoch = ++viewEpoch;
    if (!force && activeView && renderedRoute === route) {
      if (state.capture !== previous.capture || state.team !== previous.team) {
        activeView.updateTotals?.();
        return;
      }
      if (state.captureCategory !== previous.captureCategory) {
        activeView.updateCategory?.();
        return;
      }
      if (
        state.filter !== previous.filter &&
        ["board", "list", "timeline"].includes(route)
      ) {
        const results = viewport.querySelector("[data-list-results]");
        if (results) mount(results, activeView.rows());
        return;
      }
    }
    activeView?.unmount?.(route !== renderedRoute);
    const module = await (views[route] || views.overview)();
    if (epoch !== viewEpoch) return;
    activeView = module;
    renderedRoute = route;
    const recovery = !state.ready && state.mode !== "formal";
    const content = recovery
      ? html`<section class="panel">
          <h1>${s("读取本机记录", "Reading device records")}</h1>
          <p>${state.error || t("loading")}</p>
          <button class="btn" data-cmd="export-raw">
            ${s("导出原有记录", "Export existing records")}</button
          ><button class="btn" data-cmd="import">${t("import")}</button>
        </section>`
      : module.render();
    const keepScroll =
      state.view === previous.view
        ? viewport.scrollTop
        : state.scrollTop[state.view] || 0;
    mount(
      viewport,
      html`<main id="main" tabindex="-1">
        ${modeNotice(route === "interview")}
        <p class="notice error" data-feedback hidden></p>
        ${content}
      </main>`,
    );
    if (!recovery) module.mount?.();
    viewport.scrollTop = keepScroll;
    if (state.view !== previous.view) {
      /** @type {HTMLElement} */ (
        viewport.querySelector("#page-title")
      )?.focus?.({ preventScroll: true });
      requestAnimationFrame(() => {
        viewport.scrollTop = state.scrollTop[state.view] || 0;
      });
    }
    feedback();
    if (
      route === "digitization" &&
      state.mode === "formal" &&
      getStoragePort()?.api &&
      !state.pricing.ready &&
      !state.pricing.loading &&
      !state.pricing.error
    )
      commands
        .run("refresh-pricing")
        .catch((error) =>
          store.update({ error: String(error.message || error) }),
        );
  }
  async function renderOverlay(state) {
    if (
      state.dialog === lastDialog &&
      state.accountData === lastAccount &&
      state.language === lastLanguage
    )
      return;
    const sameDialog = state.dialog === lastDialog;
    const old = /** @type {HTMLDialogElement|null} */ (
      overlay.querySelector("dialog")
    );
    const draft = old
      ? Array.from(old.querySelectorAll("input,select,textarea")).map((el) => ({
          name: el.getAttribute("name"),
          value: /** @type {HTMLInputElement} */ (el).value,
          checked: /** @type {HTMLInputElement} */ (el).checked,
        }))
      : [];
    const epoch = ++dialogEpoch;
    lastDialog = state.dialog;
    lastAccount = state.accountData;
    lastLanguage = state.language;
    if (!state.dialog) {
      old?.close();
      mount(overlay, html``);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
      opener = null;
      return;
    }
    const loader = dialogs[state.dialog.kind];
    if (!loader) return;
    if (!old) opener = document.activeElement;
    const module = await loader();
    if (epoch !== dialogEpoch) return;
    old?.close();
    mount(
      overlay,
      html`<dialog
        id="${state.dialog.kind}"
        class="sheet"
        aria-labelledby="sheet-title"
        data-dialog="${state.dialog.kind}"
      >
        ${module.render()}
      </dialog>`,
    );
    const dialog = /** @type {HTMLDialogElement} */ (
      overlay.querySelector("dialog")
    );
    if (sameDialog)
      for (const saved of draft) {
        const field = /** @type {HTMLInputElement} */ (
          Array.from(dialog.querySelectorAll("[name]")).find(
            (el) => el.getAttribute("name") === saved.name,
          )
        );
        if (field) {
          field.value = saved.value;
          if (field.type === "checkbox") field.checked = saved.checked;
        }
      }
    dialog.showModal();
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      commands.run("close");
    });
    installSwipeDismiss(dialog, () => commands.run("close"));
    feedback();
  }
  const initial = store.getState();
  const render = (state, previous) => {
    document.documentElement.lang = state.language === "en" ? "en" : "zh-CN";
    document.documentElement.dataset.textScale = state.elder
      ? "elder"
      : "standard";
    const viewportShellChange =
      state.view !== previous.view ||
      state.language !== previous.language ||
      state.mode !== previous.mode ||
      state.session !== previous.session ||
      state.ready !== previous.ready;
    const shellChange = viewportShellChange || state.elder !== previous.elder;
    if (shellChange || !header.childNodes.length) {
      mount(
        header,
        html`${renderHeader()}
          <p data-live-message class="live-message" role="status"></p>`,
      );
      mount(tabbar, renderMobileNav());
    }
    if (state.view !== previous.view) {
      const url = new URL(location.href);
      url.hash = state.view;
      history.replaceState(null, "", url);
    }
    if (state.language !== previous.language) {
      const url = new URL(location.href);
      url.searchParams.set("lang", state.language);
      history.replaceState(null, "", url);
    }
    const pricingChange =
      state.pricing.record !== previous.pricing.record ||
      state.pricing.ready !== previous.pricing.ready ||
      state.pricing.loading !== previous.pricing.loading ||
      state.pricing.error !== previous.pricing.error;
    if (
      viewportShellChange ||
      state.project !== previous.project ||
      state.people !== previous.people ||
      state.filter !== previous.filter ||
      state.demoPatrick !== previous.demoPatrick ||
      state.peopleError !== previous.peopleError ||
      state.peopleReady !== previous.peopleReady ||
      state.capture !== previous.capture ||
      state.team !== previous.team ||
      state.captureCategory !== previous.captureCategory ||
      pricingChange ||
      !viewport.childNodes.length
    )
      void renderViewport(
        state,
        previous,
        viewportShellChange ||
          state.project !== previous.project ||
          pricingChange,
      );
    void renderOverlay(state);
    feedback();
  };
  render(initial, initial);
  const unsubscribe = store.subscribe(render);
  return () => {
    unsubscribe();
    tabbarObserver.disconnect();
  };
}
