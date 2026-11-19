const safeMarkup = Symbol("SafeHtml");
/** @typedef {{[safeMarkup]:true,value:string,toString:()=>string}} SafeHtml */
export function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
/** Explicit trust boundary: use only for program-owned static markup or SafeHtml composition. */
export function raw(value) {
  return {
    [safeMarkup]: true,
    value: String(value),
    toString() {
      return this.value;
    },
  };
}
function renderValue(value) {
  if (Array.isArray(value)) return value.map(renderValue).join("");
  if (value && value[safeMarkup]) return value.value;
  return escapeHtml(value);
}
export function html(strings, ...values) {
  return raw(
    strings.reduce(
      (result, text, index) =>
        result +
        text +
        (index < values.length ? renderValue(values[index]) : ""),
      "",
    ),
  );
}
/** All region writes pass through this boundary. User strings never become raw markup. */
export function mount(element, markup) {
  if (!element) return;
  const template = document.createElement("template");
  template.innerHTML = renderValue(markup);
  element.replaceChildren(template.content);
}
export const checked = (value) => raw(value ? "checked" : "");
export const selected = (value) => raw(value ? "selected" : "");
export const disabled = (value) => raw(value ? "disabled" : "");
