import test from "node:test";
import assert from "node:assert/strict";
import { createInterviewSession } from "../../dfplan/src/application/interview-session.mjs";
import {
  interviewScript,
  interviewDraft,
  collectInterviewEntities,
  canInterviewTransition,
  elderPauseMs,
} from "../../dfplan/src/domain/interview-model.mjs";
function fixture() {
  let now = 0,
    next = 0;
  const jobs = new Map();
  const clock = {
    setTimeout(fn, ms) {
      const id = ++next;
      jobs.set(id, { fn, at: now + ms });
      return id;
    },
    clearTimeout(id) {
      jobs.delete(id);
    },
  };
  return {
    session: createInterviewSession(clock),
    jobs,
    advance(ms) {
      const end = now + ms;
      let steps = 0;
      while (true) {
        const due = Array.from(jobs)
          .filter(([, job]) => job.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        if (++steps > 5000) throw Error("timer loop");
        jobs.delete(due[0]);
        now = due[1].at;
        due[1].fn();
      }
      now = end;
    },
  };
}
test("sample is bilingual, bounded and retains uncertainty and original wording", () => {
  assert.equal(interviewScript.length, 3);
  assert.equal(elderPauseMs, 3500);
  assert.equal(canInterviewTransition("idle", "thinking"), false);
  assert.equal(canInterviewTransition("speaking", "listening"), true);
  for (const language of ["zh", "en"]) {
    const draft = interviewDraft([0, 1, 2], language);
    assert.ok(draft.body);
    assert.equal(draft.checks.length, 3);
    assert.match(draft.body, language === "zh" ? /待核实/ : /unverified/);
  }
  assert.equal(
    collectInterviewEntities([0, 0]).length,
    interviewScript[0].entities.length,
  );
});
test("full timed sample completes exactly three turns and six transcript rows", () => {
  const { session, advance, jobs } = fixture();
  session.start();
  advance(40000);
  assert.equal(session.getState().phase, "complete");
  assert.deepEqual(session.getState().completed, [0, 1, 2]);
  assert.equal(session.getState().transcript.length, 6);
  assert.equal(jobs.size, 0);
  assert.match(session.exportText("en"), /NOT A VERIFIED FAMILY RECORD/);
});
test("interrupt and repeated finish cannot duplicate a turn", () => {
  const { session, advance } = fixture();
  session.start();
  session.interrupt();
  assert.equal(session.getState().phase, "listening");
  session.finish();
  session.finish();
  advance(700);
  assert.deepEqual(session.getState().completed, [0]);
  assert.equal(
    session.getState().transcript.filter((row) => row.role === "narrator")
      .length,
    1,
  );
});
test("pause freezes all stages; resume during organizing does not duplicate transcript", () => {
  const { session, advance } = fixture();
  session.start();
  session.interrupt();
  session.finish();
  session.togglePause();
  advance(9000);
  assert.equal(session.getState().turn, 0);
  assert.equal(session.getState().paused, true);
  session.togglePause();
  advance(700);
  assert.equal(session.getState().turn, 1);
  assert.equal(
    session.getState().transcript.filter((row) => row.role === "narrator")
      .length,
    1,
  );
});
test("leaving suspends pending timers and reset invalidates old callbacks", () => {
  const { session, advance, jobs } = fixture();
  session.start();
  session.suspend();
  assert.equal(jobs.size, 0);
  advance(10000);
  assert.equal(session.getState().turn, 0);
  session.reset();
  advance(10000);
  assert.equal(session.getState().phase, "idle");
  assert.equal(session.getState().transcript.length, 0);
});
test("edited drafts survive later turns and keep separate EN/ZH versions", () => {
  const { session, advance } = fixture();
  session.edit("zh", "body", "手工修改，原话需保留");
  session.edit("en", "body", "My edited draft");
  session.start();
  advance(40000);
  assert.equal(session.draft("zh").body, "手工修改，原话需保留");
  assert.equal(session.draft("en").body, "My edited draft");
  assert.equal(session.getState().completed.length, 3);
  assert.match(session.exportText("zh"), /示例原始对话/);
  session.edit("zh", "body", "x".repeat(13000));
  assert.equal(session.draft("zh").body.length, 12000);
});
