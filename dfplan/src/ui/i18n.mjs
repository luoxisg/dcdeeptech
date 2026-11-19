import { store } from "../application/store.mjs";
import { translate, localize } from "../domain/i18n.mjs";
export const t = (key) => translate(key, store.getState().language);
export const s = (zh, en) => localize(zh, en, store.getState().language);
export const field = (task, key) =>
  store.getState().language === "en" && task[key + "En"]
    ? task[key + "En"]
    : task[key] || "";
export const money = (cents) =>
  "S$" +
  (cents / 100).toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
