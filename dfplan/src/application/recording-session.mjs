import { localASRConfig } from "../domain/local-asr-model.mjs";
import {
  recordingPrompt,
  recordingExtension,
  recordingByteLimit,
  recordingDraft,
} from "../domain/recording-model.mjs";
/** Capture and object-URL operations are injected. No project/storage/cloud dependency. */
export function createRecordingSession(io) {
  const initial = () => ({
    localJob: null,
    phase: "idle",
    round: 0,
    clips: [],
    elapsed: 0,
    muted: false,
    consent: false,
    transcriptionEnabled: false,
    transcriptionLanguage: "zh-CN",
    liveTranscript: "",
    transcriptionStatus: "off",
    transcriptionError: "",
    notesExportRequested: false,
    error: "",
    notice: "",
  });
  let state = initial(),
    capture = null,
    epoch = 0,
    advance = false,
    startedAt = "",
    localEpoch = 0;
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
    transcription(value, language) {
      if (state.phase === "idle")
        emit({
          transcriptionEnabled: !!value,
          transcriptionLanguage: language === "en-SG" ? "en-SG" : "zh-CN",
        });
    },
    editTranscript(id, value) {
      emit({
        notesExportRequested: false,
        clips: state.clips.map((clip) =>
          clip.id === id
            ? {
                ...clip,
                transcript: String(value).slice(0, 12000),
                transcriptEdited: true,
              }
            : clip,
        ),
      });
    },
    cancelLocal() {
      localEpoch++;
      io.cancelLocal?.();
      emit({ localJob: null });
    },
    importAudio(file) {
      if (
        state.phase !== "idle" ||
        (state.localJob && state.localJob.stage !== "error")
      )
        throw Error("busy");
      if (!file?.size || file.size > localASRConfig.maxImportBytes)
        throw Error("file-size");
      if (!/\.(webm|m4a|mp4|wav|ogg|mp3|aac)$/i.test(file.name || ""))
        throw Error("decode");
      if (
        state.clips.reduce((n, c) => n + c.blob.size, 0) + file.size >
        recordingByteLimit
      )
        throw Error("limit");
      const clip = {
        id: io.id(),
        round: state.round,
        prompt: ["导入的访谈录音", "Imported interview recording"],
        startedAt: io.now(),
        filename: file.name,
        blob: file,
        url: io.createURL(file),
        duration: 0,
        mime: file.type,
        note: "",
        transcript: "",
        machineTranscript: "",
        transcriptState: "off",
        downloadRequested: true,
      };
      emit({ clips: [...state.clips, clip], notesExportRequested: false });
    },
    async transcribeClip(id, language) {
      if (
        state.phase !== "idle" ||
        (state.localJob && state.localJob.stage !== "error")
      )
        return;
      const clip = state.clips.find((c) => c.id === id);
      if (!clip || clip.transcriptEdited) return;
      const token = ++localEpoch;
      emit({ localJob: { id, stage: "decoding", progress: 0, error: "" } });
      try {
        const result = await io.localTranscribe(clip.blob, language, (p) => {
          if (token === localEpoch) emit({ localJob: { id, ...p, error: "" } });
        });
        if (token !== localEpoch) return;
        const text = String(result.text || "").trim();
        if (!text) throw Error("no-text");
        emit({
          localJob: null,
          notesExportRequested: false,
          clips: state.clips.map((c) =>
            c.id === id && !c.transcriptEdited
              ? {
                  ...c,
                  transcript: text,
                  machineTranscript: text,
                  transcriptState: "complete",
                  transcriptError: "",
                  transcriptSource: result.model,
                  transcriptRevision: result.revision,
                  duration: result.duration || c.duration,
                }
              : c,
          ),
        });
      } catch (error) {
        if (token === localEpoch)
          emit({ localJob: { id, stage: "error", error: error.message } });
      }
    },
    async start() {
      if (
        state.phase !== "idle" ||
        (state.localJob && state.localJob.stage !== "error") ||
        !state.consent
      )
        return;
      const remaining =
        recordingByteLimit -
        state.clips.reduce((sum, clip) => sum + clip.blob.size, 0);
      if (remaining <= 0) {
        emit({ error: "limit" });
        return;
      }
      const adapter = io.capture({
          speech: state.transcriptionEnabled,
          language: state.transcriptionLanguage,
        }),
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
        liveTranscript: "",
        transcriptionStatus: state.transcriptionEnabled ? "starting" : "off",
        transcriptionError: "",
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
                consent: {
                  recording: true,
                  publication: "not_recorded",
                  ai: "not_recorded",
                },
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
        const success = await adapter.start(
          (elapsed) => {
            if (current(token, adapter)) emit({ elapsed });
          },
          remaining,
          (transcript) => {
            if (current(token, adapter))
              emit({
                liveTranscript: transcript.text,
                transcriptionStatus: transcript.status,
                transcriptionError: transcript.error,
              });
          },
        );
        if (current(token, adapter) && success) emit({ phase: "recording" });
      } catch (error) {
        if (current(token, adapter)) {
          capture = null;
          emit({ phase: "idle", error: error.message });
        }
      }
    },
    retryTranscription() {
      if (
        state.phase === "recording" &&
        !state.muted &&
        state.transcriptionEnabled
      )
        capture?.retryTranscription?.();
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
      api.cancelLocal();
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
      api.cancelLocal();
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
        (state.clips.some(
          (clip) => clip.note.trim() || clip.transcript?.trim(),
        ) &&
          !state.notesExportRequested)
      );
    },
  };
  return api;
}
