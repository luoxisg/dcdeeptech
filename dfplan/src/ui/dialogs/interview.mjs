import { interviewSession as session } from "../../application/interview-session.mjs";
import { interviewDraft } from "../../domain/interview-model.mjs";
import { store } from "../../application/store.mjs";
import { html } from "../html.mjs";
import { s } from "../i18n.mjs";
import { sheetForm } from "./shared.mjs";
export function render() {
  const language = store.getState().language,
    state = session.getState(),
    draft = session.draft(language),
    generated = interviewDraft(state.completed, language),
    lang = language === "en" ? 1 : 0;
  if (store.getState().dialog.kind === "interview-reset")
    return sheetForm(
      s("重新体验示例？", "Restart the sample?"),
      html`<p>
        ${s("这会清空本页示例对话和手工修改的草稿。需要保留时，请先取消并导出。正式任务、人员和历史记录不会改变。", "This clears this page’s sample transcript and edited drafts. Cancel and export first if you wish to keep them. Live tasks, people and history remain unchanged.")}
      </p>`,
      "interview-confirm-reset",
      s("确认清空本页示例", "Clear this sample"),
    );
  return sheetForm(
    s("口述整理与审核", "Oral-history draft review"),
    html`<p class="notice">
        ${s("预设示例，并非录音转写或已核实事实。未接入自动归档。", "Preset sample, not a recording, transcription or verified facts. Automatic archiving is not connected.")}
      </p>
      <label
        >${s("初稿标题", "Draft title")}<input
          name="title"
          data-input="interview-draft"
          value="${draft.title}"
          maxlength="12000" /></label
      ><label
        >${s("可编辑初稿", "Editable draft")}<textarea
          name="body"
          data-input="interview-draft"
          rows="8"
          maxlength="12000"
        >
${draft.body}</textarea>
      </label>
      <section>
        <h3>${s("待核实项目", "Items to verify")}</h3>
        ${
          generated.checks.length
            ? html`<ul>
                ${generated.checks.map((item) => html`<li>${item}</li>`)}
              </ul>`
            : html`<p>
                ${s("尚未完成示例轮次。可先关闭并开始访谈。", "No sample turns completed. Close this sheet and start an interview.")}
              </p>`
        }
      </section>
      <details>
        <summary>${s("保留的示例原话", "Original sample transcript")}</summary>
        ${state.transcript.map((row) => html`<p><strong>${row.role === "guide" ? s("访谈提示", "Guide") : s("示例口述", "Sample narrator")}：</strong>${row.text[lang]}</p>`)}
      </details>
      <button type="button" class="btn full" data-cmd="interview-copy">
        ${s("复制初稿与待核实项", "Copy draft & verification items")}
      </button>
      <p data-interview-draft-notice role="status"></p>
      <p>
        ${s("导出只下载到您的设备，不会自动加入共享档案或事实核实页。", "Export only downloads to your device; it does not add records to shared archives or fact verification.")}
      </p>`,
    "interview-export",
    s("导出待核实草稿 TXT", "Export unverified draft TXT"),
  );
}
