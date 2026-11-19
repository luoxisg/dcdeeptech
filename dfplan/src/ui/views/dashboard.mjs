import { store } from "../../application/store.mjs";
import { dashboardData } from "../../domain/dashboard-model.mjs";
import { stewardshipSummary } from "../../domain/stewardship-model.mjs";
import { html, selected } from "../html.mjs";
import { t, s } from "../i18n.mjs";
import {
  pageTitle,
  formalAcceptance,
  taskProgress,
  statusLabel,
} from "../components.mjs";
export function render() {
  const state = store.getState(),
    selection = {
      person: state.filter.person,
      priority: state.filter.priority,
    },
    data = dashboardData(state.project, state.people, selection),
    progress = taskProgress(data.tasks),
    coverage = stewardshipSummary(data.tasks);
  return html`${pageTitle(t("dashboard"))}
    <div class="toolbar">
      <label
        >${s("按人员查看", "View by person")}<select
          data-change="dashboard-person"
        >
          <option value="all">${t("all")}</option>
          <option
            value="unassigned"
            ${selected(selection.person === "unassigned")}
          >
            ${s("未指定人员", "Unassigned")}
          </option>
          ${data.workload.filter((row) => row.name).map((row) => html`<option value="${row.key}" ${selected(selection.person === row.key)}>${row.name}</option>`)}
        </select></label
      ><label
        >${s("按阶段查看", "View by stage")}<select
          data-change="dashboard-priority"
        >
          <option value="all">${t("all")}</option>
          ${["P0", "P1", "P2"].map((p) => html`<option value="${p}" ${selected(selection.priority === p)}>${p}</option>`)}
        </select></label
      >
    </div>
    <div class="metric-grid">
      <section class="panel">
        <h2>${t("progress")}</h2>
        <strong class="progress-number"
          >${progress.percent === null ? "—" : progress.percent + "%"}</strong
        >
        <p>${progress.done} / ${progress.total}</p>
      </section>
      ${[
        ["all", data.total, s("全部任务", "All actions")],
        ["open", data.open, s("尚未完成", "Open")],
        ["overdue", data.overdue, s("逾期", "Overdue")],
        ["review", data.review, s("待家族确认", "Family review")],
        ["blocked", data.blocked, s("受阻", "Blocked")],
        ["unassigned", data.unassigned, s("待分工", "Unassigned")],
      ].map(
        ([focus, count, label]) =>
          html`<button
            class="btn panel metric"
            data-cmd="dashboard-focus"
            data-focus="${focus}"
            data-person="${selection.person}"
            data-priority="${selection.priority}"
          >
            <strong>${count}</strong><span>${label}</span>
          </button>`,
      )}
    </div>
    ${formalAcceptance()}${data.noDue ? html`<p class="notice">${data.noDue} ${s("项未完成任务没有截止日期，请先确认启动日或手动截止日。", "open actions have no due date; confirm the start date or individual due dates.")}</p>` : ""}
    <section class="panel">
      <h2>${s("任务状态分布", "Status distribution")}</h2>
      <div class="stack">
        ${data.statuses.map((row) => html`<button class="btn chart-row" data-cmd="dashboard-focus" data-focus="${"status:" + row.status}" data-person="${selection.person}" data-priority="${selection.priority}"><span>${statusLabel(row.status)}</span><progress max="${data.total || 1}" value="${row.count}" aria-label="${statusLabel(row.status)}"></progress><b>${row.count}</b></button>`)}
      </div>
    </section>
    <section class="panel">
      <h2>${s("阶段进度", "Stage progress")}</h2>
      ${data.stages.map((stage) => html`<button class="btn chart-row" data-cmd="dashboard-focus" data-priority="${stage.priority}"><span>${stage.priority}</span><progress max="${stage.total || 1}" value="${stage.completed}" aria-label="${stage.priority}"></progress><b>${stage.completed}/${stage.total}</b></button>`)}
    </section>
    <section class="panel">
      <h2>${s("每个人的任务", "Workload by person")}</h2>
      <div class="stack">
        ${data.workload.map((row) => html`<button class="btn chart-row" data-cmd="dashboard-focus" data-person="${row.key}"><span>${row.name || s("未指定人员", "Unassigned")}</span><span>${row.completed}/${row.total}</span><span>${row.overdue} ${s("逾期", "overdue")}</span></button>`)}
      </div>
    </section>
    <section class="panel">
      <h2>${s("家族成果与接班记录", "Outcomes and continuity records")}</h2>
      <p>
        ${s("仅统计填写覆盖，不代表独立核验或权限生效。", "Coverage is not independent verification or an access grant.")}
      </p>
      <dl class="compact-dl">
        ${[
          ["reviewer", s("验收人", "Reviewer")],
          ["backup", s("执行替补", "Backup person")],
          ["claimed", s("认领日期", "Claim date")],
          ["outcomes", s("保全成果", "Outcomes")],
          ["recovery", s("恢复记录", "Recovery")],
        ].map(
          ([key, label]) =>
            html`<div>
              <dt>${label}</dt>
              <dd>${coverage[key]} / ${data.total}</dd>
            </div>`,
        )}
      </dl>
    </section>`;
}
