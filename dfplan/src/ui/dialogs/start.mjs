import { store } from "../../application/store.mjs";
import { html } from "../html.mjs";
import { t, s } from "../i18n.mjs";
import { sheetForm, input } from "./shared.mjs";
export function render() {
  return sheetForm(
    t("start"),
    html`<p>
        ${s("建议周次从启动日计算，手动截止日保持不变。", "Suggested weeks use this start date; manual due dates stay unchanged.")}
      </p>
      ${input("startDate", t("start"), store.getState().project.startDate, "date")}`,
    "save-start",
  );
}
