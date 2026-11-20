import { backendConfig } from "../../adapters/backend-config.mjs";
import { store } from "../../application/store.mjs";
import {
  currentHandoverRole,
  handoverSnapshot,
  installHandoverCommands,
  subscribeHandover,
} from "../../application/handover.mjs";
import {
  summarizeHandoverReadiness,
  handoverBoundary,
  handoverMappings,
} from "../../domain/exports.mjs";
import {
  createZipBlob,
  finalizeHandoverFiles,
  downloadBlob,
} from "../../adapters/zip-writer.mjs";
import { html, mount as mountHTML, disabled } from "../html.mjs";
import { t, money } from "../i18n.mjs";
import { pageTitle } from "../components.mjs";
let phase = "idle",
  unsubscribe = null;
const statusKeys = {
  packing: "handoverPacking",
  requested: "handoverRequested",
  "audit-failed": "handoverAuditFailed",
  error: "handoverError",
};
function status(next) {
  phase = next;
  update();
  if (next !== "packing")
    store.update({ message: t(statusKeys[next] || "handoverError") });
}
function cards() {
  const state = handoverSnapshot(backendConfig.projectKey),
    role = currentHandoverRole(),
    r = summarizeHandoverReadiness(state, role),
    restricted = role === "vendor" || role === "elder";
  return html`<div class="handover-grid">
      ${!restricted ? html`<button class="btn handover-metric" data-cmd="navigate" data-view="people"><span>${t("handoverPeople")}</span><strong>${state.peopleReady === false ? t("loading") : r.people}</strong><small>${t("handoverAliases")}: ${r.aliases}</small></button><button class="btn handover-metric" data-cmd="navigate" data-view="facts"><span>${t("handoverFacts")}</span><strong>${r.facts}</strong><small>${t("handoverPending")}: ${r.pendingFacts} · ${t("handoverSealed")}: ${r.sealed}</small></button>` : ""}
      ${role !== "vendor" ? html`<button class="btn handover-metric" data-cmd="voice-open"><span>${t("handoverOral")}</span><strong>${r.oralDrafts}</strong></button>` : ""}
      ${role !== "elder" ? html`<button class="btn handover-metric" data-cmd="navigate" data-view="digitization"><span>${t("handoverBudget")}</span><strong>${money(r.budgetCents)}</strong><small>${t("handoverItems")}: ${r.digitizationItems}</small></button>` : ""}
    </div>
    <p>
      ${t("handoverProgress")}:
      ${r.completionPercent === null ? t("handoverNoTasks") : r.completionPercent + "%"}
      (${r.completedTasks}/${r.taskCount})
    </p>`;
}
export function render() {
  const state = store.getState(),
    role = currentHandoverRole(),
    restricted = role === "vendor",
    elder = role === "elder";
  const mappings = restricted
    ? handoverMappings.filter((m) =>
        [
          "digitization_inventory.json",
          "audit_and_tasks.json",
          "manifest.json",
        ].includes(m[0]),
      )
    : elder
      ? handoverMappings.filter((m) =>
          ["oral_histories/", "manifest.json"].includes(m[0]),
        )
      : handoverMappings;
  return html`${pageTitle(t("handover"), t("handoverSubtitle"))}
    <section class="notice handover-boundary">
      <h2>${t("handoverTitle")}</h2>
      <p>${t("handoverScope")}</p>
      <p lang="zh-CN">${handoverBoundary.zh}</p>
      <p lang="en">${handoverBoundary.en}</p>
    </section>
    <section class="panel stack">
      <h2>${t("handoverReadiness")}</h2>
      <div data-handover-readiness>${cards()}</div>
      <p>${t("handoverEstimate")}</p>
      <p>${t("handoverSession")}</p>
    </section>
    <section class="panel stack">
      <h2>
        ${t(restricted || elder ? "handoverMappingsRestricted" : "handoverMappings")}
      </h2>
      ${mappings.map(
        ([file, zh, en]) =>
          html`<details>
            <summary><code>${file}</code></summary>
            <p><strong>${t("handoverFuture")}</strong></p>
            <p>${state.language === "en" ? en : zh}</p>
          </details>`,
      )}${restricted || elder ? html`<p>${t("handoverRestricted")}</p>` : ""}
    </section>
    <section class="panel stack">
      <h2>${t("handoverRole")}</h2>
      <p>
        ${t({ owner: "handoverOwner", editor: "handoverEditor", vendor: "handoverVendor", elder: "handoverElder" }[role])}
      </p>
      <p>${t("handoverCompatibility")}</p>
      <p>${t("handoverEmpty")}</p>
      <label class="handover-consent" data-handover-sealed-label hidden
        ><input type="checkbox" data-handover-sealed /><span
          >${t("handoverInclude")}</span
        ></label
      >
      <button
        class="btn btn-primary full"
        data-cmd="handover-export"
        data-format="zip"
        ${disabled(elder)}
      >
        ${t("handoverDownload")}
      </button>
      <div class="handover-secondary">
        <button
          class="btn"
          data-cmd="handover-export"
          data-format="json"
          ${disabled(elder)}
        >
          ${t("handoverJSON")}</button
        ><button class="btn" data-cmd="handover-export" data-format="md">
          ${t(elder ? "handoverOwnMD" : "handoverMD")}
        </button>
      </div>
      <p data-handover-status role="status" aria-live="polite"></p>
      <p>${t("handoverSingle")}</p>
      <p>${t("handoverPrivacy")}</p>
    </section>`;
}
export function update() {
  const root = document.querySelector("[data-handover-readiness]");
  if (!root) return;
  mountHTML(root, cards());
  const role = currentHandoverRole(),
    r = summarizeHandoverReadiness(
      handoverSnapshot(backendConfig.projectKey),
      role,
    );
  const label = /** @type {HTMLElement} */ (
    document.querySelector("[data-handover-sealed-label]")
  );
  label.hidden = role !== "owner" || !r.hasSealedContent;
  const check = /** @type {HTMLInputElement} */ (label.querySelector("input"));
  check.disabled = phase === "packing";
  if (label.hidden) check.checked = false;
  document.querySelectorAll('[data-cmd="handover-export"]').forEach((el) => {
    const button = /** @type {HTMLButtonElement} */ (el);
    button.disabled =
      phase === "packing" ||
      (role === "elder" && (button.dataset.format !== "md" || !r.oralDrafts));
    if (button.dataset.format === "zip")
      button.textContent = t(
        phase === "packing" ? "handoverPacking" : "handoverDownload",
      );
  });
  const notice = document.querySelector("[data-handover-status]");
  notice.textContent =
    phase === "idle"
      ? role === "elder" && !r.oralDrafts
        ? t("handoverNoSelf")
        : ""
      : t(statusKeys[phase] || "handoverError");
}
export function mount() {
  installHandoverCommands({
    projectId: backendConfig.projectKey,
    zip: createZipBlob,
    finalize: finalizeHandoverFiles,
    download: downloadBlob,
    status,
  });
  unsubscribe = subscribeHandover(update);
  update();
}
export function unmount() {
  unsubscribe?.();
  unsubscribe = null;
}
