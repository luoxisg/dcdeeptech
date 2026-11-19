import {
  recordingPrompt,
  recordingExtension,
  recordingByteLimit,
  recordingDraft,
} from "../domain/recording-model.mjs";
/** Capture and object-URL operations are injected. No project/storage/cloud dependency. */
export function createRecordingSession(io) {
  const initial = () => ({
    phase: "idle",
    round: 0,
    clips: [],
    elapsed: 0,
    muted: false,
    consent: false,
    notesExportRequested: false,
    error: "",
    notice: "",
  });
  let state = initial(),
    capture = null,
    epoch = 0,
    advance = false,
    startedAt = "";
  const listeners = new Set();
  const emit = (change) => {
    state = { ...state, ...change };
    listeners.forEach((fn) => fn(state));
  };
  const current = (token, adapter) => token === epoch && capture === adapter;
  const api = {
    snapshot: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    consent(value) {
      if (state.phase === "idle") emit({ consent: !!value });
    },
    async start() {
      if (state.phase !== "idle" || !state.consent) return;
      const remaining =
        recordingByteLimit -
        state.clips.reduce((sum, clip) => sum + clip.blob.size, 0);
      if (remaining <= 0) {
        emit({ error: "limit" });
        return;
      }
      const adapter = io.capture(),
        token = ++epoch;
      capture = adapter;
      advance = false;
      startedAt = io.now();
      emit({
        phase: "requesting",
        elapsed: 0,
        error: "",
        notice: "",
        muted: false,
      });
      adapter.finished
        .then(
          (result) => {
            if (!current(token, adapter)) return;
            capture = null;
            if (!result.blob?.size) {
              emit({ phase: "idle", error: "empty" });
              return;
            }
            const ext = recordingExtension(result.mime),
              id = io.id(),
              clip = {
                id,
                round: state.round,
                prompt: recordingPrompt(state.round),
                startedAt,
                filename: `DeepFamily_Interview_${state.clips.length + 1}.${ext}`,
                ...result,
                url: io.createURL(result.blob),
                note: "",
                downloadRequested: false,
              };
            emit({
              phase: "idle",
              clips: [...state.clips, clip],
              round: state.round + (advance ? 1 : 0),
              elapsed: advance ? 0 : result.duration,
              muted: false,
              error: "",
              notice: result.reason || "saved",
              notesExportRequested: false,
            });
          },
          (error) => {
            if (current(token, adapter)) {
              capture = null;
              emit({
                phase: "idle",
                muted: false,
                error: error.message === "cancelled" ? "" : error.message,
              });
            }
          },
        )
        .catch(() => {
          if (token === epoch) {
            capture = null;
            emit({ phase: "idle", error: "recording-failed" });
          }
        });
      try {
        const success = await adapter.start((elapsed) => {
          if (current(token, adapter)) emit({ elapsed });
        }, remaining);
        if (current(token, adapter) && success) emit({ phase: "recording" });
      } catch (error) {
        if (current(token, adapter)) {
          capture = null;
          emit({ phase: "idle", error: error.message });
        }
      }
    },
    async stop(nextRound = false) {
      if (!capture || !["recording", "paused"].includes(state.phase)) return;
      advance = nextRound;
      const adapter = capture;
      emit({ phase: "stopping" });
      try {
        await adapter.stop();
      } catch {}
    },
    pause() {
      if (state.phase === "recording") {
        capture.pause();
        emit({ phase: "paused" });
      } else if (state.phase === "paused") {
        capture.resume();
        emit({ phase: "recording" });
      }
    },
    mute() {
      if (!["recording", "paused"].includes(state.phase)) return;
      const muted = !state.muted;
      capture.mute(muted);
      emit({ muted });
    },
    async leave() {
      if (state.phase === "requesting") {
        epoch++;
        capture?.dispose();
        capture = null;
        emit({ phase: "idle", error: "", muted: false });
      } else if (state.phase === "stopping") {
        try {
          await capture?.finished;
        } catch {}
      } else await api.stop(false);
    },
    note(id, note) {
      emit({
        notesExportRequested: false,
        clips: state.clips.map((clip) =>
          clip.id === id
            ? { ...clip, note: String(note).slice(0, 12000) }
            : clip,
        ),
      });
    },
    downloaded(id) {
      emit({
        clips: state.clips.map((clip) =>
          clip.id === id ? { ...clip, downloadRequested: true } : clip,
        ),
      });
    },
    notesDownloaded() {
      emit({ notesExportRequested: true });
    },
    draft: (lang) => recordingDraft(state.clips, lang),
    clear() {
      epoch++;
      capture?.dispose();
      capture = null;
      state.clips.forEach((clip) => io.revokeURL(clip.url));
      state = initial();
      emit({});
    },
    pending() {
      return (
        state.phase !== "idle" ||
        state.clips.some((clip) => !clip.downloadRequested) ||
        (state.clips.some((clip) => clip.note.trim()) &&
          !state.notesExportRequested)
      );
    },
  };
  return api;
}
