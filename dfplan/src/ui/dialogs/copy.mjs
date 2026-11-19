import { store } from "../../application/store.mjs";
import { html } from "../html.mjs";
import { t, s } from "../i18n.mjs";
export function render() {
  return html`<div class="sheet-form">
    <header class="sheet-heading">
      <div class="sheet-handle" data-sheet-handle aria-hidden="true"></div>
      <h2 id="sheet-title">${s("请手动复制", "Copy manually")}</h2>
    </header>
    <div class="sheet-body">
      <p>
        ${s("浏览器未允许自动复制，请选中文字复制。", "Automatic copying was unavailable. Select and copy the text.")}
      </p>
      <textarea readonly rows="5" aria-label="${s("复制内容", "Text to copy")}">
${store.getState().dialog.data.text}</textarea>
    </div>
    <footer class="sheet-actions">
      <button class="btn btn-primary" data-cmd="close">${t("close")}</button>
    </footer>
  </div>`;
}
