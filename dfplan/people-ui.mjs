import { assigneeGroup } from "./people-model.mjs";
export function assigneeSelect(task, people, h) {
  const { s, esc } = h,
    active = people.filter((p) => p.active),
    current = task.assignee || "";
  return `<label>${s("具体人名", "Assignee")}<select name="assignee" aria-describedby="assignee-help"><option value="">${s("待确认", "To confirm")}</option>${current && !active.some((p) => p.displayName === current) ? `<option value="${esc(current)}" selected>${esc(current)} · ${s("原记录", "Existing assignment")}</option>` : ""}${active.map((p) => `<option value="${esc(p.displayName)}" ${p.displayName === current ? "selected" : ""}>${esc(p.displayName)}</option>`).join("")}</select><small id="assignee-help">${s("从人员名单选择；管理员或获授权的 Patrick 可在“人员管理”增加人员。", "Choose from the directory. Administrators or authorized Patrick can add people under People management.")}</small></label>`;
}
export function renderPeople(
  project,
  people,
  {
    canManage = false,
    ready = false,
    error = "",
    busy = false,
    draft = {},
    formError = "",
  } = {},
  h,
) {
  const { s, esc, icon } = h,
    active = people.filter((p) => p.active),
    inactive = people.filter((p) => !p.active);
  // Only a successful server snapshot can establish that the roster is empty.
  // Hide stale records, counts and write controls after a read failure.
  if (!ready)
    return `<section class="df-people" aria-labelledby="people-title"><div class="module-heading"><h1 id="people-title">${canManage ? s("人员管理", "People management") : s("人员名单", "People")}</h1><button class="module-button" data-view="dashboard">${icon("board")}${s("看仪表盘", "Dashboard")}</button></div><p class="module-alert" role="${error ? "alert" : "status"}">${esc(error || s("正在读取人员名单，尚未取得结果…", "Loading the directory; no result is available yet…"))}</p>${error ? `<p>${s("读取失败不代表名单为空。请检查授权或网络后刷新页面重试。", "A read failure does not mean the directory is empty. Check access or connectivity and refresh to retry.")}</p>` : ""}</section>`;
  const list = (rows) =>
    rows
      .map((person) => {
        const tasks = project.tasks.filter(
          (t) => assigneeGroup(t, people).key === person.id,
        );
        return `<article class="people-card"><div class="person-avatar">${esc([...person.displayName][0] || "?")}</div><div class="people-card-main"><h2>${esc(person.displayName)}</h2><p>${esc(person.responsibility || s("分工待确认", "Responsibility to confirm"))}</p><span>${tasks.length} ${s("项任务", "actions")}${!person.active ? " · " + s("已移除，既有任务保留", "Removed; existing actions retained") : ""}</span></div><div class="people-card-actions"><button class="module-button" data-dashboard-person="${esc(person.id)}">${icon("list")}${s("看任务", "Actions")}</button>${canManage && ready ? `<button class="module-button ${person.active ? "person-remove" : ""}" data-person-id="${esc(person.id)}" data-person-active="${!person.active}" ${busy ? "disabled" : ""}>${icon(person.active ? "close" : "plus")}${person.active ? s("移出名单", "Remove") : s("恢复人员", "Restore")}</button>` : ""}</div></article>`;
      })
      .join("");
  return `<section class="df-people" aria-labelledby="people-title"><div class="module-heading"><div><span class="module-kicker">FAMILY PEOPLE</span><h1 id="people-title">${canManage ? s("人员管理", "People management") : s("人员名单", "People")}</h1><p>${s("把每一件事，交给合适的家人。", "A shared plan, with the right people for each step.")}</p></div><button class="module-button" data-view="dashboard">${icon("board")}${s("看仪表盘", "Dashboard")}</button></div><p class="module-notice">${icon("shield")}${canManage ? s("管理员和获授权的 Patrick 可以增加、移出和恢复人员。移出后，既有任务与历史记录会保留。人员名单用于分工，网站访问需另行授权。", "Administrators and authorized Patrick can add, remove and restore people. Existing actions and history are retained. Directory entries assign work; website access requires separate authorization.") : s("你可以查看人员和分工；新增或移出人员请联系有人员管理权限的人。", "You can view people and their work. Contact a directory manager to add or remove people.")}</p>
  ${!ready ? `<p class="module-alert" role="status">${esc(error || s("正在连接人员名单…", "Connecting to the directory…"))}</p>` : ""}
  ${canManage ? `<form id="person-form" class="person-form"><h2>${icon("plus")}${s("增加一位人员", "Add a person")}</h2><label>${s("具体人名", "Name")}<input id="person-name" name="displayName" value="${esc(draft.displayName || "")}" required maxlength="120" autocomplete="off" placeholder="${s("填写姓名", "Enter a name")}" ${!ready || busy ? "disabled" : ""}></label><label>${s("分工说明（可选）", "Responsibility (optional)")}<input id="person-responsibility" name="responsibility" value="${esc(draft.responsibility || "")}" maxlength="240" autocomplete="off" placeholder="${s("例如：家族代表、资料整理", "For example: family representative, archives")}" ${!ready || busy ? "disabled" : ""}></label><button class="module-primary" type="submit" ${!ready || busy ? "disabled" : ""}>${icon("plus")}${s("加入人员名单", "Add to the directory")}</button><p id="people-form-error" class="module-alert" role="alert">${esc(formError)}</p></form>` : ""}
  <div class="people-section-heading"><h2>${s("在册人员", "Active people")}</h2><b>${active.length}</b></div><div class="people-list">${list(active) || `<p class="module-empty">${s("名单暂时为空。管理员可增加人员，或在后台更新时从已有任务人名建立名单。", "The directory is empty. An administrator can add people or initialize it from existing task assignments during the backend update.")}</p>`}</div>${inactive.length ? `<details class="removed-people"><summary>${s("已移出人员", "Removed people")} · ${inactive.length}</summary><div class="people-list">${list(inactive)}</div></details>` : ""}</section>`;
}
