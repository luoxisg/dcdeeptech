import { html, mount } from "./html.mjs";
import { store } from "../application/store.mjs";
import { shouldClearInterview } from "../application/interview-session.mjs";
import { createRecordingSession } from "../application/recording-session.mjs";
import { recordingPrompt, recordingTime } from "../domain/recording-model.mjs";
import {
  createBrowserRecorder,
  recordingBrowserIO,
  downloadRecordingFile,
  downloadRecordingNotes,
} from "../adapters/media-recorder.mjs";
import { browserTranscriptionSupported } from "../adapters/browser-transcription.mjs";
import { installSwipeDismiss } from "./keyboard-viewport.mjs";
const session = createRecordingSession({
  ...recordingBrowserIO,
  capture: (options) => createBrowserRecorder(options),
});
let activeClose = null;
store.subscribe((next, previous) => {
  if (shouldClearInterview(previous, next)) {
    session.clear();
    void activeClose?.(true);
  }
});
window.addEventListener("pagehide", () => {
  session.clear();
  void activeClose?.(true);
});
window.addEventListener("beforeunload", (event) => {
  if (session.pending()) {
    event.preventDefault();
    event.returnValue = "";
  }
});
/** A local recorder is the default; network AI and sample modes remain separate opt-ins. */
export function openVoiceOverlay({
  lang = "zh",
  largeText = true,
  onTextScaleChange = (_value) => {},
} = {}) {
  const host = document.getElementById("voice-overlay-root");
  if (!host || host.childElementCount) return;
  const s = (zh, en) => (lang === "en" ? en : zh),
    app = document.getElementById("app"),
    previousFocus = /** @type {HTMLElement} */ (document.activeElement),
    wasInert = app.inert,
    speechSupported = browserTranscriptionSupported();
  if (!speechSupported)
    session.transcription(false, session.snapshot().transcriptionLanguage);
  let closing = false,
    unsubscribe = null;
  app.inert = true;
  const q = (selector) => host.querySelector(selector);
  const text = (selector, value) => {
    const el = q(selector);
    if (el && el.textContent !== value) el.textContent = value;
  };
  const errorText = (code) =>
    ({
      permission: s(
        "未获麦克风权限。请在浏览器网站设置中允许麦克风后重试。",
        "Microphone permission denied. Allow it in browser site settings and try again.",
      ),
      "no-device": s(
        "未找到麦克风，请连接设备后重试。",
        "No microphone found. Connect one and try again.",
      ),
      unsupported: s(
        "此浏览器不支持录音。请在 HTTPS 页面使用 Samsung Internet、Chrome 或 Safari。",
        "Recording is unavailable. Use Samsung Internet, Chrome or Safari on HTTPS.",
      ),
      empty: s(
        "这段未产生有效音频，请重新录制。",
        "No audio was captured. Please record again.",
      ),
      limit: s(
        "本页录音已达约 128 MB，请下载并重置后继续。",
        "This session has reached about 128 MB. Download and reset before continuing.",
      ),
      "stop-timeout": s(
        "未能完成这段录音，请先检查已有片段。",
        "This clip could not be finalized. Check your existing clips.",
      ),
      "recording-failed": s(
        "录音设备不可用或已中断，请检查麦克风。",
        "The microphone is unavailable or was interrupted. Please check the device.",
      ),
    })[code] ||
    s(
      "录音未能完成，请检查已有片段后重试。",
      "Recording could not finish. Check existing clips and retry.",
    );
  mount(
    host,
    html`<section
      class="voice-overlay recorder-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recorder-title"
      tabindex="-1"
    >
      <header class="voice-header">
        <div>
          <span class="recorder-brand"
            >DeepFamily · ${s("口述记忆", "Oral history")}</span
          >
          <h2 id="recorder-title">${s("访谈测试版", "Interview beta")}</h2>
        </div>
        <div>
          <button
            data-recording="scale"
            aria-label="${s("切换适老大字", "Toggle elder text")}"
            aria-pressed="${largeText}"
          >
            Aa</button
          ><button data-recording="reset">${s("重置", "Reset")}</button
          ><button
            data-recording="close"
            aria-label="${s("关闭访谈", "Close interview")}"
          >
            ×
          </button>
        </div>
      </header>
      <div class="recorder-body">
        <section class="recorder-stage">
          <span class="badge"
            >${s("真实录音 · 本页保留音频", "Real recording · audio retained on this page")}</span
          >
          <p class="recording-round"></p>
          <p class="recording-state" role="status"></p>
          <button
            class="voice-orb recording-orb"
            data-recording="orb"
            aria-label="${s("开始或结束本段录音", "Start or stop this recording")}"
          >
            <span aria-hidden="true">●</span></button
          ><strong class="recording-timer">00:00</strong>
          <h3 class="recording-prompt"></h3>
          <label class="recorder-consent"
            ><input type="checkbox" data-recording-consent /><span
              >${s("已征得受访者同意，愿意在本设备录音并保管导出文件。", "I have the narrator’s consent to record on this device and keep the exported files.")}</span
            ></label
          >
          <section class="recorder-transcription">
            <label class="recorder-consent"
              ><input type="checkbox" data-transcription-enable /><span
                >${s("开启免费实时转写（同意浏览器服务处理语音，可能联网）", "Enable free live transcription (allow the browser service to process speech, possibly online)")}</span
              ></label
            >
            <label
              >${s("识别语言", "Recognition language")}<select
                data-transcription-language
              >
                <option value="zh-CN">
                  ${s("普通话", "Mandarin Chinese")}
                </option>
                <option value="en-SG">
                  ${s("英语（新加坡）", "English (Singapore)")}
                </option>
              </select></label
            >
            <p>
              ${speechSupported ? s("无需 API 密钥，仅新录音实时转写；结果需核对。服务可能联网或跨境处理；敏感访谈可关闭此开关。可用性取决于浏览器及网络。", "No API key. Live transcription for new recordings; review all text. The provider may process speech online or abroad. Availability varies; keep transcription off for sensitive material.") : s("当前浏览器不支持实时转写。可尝试 Android Chrome；录音和手工笔记仍可使用。", "This browser does not support live transcription. Try Android Chrome; audio recording and manual notes still work.")}
            </p>
            <p data-transcription-status role="status"></p>
            <button class="btn full" data-recording="speech-retry">
              ${s("重试文字识别（录音继续）", "Retry recognition (keep recording)")}
            </button>
            <p
              class="transcription-live pre-wrap"
              data-live-transcript
              aria-label="${s("实时转写文字，待核实", "Live transcript, unverified")}"
            ></p>
          </section>
          <p class="recording-notice" role="status"></p>
          <p class="recording-error" role="alert"></p>
          <p class="recorder-hint">
            ${s("录音保留在当前页面内存。刷新、离开网站或退出账号前请下载；关闭访谈窗口后可重新打开回放。不会写入家族档案；只有开启转写后，浏览器才会调用其识别服务。", "Audio stays in this page’s memory. Download before reloading, leaving the site or signing out. Close and reopen this interview to play saved clips. No family archive write. Only enabling transcription invokes the browser’s recognition service.")}
          </p>
          <button class="btn" data-recording="review">
            ${s("回放与下载已有录音", "Play & download saved clips")}
          </button>
          <details class="recorder-options">
            <summary>${s("其他访谈方式", "Other interview options")}</summary>
            <p>
              ${s("原脚本演示和已配置的 AI 访谈仍可使用；联网模式按原设置传输资料，本机录音不会自动发送过去。", "Scripted demos and configured AI interviews remain available. Network modes follow their own settings; local recordings are not sent to them automatically.")}
            </p>
            <button data-recording="advanced">
              ${s("打开脚本 / AI 访谈选项", "Open scripted / AI interview options")}
            </button>
          </details>
        </section>
      </div>
      <footer class="voice-controls">
        <button data-recording="mute">${s("静音", "Mute")}</button
        ><button data-recording="pause">${s("暂停", "Pause")}</button
        ><button data-recording="done">
          ${s("我说完了 · 下一轮", "Done · next question")}</button
        ><button data-recording="finish">
          ${s("结束并整理初稿", "Finish & review notes")}
        </button>
      </footer>
      <div class="recording-sheet-host"></div>
    </section>`,
  );
  const update = () => {
    if (!host.childElementCount) return;
    const state = session.snapshot(),
      active = ["recording", "paused"].includes(state.phase),
      busy = ["requesting", "stopping"].includes(state.phase);
    text(
      ".recording-round",
      state.round < 3
        ? `${s("第", "Round ")} ${state.round + 1} / 3 ${s("轮", "")}`
        : s("补充录音", "Additional recording"),
    );
    const statuses = {
      idle: state.clips.length
        ? s(
            "已保存到本页，可继续录音",
            "Saved on this page; record more when ready",
          )
        : s(
            "勾选同意后，点击光球开始录音",
            "Confirm consent, then tap the orb to record",
          ),
      requesting: s("等待麦克风授权…", "Waiting for microphone permission…"),
      recording: state.muted
        ? s("已静音 · 正在录制静音", "Muted · recording silence")
        : s("正在真实录音", "Recording your microphone"),
      paused: s("录音已暂停", "Recording paused"),
      stopping: s("正在结束并保留音频…", "Finalizing and retaining audio…"),
    };
    text(".recording-state", statuses[state.phase]);
    const speechToggle = /** @type {HTMLInputElement} */ (
        q("[data-transcription-enable]")
      ),
      speechLanguage = /** @type {HTMLSelectElement} */ (
        q("[data-transcription-language]")
      );
    speechToggle.checked = state.transcriptionEnabled;
    speechToggle.disabled = !speechSupported || state.phase !== "idle";
    speechLanguage.value = state.transcriptionLanguage;
    speechLanguage.disabled = !speechSupported || state.phase !== "idle";
    const speechMessages = {
      off: state.transcriptionEnabled
        ? s(
            "将随下一段录音启动免费转写。",
            "Free transcription starts with the next recording.",
          )
        : s(
            "转写未开启，仍可正常录音。",
            "Transcription is off; audio recording still works.",
          ),
      starting: s(
        "正在启动浏览器语音识别…",
        "Starting browser speech recognition…",
      ),
      listening: s(
        "正在实时转写，机器文字需核对。",
        "Transcribing live; review the machine-generated text.",
      ),
      paused: s("转写已暂停。", "Transcription paused."),
      waiting: s(
        "暂未识别到语音，录音仍在继续。",
        "No speech recognized yet; audio recording continues.",
      ),
      reconnecting: s(
        "正在重启浏览器识别，录音保持继续。",
        "Restarting browser recognition; audio recording continues.",
      ),
      finishing: s(
        "正在等待最后的识别文字…",
        "Waiting for final recognition results…",
      ),
      complete: s(
        "转写已结束，请回放核对。",
        "Transcription ended; check against the audio.",
      ),
      partial: s(
        "仅保留部分转写，请回放补充核对。",
        "Partial transcript retained; review and complete it from the audio.",
      ),
      empty: s(
        "未获得转写文字，可使用录音补记。",
        "No transcript received; use the audio to add notes.",
      ),
      stopped: s(
        "浏览器识别已停止，可在下一段录音重试。",
        "Browser recognition stopped; retry on the next clip.",
      ),
      unsupported: s(
        "当前浏览器不支持语音识别。",
        "Speech recognition is unavailable in this browser.",
      ),
      error: s(
        "转写服务未完成，原始录音仍保留。",
        "Transcription did not complete; the audio is retained.",
      ),
    };
    const speechErrors = {
      network: s(
        "网络或浏览器识别服务不可用。",
        "Network or browser recognition service unavailable.",
      ),
      "not-allowed": s(
        "识别服务未获授权。",
        "Recognition service permission denied.",
      ),
      "service-not-allowed": s(
        "浏览器未开放识别服务。",
        "Browser recognition service not permitted.",
      ),
      "text-limit": s(
        "已达本段文字长度上限，请用下一段继续。",
        "Transcript limit reached; continue in the next clip.",
      ),
      "language-not-supported": s(
        "服务不支持当前识别语言。",
        "The service does not support this recognition language.",
      ),
    };
    text(
      "[data-transcription-status]",
      (speechMessages[state.transcriptionStatus] || speechMessages.error) +
        (state.transcriptionError
          ? " " +
            (speechErrors[state.transcriptionError] ||
              s(
                "请核对权限、网络或更换浏览器；录音可继续。",
                "Check permissions/network or try another browser; recording can continue.",
              ))
          : ""),
    );
    text("[data-live-transcript]", state.liveTranscript);
    const retry = /** @type {HTMLButtonElement} */ (
      q('[data-recording="speech-retry"]')
    );
    retry.hidden =
      !state.transcriptionEnabled ||
      !speechSupported ||
      state.phase !== "recording" ||
      !["error", "stopped"].includes(state.transcriptionStatus);
    retry.disabled =
      state.phase !== "recording" ||
      state.muted ||
      !["error", "stopped"].includes(state.transcriptionStatus) ||
      state.transcriptionError === "text-limit";

    text(".recording-timer", recordingTime(state.elapsed));
    text(
      ".recording-prompt",
      recordingPrompt(state.round)[lang === "en" ? 1 : 0],
    );
    const orb = /** @type {HTMLButtonElement} */ (q('[data-recording="orb"]'));
    orb.disabled = busy || (!active && !state.consent);
    orb.dataset.recordingState = state.phase;
    orb.setAttribute(
      "aria-label",
      active
        ? s("结束并保存本段录音", "Stop and retain this clip")
        : s("开始真实录音", "Start real recording"),
    );
    text(".recording-orb span", active ? "■" : "●");
    const consent = /** @type {HTMLInputElement} */ (
      q("[data-recording-consent]")
    );
    consent.checked = state.consent;
    consent.disabled = state.phase !== "idle";
    for (const action of ["mute", "pause", "done"]) {
      const button = /** @type {HTMLButtonElement} */ (
        q(`[data-recording="${action}"]`)
      );
      button.disabled = !active;
    }
    /** @type {HTMLButtonElement} */ (q('[data-recording="finish"]')).disabled =
      busy || (!active && !state.clips.length);
    /** @type {HTMLButtonElement} */ (q('[data-recording="review"]')).disabled =
      busy || (!active && !state.clips.length);
    text(
      '[data-recording="mute"]',
      state.muted ? s("取消静音", "Unmute") : s("静音", "Mute"),
    );
    q('[data-recording="mute"]').setAttribute(
      "aria-pressed",
      String(state.muted),
    );
    text(
      '[data-recording="pause"]',
      state.phase === "paused"
        ? s("继续录音", "Resume recording")
        : s("暂停", "Pause"),
    );
    text(
      ".recording-notice",
      state.notice === "limit"
        ? errorText("limit")
        : state.notice === "device"
          ? s(
              "设备已中断，已尽量保留音频，请回放检查。",
              "The device stopped. Available audio was retained; check playback.",
            )
          : state.notice === "saved"
            ? s(
                "本段保留在本页，尚未下载到硬盘。",
                "This clip is held on this page; it is not yet downloaded.",
              )
            : "",
    );
    text(".recording-error", state.error ? errorText(state.error) : "");
    const draft = q("[data-recording-draft]");
    if (draft) draft.textContent = session.draft(lang);
  };
  function closeSheet() {
    const dialog = /** @type {HTMLDialogElement|null} */ (q("dialog"));
    dialog?.querySelectorAll("audio").forEach((audio) => audio.pause());
    dialog?.close();
    mount(q(".recording-sheet-host"), html``);
    /** @type {HTMLElement} */ (q('[data-recording="orb"]')).focus({
      preventScroll: true,
    });
  }
  function sheet(kind) {
    const state = session.snapshot();
    const review = kind === "review";
    mount(
      q(".recording-sheet-host"),
      html`<dialog
        class="sheet recorder-sheet"
        aria-labelledby="recording-sheet-title"
      >
        <div class="sheet-form">
          <header class="sheet-heading">
            <div
              class="sheet-handle"
              data-sheet-handle
              aria-hidden="true"
            ></div>
            <h2 id="recording-sheet-title">
              ${review ? s("录音回放与访谈笔记", "Recordings & interview notes") : s("清空本页录音？", "Clear this page’s recordings?")}
            </h2>
            <button
              class="btn"
              data-recording="dismiss"
              aria-label="${s("关闭面板", "Close panel")}"
            >
              ×
            </button>
          </header>
          <div class="sheet-body">
            ${
              review
                ? html`<p>
                      ${s("请逐段回放并下载。机器转写可能不完整或有误，请核对后编辑；原始机器文字会保留，并一同导出。", "Check and download each recording. Machine transcripts can be incomplete or incorrect; review and edit them. Original machine text is retained and included in the export.")}
                    </p>
                    ${state.clips.map(
                      (clip, index) =>
                        html`<article class="panel recording-clip">
                          <h3>
                            ${s("片段", "Clip")} ${index + 1} ·
                            ${s("第", "Round ")} ${clip.round + 1}${s("轮", "")}
                            · ${recordingTime(clip.duration)}
                          </h3>
                          <p>${clip.prompt[lang === "en" ? 1 : 0]}</p>
                          ${clip.incomplete ? html`<p class="notice">${s("此段曾中断，请检查完整性。", "This clip was interrupted; check completeness.")}</p>` : ""}<audio
                            controls
                            preload="metadata"
                            src="${clip.url}"
                            aria-label="${s("回放片段", "Play clip")} ${index + 1}"
                          ></audio
                          ><button
                            class="btn full"
                            data-recording="download"
                            data-id="${clip.id}"
                          >
                            ${s("下载本段录音", "Download this recording")}
                            (.${clip.filename.split(".").pop()})</button
                          >${clip.transcriptState && clip.transcriptState !== "off" ? html`<p class="badge">${s("机器转写 · 待核实", "Machine transcript · unverified")}${["partial", "error", "empty", "stopped"].includes(clip.transcriptState) ? s("（可能不完整）", " (may be incomplete)") : ""}</p>` : ""}
                          <label
                            >${s("转写文字（待核实，可编辑）", "Transcript (unverified, editable)")}<textarea
                              rows="4"
                              maxlength="12000"
                              data-recording-transcript="${clip.id}"
                            >
${clip.transcript || ""}</textarea>
                          </label>
                          ${
                            clip.machineTranscript
                              ? html`<details>
                                  <summary>
                                    ${s("查看原始机器转写", "View original machine transcript")}
                                  </summary>
                                  <p class="pre-wrap">
                                    ${clip.machineTranscript}
                                  </p>
                                </details>`
                              : ""
                          }
                          <label
                            >${s("本段文字笔记（选填，非自动转写）", "Manual notes (optional; not auto-transcribed)")}<textarea
                              data-recording-note="${clip.id}"
                              rows="3"
                              maxlength="12000"
                            >
${clip.note}</textarea>
                          </label>
                        </article>`,
                    )}
                    <details>
                      <summary>
                        ${s("查看待核实初稿", "View unverified notes draft")}
                      </summary>
                      <pre class="pre-wrap" data-recording-draft>
${session.draft(lang)}</pre>
                    </details>`
                : html`<p>
                    ${s("这会删除当前页面中的全部录音和笔记，无法恢复。需要保留时，请先取消并下载。正式家族数据不受影响。", "This permanently clears this page’s recordings and notes. Cancel and download first if you need them. Live family records are unaffected.")}
                  </p>`
            }
            <p class="recording-sheet-notice" role="status"></p>
          </div>
          <footer class="sheet-actions">
            <button class="btn" data-recording="dismiss">
              ${s("返回", "Back")}</button
            ><button
              class="btn btn-primary"
              data-recording="${review ? "notes" : "confirm-reset"}"
            >
              ${review ? s("导出初稿 TXT", "Export notes TXT") : s("确认清空", "Confirm clear")}
            </button>
          </footer>
        </div>
      </dialog>`,
    );
    const dialog = /** @type {HTMLDialogElement} */ (q("dialog"));
    dialog.showModal();
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeSheet();
    });
    installSwipeDismiss(dialog, closeSheet);
  }
  async function close(force = false) {
    if (closing) return;
    closing = true;
    if (!force) await session.leave();
    unsubscribe?.();
    host.removeEventListener("click", click);
    host.removeEventListener("input", input);
    host.removeEventListener("keydown", keydown);
    host.querySelectorAll("audio").forEach((audio) => audio.pause());
    q("dialog")?.close();
    mount(host, html``);
    app.inert = wasInert;
    activeClose = null;
    if (previousFocus?.isConnected)
      previousFocus.focus({ preventScroll: true });
    else
      /** @type {HTMLElement} */ (
        document.querySelector('[data-cmd="voice-open"]')
      )?.focus({ preventScroll: true });
  }
  async function click(event) {
    event.stopPropagation();
    const button = event.target.closest("[data-recording]");
    if (!button || button.disabled) return;
    const action = button.dataset.recording;
    try {
      if (action === "orb") {
        if (session.snapshot().phase === "idle") await session.start();
        else await session.stop(false);
      }
      if (action === "speech-retry") session.retryTranscription();
      if (action === "pause") session.pause();
      if (action === "mute") session.mute();
      if (action === "done") await session.stop(true);
      if (action === "review" || action === "finish") {
        await session.leave();
        sheet("review");
      }
      if (action === "reset") {
        await session.leave();
        sheet("reset");
      }
      if (action === "confirm-reset") {
        closeSheet();
        session.clear();
      }
      if (action === "dismiss") closeSheet();
      if (action === "close") await close();
      if (action === "scale") {
        largeText = !largeText;
        onTextScaleChange(largeText);
        button.setAttribute("aria-pressed", String(largeText));
      }
      if (action === "download") {
        const clip = session
          .snapshot()
          .clips.find((row) => row.id === button.dataset.id);
        if (clip) {
          downloadRecordingFile(clip.url, clip.filename);
          session.downloaded(clip.id);
          text(
            ".recording-sheet-notice",
            s(
              "下载已交给浏览器，请检查文件。",
              "Download requested; check the file in Downloads.",
            ),
          );
        }
      }
      if (action === "notes") {
        downloadRecordingNotes(session.draft(lang));
        session.notesDownloaded();
        text(
          ".recording-sheet-notice",
          s(
            "初稿已交给浏览器下载；音频须逐段另存。",
            "Notes download requested; save each audio clip separately.",
          ),
        );
      }
      if (action === "advanced") {
        await close();
        const { openVoiceOverlay: openAssistant } =
          await import("./voiceAssistantOverlay.mjs");
        openAssistant({ lang, largeText, onTextScaleChange });
      }
    } catch {
      text(".recording-error", errorText("recording-failed"));
    }
  }
  function input(event) {
    event.stopPropagation();
    if (event.target.matches("[data-recording-consent]"))
      session.consent(event.target.checked);
    if (
      event.target.matches(
        "[data-transcription-enable],[data-transcription-language]",
      )
    )
      session.transcription(
        /** @type {HTMLInputElement} */ (q("[data-transcription-enable]"))
          .checked,
        /** @type {HTMLSelectElement} */ (q("[data-transcription-language]"))
          .value,
      );
    if (event.target.dataset.recordingTranscript)
      session.editTranscript(
        event.target.dataset.recordingTranscript,
        event.target.value,
      );
    if (event.target.dataset.recordingNote)
      session.note(event.target.dataset.recordingNote, event.target.value);
  }
  function keydown(event) {
    event.stopPropagation();
    if (q("dialog[open]")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      void close();
    }
    if (event.key === "Tab") {
      const nodes = Array.from(
        host.querySelectorAll(
          "button:not(:disabled),input:not(:disabled),summary,audio",
        ),
      ).filter((el) => el.getClientRects().length);
      if (event.shiftKey && document.activeElement === nodes[0]) {
        event.preventDefault();
        /** @type {HTMLElement} */ (nodes.at(-1))?.focus();
      } else if (!event.shiftKey && document.activeElement === nodes.at(-1)) {
        event.preventDefault();
        /** @type {HTMLElement} */ (nodes[0])?.focus();
      }
    }
  }
  host.addEventListener("click", click);
  host.addEventListener("input", input);
  host.addEventListener("keydown", keydown);
  unsubscribe = session.subscribe(update);
  activeClose = close;
  update();
  /** @type {HTMLElement} */ (q(".voice-overlay")).focus();
}
