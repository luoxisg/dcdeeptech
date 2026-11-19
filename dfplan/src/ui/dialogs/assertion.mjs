import { store } from "../../application/store.mjs";
import { readAssertions } from "../../domain/stewardship-model.mjs";
import { html, selected } from "../html.mjs";
import { t, s, field } from "../i18n.mjs";
import { sheetForm, input, textArea } from "./shared.mjs";
export function render() {
  const state = store.getState(),
    dialog = state.dialog,
    task = state.project.tasks.find((t) => t.id === dialog.taskId),
    assertion = task
      ? readAssertions(task.outcomes || "").assertions.find(
          (a) => a.id === dialog.assertionId,
        )
      : null;
  return sheetForm(
    assertion ? t("noteFact") : t("addFact"),
    html`<p>
        ${s("记录来源和不同说法，事实确认不等于项目正式验收。", "Keep sources and differing accounts; fact confirmation is not formal project acceptance.")}
      </p>
      <label
        >${s("关联任务", "Related task")}<select name="taskId">
          ${state.project.tasks.map((task) => html`<option value="${task.id}" ${selected(task.id === dialog.taskId)}>${task.id} · ${field(task, "title")}</option>`)}
        </select></label
      >${assertion ? html`<p>${assertion.text}</p>` : textArea("text", s("事实 / 待核实说法", "Fact / assertion to verify"), "")}${input("source", s("来源 / 受控凭据编号", "Source / controlled reference"), assertion?.source || "")}${textArea("note", s("笔记与不同说法", "Notes and differing accounts"), assertion?.note || "")}`,
    "save-assertion",
  );
}
