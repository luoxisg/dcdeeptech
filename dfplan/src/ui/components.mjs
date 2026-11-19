import { matchesDashboardTask } from "../domain/dashboard-model.mjs";
import { store } from "../application/store.mjs";
import { statuses, statusEn, targetDate } from "../domain/task-schema.mjs";
import { isAccepted } from "../domain/people-model.mjs";
import { html, selected } from "./html.mjs";
import { t, s, field } from "./i18n.mjs";
import { icon } from "./icons.mjs";
export function statusLabel(status) {
  return store.getState().language === "en"
    ? statusEn[statuses.indexOf(status)] || status
    : status;
}
export function pageTitle(title, note = "") {
  return html`<header class="page-heading">
    <h1 tabindex="-1" id="page-title">${title}</h1>
    ${note ? html`<p>${note}</p>` : ""}
  </header>`;
}
export function modeNotice(compact = false) {
  const state = store.getState();
  return html`<aside
    class="notice ${state.mode === "demo" ? "notice-demo" : ""}"
    data-mode="${state.mode}"
  >
    <strong
      >${state.mode === "demo" ? t("demo") : state.ready ? t("formal") : t("signedOut")}</strong
    >
    ${
      compact
        ? ""
        : html`<p>
            ${state.mode === "demo" ? s("修改只留在此浏览器，不读取或写入正式家族资料。", "Edits stay in this browser; live family records are not read or changed.") : state.ready ? s("这里的保存操作会更新获授权的共享项目。", "Saving here updates the authorized shared project.") : s("请使用获授权的登录或专属邀请。", "Use authorized sign-in or your personal invitation.")}
          </p>`
    }
  </aside>`;
}
export function taskCard(task) {
  return html`<article
    class="task-card"
    draggable="true"
    data-task-id="${task.id}"
  >
    <div class="card-meta">
      <span>${task.id} · ${task.priority}</span
      ><span class="status">${statusLabel(task.status)}</span>
    </div>
    <h2>${field(task, "title")}</h2>
    <p>${task.next || field(task, "action")}</p>
    <dl class="compact-dl">
      <div>
        <dt>${s("负责人", "Assignee")}</dt>
        <dd>${task.assignee || s("待指定人员", "Unassigned")}</dd>
      </div>
      <div>
        <dt>${s("截止日期", "Due date")}</dt>
        <dd>
          ${targetDate(task, store.getState().project.startDate) || s("待确认", "To confirm")}
        </dd>
      </div>
    </dl>
    <button class="btn btn-primary full" data-cmd="editor" data-id="${task.id}">
      ${t("more")}${icon("arrow")}
    </button>
    ${task.id === "WU-05" ? html`<button class="btn full" data-cmd="navigate" data-view="interview">${s("口述访谈体验", "Oral-history sample")}</button>` : ""}
  </article>`;
}
export function formalAcceptance() {
  return html`<section class="panel formal-acceptance">
    <h2>${t("acceptance")}</h2>
    <strong class="badge">${t("unverified")}</strong>
    <p>
      ${s("当前只有任务内确认记录，尚无独立审核数据。事实确认也不等于项目正式验收。", "Existing task confirmations are not independent audit data. Fact confirmation is also separate from formal project acceptance.")}
    </p>
  </section>`;
}
export function weeklyFocus() {
  const tasks = store.getState().project.tasks;
  const focus = ["WU-01", "WU-02", "WU-03", "WU-04", "WU-05"]
    .map((id) => tasks.find((task) => task.id === id))
    .filter((task) => task && task.status !== "已完成");
  const handover = tasks.find((task) => task.id === "WU-10");
  return html`<section class="panel weekly-focus">
    <h2>${t("focus")}</h2>
    <p>
      ${s("建议先跟进 WU-01 至 WU-05，不修改原任务日期与内容。", "Prioritize WU-01 to WU-05 without changing task dates or content.")}
    </p>
    <div class="stack">
      ${focus.map((task) => html`<button class="btn focus-action" data-cmd="editor" data-id="${task.id}"><span>${task.id}</span><strong>${field(task, "title")}</strong>${icon("arrow")}</button>`)}
    </div>
    ${
      handover
        ? html`<aside class="early-reminder">
            <h3>${s("WU-10 提前提醒", "WU-10 early reminder")}</h3>
            <p>
              ${s("尽早确认预算上限、备份保管和接班安排。", "Agree budget limits, backup custodians and succession arrangements early.")}
            </p>
            <button class="btn" data-cmd="editor" data-id="WU-10">
              ${t("more")}
            </button>
          </aside>`
        : ""
    }
  </section>`;
}
export function taskProgress(tasks) {
  const done = tasks.filter((task) => task.status === "已完成").length;
  return {
    done,
    total: tasks.length,
    percent: tasks.length ? Math.round((done / tasks.length) * 100) : null,
  };
}
export function taskControls() {
  return html`<div class="toolbar">
      <label
        >${t("search")}<input
          type="search"
          data-input="filter-query"
          value="${store.getState().filter.query}"
          placeholder="${t("search")}" /></label
      ><label
        >${s("状态", "Status")}<select data-change="filter-status">
          <option
            value="all"
            ${selected(store.getState().filter.status === "all")}
          >
            ${t("all")}
          </option>
          ${statuses.map((status) => html`<option value="${status}" ${selected(store.getState().filter.status === status)}>${statusLabel(status)}</option>`)}
        </select></label
      ><button class="btn btn-primary" data-cmd="editor">${t("add")}</button>
    </div>
    <div class="subnav">
      ${["board", "list", "timeline"].map((view) => html`<button class="btn" data-cmd="navigate" data-view="${view}">${t(view)}</button>`)}
    </div>`;
}
export function filteredTasks() {
  const state = store.getState(),
    f = state.filter;
  return state.project.tasks.filter(
    (task) =>
      (!f.query ||
        [task.title, task.titleEn, task.assignee, task.owner, task.next]
          .join(" ")
          .toLowerCase()
          .includes(f.query.toLowerCase())) &&
      (f.status === "all" || task.status === f.status) &&
      matchesDashboardTask(task, state.project, state.people, {
        person: f.person,
        priority: f.priority,
        focus: f.focus || "all",
      }),
  );
}
