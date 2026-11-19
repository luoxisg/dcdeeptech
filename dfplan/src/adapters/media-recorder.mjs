import { createBrowserTranscription } from "./browser-transcription.mjs";
/** Audio stays local; optional browser transcription is separately consented. */
/** @param {{speech?:boolean,language?:string}} [options] */
export function createBrowserRecorder(options = {}) {
  let stream = null,
    recorder = null,
    chunks = [],
    timer = null,
    stopGuard = null,
    cancelled = false,
    started = false,
    paused = false,
    mark = 0,
    total = 0,
    bytes = 0,
    reason = "",
    settled = false;
  let speech = null,
    speechResult = null,
    muted = false;
  let resolveFinished, rejectFinished;
  const finished = new Promise((resolve, reject) => {
    resolveFinished = resolve;
    rejectFinished = reject;
  });
  // Consumers can attach after a synchronous API failure without an unhandled rejection.
  void finished.catch(() => {});
  const duration = () =>
    total + (started && !paused ? performance.now() - mark : 0);
  const release = () => {
    clearInterval(timer);
    timer = null;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
  };
  const reject = (code) => {
    if (settled) return;
    settled = true;
    speech?.cancel();
    clearTimeout(stopGuard);
    release();
    chunks = [];
    rejectFinished(Error(code));
  };
  function stop(why = "") {
    if (why) reason = why;
    if (speech && !speechResult) speechResult = speech.finish();
    if (recorder && recorder.state !== "inactive") {
      total = duration();
      started = false;
      try {
        recorder.stop();
        stopGuard = setTimeout(() => reject("stop-timeout"), 5000);
      } catch {
        reject("recording-failed");
      }
      release();
    } else if (!recorder) reject("cancelled");
    return finished;
  }
  return {
    finished,
    async start(onTick, remainingBytes, onTranscript = (_value) => {}) {
      if (
        !globalThis.isSecureContext ||
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      ) {
        reject("unsupported");
        throw Error("unsupported");
      }
      try {
        const acquired = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        if (cancelled) {
          acquired.getTracks().forEach((track) => track.stop());
          return false;
        }
        stream = acquired;
        const mime = [
          "audio/webm;codecs=opus",
          "audio/mp4",
          "audio/ogg;codecs=opus",
          "audio/webm",
        ].find((type) => MediaRecorder.isTypeSupported(type));
        recorder = mime
          ? new MediaRecorder(stream, { mimeType: mime })
          : new MediaRecorder(stream);
        recorder.ondataavailable = (event) => {
          if (cancelled || !event.data?.size) return;
          chunks.push(event.data);
          bytes += event.data.size;
          if (bytes >= remainingBytes && recorder.state !== "inactive")
            void stop("limit");
        };
        recorder.onerror = () => {
          reason = "device";
          if (recorder.state !== "inactive") void stop("device");
          else reject("recording-failed");
        };
        recorder.onstop = async () => {
          clearTimeout(stopGuard);
          if (cancelled) {
            reject("cancelled");
            return;
          }
          const elapsed = duration();
          started = false;
          release();
          if (settled) return;
          if (!chunks.length || !bytes) {
            reject("empty");
            return;
          }
          const type =
              recorder.mimeType || chunks[0].type || "application/octet-stream",
            blob = new Blob(chunks, { type });
          chunks = [];
          let transcription = {
            text: "",
            status: "off",
            error: "",
            language: options.language || "zh-CN",
          };
          if (speech) {
            speechResult ||= speech.finish();
            transcription = await speechResult;
          }
          if (cancelled) {
            reject("cancelled");
            return;
          }
          settled = true;
          resolveFinished({
            blob,
            mime: type,
            duration: elapsed,
            incomplete: !!reason,
            reason,
            transcript: transcription.text,
            machineTranscript: transcription.text,
            transcriptState: transcription.status,
            transcriptError: transcription.error,
            transcriptLanguage: transcription.language,
          });
        };
        acquired.getTracks().forEach((track) =>
          track.addEventListener(
            "ended",
            () => {
              if (started) void stop("device");
            },
            { once: true },
          ),
        );
        mark = performance.now();
        started = true;
        recorder.start(500);
        if (options.speech) {
          speech = createBrowserTranscription({
            language: options.language,
            onChange: onTranscript,
          });
          speech.start();
        }
        timer = setInterval(() => onTick(duration()), 250);
        onTick(0);
        return true;
      } catch (error) {
        const code =
          error.name === "NotAllowedError"
            ? "permission"
            : error.name === "NotFoundError"
              ? "no-device"
              : error.message === "unsupported"
                ? "unsupported"
                : "recording-failed";
        reject(code);
        throw Error(code);
      }
    },
    stop,
    retryTranscription() {
      if (started && !paused && !muted) speech?.resume();
    },
    pause() {
      if (recorder?.state !== "recording") return;
      speech?.pause();
      total = duration();
      paused = true;
      recorder.pause();
    },
    resume() {
      if (recorder?.state !== "paused") return;
      mark = performance.now();
      paused = false;
      recorder.resume();
      if (!muted) speech?.resume();
    },
    mute(value) {
      muted = value;
      if (value) speech?.pause();
      else if (!paused) speech?.resume();
      stream?.getAudioTracks().forEach((track) => {
        track.enabled = !value;
      });
    },
    dispose() {
      speech?.cancel();
      cancelled = true;
      started = false;
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {}
      }
      reject("cancelled");
      release();
    },
  };
}
export const recordingBrowserIO = {
  createURL: (blob) => URL.createObjectURL(blob),
  revokeURL: (url) => URL.revokeObjectURL(url),
  id: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
};
export function downloadRecordingFile(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
}
export function downloadRecordingNotes(text) {
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + text], { type: "text/plain;charset=utf-8" }),
  );
  downloadRecordingFile(url, "DeepFamily_Interview_Notes.txt");
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
