import test from "node:test";
import assert from "node:assert/strict";
import { createBrowserTranscription } from "../../dfplan/src/adapters/browser-transcription.mjs";
function fixture() {
  let now = 0,
    id = 0;
  const jobs = new Map(),
    instances = [],
    events = [];
  const clock = {
    setTimeout(fn, ms) {
      const key = ++id;
      jobs.set(key, { fn, at: now + ms });
      return key;
    },
    clearTimeout: (key) => jobs.delete(key),
  };
  class Recognition {
    constructor() {
      instances.push(this);
    }
    start() {
      this.started = true;
      this.onstart?.();
    }
    stop() {
      this.stopped = true;
    }
    abort() {
      this.aborted = true;
    }
    result(rows, index = 0) {
      const results = rows.map(([text, final]) =>
        Object.assign([{ transcript: text }], { isFinal: final }),
      );
      this.onresult?.({ results, resultIndex: index });
    }
    end() {
      this.onend?.();
    }
  }
  const api = createBrowserTranscription({
    Recognition,
    clock,
    language: "zh-CN",
    onChange: (event) => events.push(event),
  });
  return {
    api,
    instances,
    events,
    jobs,
    tick(ms) {
      const end = now + ms;
      let steps = 0;
      while (true) {
        const next = Array.from(jobs)
          .filter(([, job]) => job.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        if (++steps > 1000) throw Error("loop");
        jobs.delete(next[0]);
        now = next[1].at;
        next[1].fn();
      }
      now = end;
    },
  };
}
test("interim results are revised in place and never duplicated as fabricated final text", async () => {
  const f = fixture();
  f.api.start();
  const rec = f.instances[0];
  assert.equal(rec.lang, "zh-CN");
  rec.result([["祖父在", false]]);
  rec.result([["祖父在老码头工作。", true]]);
  assert.equal(f.api.snapshot().text, "祖父在老码头工作。");
  const done = f.api.finish();
  rec.end();
  const result = await done;
  assert.equal(result.text, "祖父在老码头工作。");
  assert.equal(result.status, "complete");
});
test("pause aborts recognition and ignores stale callbacks; resumed segments retain original wording", async () => {
  const f = fixture();
  f.api.start();
  const old = f.instances[0];
  old.result([["First account.", true]]);
  const late = old.onresult;
  f.api.pause();
  assert.equal(old.aborted, true);
  late({
    resultIndex: 0,
    results: [
      Object.assign([{ transcript: "MUTED PRIVATE WORDS" }], { isFinal: true }),
    ],
  });
  f.api.resume();
  f.instances[1].result([["Second account.", true]]);
  assert.equal(f.api.snapshot().text, "First account. Second account.");
  const done = f.api.finish();
  f.instances[1].end();
  await done;
});
test("stop waits for the provider final result and associates it with this clip", async () => {
  const f = fixture();
  f.api.start();
  const rec = f.instances[0];
  rec.result([["old partial", false]]);
  const done = f.api.finish();
  rec.result([["final corrected words", true]]);
  rec.end();
  assert.equal((await done).text, "final corrected words");
  assert.equal(f.jobs.size, 0);
});
test("a provider that never ends cannot block saving the audio indefinitely", async () => {
  const f = fixture();
  f.api.start();
  f.instances[0].result([["partial words", false]]);
  const done = f.api.finish();
  f.tick(1500);
  assert.equal((await done).status, "partial");
  assert.equal(f.instances[0].aborted, true);
});
test("network errors preserve available text and never claim completed transcription", async () => {
  const f = fixture();
  f.api.start();
  const rec = f.instances[0];
  rec.result([["some words", false]]);
  rec.onerror({ error: "network" });
  rec.end();
  assert.equal(f.api.snapshot().status, "error");
  assert.equal(f.jobs.size, 0);
  const result = await f.api.finish();
  assert.equal(result.text, "some words");
  assert.equal(result.error, "network");
});
test("clear cancels pending finalization and stale text cannot reappear", async () => {
  const f = fixture();
  f.api.start();
  const rec = f.instances[0];
  rec.result([["private words", true]]);
  const callback = rec.onresult,
    done = f.api.finish();
  f.api.cancel();
  callback({
    results: [Object.assign([{ transcript: "late words" }], { isFinal: true })],
    resultIndex: 0,
  });
  assert.equal((await done).text, "");
  assert.equal(f.api.snapshot().text, "");
  assert.equal(f.jobs.size, 0);
});
test("silent/end reconnection attempts are bounded and do not loop forever", () => {
  const f = fixture();
  f.api.start();
  for (let i = 0; i < 3; i++) {
    f.instances[i].end();
    f.tick(250);
  }
  assert.equal(f.instances.length, 3);
  assert.equal(f.jobs.size, 0);
  assert.equal(f.api.snapshot().status, "stopped");
  f.api.cancel();
});
test("oversized text is labeled partial and recognition stops while audio can continue", async () => {
  const f = fixture();
  f.api.start();
  f.instances[0].result([["x".repeat(13000), true]]);
  assert.equal(f.api.snapshot().text.length, 12000);
  assert.equal(f.api.snapshot().error, "text-limit");
  assert.equal(f.instances[0].aborted, true);
  const result = await f.api.finish();
  assert.equal(result.partial, true);
});

test("manual retry after service failure restarts under a fresh user action and retains earlier text", async () => {
  const f = fixture();
  f.api.start();
  f.instances[0].result([["earlier text", true]]);
  f.instances[0].onerror({ error: "network" });
  assert.equal(f.instances[0].aborted, true);
  f.api.resume();
  f.instances[1].result([["new words", true]]);
  const done = f.api.finish();
  f.instances[1].end();
  assert.equal((await done).text, "earlier text new words");
});
