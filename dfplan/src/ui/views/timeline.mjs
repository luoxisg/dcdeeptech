import { store } from "../../application/store.mjs";
import { targetDate } from "../../domain/task-schema.mjs";
import { html } from "../html.mjs";
import { t, s, field } from "../i18n.mjs";
import { pageTitle, taskControls, filteredTasks } from "../components.mjs";
export function rows() {
  return html`<div class="stack">
    ${filteredTasks().map(
      (task) =>
        html`<article class="panel timeline-card">
          <span
            >${task.id} · ${s("建议周次", "Suggested weeks")}
            W${task.weekStart}–W${task.weekEnd}</span
          >
          <h2>${field(task, "title")}</h2>
          <progress
            max="104"
            value="${task.weekEnd}"
            aria-label="${s("建议结束周", "Suggested end week")}"
          ></progress>
          <p>
            ${targetDate(task, store.getState().project.startDate) || s("请确认启动日或截止日", "Confirm a start date or due date")}
          </p>
          <button class="btn" data-cmd="editor" data-id="${task.id}">
            ${t("more")}
          </button>
        </article>`,
    )}
  </div>`;
}
export function render() {
  return html`${pageTitle(t("timeline"))}<button class="btn" data-cmd="start">
      ${t("start")}: ${store.getState().project.startDate || "—"}</button
    >${taskControls()}
    <div data-list-results>${rows()}</div>`;
}
