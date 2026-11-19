import { createSession, transition, interrupt, appendTurn, addEntity, setDraft } from "../domain/voiceSession.mjs";

export function createVoiceController({ lang, config, notify, audioFactory, gatewayFactory } = {}) {
  let session = createSession(lang), gateway, audio, paused = false, muted = false, starting = false, error = "", closed = false;
  let lastVoice = 0, hasVoice = false, rms = 0, lastMeter = 0, audioPending = false, afterAudio = null, playbackEpoch = 0;
  const snapshot = () => ({ ...session, paused, muted, starting, error, rms, mode: config.mode });
  const publish = () => { if (!closed) notify(snapshot()); };
  const fail = (reason) => {
    error = reason?.message || String(reason); gateway?.close(); audio?.dispose(); audio = null; starting = false;
    session = { ...session, state: "IDLE" }; publish();
  };
  const change = (state) => { session = transition(session, state); publish(); };
  const receive = (event) => {
    if (closed) return;
    try {
      if (event.type === "state.change") {
        if (audioPending && event.state === "LISTENING") { afterAudio = event.state; return; }
        change(event.state);
      }
      if (event.type === "transcript.delta") session = appendTurn(session, event.role, event.text);
      if (event.type === "entity.extracted") session = addEntity(session, event.kind, event.value);
      if (event.type === "draft.ready") session = setDraft(session, event.title, event.markdown);
      if (event.type === "audio.start") { audioPending = true; audio.beginAudio(); }
      if (event.type === "audio.chunk") audio?.addAudio(event.data);
      if (event.type === "audio.end") {
        const epoch = playbackEpoch;
        audio.playAudio().then(() => {
          if (closed || epoch !== playbackEpoch) return;
          audioPending = false; if (afterAudio) { const state = afterAudio; afterAudio = null; change(state); }
        }).catch(fail);
      }
      if (event.type === "notice") { error = event.message; }
      if (event.type === "error") { fail(event.message || "Voice service failed"); return; }
      publish();
    } catch (reason) { fail(reason); }
  };
  const send = (type, data) => { try { gateway?.send(type, data); } catch (reason) { fail(reason); } };
  const api = {
    snapshot,
    start() {
      if (starting || session.state !== "IDLE") return;
      starting = true; error = ""; paused = false; muted = false; hasVoice = false;
      // No await before unlock: Safari requires the original click gesture.
      let unlocked;
      try { if (config.mode === "live") { audio = audioFactory(); unlocked = audio.unlock(); } } catch (reason) { fail(reason); return; }
      publish();
      return (async () => {
        try {
          await unlocked;
          gateway = gatewayFactory(receive);
          await gateway.connect(); if (closed) { gateway.close(); return; }
          send("session.start", { lang: session.lang, vadSilenceMs: config.vadSilenceMs });
          if (audio) await audio.capture((pcm) => {
            if (!paused && !muted && session.state === "LISTENING") gateway.audio(pcm.buffer);
          }, (level) => {
            rms = level; const now = performance.now();
            if (!paused && !muted && session.state === "LISTENING") {
              if (level > .025) { lastVoice = now; hasVoice = true; }
              else if (hasVoice && now - lastVoice >= config.vadSilenceMs) api.commit();
            }
            if (now - lastMeter > 100) { lastMeter = now; publish(); }
          });
          starting = false; publish();
        } catch (reason) { if (!closed) fail(reason); }
      })();
    },
    commit() {
      if (session.state !== "LISTENING" || paused || muted) return;
      hasVoice = false; send("input.commit");
    },
    interrupt() {
      playbackEpoch++; audio?.interrupt(); audioPending = false; afterAudio = null; hasVoice = false;
      session = interrupt(session); send("output.interrupt"); publish();
    },
    mute() { muted = !muted; hasVoice = false; if (muted) api.interrupt(); publish(); },
    pause() { paused = !paused; hasVoice = false; if (paused) api.interrupt(); publish(); },
    finalize() {
      if (session.state === "IDLE" || starting) return;
      playbackEpoch++; audio?.interrupt(); audioPending = false; afterAudio = null; hasVoice = false;
      send("session.finalize");
    },
    editDraft(title, markdown) { session = setDraft(session, title, markdown); },
    dispose() { closed = true; gateway?.close(); audio?.dispose(); },
  };
  return api;
}
