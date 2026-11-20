import test from "node:test";
import assert from "node:assert/strict";
import {
  prepareASRAudio,
  transcriptionSummary,
  asrLanguage,
} from "../../dfplan/src/domain/local-asr-model.mjs";
import { createRecordingSession } from "../../dfplan/src/application/recording-session.mjs";
function fixture() {
  let resolve,
    reject,
    count = 0,
    cancelled = 0;
  const task = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  const session = createRecordingSession({
    id: () => String(++count),
    now: () => "",
    createURL: () => `blob:${count}`,
    revokeURL: () => {},
    localTranscribe: () => task,
    cancelLocal: () => cancelled++,
  });
  session.importAudio(new File(["audio"], "old.webm", { type: "audio/webm" }));
  return { session, resolve, reject, cancelled: () => cancelled };
}
test("pure PCM preparation resamples/downmixes; refuses silence, invalid and long input", () => {
  const input = new Float32Array(48000).fill(0.2);
  assert.equal(prepareASRAudio([input, input], 48000).length, 16000);
  assert.throws(() => prepareASRAudio([new Float32Array(32)], 16000), /silent/);
  assert.throws(() => prepareASRAudio([], 16000), /decode/);
  assert.throws(
    () => prepareASRAudio([new Float32Array(16000 * 301)], 16000),
    /too-long/,
  );
  assert.equal(asrLanguage("en-SG"), "english");
});
test("empty browser results state the failure rather than implying received text", () => {
  assert.match(
    transcriptionSummary({ transcript: "", transcriptError: "network" }),
    /未获得.*网络/,
  );
  assert.match(transcriptionSummary({ transcript: "hello" }, "en"), /received/);
});
test("local result preserves original audio and notes and is exported as unverified", async () => {
  const f = fixture(),
    clip = f.session.snapshot().clips[0];
  f.session.note(clip.id, "manual note");
  const pending = f.session.transcribeClip(clip.id, "zh-CN");
  f.resolve({
    text: "真实测试文字",
    model: "whisper",
    revision: "pinned",
    duration: 11000,
  });
  await pending;
  const result = f.session.snapshot().clips[0];
  assert.equal(result.blob, clip.blob);
  assert.equal(result.note, "manual note");
  assert.equal(result.transcript, "真实测试文字");
  assert.match(f.session.draft(), /真实测试文字/);
  assert.equal(result.duration, 11000);
});
test("cancel/reset discards stale model completion without losing retained audio", async () => {
  const f = fixture(),
    clip = f.session.snapshot().clips[0],
    p = f.session.transcribeClip(clip.id, "zh-CN");
  f.session.cancelLocal();
  f.resolve({ text: "stale" });
  await p;
  assert.equal(f.session.snapshot().clips[0].transcript, "");
  assert.equal(f.session.snapshot().clips[0].url, clip.url);
  assert.ok(f.cancelled());
});
test("failure keeps audio, reports error, allows retry; manual edits are protected", async () => {
  const f = fixture(),
    clip = f.session.snapshot().clips[0],
    p = f.session.transcribeClip(clip.id, "zh-CN");
  f.reject(Error("model-failed"));
  await p;
  assert.equal(f.session.snapshot().localJob.error, "model-failed");
  assert.equal(f.session.snapshot().clips[0].blob, clip.blob);
  f.session.editTranscript(clip.id, "reviewed text");
  await f.session.transcribeClip(clip.id, "zh-CN");
  assert.equal(f.session.snapshot().clips[0].transcript, "reviewed text");
});
test("imports reject unexpected or oversized files", () => {
  const { session } = fixture();
  assert.throws(
    () => session.importAudio(new File(["x"], "input.html")),
    /decode/,
  );
  assert.throws(
    () =>
      session.importAudio(
        new File([new Uint8Array(13 * 1024 * 1024)], "large.webm"),
      ),
    /file-size/,
  );
});

test("edits made during inference survive late model results", async () => {
  const f = fixture(),
    clip = f.session.snapshot().clips[0];
  const pending = f.session.transcribeClip(clip.id, "zh-CN");
  f.session.editTranscript(clip.id, "人工确认的文字");
  f.resolve({ text: "late machine words" });
  await pending;
  assert.equal(f.session.snapshot().clips[0].transcript, "人工确认的文字");
});
test("a second local job can succeed after a failed first attempt", async () => {
  let calls = 0;
  const session = createRecordingSession({
    id: () => "id",
    now: () => "",
    createURL: () => "blob:id",
    revokeURL: () => {},
    localTranscribe: async () => {
      if (++calls === 1) throw Error("model-failed");
      return { text: "重试成功" };
    },
  });
  session.importAudio(new File(["audio"], "clip.webm"));
  await session.transcribeClip("id", "zh-CN");
  assert.equal(session.snapshot().localJob.stage, "error");
  await session.transcribeClip("id", "zh-CN");
  assert.equal(session.snapshot().clips[0].transcript, "重试成功");
  assert.equal(session.snapshot().localJob, null);
});
