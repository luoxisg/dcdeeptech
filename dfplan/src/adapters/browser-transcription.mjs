/** Optional Web Speech API. The browser provider may process live audio remotely. */
export function browserTranscriptionSupported() {
  const platform = /** @type {any} */ (globalThis);
  return (
    typeof (platform.SpeechRecognition || platform.webkitSpeechRecognition) ===
    "function"
  );
}
/** @param {{language?:string,onChange?:(value:any)=>void,Recognition?:any,clock?:any}} [options] */
export function createBrowserTranscription({
  language = "zh-CN",
  onChange = (_value) => {},
  Recognition = null,
  clock = {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
  },
} = {}) {
  const platform = /** @type {any} */ (globalThis),
    Constructor =
      Recognition ||
      platform.SpeechRecognition ||
      platform.webkitSpeechRecognition;
  let recognizer = null,
    epoch = 0,
    prefix = "",
    segments = [],
    text = "",
    status = "off",
    error = "",
    partial = false,
    truncated = false,
    running = false,
    finishing = false,
    restarts = 0,
    restartTimer = null,
    finishTimer = null,
    finishPromise = null,
    resolveFinish = null;
  const snapshot = () => ({
    text,
    status,
    error,
    partial,
    truncated,
    language,
  });
  const notify = () => onChange(snapshot());
  const refresh = () => {
    const combined = [prefix, ...segments.map((item) => item?.text || "")]
      .filter(Boolean)
      .join(" ")
      .trim();
    text = combined.slice(0, 12000);
    truncated = truncated || combined.length > 12000;
  };
  const commit = () => {
    refresh();
    partial = partial || segments.some((item) => item && !item.final);
    prefix = text;
    segments = [];
  };
  const clearTimers = () => {
    clock.clearTimeout(restartTimer);
    clock.clearTimeout(finishTimer);
    restartTimer = null;
    finishTimer = null;
  };
  function complete() {
    if (!finishing) return;
    commit();
    epoch++;
    const old = recognizer;
    recognizer = null;
    running = false;
    finishing = false;
    clearTimers();
    try {
      old?.abort();
    } catch {}
    status = error
      ? "error"
      : text
        ? partial || truncated
          ? "partial"
          : "complete"
        : "empty";
    notify();
    resolveFinish?.(snapshot());
    resolveFinish = null;
  }
  function attempt() {
    if (!running || finishing) return;
    if (!Constructor) {
      status = "unsupported";
      error = "unsupported";
      running = false;
      notify();
      return;
    }
    const token = ++epoch;
    segments = [];
    let instance;
    try {
      instance = new Constructor();
      recognizer = instance;
      instance.lang = language;
      instance.continuous = true;
      instance.interimResults = true;
      instance.maxAlternatives = 1;
      status = "starting";
      notify();
      const valid = () =>
        token === epoch && recognizer === instance && (running || finishing);
      instance.onstart = () => {
        if (valid()) {
          status = "listening";
          notify();
        }
      };
      instance.onresult = (event) => {
        if (!valid()) return;
        for (let i = event.resultIndex || 0; i < event.results.length; i++) {
          const result = event.results[i];
          segments[i] = {
            text: String(result[0]?.transcript || ""),
            final: !!result.isFinal,
          };
          if (result.isFinal && segments[i].text.trim()) restarts = 0;
        }
        refresh();
        notify();
        if (truncated) {
          commit();
          running = false;
          epoch++;
          recognizer = null;
          status = "partial";
          error = "text-limit";
          partial = true;
          try {
            instance.abort();
          } catch {}
          notify();
          if (finishing) complete();
        }
      };
      instance.onerror = (event) => {
        if (!valid()) return;
        error = String(event.error || "service");
        if (error === "no-speech") {
          status = "waiting";
          notify();
          return;
        }
        running = false;
        status = "error";
        if (finishing) {
          complete();
          return;
        }
        commit();
        epoch++;
        recognizer = null;
        try {
          instance.abort();
        } catch {}
        notify();
      };
      instance.onend = () => {
        if (!valid() && !(token === epoch && recognizer === instance)) return;
        commit();
        recognizer = null;
        if (finishing) {
          complete();
          return;
        }
        if (running && restarts++ < 2) {
          error = "";
          status = "reconnecting";
          notify();
          restartTimer = clock.setTimeout(attempt, 250);
        } else {
          running = false;
          status = error ? "error" : "stopped";
          notify();
        }
      };
      instance.start();
    } catch {
      running = false;
      recognizer = null;
      status = "error";
      error = "service";
      notify();
    }
  }
  return {
    snapshot,
    start() {
      if (running || finishing || truncated) return;
      running = true;
      error = "";
      restarts = 0;
      attempt();
    },
    pause() {
      if (finishing) return;
      commit();
      running = false;
      epoch++;
      clock.clearTimeout(restartTimer);
      restartTimer = null;
      const old = recognizer;
      recognizer = null;
      try {
        old?.abort();
      } catch {}
      status = "paused";
      notify();
    },
    resume() {
      this.start();
    },
    finish() {
      if (finishPromise) return finishPromise;
      finishPromise = new Promise((resolve) => (resolveFinish = resolve));
      running = false;
      finishing = true;
      clock.clearTimeout(restartTimer);
      restartTimer = null;
      if (!recognizer) {
        complete();
        return finishPromise;
      }
      status = "finishing";
      notify();
      finishTimer = clock.setTimeout(() => {
        partial = true;
        complete();
      }, 1500);
      try {
        recognizer.stop();
      } catch {
        partial = true;
        complete();
      }
      return finishPromise;
    },
    cancel() {
      epoch++;
      running = false;
      finishing = false;
      clearTimers();
      const old = recognizer;
      recognizer = null;
      try {
        old?.abort();
      } catch {}
      prefix = "";
      segments = [];
      text = "";
      status = "off";
      error = "";
      partial = false;
      truncated = false;
      resolveFinish?.(snapshot());
      resolveFinish = null;
    },
  };
}
