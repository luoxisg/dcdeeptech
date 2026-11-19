import { store } from "../../application/store.mjs";
import { canManagePeople } from "../../application/actions.mjs";
import { html } from "../html.mjs";
import { t, s } from "../i18n.mjs";
import { pageTitle } from "../components.mjs";
export function render() {
  const state = store.getState(),
    manage = canManagePeople() && state.peopleReady;
  return html`${pageTitle(t("people"), s("人员分工与网站访问权限分别管理。", "The people directory does not grant website access."))}${state.mode === "demo" ? html`<button class="btn" data-cmd="demo-patrick" aria-pressed="${state.demoPatrick}">${state.demoPatrick ? s("退出 Patrick 权限体验", "Leave Patrick preview") : s("体验 Patrick 权限", "Try Patrick permissions")}</button>` : ""}${state.peopleError ? html`<p class="notice error" role="alert">${state.peopleError}</p>` : ""}${manage ? html`<button class="btn btn-primary" data-cmd="person-dialog">${s("增加一位人员", "Add a person")}</button>` : ""}
    <div class="stack">
      ${(state.peopleReady ? state.people : []).map(
        (person) =>
          html`<article class="panel">
            <h2>${person.displayName}</h2>
            <p>
              ${person.responsibility || s("分工待确认", "Responsibility to confirm")}
            </p>
            <span class="badge"
              >${person.active ? s("在册", "Active") : s("已移出，历史保留", "Removed; history retained")}</span
            >
            <div class="stack actions">
              <button
                class="btn"
                data-cmd="dashboard-focus"
                data-person="${person.id}"
              >
                ${s("查看任务", "View actions")}</button
              >${manage ? html`<button class="btn" data-cmd="person-active" data-id="${person.id}" data-active="${!person.active}">${person.active ? s("移出名单", "Remove from directory") : s("恢复人员", "Restore person")}</button>` : ""}
            </div>
          </article>`,
      )}
    </div>
    ${!state.peopleReady ? html`<p>${t("loading")}</p>` : !state.people.length ? html`<p>${s("名单暂时为空。", "The directory is empty.")}</p>` : ""}`;
}
