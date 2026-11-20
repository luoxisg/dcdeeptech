import { store } from "./store.mjs";
import { commands } from "./command-bus.mjs";
import { commitProject } from "./actions.mjs";
import { translate } from "../domain/i18n.mjs";
import { buildHandoverFiles } from "../domain/exports.mjs";
import { interviewSession } from "./interview-session.mjs";
import { collectInterviewEntities } from "../domain/interview-model.mjs";
let readRecordings = () => null,
  installed = false,
  working = false;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());
interviewSession.subscribe(notify);
export function subscribeHandover(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function registerHandoverRecordings(read, subscribe) {
  readRecordings = read;
  subscribe(notify);
  notify();
}
/** Export-only compatibility mapping. Does not create memberships or change account permissions. */
export function currentHandoverRole(state = store.getState()) {
  if (!state.ready) return "vendor";
  if (state.mode === "demo" || state.mode === "local") return "owner";
  const role = state.session.admin?.role;
  return role === "owner"
    ? "owner"
    : role === "admin" || role === "editor"
      ? "editor"
      : role === "elder"
        ? "elder"
        : "vendor";
}
export function handoverSnapshot(projectId = "dfplan") {
  const state = store.getState(),
    recording = readRecordings(),
    sample = interviewSession.getState();
  /** @type {Array<Record<string,any>>} */ const clips = (
    recording?.clips || []
  ).map((clip) => ({
    id: clip.id,
    personId: clip.personId,
    subjectId: clip.subjectId,
    startedAt: clip.startedAt,
    prompt: clip.prompt,
    transcript: clip.transcript || "",
    machineTranscript: clip.machineTranscript || "",
    transcriptEdited: !!clip.transcriptEdited,
    note: clip.note || "",
    duration: clip.duration,
    entities: clip.entities || [],
    sensitivity: clip.sensitivity || "family",
    source: "session-recording",
    consent: clip.consent || null,
  }));
  const hasSample =
    sample.transcript.length || Object.keys(sample.drafts).length;
  if (hasSample && state.mode === "demo")
    clips.push({
      id: "scripted-sample",
      transcript: interviewSession.exportText(state.language),
      draft: interviewSession.draft(state.language).body,
      entities: collectInterviewEntities(sample.completed),
      source: "scripted-sample",
      sensitivity: "family",
    });
  return {
    ...state,
    projectId:
      state.mode === "demo"
        ? "dfplan-demo"
        : state.mode === "local"
          ? "dfplan-local"
          : projectId,
    oralHistories: clips,
  };
}
/** All browser/ZIP operations are injected, keeping application imports inside its layers. */
export function installHandoverCommands(io) {
  if (installed) return;
  installed = true;
  commands.register(
    "handover-export",
    async ({ format = "zip", includeSealed = "false" } = {}) => {
      if (working) return;
      const before = store.getState();
      if (!before.ready)
        throw Error(translate("handoverNotReady", before.language));
      const role = currentHandoverRole(before),
        snapshot = handoverSnapshot(io.projectId),
        own = snapshot.oralHistories.filter(
          (row) =>
            String(row.personId || row.subjectId || "") ===
              String(before.session.user?.uid || "") &&
            !!before.session.user?.uid,
        );
      if (
        !["zip", "json", "md"].includes(format) ||
        (role === "elder" && (format !== "md" || !own.length))
      )
        throw Error(translate("handoverNotAllowed", before.language));
      if (
        format !== "md" &&
        ["owner", "editor"].includes(role) &&
        before.peopleReady === false
      )
        throw Error(translate("handoverPeopleUnavailable", before.language));
      working = true;
      io.status("packing");
      try {
        const nowIso = new Date().toISOString(),
          exportedBy =
            before.session.user?.email ||
            before.session.admin?.displayName ||
            (before.mode === "demo" ? "Demo browser" : "This device");
        const include = role === "owner" && includeSealed === "true";
        const files = await io.finalize(
          buildHandoverFiles(snapshot, {
            role,
            includeSealed: include,
            exportedBy,
            nowIso,
          }),
        );
        const current = store.getState();
        if (
          !current.ready ||
          currentHandoverRole(current) !== role ||
          current.mode !== before.mode ||
          current.session.user?.uid !== before.session.user?.uid
        )
          throw Error(translate("handoverIdentityChanged", before.language));
        const id =
          String(snapshot.projectId)
            .replace(/[^a-zA-Z0-9_-]/g, "_")
            .slice(0, 80) || "dfplan";
        const base = `deepfamily-handover-${id}-${nowIso.slice(0, 10).replaceAll("-", "")}`;
        if (format === "zip") io.download(io.zip(files), base + ".zip");
        if (format === "json")
          io.download(
            new Blob(
              [
                JSON.stringify(
                  {
                    schemaVersion: "1.0.0",
                    files: files.map((file) => ({
                      path: file.path,
                      content: file.content,
                    })),
                  },
                  null,
                  2,
                ),
              ],
              { type: "application/json;charset=utf-8" },
            ),
            base + ".json",
          );
        if (format === "md")
          io.download(
            new Blob(
              [
                role === "elder"
                  ? files
                      .filter(
                        (file) =>
                          file.path.startsWith("oral_histories/") &&
                          file.path.endsWith(".md"),
                      )
                      .map((file) => file.content)
                      .join("\n\n")
                  : files.find((file) => file.path === "README_HANDOVER.md")
                      .content,
              ],
              { type: "text/markdown;charset=utf-8" },
            ),
            base + ".md",
          );
        const event = {
          type: "handover-export",
          exportedBy,
          role,
          format,
          includeSealed:
            include &&
            format !== "md" &&
            JSON.parse(
              files.find((file) => file.path === "manifest.json").content,
            ).readiness.hasSealedContent,
          at: nowIso,
          delivery: "browser-download-requested",
        };
        // Existing save port appends the audit entry; tasks and acceptance are not edited.
        try {
          await commands.run("handover-audit", { event });
          io.status("requested");
        } catch {
          io.status("audit-failed");
        }
      } catch (error) {
        io.status("error");
        throw error;
      } finally {
        working = false;
      }
    },
  );
  commands.register("handover-audit", async ({ event }) => {
    const uid = store.getState().session.user?.uid;
    const text = "请求下载数采移交包 " + JSON.stringify(event),
      textEn =
        "Requested data-output handover download " + JSON.stringify(event);
    await commitProject(store.getState().project, text, textEn, false, true);
    const after = store.getState();
    if (
      !after.ready ||
      after.session.user?.uid !== uid ||
      !after.project.history.some(
        (row) => row.text === text || row.textEn === textEn,
      )
    )
      throw Error(translate("handoverAuditFailed", after.language));
  });
}
