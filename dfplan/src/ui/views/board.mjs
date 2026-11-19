import { statuses } from "../../domain/task-schema.mjs";
import { html } from "../html.mjs";
import { t } from "../i18n.mjs";
import {
  pageTitle,
  taskControls,
  taskCard,
  filteredTasks,
  statusLabel,
} from "../components.mjs";
export function rows() {
  const tasks = filteredTasks();
  return html`<div class="board-grid">
    ${statuses.map(
      (status) =>
        html`<section class="board-column" data-drop-status="${status}">
          <h2>
            ${statusLabel(status)}
            <small
              >${tasks.filter((task) => task.status === status).length}</small
            >
          </h2>
          <div class="stack">
            ${tasks.filter((task) => task.status === status).map(taskCard)}
          </div>
        </section>`,
    )}
  </div>`;
}
export function render() {
  return html`${pageTitle(t("board"))}${taskControls()}
    <div data-list-results>${rows()}</div>`;
}
