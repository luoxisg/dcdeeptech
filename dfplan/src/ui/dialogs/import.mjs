import { store } from "../../application/store.mjs";
import { html } from "../html.mjs";
import { t, s } from "../i18n.mjs";
import { sheetForm } from "./shared.mjs";
export function render() {
  const state = store.getState();
  return sheetForm(
    t("import"),
    html`<p>
        ${s("请先导出现有备份。导入不会自动删除正式后台已有任务，原有云端历史保留。", "Export your current backup first. Importing cannot delete existing live tasks; cloud history is retained.")}
      </p>
      <button class="btn full" type="button" data-cmd="export-json">
        ${t("exportJson")}</button
      ><label
        >${s("选择 JSON 项目备份", "Choose a JSON project backup")}<input
          type="file"
          name="backupFile"
          accept=".json,application/json"
          required /></label
      ><label class="checkbox-row"
        ><input
          type="checkbox"
          name="confirmImport"
          value="true"
          required
        /><span
          >${s("我已备份，并确认导入此文件。", "I have a backup and confirm importing this file.")}</span
        ></label
      >`,
    "read-import",
    s("确认导入", "Confirm import"),
  );
}
