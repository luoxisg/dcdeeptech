import { store } from "../application/store.mjs";
import { html } from "./html.mjs";
import { t, s } from "./i18n.mjs";
import { icon } from "./icons.mjs";
export const routes = [
  "overview",
  "board",
  "list",
  "timeline",
  "interview",
  "facts",
  "digitization",
  "dashboard",
  "people",
  "security",
  "history",
];
export function renderHeader() {
  const state = store.getState();
  return html`<div class="header-main">
      <button class="btn brand" data-cmd="navigate" data-view="overview">
        <img src="./assets/seal.svg" alt="" width="36" height="36" /><strong
          >DeepFamily</strong
        >
      </button>
      <div class="header-controls">
        <button class="btn" data-cmd="text-scale" aria-pressed="${state.elder}">
          Aa <span>${state.elder ? t("large") : t("standard")}</span></button
        ><button
          class="btn"
          data-cmd="language"
          data-value="${state.language === "zh" ? "en" : "zh"}"
          aria-label="${s("切换为英文", "Switch to Chinese")}"
        >
          ${state.language === "zh" ? "EN" : "中文"}
        </button>
      </div>
    </div>
    <div class="header-secondary">
      <details class="site-menu">
        <summary class="btn">${t("menu")}</summary>
        <nav aria-label="${t("menu")}">
          ${routes.map((view) => html`<button class="btn" data-cmd="navigate" data-view="${view}" aria-current="${state.view === view ? "page" : "false"}">${t(view)}</button>`)}
        </nav>
      </details>
      <span class="mode-label"
        >${state.mode === "demo" ? s("演示版", "Demo") : state.ready ? s("正式共享", "Live shared") : s("正式站点", "Live workspace")}</span
      ><button class="btn" data-cmd="account">
        ${icon("people")}${state.ready ? t("account") : s("访问说明", "Access")}
      </button>
    </div>`;
}
