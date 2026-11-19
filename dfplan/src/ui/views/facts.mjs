import { store } from "../../application/store.mjs";
import { readAssertions } from "../../domain/stewardship-model.mjs";
import { html } from "../html.mjs";
import { t, s, field } from "../i18n.mjs";
import { pageTitle } from "../components.mjs";
export function render() {
  const state = store.getState();
  return html`${pageTitle(t("facts"), s("保留来源与不同说法，确认事实不等于项目正式验收。", "Keep sources and differing accounts. A fact confirmation is not formal project acceptance."))}
    <section class="panel">
      <button class="btn btn-primary full" data-cmd="assertion">
        ${t("addFact")}
      </button>
    </section>
    <div class="stack">
      ${state.project.tasks.map((task) => {
        const parsed = readAssertions(task.outcomes || "");
        return html`<section class="panel">
          <h2>${task.id} · ${field(task, "title")}</h2>
          ${parsed.text ? html`<p class="pre-wrap">${parsed.text}</p>` : ""}${task.recovery ? html`<p>${s("恢复记录：", "Recovery: ")}${task.recovery}</p>` : ""}${parsed.assertions.map(
            (assertion) =>
              html`<article class="assertion-card">
                <span class="badge"
                  >${t(assertion.status === "unverified" ? "unverified" : assertion.status)}</span
                >
                <h3>${assertion.text}</h3>
                <p>${s("来源：", "Source: ")}${assertion.source || "—"}</p>
                <p class="pre-wrap">${assertion.note}</p>
                <div class="fact-actions">
                  <button
                    class="btn btn-primary full"
                    data-cmd="fact-status"
                    data-task-id="${task.id}"
                    data-id="${assertion.id}"
                    data-status="confirmed"
                  >
                    ${t("confirmFact")}</button
                  ><button
                    class="btn full"
                    data-cmd="fact-status"
                    data-task-id="${task.id}"
                    data-id="${assertion.id}"
                    data-status="conflict"
                  >
                    ${t("reviewFact")}</button
                  ><button
                    class="btn full"
                    data-cmd="fact-note"
                    data-task-id="${task.id}"
                    data-id="${assertion.id}"
                  >
                    ${t("noteFact")}
                  </button>
                </div>
              </article>`,
          )}${!parsed.assertions.length ? html`<p>${s("尚无独立事实记录。原有保全及恢复记录仍保留在任务中。", "No assertion records yet. Existing stewardship and recovery notes remain in the task.")}</p>` : ""}<button
            class="btn"
            data-cmd="assertion"
            data-task-id="${task.id}"
          >
            ${t("addFact")}</button
          ><button class="btn" data-cmd="editor" data-id="${task.id}">
            ${s("查看分工与保全记录", "View stewardship records")}
          </button>
        </section>`;
      })}
    </div>`;
}
