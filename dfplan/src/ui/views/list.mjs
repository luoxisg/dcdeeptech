import { html } from "../html.mjs";
import { t, s } from "../i18n.mjs";
import {
  pageTitle,
  taskControls,
  taskCard,
  filteredTasks,
} from "../components.mjs";
export function rows() {
  return html`<div class="task-list">${filteredTasks().map(taskCard)}</div>`;
}
export function render() {
  return html`${pageTitle(t("list"), s("按卡片查看、分工与跟进。", "Read, assign and follow up using the cards."))}${taskControls()}
    <div data-list-results>${rows()}</div>`;
}
