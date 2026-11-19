import { store } from "../../application/store.mjs";
import { statuses, createTask } from "../../domain/task-schema.mjs";
import {
  stewardshipFields,
  readAssertions,
  stewardshipProposals,
} from "../../domain/stewardship-model.mjs";
import { html, selected, checked } from "../html.mjs";
import { t, s } from "../i18n.mjs";
import { statusLabel } from "../components.mjs";
import { sheetForm, input, textArea } from "./shared.mjs";
export function render() {
  const state = store.getState(),
    task =
      state.project.tasks.find((task) => task.id === state.dialog.taskId) ||
      createTask(state.dialog.taskId),
    active = state.people.filter((p) => p.active),
    current = active.find(
      (p) => p.id === task.assigneeId || p.displayName === task.assignee,
    );
  return sheetForm(
    s("行动详情", "Action details"),
    html`<p class="badge">${task.id}</p>
      ${stewardshipProposals[Number(task.id.slice(3)) - 1] ? html`<p class="notice">${s("建议（待家族确认）：", "Proposal (subject to family agreement): ")}${s(stewardshipProposals[Number(task.id.slice(3)) - 1][0], stewardshipProposals[Number(task.id.slice(3)) - 1][1])}</p>` : ""}${input("title", s("行动名称（中文）", "Action title (Chinese)"), task.title)}${input("titleEn", s("行动名称（英文）", "Action title (English)"), task.titleEn || "")}<label
        >${s("当前状态", "Status")}<select name="status">
          ${statuses.map((status) => html`<option value="${status}" ${selected(task.status === status)}>${statusLabel(status)}</option>`)}
        </select></label
      ><label
        >${s("优先级", "Priority")}<select name="priority">
          ${["P0", "P1", "P2"].map((p) => html`<option value="${p}" ${selected(task.priority === p)}>${p}</option>`)}
        </select></label
      ><label
        >${s("具体负责人", "Named assignee")}<select name="assigneeId">
          <option value="">${s("待指定人员", "Unassigned")}</option>
          ${active.map((person) => html`<option value="${person.id}" ${selected(current?.id === person.id)}>${person.displayName}</option>`)}${task.assignee && !current ? html`<option value="__historic__" selected>${task.assignee} · ${s("原有分工，保留", "existing assignment retained")}</option>` : ""}
        </select></label
      >${input("owner", s("负责人职责（中文）", "Responsibility (Chinese)"), task.owner || "")}${input("ownerEn", s("负责人职责（英文）", "Responsibility (English)"), task.ownerEn || "")}${input("collaborators", s("配合人员（中文）", "Collaborators (Chinese)"), task.collaborators || "")}${input("collaboratorsEn", s("配合人员（英文）", "Collaborators (English)"), task.collaboratorsEn || "")}${input("weekStart", s("建议开始周", "Suggested start week"), String(task.weekStart), "number")}${input("weekEnd", s("建议结束周", "Suggested end week"), String(task.weekEnd), "number")}${input("due", s("手动截止日", "Manual due date"), task.due || "", "date")}${textArea("next", s("下一步 / 阻碍", "Next step / blockers"), task.next || "")}${["action", "deliverable", "dependency"].map((key) => html`${textArea(key, { action: s("具体行动", "Action"), deliverable: s("交付物", "Deliverable"), dependency: s("前置条件", "Dependencies") }[key], task[key] || "")}${textArea(key + "En", s("补充英文：", "English: ") + key, task[key + "En"] || "")}`)}
      <details open>
        <summary>
          ${s("分工、成果与接班", "Responsibilities, outcomes & continuity")}
        </summary>
        <p>
          ${s("这些字段是计划记录，不授予账号访问或材料使用许可。", "These planning records do not grant account access or material-use permission.")}
        </p>
        ${stewardshipFields.map(([key, zh, en, type]) => (type === "textarea" ? textArea(key, s(zh, en), key === "outcomes" ? readAssertions(task[key] || "").text : task[key] || "") : input(key, s(zh, en), task[key] || "", type)))}
      </details>
      <section class="delivery-fields">
        <h3>${s("交付与任务确认", "Delivery and task confirmation")}</h3>
        ${textArea("evidence", s("交付凭据 / 受控记录编号", "Evidence / controlled reference"), task.evidence || "")}${input("completed", s("实际完成日", "Completion date"), task.completed || "", "date")}<label
          class="checkbox-row"
          ><input
            type="checkbox"
            name="accepted"
            value="true"
            ${checked(task.accepted)}
          /><span
            >${s("家人已确认此任务记录（不代表独立正式审核）", "The family confirmed this task record (not an independent formal audit)")}</span
          ></label
        >
      </section>`,
    "save-task",
  );
}
