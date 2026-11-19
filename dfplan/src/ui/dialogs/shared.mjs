import { html, raw, disabled, checked, selected } from "../html.mjs";
import { t } from "../i18n.mjs";
import { store } from "../../application/store.mjs";
export function sheetForm(title, body, command, label = t("save")) {
  return html`<form data-cmd="${command}" class="sheet-form">
    <header class="sheet-heading">
      <div class="sheet-handle" data-sheet-handle aria-hidden="true"></div>
      <h2 id="sheet-title">${title}</h2>
      <button
        class="btn"
        type="button"
        data-cmd="close"
        aria-label="${t("close")}"
      >
        ×
      </button>
    </header>
    <div class="sheet-body">${body}</div>
    <footer class="sheet-actions">
      <p class="sheet-error" role="alert"></p>
      <span data-submit-status role="status"></span
      ><button class="btn" type="button" data-cmd="close">${t("cancel")}</button
      ><button
        class="btn btn-primary"
        type="submit"
        ${disabled(store.getState().busy)}
      >
        ${label}
      </button>
    </footer>
  </form>`;
}
export function input(
  name,
  label,
  value = "",
  type = "text",
  required = false,
) {
  return html`<label
    >${label}<input
      name="${name}"
      type="${type}"
      value="${value}"
      ${raw(required ? "required" : "")}
      aria-required="${required}"
  /></label>`;
}
export function textArea(name, label, value = "", rows = 3) {
  return html`<label
    >${label}<textarea name="${name}" rows="${rows}" maxlength="12000">
${value}</textarea>
  </label>`;
}
