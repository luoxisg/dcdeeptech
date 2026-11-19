import { html } from "../html.mjs";
import { t, s } from "../i18n.mjs";
import { sheetForm, input } from "./shared.mjs";
export function render() {
  return sheetForm(
    s("增加一位人员", "Add a person"),
    html`${input("displayName", s("姓名", "Name"))}${input("responsibility", s("分工说明", "Responsibility"))}`,
    "add-person",
  );
}
