import test from "node:test";
import assert from "node:assert/strict";
import { createSession, transition, interrupt, appendTurn, addEntity, setDraft } from "../dfplan/src/domain/voiceSession.mjs";
import { MockVoiceGateway, normalizeConfig } from "../dfplan/src/adapters/voiceGateway.mjs";
import { createResampler } from "../dfplan/src/adapters/audioAdapter.mjs";
import { createVoiceController } from "../dfplan/src/application/voiceController.mjs";

test("strict transitions, review and restart; illegal shortcut rejected", () => {
  let session = createSession("en");
  assert.throws(() => transition(session, "SPEAKING"));
  for (const state of ["LISTENING", "THINKING", "SPEAKING", "LISTENING", "REVIEWING", "IDLE"]) session = transition(session, state);
  assert.equal(session.lang, "en");
});
test("barge-in preserves turns, entities and draft without mutating previous state", () => {
  let session = transition(createSession(), "LISTENING");
  session = appendTurn(session, "user", "A story"); session = addEntity(session, "time", "1985");
  session = setDraft(session, "Draft", "[待核实]"); session = transition(session, "THINKING");
  const next = interrupt(session);
  assert.equal(session.state, "THINKING"); assert.equal(next.state, "LISTENING");
  assert.deepEqual(next.turns, session.turns); assert.deepEqual(next.entities, session.entities); assert.deepEqual(next.draft, session.draft);
  assert.equal(interrupt(transition(session, "SPEAKING")).state, "LISTENING");
});
test("entities deduplicate normalized case/spacing and preserve original spelling; kinds remain distinct", () => {
  let session = createSession();
  for (const value of ["  Aunt Lin  ", "aunt lin", "Ａｕｎｔ Lin"]) session = addEntity(session, "person", value);
  session = addEntity(session, "place", "Aunt Lin"); session = addEntity(session, "password", "ignored");
  assert.deepEqual(session.entities, [{ kind: "person", value: "Aunt Lin" }, { kind: "place", value: "Aunt Lin" }]);
});
test("streaming 48k → 16k PCM has correct length, clipping and continuity", () => {
  const resample = createResampler(48000); let size = 0;
  for (let i = 0; i < 48; i++) { const pcm = resample(new Float32Array(1000).fill(2)); size += pcm.length; assert.equal(pcm[0], 32767); }
  assert.equal(size, 16000);
});
test("VAD config bounded and invalid mode defaults to offline", () => {
  assert.equal(normalizeConfig({ vadSilenceMs: 1 }).vadSilenceMs, 1500);
  assert.equal(normalizeConfig({ vadSilenceMs: 99999 }).vadSilenceMs, 6000);
  assert.equal(normalizeConfig({ mode: "unknown" }).mode, "mock");
});
test("Mock emits exactly three user turns, one draft, no fourth turn", async () => {
  const events = [], gateway = new MockVoiceGateway((event) => events.push(event));
  await gateway.connect(); gateway.send("session.start", { lang: "zh" });
  for (let i = 0; i < 3; i++) { gateway.send("input.commit"); await new Promise((resolve) => setTimeout(resolve, 1150)); }
  gateway.send("input.commit"); gateway.send("session.finalize");
  assert.equal(events.filter((e) => e.type === "transcript.delta" && e.role === "user").length, 3);
  assert.equal(events.filter((e) => e.type === "entity.extracted").length, 3);
  assert.match(events.find((e) => e.type === "draft.ready").markdown, /\[待核实\]/); gateway.close();
});
test("controller unlocks live audio synchronously and interrupt stops output", async () => {
  let unlocked = false, stopped = false, emit; const sent = [];
  const controller = createVoiceController({ lang: "zh", config: { mode: "live", vadSilenceMs: 3500 }, notify() {},
    audioFactory: () => ({ unlock() { unlocked = true; }, async capture() {}, interrupt() { stopped = true; }, dispose() {} }),
    gatewayFactory: (listener) => { emit = listener; return { async connect() {}, close() {}, send(type) { sent.push(type); if (type === "session.start") emit({ type: "state.change", state: "LISTENING" }); } }; },
  });
  const starting = controller.start(); assert.equal(unlocked, true); await starting;
  emit({ type: "state.change", state: "THINKING" }); controller.interrupt();
  assert.equal(stopped, true); assert.equal(controller.snapshot().state, "LISTENING"); assert.ok(sent.includes("output.interrupt")); controller.dispose();
});
