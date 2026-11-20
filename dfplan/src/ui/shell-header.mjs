import { store } from "../application/store.mjs";
import { html } from "./html.mjs";
import { t, s } from "./i18n.mjs";
import { icon } from "./icons.mjs";
export const secondaryRoutes = ["dashboard", "people", "security", "history"];
export function renderHeader() {
  const state = store.getState();
  return html`<div class="header-main" data-current-view="${state.view}">
      <button
        class="btn brand"
        data-cmd="navigate"
        data-view="overview"
        aria-label="${s("返回传承总览", "Go to overview")}"
      >
        <img src="./assets/seal.svg" alt="" width="36" height="36" />
        <strong class="brand-wordmark">DeepFamily</strong
        ><strong class="header-page-title">${t(state.view)}</strong>
      </button>
      <div class="header-controls">
        <button
          class="btn"
          data-cmd="text-scale"
          aria-label="${s("切换字号", "Toggle text size")}"
          aria-pressed="${state.elder}"
        >
          Aa<span class="text-scale-label"
            >${state.elder ? t("large") : t("standard")}</span
          >
        </button>
        <details class="site-menu">
          <summary class="btn" aria-label="${t("menu")}">
            ${s("更多", "More")}
          </summary>
          <nav aria-label="${t("menu")}">
            <button
              class="btn btn-primary handover-menu-entry"
              data-cmd="navigate"
              data-view="handover"
              aria-current="${state.view === "handover" ? "page" : "false"}"
            >
              ${icon("download")}${t("handover")}
            </button>
            <div class="menu-utilities">
              <span class="mode-label"
                >${state.mode === "demo" ? s("演示版", "Demo") : state.ready ? s("正式共享", "Live shared") : s("正式站点 · 未登录", "Live · signed out")}</span
              >
              <button
                class="btn"
                data-cmd="language"
                data-value="${state.language === "zh" ? "en" : "zh"}"
                aria-label="${s("切换为英文", "Switch to Chinese")}"
              >
                ${state.language === "zh" ? "EN" : "中文"}
              </button>
              <button class="btn" data-cmd="account">
                ${icon("people")}${t("account")}
              </button>
            </div>
            ${secondaryRoutes.map((view) => html`<button class="btn" data-cmd="navigate" data-view="${view}" aria-current="${state.view === view ? "page" : "false"}">${t(view)}</button>`)}
          </nav>
        </details>
      </div>
    </div>
    <nav class="desktop-primary" aria-label="${s("主导航", "Main navigation")}">
      ${["overview", "list", "facts", "digitization"].map((view) => html`<button class="btn" data-cmd="navigate" data-view="${view}" aria-current="${(view === "list" ? ["list", "board", "timeline"].includes(state.view) : state.view === view) ? "page" : "false"}">${view === "list" ? t("tasks") : t(view)}</button>`)}
      <button
        class="btn"
        data-cmd="navigate"
        data-view="handover"
        aria-current="${state.view === "handover" ? "page" : "false"}"
      >
        ${icon("download")}${t("handover")}
      </button>
      <button class="btn" data-cmd="voice-open">
        ${icon("microphone")}${t("interview")}
      </button>
    </nav>`;
}
