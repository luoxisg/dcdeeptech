import test from "node:test";
import assert from "node:assert/strict";
import { createRecordingSession } from "../../dfplan/src/application/recording-session.mjs";
import {
  recordingByteLimit,
  recordingExtension,
  recordingTime,
  recordingDraft,
} from "../../dfplan/src/domain/recording-model.mjs";
function fixture() {
  const adapters = [],
    revoked = [],
    created = [];
  const io = {
    id: () => String(created.length),
    now: () => "2026-11-19T12:00:00Z",
    createURL: (blob) => {
      created.push(blob);
      return "blob:qa-" + created.length;
    },
    revokeURL: (url) => revoked.push(url),
    capture() {
      let resolve, reject;
      const finished = new Promise((yes, no) => {
        resolve = yes;
        reject = no;
      });
      const adapter = {
        finished,
        async start(tick) {
          this.tick = tick;
          return true;
        },
        stop() {
          this.stops = (this.stops || 0) + 1;
          resolve(
            this.result || {
              blob: new Blob(["audio"]),
              mime: "audio/webm;codecs=opus",
              duration: 1400,
            },
          );
          return finished;
        },
        pause() {
          this.paused = true;
        },
        resume() {
          this.paused = false;
        },
        mute(value) {
          this.muted = value;
        },
        dispose() {
          this.disposed = true;
          reject(Error("cancelled"));
        },
        resolve,
        reject,
      };
      adapters.push(adapter);
      return adapter;
    },
  };
  return { session: createRecordingSession(io), adapters, revoked, created };
}
test("MIME extensions describe real containers; durations never wrap after an hour", () => {
  for (const [mime, ext] of [
    ["audio/mp4", "m4a"],
    ["audio/webm;codecs=opus", "webm"],
    ["audio/ogg", "ogg"],
    ["audio/aac", "aac"],
    ["unknown", "bin"],
  ])
    assert.equal(recordingExtension(mime), ext);
  assert.equal(recordingTime(3661000), "61:01");
  assert.equal(recordingTime(-20), "00:00");
});
test("permission capture requires consent and duplicate start cannot open two devices", async () => {
  const f = fixture();
  await f.session.start();
  assert.equal(f.adapters.length, 0);
  f.session.consent(true);
  const pending = f.session.start();
  await f.session.start();
  await pending;
  assert.equal(f.adapters.length, 1);
  assert.equal(f.session.snapshot().phase, "recording");
  f.session.clear();
  await Promise.resolve();
});
test("pause, resume, mute and next round retain one real blob without duplicate stops", async () => {
  const f = fixture();
  f.session.consent(true);
  await f.session.start();
  f.session.pause();
  assert.equal(f.adapters[0].paused, true);
  f.session.mute();
  assert.equal(f.adapters[0].muted, true);
  f.session.pause();
  assert.equal(f.session.snapshot().phase, "recording");
  const first = f.session.stop(true);
  await f.session.stop(true);
  await first;
  assert.equal(f.adapters[0].stops, 1);
  assert.equal(f.session.snapshot().clips.length, 1);
  assert.equal(f.session.snapshot().round, 1);
  assert.equal(f.session.snapshot().elapsed, 0);
  assert.equal(f.session.snapshot().clips[0].blob.size, 5);
});
test("closing retains audio and manual notes; only explicit clear revokes their URLs", async () => {
  const f = fixture();
  f.session.consent(true);
  await f.session.start();
  await f.session.leave();
  assert.equal(f.session.snapshot().clips.length, 1);
  const clip = f.session.snapshot().clips[0];
  f.session.note(clip.id, "真实手工笔记 <img onerror=x>");
  assert.match(f.session.draft("zh"), /真实手工笔记/);
  assert.match(f.session.draft("en"), /not an automatic factual record/);
  assert.equal(f.session.pending(), true);
  f.session.downloaded(clip.id);
  assert.equal(f.session.pending(), true);
  f.session.notesDownloaded();
  assert.equal(f.session.pending(), false);
  assert.deepEqual(f.revoked, []);
  f.session.clear();
  assert.deepEqual(f.revoked, [clip.url]);
  assert.equal(f.session.snapshot().clips.length, 0);
  assert.equal(f.session.snapshot().consent, false);
});
test("permission cancellation and late completion never resurrect cleared private audio", async () => {
  const f = fixture();
  f.session.consent(true);
  const starting = f.session.start();
  f.session.clear();
  await starting;
  await Promise.resolve();
  assert.equal(f.session.snapshot().phase, "idle");
  assert.equal(f.created.length, 0);
  assert.equal(f.adapters[0].disposed, true);
});
test("empty audio is a failure and never offered as a successful recording", async () => {
  const f = fixture();
  f.session.consent(true);
  await f.session.start();
  f.adapters[0].result = { blob: new Blob([]), mime: "audio/mp4", duration: 0 };
  await f.session.stop();
  assert.equal(f.session.snapshot().error, "empty");
  assert.equal(f.session.snapshot().clips.length, 0);
  assert.equal(f.created.length, 0);
});
test("capture failure preserves older clips and allows retry", async () => {
  const f = fixture();
  f.session.consent(true);
  await f.session.start();
  await f.session.stop();
  await f.session.start();
  f.adapters[1].reject(Error("permission"));
  await Promise.resolve();
  assert.equal(f.session.snapshot().error, "permission");
  assert.equal(f.session.snapshot().clips.length, 1);
  assert.equal(f.session.snapshot().phase, "idle");
});
test("session capacity stops further capture instead of silently evicting older audio", async () => {
  const f = fixture();
  f.session.consent(true);
  await f.session.start();
  f.adapters[0].result = {
    blob: { size: recordingByteLimit },
    mime: "audio/ogg",
    duration: 1000,
  };
  await f.session.stop();
  await f.session.start();
  assert.equal(f.adapters.length, 1);
  assert.equal(f.session.snapshot().error, "limit");
  assert.equal(f.session.snapshot().clips.length, 1);
});

test("transcription is explicitly opted in, raw machine text survives edits, and notes need their own export", async () => {
  const f = fixture();
  assert.equal(f.session.snapshot().transcriptionEnabled, false);
  f.session.transcription(true, "en-SG");
  f.session.consent(true);
  await f.session.start();
  f.adapters[0].result = {
    blob: new Blob(["audio"]),
    mime: "audio/webm",
    duration: 1000,
    transcript: "Machine original",
    machineTranscript: "Machine original",
    transcriptState: "complete",
  };
  await f.session.stop();
  const clip = f.session.snapshot().clips[0];
  f.session.editTranscript(clip.id, "Reviewed text");
  f.session.note(clip.id, "Independent note");
  assert.equal(
    f.session.snapshot().clips[0].machineTranscript,
    "Machine original",
  );
  const text = f.session.draft("en");
  assert.match(text, /Reviewed text/);
  assert.match(text, /Machine original/);
  assert.match(text, /Independent note/);
  f.session.downloaded(clip.id);
  assert.equal(f.session.pending(), true);
  f.session.notesDownloaded();
  assert.equal(f.session.pending(), false);
  f.session.clear();
  assert.equal(f.session.snapshot().transcriptionEnabled, false);
  assert.equal(f.session.snapshot().liveTranscript, "");
});
