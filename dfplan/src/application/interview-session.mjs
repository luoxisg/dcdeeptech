import {
  interviewScript,
  interviewDraft,
  canInterviewTransition,
  elderPauseMs,
} from "../domain/interview-model.mjs";
/** Memory-only demo state, isolated from project storage and production records. */
export function createInterviewSession(
  clock = {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
  },
) {
  const initial = () => ({
    phase: "idle",
    paused: false,
    turn: 0,
    completed: [],
    transcript: [],
    progress: 0,
    cue: [
      "点击开始，体验三轮示例访谈。",
      "Start a three-turn sample interview.",
    ],
    remaining: elderPauseMs,
    drafts: {},
    notice: "",
  });
  let state = initial(),
    timer = null,
    generation = 0;
  const listeners = new Set();
  const emit = (change) => {
    state = { ...state, ...change };
    listeners.forEach((fn) => fn(state));
  };
  const cancel = () => {
    generation++;
    if (timer !== null) clock.clearTimeout(timer);
    timer = null;
  };
  const later = (fn, ms) => {
    const token = generation;
    timer = clock.setTimeout(() => {
      timer = null;
      if (token === generation && !state.paused) fn();
    }, ms);
  };
  function phase(next) {
    if (!canInterviewTransition(state.phase, next)) return false;
    emit({ phase: next, progress: 0 });
    return true;
  }
  function animate(cue, onDone) {
    emit({ cue, progress: 0 });
    const tick = () => {
      const progress = Math.min(1, state.progress + 0.06);
      emit({ progress });
      if (progress < 1) later(tick, 120);
      else onDone();
    };
    later(tick, 120);
  }
  function countdown() {
    emit({ remaining: elderPauseMs });
    const tick = () => {
      emit({ remaining: Math.max(0, state.remaining - 100) });
      if (state.remaining > 0) later(tick, 100);
      else finishTurn();
    };
    later(tick, 100);
  }
  function listen() {
    if (!phase("listening")) return;
    animate(interviewScript[state.turn].raw, countdown);
  }
  function speak() {
    if (!phase("speaking")) return;
    const prompt = interviewScript[state.turn].prompt;
    emit({
      transcript: [...state.transcript, { role: "guide", text: prompt }],
    });
    animate(prompt, listen);
  }
  function organized() {
    const index = state.turn;
    emit({ completed: [...state.completed, index], turn: index + 1 });
    if (state.turn === interviewScript.length) {
      phase("complete");
      emit({
        cue: [
          "三轮示例完成。请审阅原文和待核实项目，再导出草稿。",
          "All three sample turns are complete. Review the transcript and uncertainties before exporting.",
        ],
        progress: 1,
      });
    } else speak();
  }
  function finishTurn() {
    if (state.phase !== "listening" || state.paused) return;
    cancel();
    const index = state.turn;
    phase("thinking");
    emit({
      cue: [
        "正在按示例整理，保留原话及待核实信息…",
        "Organizing the sample, preserving the original wording and uncertainties…",
      ],
      progress: 1,
      transcript: [
        ...state.transcript,
        { role: "narrator", text: interviewScript[index].raw },
      ],
    });
    later(organized, 700);
  }
  return {
    getState: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    start() {
      if (state.phase !== "idle") return;
      speak();
    },
    interrupt() {
      if (state.phase !== "speaking" || state.paused) return;
      cancel();
      listen();
    },
    finish: finishTurn,
    togglePause() {
      if (["idle", "complete"].includes(state.phase)) return;
      if (!state.paused) {
        cancel();
        emit({ paused: true });
      } else {
        emit({ paused: false });
        if (state.phase === "speaking") animate(state.cue, listen);
        else if (state.phase === "listening")
          animate(interviewScript[state.turn].raw, countdown);
        else later(organized, 700);
      }
    },
    suspend() {
      if (!["idle", "complete"].includes(state.phase) && !state.paused) {
        cancel();
        emit({ paused: true });
      }
    },
    reset() {
      cancel();
      state = initial();
      emit({});
    },
    edit(language, key, value) {
      if (!["title", "body"].includes(key)) return;
      const old = this.draft(language);
      emit({
        drafts: {
          ...state.drafts,
          [language]: { ...old, [key]: String(value).slice(0, 12000) },
        },
        notice: "",
      });
    },
    draft(language) {
      return (
        state.drafts[language] || interviewDraft(state.completed, language)
      );
    },
    notify(notice) {
      emit({ notice });
    },
    exportText(language) {
      const draft = this.draft(language),
        lang = language === "en" ? 1 : 0;
      return [
        lang
          ? "SCRIPTED SAMPLE — NOT A VERIFIED FAMILY RECORD"
          : "脚本示例——并非已核实的家族记录",
        draft.title,
        draft.body,
        lang ? "Items to verify" : "待核实项目",
        ...interviewDraft(state.completed, language).checks,
        lang ? "Original sample transcript" : "示例原始对话",
        ...state.transcript.map(
          (row) =>
            (row.role === "guide"
              ? lang
                ? "Guide: "
                : "访谈提示："
              : lang
                ? "Narrator: "
                : "示例口述：") + row.text[lang],
        ),
      ].join("\n\n");
    },
  };
}
export const interviewSession = createInterviewSession();

/** Clear session-local notes when live access is lost or the signed-in identity changes. */
export function shouldClearInterview(previous, next) {
  return (
    previous.mode === "formal" &&
    (previous.session.user?.uid !== next.session.user?.uid ||
      (previous.ready && !next.ready))
  );
}
