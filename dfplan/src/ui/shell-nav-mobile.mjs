import { store } from "../application/store.mjs";
import { html } from "./html.mjs";
import { t } from "./i18n.mjs";
import { icon } from "./icons.mjs";
export function renderMobileNav() {
  const view = store.getState().view;
  return html`<nav class="mobile-tabs" aria-label="${t("menu")}">
    ${[
      ["overview", "home", "overview"],
      ["list", "tasks", "tasks"],
      ["facts", "facts", "facts"],
      ["digitization", "capture", "digitization"],
    ].map(
      ([route, picture, label]) =>
        html`<button
          class="tab-item"
          data-cmd="navigate"
          data-view="${route}"
          aria-current="${(route === "list" ? ["list", "board", "timeline"].includes(view) : view === route) ? "page" : "false"}"
        >
          ${icon(picture)}<span>${t(label)}</span>
        </button>`,
    )}
  </nav>`;
}
