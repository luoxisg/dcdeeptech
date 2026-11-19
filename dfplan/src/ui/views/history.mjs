import { store } from "../../application/store.mjs";
import { html } from "../html.mjs";
import { t, s } from "../i18n.mjs";
import { pageTitle } from "../components.mjs";
export function render() {
  const state = store.getState();
  return html`${pageTitle(t("history"))}
    <section class="panel stack">
      <p>
        ${s("计划备份只包含任务、核实与历史记录，不包含照片、录音等原始资料。", "Plan backups contain tasks, verification metadata and history, not original photos or audio.")}
      </p>
      <button class="btn btn-primary" data-cmd="export-json">
        ${t("exportJson")}</button
      ><button class="btn" data-cmd="export-csv">${t("exportCsv")}</button
      ><button class="btn" data-cmd="import">${t("import")}</button
      ><button class="btn" data-cmd="export-raw">
        ${s("导出原有本机记录", "Export earlier device records")}
      </button>
    </section>
    <div class="stack">
      ${[...state.project.history].reverse().map(
        (row) =>
          html`<article class="panel">
            <h2>
              ${state.language === "en" && row.textEn ? row.textEn : row.text}
            </h2>
            <p>${row.actor} · ${row.at}</p>
          </article>`,
      )}
    </div>`;
}
