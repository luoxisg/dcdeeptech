export const CONFIG_KEY = "dfplan.voice.config";
export function readConfig(storage) {
  let saved;
  try { saved = JSON.parse(storage.getItem(CONFIG_KEY)); } catch { /* corrupt/blocked storage uses safe defaults */ }
  return normalizeConfig(saved);
}
export function normalizeConfig(value = {}) {
  return { mode: value?.mode === "live" ? "live" : "mock", url: String(value?.url || "ws://localhost:8765/ws/voice"),
    vadSilenceMs: Math.max(1500, Math.min(6000, Number(value?.vadSilenceMs) || 3500)) };
}
const examples = {
  zh: [
    ["大约在一九八五年，我和陈伯搬到了南桥镇。", "搬家的那段日子一定很难忘。您还记得，当时带到新家的一件物品是什么吗？", "time", "约1985年"],
    ["带了一只木箱，是林姨送的。里面放着照片。", "这只装着照片的木箱，留住了许多牵挂。您最记得其中哪一张照片呢？", "person", "林姨"],
    ["有一张南桥老屋前的合照，年份我记不清了。", "老屋前的合照很珍贵，年份可以慢慢核实。您记得照片是谁拍下的吗？", "place", "南桥镇"],
  ],
  en: [
    ["Around 1985, Uncle Chen and I moved to Southbridge.", "That move sounds memorable. What was one thing you brought to your new home?", "time", "Around 1985"],
    ["Aunt Lin gave us a wooden box with photographs inside.", "That box held precious memories. Which photograph do you remember most clearly?", "person", "Aunt Lin"],
    ["A group photograph outside the old house. I cannot recall the year.", "We can verify the year later. Do you remember who took the photograph?", "place", "Southbridge"],
  ],
};
export class MockVoiceGateway {
  constructor(emit) { this.emit = emit; this.round = 0; }
  async connect() { this.closed = false; }
  send(type, data = {}) {
    if (type === "session.start") { this.lang = data.lang === "en" ? "en" : "zh"; this.emit({ type: "state.change", state: "LISTENING" }); }
    if (type === "output.interrupt") { clearTimeout(this.timer); this.emit({ type: "state.change", state: "LISTENING" }); }
    if (type === "input.commit" && this.round < 3) {
      const [text, reply, kind, value] = examples[this.lang][this.round++];
      this.emit({ type: "transcript.delta", role: "user", text });
      this.emit({ type: "state.change", state: "THINKING" });
      this.timer = setTimeout(() => {
        this.emit({ type: "entity.extracted", kind, value });
        this.emit({ type: "transcript.delta", role: "assistant", text: reply });
        this.emit({ type: "state.change", state: "SPEAKING" });
        this.timer = setTimeout(() => this.emit({ type: "state.change", state: "LISTENING" }), 650);
      }, 450);
    }
    if (type === "session.finalize") {
      clearTimeout(this.timer);
      const title = this.lang === "en" ? "Fictional interview draft" : "虚构访谈示范初稿";
      const rows = examples[this.lang].slice(0, this.round).map(([text]) => `- ${text} [待核实]`).join("\n");
      this.emit({ type: "draft.ready", title, markdown: `# ${title}\n\n${rows || "[待核实]"}\n\n> ${this.lang === "en" ? "Fictional demo. Confirm dates and identities before archiving." : "本内容为虚构演示。时间、人物与地点均需核实，不构成事实记录。"}` });
      this.emit({ type: "state.change", state: "REVIEWING" });
    }
  }
  close() { this.closed = true; clearTimeout(this.timer); }
}
export class WebSocketVoiceGateway {
  constructor(emit, url) { this.emit = emit; this.url = url; }
  connect() {
    const url = new URL(this.url);
    if (!["ws:", "wss:"].includes(url.protocol) || url.username || url.password) throw new Error("Use a ws:// or wss:// URL without credentials");
    return new Promise((resolve, reject) => {
      const ws = this.socket = new WebSocket(url); ws.binaryType = "arraybuffer";
      const timer = setTimeout(() => { ws.close(); reject(new Error("Connection timed out")); }, 6000);
      ws.onopen = () => { clearTimeout(timer); resolve(); };
      ws.onmessage = ({ data }) => {
        if (typeof data !== "string") this.emit({ type: "audio.chunk", data });
        else { try { this.emit(JSON.parse(data)); } catch { this.emit({ type: "error", message: "Invalid server response" }); } }
      };
      ws.onerror = () => { clearTimeout(timer); reject(new Error("WebSocket connection failed")); };
      ws.onclose = () => { clearTimeout(timer); reject(new Error("WebSocket closed")); if (!this.intentional) this.emit({ type: "error", message: "连接已断开 / Disconnected. 请重新开始 / Please restart." }); };
    });
  }
  send(type, data = {}) {
    if (this.socket?.readyState !== WebSocket.OPEN) throw new Error("WebSocket is not connected");
    this.socket.send(JSON.stringify({ type, ...data }));
  }
  audio(data) { if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(data); }
  close() { this.intentional = true; this.socket?.close(); }
}
export async function testConnection(url) {
  const gateway = new WebSocketVoiceGateway(() => {}, url);
  try { await gateway.connect(); } finally { gateway.close(); }
}
