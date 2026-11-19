import {
  interviewSession as session,
  shouldClearInterview,
} from "../../application/interview-session.mjs";
import { commands } from "../../application/command-bus.mjs";
import { store } from "../../application/store.mjs";
import {
  collectInterviewEntities,
  interviewScript,
  elderPauseMs,
} from "../../domain/interview-model.mjs";
import {
  createInterviewMeter,
  downloadInterview,
} from "../../adapters/interview-browser.mjs";
import { html, mount as mountHTML } from "../html.mjs";
import { t, s } from "../i18n.mjs";
import { pageTitle } from "../components.mjs";
let installed = false,
  unsubscribe = null,
  meter = null,
  micStatus = "off",
  lastCompleted = -1;
const label = (pair) => s(pair[0], pair[1]);
const labels = {
  idle: ["尚未开始", "Ready"],
  speaking: ["访谈提示", "Interview prompt"],
  listening: ["示例口述", "Sample response"],
  thinking: ["整理示例", "Organizing sample"],
  complete: ["示例完成", "Sample complete"],
};
const micLabels = {
  off: ["测试麦克风电平", "Test microphone level"],
  requesting: ["等待麦克风授权…", "Waiting for microphone permission…"],
  active: ["停止麦克风测试", "Stop microphone test"],
  denied: [
    "未获麦克风权限，可继续脚本演示",
    "Microphone unavailable; the script still works",
  ],
  unsupported: [
    "此浏览器不支持电平测试",
    "Level test is unavailable in this browser",
  ],
};
function stopMeter() {
  meter?.stop();
  meter = null;
  micStatus = "off";
}
function install() {
  if (installed) return;
  installed = true;
  store.subscribe((next, previous) => {
    if (shouldClearInterview(previous, next)) {
      stopMeter();
      session.reset();
    }
  });
  commands.register("interview-primary", () => {
    const state = session.getState();
    if (state.paused) session.togglePause();
    else if (state.phase === "idle") session.start();
    else if (state.phase === "speaking") session.interrupt();
    else if (state.phase === "listening") session.finish();
  });
  commands.register("interview-pause", () => session.togglePause());
  commands.register("interview-reset", () => {
    session.suspend();
    stopMeter();
    store.update({ dialog: { kind: "interview-reset" } });
  });
  commands.register("interview-confirm-reset", () => {
    session.reset();
    store.update({ dialog: null });
  });
  commands.register("interview-review", () => {
    session.suspend();
    stopMeter();
    store.update({ dialog: { kind: "interview" } });
  });
  commands.register("interview-edit", ({ language, key, value }) =>
    session.edit(language, key, value),
  );
  commands.register("interview-export", () => {
    downloadInterview(session.exportText(store.getState().language));
    session.notify(
      s(
        "已交给浏览器下载，请检查文件后妥善保管。",
        "Download started. Check and store the file securely.",
      ),
    );
  });
  commands.register("interview-copy", async () => {
    const text = session.exportText(store.getState().language);
    try {
      if (!navigator.clipboard?.writeText) throw Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      session.notify(s("已复制待核实草稿。", "Unverified draft copied."));
    } catch {
      store.update({ dialog: { kind: "copy", data: { text } } });
    }
  });
  commands.register("interview-microphone", async () => {
    if (micStatus === "active" || micStatus === "requesting") {
      stopMeter();
      update();
      return;
    }
    if (!meter)
      meter = createInterviewMeter(
        (level) => {
          const orb = /** @type {HTMLElement|null} */ (
            document.querySelector("[data-interview-orb]")
          );
          orb?.style.setProperty("--mic-level", String(level));
        },
        (status) => {
          micStatus = status;
          update();
        },
      );
    await meter.start();
  });
}
export function render() {
  return html`${pageTitle(t("interview"), s("WU-05 访谈体验：采集 → 整理 → 核实。", "WU-05 sample: collect → organize → verify."))}
    <section class="interview-workspace">
      <div class="panel interview-stage">
        <button class="btn btn-primary full" data-cmd="voice-open">
          ${s("打开真实录音访谈", "Open real recording interview")}
        </button>
        <strong class="badge"
          >${s("脚本演示 · 尚未录音或转写", "Scripted sample · no recording or transcription")}</strong
        >
        <div class="card-meta">
          <strong data-interview-phase role="status"></strong
          ><span data-interview-count></span>
        </div>
        <button
          class="interview-orb btn"
          data-cmd="interview-primary"
          data-interview-orb
          aria-label="${s("开始或打断示例提示", "Start or interrupt the sample prompt")}"
        >
          <span aria-hidden="true">◉</span>
        </button>
        <p class="interview-cue" data-interview-cue></p>
        <div class="interview-vad" data-interview-vad hidden>
          <progress
            data-interview-countdown
            max="3500"
            value="3500"
            aria-label="${s("长停顿演示倒计时", "Long-pause demo countdown")}"
          ></progress>
          <p data-interview-seconds></p>
        </div>
        <div class="interview-controls">
          <button
            class="btn btn-primary full"
            data-cmd="interview-primary"
            data-interview-primary
          ></button
          ><button
            class="btn"
            data-cmd="interview-pause"
            data-interview-pause
          ></button
          ><button class="btn" data-cmd="interview-reset">
            ${s("重新体验", "Restart sample")}</button
          ><button class="btn full" data-cmd="interview-review">
            ${s("整理与审阅草稿", "Organize & review draft")}
          </button>
        </div>
        <p class="interview-notice" data-interview-notice role="status"></p>
      </div>
      <aside class="stack">
        <aside class="notice">
          <strong
            >${s("三轮脚本演示，不是实时 AI 访谈。", "Three scripted sample turns, not a live AI interview.")}</strong
          >
          <p>
            ${s("字幕、人物标签与初稿均来自预设示例；本模块不录音、不转写、不上传，也不会自动归档。", "Subtitles, tags and drafts come from a preset example. This module does not record, transcribe, upload or automatically archive.")}
          </p>
        </aside>

        <section class="panel">
          <h2>
            ${s("从口述到可核实记录", "From a story to verifiable records")}
          </h2>
          <ol class="interview-steps">
            <li>
              ${s("先确认访谈同意、语言与陪同者。", "Agree consent, language and a companion first.")}
            </li>
            <li>
              ${s("保留原话和不确定的日期，不自动补全事实。", "Keep original wording and uncertain dates; do not invent facts.")}
            </li>
            <li>
              ${s("审阅后导出；由获授权人员在事实核实页另行登记。", "Review and export; authorized people can separately register facts for verification.")}
            </li>
          </ol>
          <button class="btn full" data-cmd="navigate" data-view="facts">
            ${s("前往事实核实", "Open fact verification")}
          </button>
        </section>
        <section class="panel">
          <h2>
            ${s("示例中的人物、时间与地点", "People, dates and places in the sample")}
          </h2>
          <p>
            ${s("标签仅帮助整理，尚未核实。", "Tags help organize the sample; they are unverified.")}
          </p>
          <div class="interview-entities" data-interview-entities></div>
        </section>
        <details class="panel">
          <summary>
            ${s("可选：测试麦克风电平", "Optional: test microphone level")}
          </summary>
          <p>
            ${s("只有点击测试才申请麦克风权限。仅在本机显示音量，不录音或识别内容；离开页面即关闭麦克风。", "Permission is requested only after you tap Test. Volume is shown locally without recording or recognizing content. Leaving this page stops the microphone.")}
          </p>
          <button
            class="btn full"
            data-cmd="interview-microphone"
            data-interview-microphone
          ></button>
          <p data-interview-mic-status role="status"></p>
        </details>
        <p>
          ${s("草稿只保留在当前页面会话。刷新或关闭前请先导出；不会修改 WU-05 的任务状态或验收。", "Drafts stay in this page session. Export before refreshing or closing. WU-05 status and acceptance are unchanged.")}
        </p>
      </aside>
    </section>`;
}
export function update() {
  const root = document.querySelector(".interview-workspace");
  if (!root) return;
  const state = session.getState(),
    lang = store.getState().language === "en" ? 1 : 0;
  const text = (selector, value) => {
    const node = root.querySelector(selector);
    if (node && node.textContent !== value) node.textContent = value;
  };
  text(
    "[data-interview-phase]",
    state.paused
      ? s("已暂停，可继续", "Paused — resume when ready")
      : label(labels[state.phase]),
  );
  text(
    "[data-interview-count]",
    `${state.completed.length} / ${interviewScript.length} ${s("轮", "turns")}`,
  );
  text(
    "[data-interview-cue]",
    state.cue[lang].slice(
      0,
      Math.max(
        1,
        Math.ceil(
          state.cue[lang].length *
            (["idle", "complete"].includes(state.phase) ? 1 : state.progress),
        ),
      ),
    ),
  );
  const primary = state.paused
    ? s("继续示例", "Resume sample")
    : state.phase === "idle"
      ? s("开始示例访谈", "Start sample interview")
      : state.phase === "speaking"
        ? s("打断提示，轮到我说", "Skip prompt — my turn")
        : state.phase === "listening"
          ? s("本轮示例说完了", "Finish this sample turn")
          : state.phase === "complete"
            ? s("示例已完成，请审阅草稿", "Sample complete — review draft")
            : s("正在整理…", "Organizing…");
  text("[data-interview-primary]", primary);
  text(
    "[data-interview-pause]",
    state.paused ? s("继续", "Resume") : s("暂停", "Pause"),
  );
  root
    .querySelectorAll("[data-interview-primary],[data-interview-orb]")
    .forEach((el) => {
      /** @type {HTMLButtonElement} */ (el).disabled =
        !state.paused && ["thinking", "complete"].includes(state.phase);
    });
  /** @type {HTMLButtonElement} */ (
    root.querySelector("[data-interview-pause]")
  ).disabled = ["idle", "complete"].includes(state.phase);
  const orb = /** @type {HTMLElement} */ (
    root.querySelector("[data-interview-orb]")
  );
  orb.dataset.phase = state.paused ? "idle" : state.phase;
  const vad = /** @type {HTMLElement} */ (
    root.querySelector("[data-interview-vad]")
  );
  vad.hidden = state.phase !== "listening" || state.progress < 1;
  /** @type {HTMLProgressElement} */ (
    root.querySelector("[data-interview-countdown]")
  ).value = state.remaining;
  text(
    "[data-interview-seconds]",
    s("停顿宽容演示：", "Pause-tolerance demo: ") +
      (state.remaining / 1000).toFixed(1) +
      s(" 秒，不分析真实语音", " s; no real speech analysis"),
  );
  text("[data-interview-notice]", state.notice);
  text(
    "[data-interview-microphone]",
    micStatus === "active"
      ? label(micLabels.active)
      : micStatus === "requesting"
        ? label(micLabels.requesting)
        : label(micLabels.off),
  );
  text(
    "[data-interview-mic-status]",
    ["denied", "unsupported"].includes(micStatus)
      ? label(micLabels[micStatus])
      : "",
  );
  if (lastCompleted !== state.completed.length) {
    lastCompleted = state.completed.length;
    mountHTML(
      root.querySelector("[data-interview-entities]"),
      html`${collectInterviewEntities(state.completed).map((entity) => html`<span class="badge">${entity[lang + 1]}</span>`)}`,
    );
  }
  // Only feedback text changes while the review form remains mounted.
  const notice = document.querySelector("[data-interview-draft-notice]");
  if (notice) notice.textContent = state.notice;
}
export function mount() {
  install();
  lastCompleted = -1;
  unsubscribe = session.subscribe(update);
  update();
}
export function unmount(leaving = false) {
  unsubscribe?.();
  unsubscribe = null;
  if (leaving) {
    session.suspend();
    stopMeter();
  }
}
