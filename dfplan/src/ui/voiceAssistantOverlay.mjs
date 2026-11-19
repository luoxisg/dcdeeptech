import { html, mount } from "./html.mjs";
import { AudioAdapter } from "../adapters/audioAdapter.mjs";
import { createVoiceController } from "../application/voiceController.mjs";
import { CONFIG_KEY, readConfig, normalizeConfig, testConnection, MockVoiceGateway, WebSocketVoiceGateway } from "../adapters/voiceGateway.mjs";

export function openVoiceOverlay({ lang = "zh", largeText = true, onTextScaleChange = (_value) => {} } = {}) {
  const host = document.getElementById("voice-overlay-root");
  if (!host || host.childElementCount) return;
  const s = (zh, en) => lang === "en" ? en : zh;
  const previousFocus = document.activeElement, app = document.getElementById("app");
  const wasInert = app.inert, overflow = document.body.style.overflow, scrollY = window.scrollY;
  app.inert = true; document.body.style.overflow = "hidden";
  let config = readConfig(localStorage), controller, snapshot, sheet = "", tab = "draft", reviewedDraft, lastEntities;
  const q = (selector) => host.querySelector(selector);
  const say = (text) => {
    q(".voice-notice").textContent = text;
    const status = q(".voice-sheet-status"); if (status) status.textContent = text;
  };
  mount(host, html`<section class="voice-overlay" role="dialog" aria-modal="true" aria-labelledby="voice-title" tabindex="-1">
    <header class="voice-header"><h2 id="voice-title">${s("访谈测试版", "Interview beta")}</h2><div><button data-voice="settings">${s("设置", "Settings")}</button><button data-voice="close" aria-label="${s("关闭访谈", "Close interview")}">✕</button></div></header>
    <div class="voice-entities" aria-label="${s("记忆锚点", "Memory anchors")}"></div>
    <div class="voice-stage"><p class="voice-mode"></p><p class="voice-state" role="status"></p><button class="voice-orb" data-voice="orb" aria-label="${s("开始或打断访谈", "Start or interrupt interview")}"><span aria-hidden="true">✦</span></button>
    <p class="voice-subtitle" aria-live="polite"></p><p class="voice-notice" role="status">${s("默认三轮虚构演示，不录音。Live 模式使用麦克风，文字会发送给配置的模型服务，后端在本机自动归档。", "Three fictional demo turns; no recording. Live mode uses your microphone, sends text to the configured model and archives on the local server.")}</p></div>
    <footer class="voice-controls"><button data-voice="mute"></button><button data-voice="pause"></button><button data-voice="commit">${s("我说完了", "Done speaking")}</button><button data-voice="finalize">${s("结束并生成初稿", "Finish & draft")}</button></footer>
    <div class="voice-sheet-host"></div></section>`);
  const update = (next) => {
    snapshot = next;
    const names = { IDLE: s("准备好后开始", "Start when ready"), LISTENING: s("请慢慢说，我在听", "Take your time. I am listening."), THINKING: s("正在整理您的话", "Reflecting on your story"), SPEAKING: s("轻触光球可打断", "Tap the orb to interrupt"), REVIEWING: s("初稿已生成，请核实", "Draft ready for review") };
    q(".voice-overlay").dataset.state = next.state;
    q(".voice-mode").textContent = config.mode === "mock" ? s("MOCK · 虚构演示（共三轮）", "MOCK · Fictional demo (3 turns)") : "LIVE · WebSocket";
    q(".voice-state").textContent = next.starting ? s("正在连接…", "Connecting…") : names[next.state];
    q(".voice-orb").style.setProperty("--voice-level", Math.min(.3, next.rms * 3));
    q(".voice-orb").disabled = next.starting;
    q(".voice-orb span").textContent = next.state === "IDLE" ? "▶" : "✦";
    q(".voice-subtitle").textContent = next.turns.at(-1)?.text || s("讲一件您愿意留下来的往事吧。", "Tell a story you would like to preserve.");
    if (next.entities !== lastEntities) mount(q(".voice-entities"), html`${next.entities.map((entity) => html`<span>${({ time: "◷", person: "♙", place: "⌖" })[entity.kind]} ${entity.value}</span>`)}`);
    lastEntities = next.entities;
    q('[data-voice="mute"]').textContent = next.muted ? s("取消静音", "Unmute") : s("静音", "Mute");
    q('[data-voice="mute"]').setAttribute("aria-pressed", String(next.muted));
    q('[data-voice="pause"]').textContent = next.paused ? s("继续", "Resume") : s("暂停", "Pause");
    q('[data-voice="pause"]').setAttribute("aria-pressed", String(next.paused));
    for (const action of ["mute", "pause", "finalize"]) q(`[data-voice="${action}"]`).disabled = next.state === "IDLE" || next.starting || next.state === "REVIEWING";
    q('[data-voice="commit"]').disabled = next.state !== "LISTENING" || next.paused || next.muted || (config.mode === "mock" && next.turns.filter((t) => t.role === "user").length >= 3);
    if (next.error) say(next.error);
    if (next.draft && !reviewedDraft) { reviewedDraft = true; sheet = "review"; renderSheet(); }
  };
  const reset = () => { reviewedDraft = false; controller?.dispose(); controller = createVoiceController({ lang, config, notify: update, audioFactory: () => new AudioAdapter(), gatewayFactory: (emit) => config.mode === "mock" ? new MockVoiceGateway(emit) : new WebSocketVoiceGateway(emit, config.url) }); update(controller.snapshot()); };
  const draft = () => {
    const title = q("#voice-draft-title"), markdown = q("#voice-draft-markdown");
    if (title && markdown) controller.editDraft(title.value, markdown.value);
    return controller.snapshot().draft;
  };
  const highlight = (text) => html`${text.split(/(\[待核实\])/g).map((part) => part === "[待核实]" ? html`<mark>${part}</mark>` : part)}`;
  function renderSheet() {
    const active = !["IDLE", "REVIEWING"].includes(snapshot.state) || snapshot.starting;
    const contents = sheet === "settings" ? html`
      <h3>${s("访谈设置", "Interview settings")}</h3>
      <label>${s("运行模式", "Mode")}<select id="voice-mode" ${active ? "disabled" : ""}><option value="mock" ${config.mode === "mock" ? "selected" : ""}>Mock · ${s("离线演示", "Offline demo")}</option><option value="live" ${config.mode === "live" ? "selected" : ""}>Live WS</option></select></label>
      <label>WebSocket URL<input id="voice-url" type="url" value="${config.url}" ${active ? "disabled" : ""}></label>
      <button data-voice="test">${s("测试连接", "Test connection")}</button>
      <label>${s("停顿多久后自动发送（毫秒）", "Silence before sending (milliseconds)")}<input id="voice-vad" type="number" min="1500" max="6000" step="100" value="${config.vadSilenceMs}" ${active ? "disabled" : ""}></label>
      <label class="voice-check"><input id="voice-elder" type="checkbox" ${largeText ? "checked" : ""}>${s("适老大字版", "Large text")}</label>
      <p>${s("Live：本地识别不收 ASR 接口费；LLM 可能收费，语音合成需要联网。首次启动后端会下载 Whisper 模型。会话期间请先结束，再切换配置。", "Live: local ASR has no API fee; the LLM may charge and TTS needs internet. First backend start downloads Whisper. Finish the session before changing configuration.")}</p>
      <button data-voice="save-settings" ${active ? "disabled" : ""}>${s("保存设置", "Save settings")}</button>` : sheet === "review" ? html`
      <h3>${s("事件说明初稿", "Story draft")}</h3><div class="voice-tabs"><button data-voice="draft-tab" aria-pressed="${tab === "draft"}">${s("可编辑初稿", "Editable draft")}</button><button data-voice="transcript-tab" aria-pressed="${tab === "transcript"}">${s("原始对话", "Transcript")}</button></div>
      ${tab === "draft" ? html`<label>${s("标题", "Title")}<input id="voice-draft-title" value="${snapshot.draft.title}"></label><label>Markdown<textarea id="voice-draft-markdown" rows="9">${snapshot.draft.markdown}</textarea></label><pre class="voice-preview">${highlight(snapshot.draft.markdown)}</pre>` : html`<div class="voice-transcript">${snapshot.turns.map((turn) => html`<p><strong>${turn.role === "user" ? s("讲述者", "Narrator") : s("访谈助手", "Interviewer")}</strong> ${turn.text}</p>`)}</div>`}
      <div class="voice-export"><button data-voice="copy">${s("复制", "Copy")}</button><button data-voice="export">${s("导出 .md", "Export .md")}</button><button data-voice="save-draft">${s("保存到本机", "Save locally")}</button></div><p>${s("请核实后再归档。保存仅在当前浏览器，不上传 Firebase。", "Review before archiving. Browser saves do not upload to Firebase.")}</p>` : "";
    mount(q(".voice-sheet-host"), sheet ? html`<div class="voice-sheet-backdrop"><section class="voice-sheet" role="dialog" aria-modal="true" aria-label="${s("访谈面板", "Interview panel")}"><div class="voice-sheet-top"><button class="voice-handle" data-voice="dismiss" aria-label="${s("下滑或点击关闭面板", "Swipe down or click to close panel")}">━</button><button data-voice="dismiss">${s("收起", "Close panel")}</button></div>${contents}<p class="voice-sheet-status" role="status"></p></section></div>` : "");
    q(".voice-stage").inert = Boolean(sheet); q(".voice-controls").inert = Boolean(sheet); q(".voice-header").inert = Boolean(sheet);
    q(".voice-sheet button")?.focus({ preventScroll: true });
    const handle = q(".voice-handle"); let startY;
    handle?.addEventListener("pointerdown", (event) => { startY = event.clientY; handle.setPointerCapture(event.pointerId); });
    handle?.addEventListener("pointerup", (event) => { if (event.clientY - startY > 60) dismiss(); });
  }
  function dismiss() { if (sheet === "review") draft(); sheet = ""; renderSheet(); q(".voice-orb").focus({ preventScroll: true }); }
  function close() {
    controller.dispose(); host.removeEventListener("click", click); host.removeEventListener("keydown", keydown); host.removeEventListener("input", input);
    mount(host, ""); app.inert = wasInert; document.body.style.overflow = overflow;
    window.scrollTo(0, scrollY);
    const returnFocus = previousFocus?.isConnected ? previousFocus :
      Array.from(document.querySelectorAll('[data-cmd="voice-open"], .site-menu summary')).find((node) => node.getClientRects().length);
    /** @type {HTMLElement} */(returnFocus)?.focus({ preventScroll: true });
  }
  async function click(event) {
    event.stopPropagation(); const action = event.target.closest("[data-voice]")?.dataset.voice;
    try {
      if (action === "close") close();
      if (action === "settings") { sheet = "settings"; renderSheet(); }
      if (action === "dismiss") dismiss();
      if (action === "orb") { if (snapshot.state === "IDLE") controller.start(); else if (snapshot.state === "REVIEWING") { sheet = "review"; renderSheet(); } else controller.interrupt(); }
      if (["commit", "mute", "pause", "finalize"].includes(action)) controller[action]();
      if (action === "save-settings") {
        config = normalizeConfig({ mode: q("#voice-mode").value, url: q("#voice-url").value, vadSilenceMs: q("#voice-vad").value });
        localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); largeText = q("#voice-elder").checked; onTextScaleChange(largeText);
        sheet = ""; reset(); renderSheet(); say(s("设置已保存", "Settings saved"));
      }
      if (action === "test") { event.target.disabled = true; try { await testConnection(q("#voice-url").value); say(s("WebSocket 连接成功（未测试麦克风或模型）", "WebSocket connected (microphone/model not tested)")); } finally { event.target.disabled = false; } }
      if (action === "draft-tab" || action === "transcript-tab") { draft(); snapshot = controller.snapshot(); tab = action === "draft-tab" ? "draft" : "transcript"; renderSheet(); }
      if (action === "copy") { await navigator.clipboard.writeText(draft().markdown); say(s("已复制", "Copied")); }
      if (action === "export") {
        const value = draft(), url = URL.createObjectURL(new Blob([value.markdown], { type: "text/markdown;charset=utf-8" }));
        const link = document.createElement("a"); link.href = url; link.download = "interview-draft.md"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      if (action === "save-draft") {
        const value = draft(), key = "dfplan.voice.sessions", saved = JSON.parse(localStorage.getItem(key) || "[]");
        const id = controller.localId ||= crypto.randomUUID();
        localStorage.setItem(key, JSON.stringify([{ id, ...value, turns: snapshot.turns, savedAt: new Date().toISOString() }, ...saved.filter((item) => item.id !== id)].slice(0, 20)));
        say(s("已保存到当前浏览器", "Saved in this browser"));
      }
    } catch (reason) { say(reason.message || String(reason)); }
  }
  function keydown(event) {
    event.stopPropagation();
    if (event.key === "Escape") { event.preventDefault(); sheet ? dismiss() : close(); }
    if (event.key === "Tab") {
      const root = q(".voice-sheet") || q(".voice-overlay");
      const nodes = [...root.querySelectorAll("button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea")].filter((node) => !node.closest("[inert]"));
      const first = nodes[0], last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }
  host.addEventListener("click", click); host.addEventListener("keydown", keydown);
  function input(event) { if (event.target.id === "voice-draft-markdown") mount(q(".voice-preview"), highlight(event.target.value)); }
  host.addEventListener("input", input);
  reset(); q(".voice-overlay").focus();
}
