import { store } from "../../application/store.mjs";
import { html } from "../html.mjs";
import { t, s } from "../i18n.mjs";
import {
  pageTitle,
  taskProgress,
  formalAcceptance,
  weeklyFocus,
  taskCard,
} from "../components.mjs";
export function render() {
  const state = store.getState(),
    progress = taskProgress(state.project.tasks),
    next = state.project.tasks.find((task) => task.status !== "已完成");
  return html`${pageTitle(s("一家人的记忆，一起守护。", "Our family memories, in caring hands."), s("慢慢来，一次做好一件事。", "One small step at a time."))}
    <section class="hero-panel">
      <img src="./assets/heritage-tree.svg" alt="" width="500" height="260" />
      <h2>${t("progress")}</h2>
      <strong class="progress-number"
        >${progress.percent === null ? "—" : progress.percent + "%"}</strong
      >
      <p>
        ${progress.done} / ${progress.total}
        ${s("项任务记录为已完成", "actions recorded complete")}
      </p>
      <progress
        max="100"
        value="${progress.percent ?? 0}"
        aria-label="${t("progress")}"
      ></progress>
    </section>
    ${formalAcceptance()}${weeklyFocus()}
    <section class="panel">
      <h2>${s("下一步，一起做好", "One action to do next")}</h2>
      ${next ? taskCard(next) : html`<p>${s("现有任务已记录完成，请核对交付与验收凭据。", "Existing actions are recorded complete. Review evidence and acceptance records.")}</p>`}
    </section>
    <div class="card-grid">
      ${["dashboard", "people", "security", "history"].map((view) => html`<button class="btn panel" data-cmd="navigate" data-view="${view}">${t(view)}</button>`)}
    </div>`;
}
