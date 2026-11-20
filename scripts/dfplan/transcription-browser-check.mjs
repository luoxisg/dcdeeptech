import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
/** Deterministic Speech API events + real synthetic MediaRecorder; no provider requests. */
export async function checkTranscription(page) {
  const projectBefore = await page.evaluate(() =>
    localStorage.getItem("deepfamily.dfplan.demo.v1"),
  );
  await page.evaluate(() => {
    window.__originalSpeech = window.SpeechRecognition;
    window.__originalWebkitSpeech = window.webkitSpeechRecognition;
    window.__speechInstances = [];
    class TestSpeech {
      constructor() {
        window.__speechInstances.push(this);
      }
      start() {
        queueMicrotask(() => this.onstart?.());
      }
      abort() {
        this.aborted = true;
        queueMicrotask(() => this.onend?.());
      }
      stop() {
        this.stopped = true;
        setTimeout(() => {
          if (this.finalOnStop) this.result(this.finalOnStop, true);
          this.onend?.();
        }, 20);
      }
      result(text, final) {
        this.onresult?.({
          resultIndex: 0,
          results: [Object.assign([{ transcript: text }], { isFinal: final })],
        });
      }
    }
    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      value: TestSpeech,
    });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      configurable: true,
      value: TestSpeech,
    });
  });
  const open = async () => {
    await page.locator('[data-cmd="voice-open"]:visible').first().click();
    await page.locator(".recorder-overlay").waitFor();
  };
  const reset = async () => {
    await page.locator('[data-recording="reset"]').click();
    await page.locator('[data-recording="confirm-reset"]').click();
  };
  const begin = async () => {
    await page.locator("[data-recording-consent]").check();
    await page.locator("[data-transcription-enable]").check();
    await page.locator('[data-recording="orb"]').click();
    await page.waitForFunction(
      () =>
        document.querySelector('[data-recording="orb"]')?.dataset
          .recordingState === "recording",
    );
  };
  const dismiss = async () =>
    page.locator('[data-recording="dismiss"]').first().click();
  await open();
  await reset();
  assert.equal(
    await page.locator("[data-transcription-enable]").isChecked(),
    false,
  );
  assert.equal(await page.evaluate(() => window.__speechInstances.length), 0);
  await begin();
  await page.waitForFunction(() => window.__speechInstances.length === 1);
  await page.evaluate(() => {
    window.__speechInstances[0].result("祖父在", false);
    window.__speechInstances[0].result("祖父在新加坡工作。", true);
  });
  await page.waitForFunction(
    () =>
      document.querySelector("[data-live-transcript]")?.textContent ===
      "祖父在新加坡工作。",
  );
  assert.equal(
    await page.evaluate(() => window.__speechInstances[0].lang),
    "zh-CN",
  );
  await page.locator('[data-recording="pause"]').click();
  assert.equal(
    await page.evaluate(() => window.__speechInstances[0].aborted),
    true,
  );
  await page.evaluate(() =>
    window.__speechInstances[0].result("MUTED_WORDS_MUST_NOT_APPEAR", true),
  );
  assert.doesNotMatch(
    await page.locator("[data-live-transcript]").innerText(),
    /MUTED_WORDS/,
  );
  await page.locator('[data-recording="pause"]').click();
  await page.waitForFunction(() => window.__speechInstances.length === 2);
  await page.evaluate(() =>
    window.__speechInstances[1].result("保留另一种说法。", true),
  );
  await page.locator('[data-recording="mute"]').click();
  assert.equal(
    await page.evaluate(() => window.__speechInstances[1].aborted),
    true,
  );
  await page.locator('[data-recording="mute"]').click();
  await page.waitForFunction(() => window.__speechInstances.length === 3);
  await page.evaluate(() => {
    window.__speechInstances[2].result("末尾临时", false);
    window.__speechInstances[2].finalOnStop =
      "末尾最终文字 <img src=x onerror=alert(1)>";
  });
  await page.waitForTimeout(650);
  await page.locator('[data-recording="done"]').click();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-recording="orb"]')?.dataset
        .recordingState === "idle",
  );
  await page.locator('[data-recording="review"]').click();
  const field = page.locator("[data-recording-transcript]").first();
  await field.waitFor();
  const original = await field.inputValue();
  assert.match(original, /祖父在新加坡工作/);
  assert.match(original, /末尾最终文字/);
  assert.doesNotMatch(original, /末尾临时|MUTED_WORDS/);
  assert.equal(await page.locator(".recorder-sheet img").count(), 0);
  await field.fill("人工校对后：日期仍待核实。");
  await page.locator("[data-recording-note]").fill("独立的手工笔记");
  assert.equal(
    await page
      .locator("[data-recording-note]")
      .evaluate((el) => el === document.activeElement),
    true,
  );
  const pending = page.waitForEvent("download");
  await page.locator('[data-recording="notes"]').click();
  const file = await pending,
    contents = await readFile(await file.path(), "utf8");
  assert.match(contents, /人工校对后/);
  assert.match(contents, /原始机器转写：/);
  assert.match(contents, /末尾最终文字/);
  assert.match(contents, /独立的手工笔记/);
  await dismiss();
  await reset();
  // A failed ASR service must not fail or invent the audio recording.
  await begin();
  await page.waitForFunction(() => window.__speechInstances.length === 4);
  await page.evaluate(() => {
    const rec = window.__speechInstances[3];
    rec.onerror({ error: "network" });
    rec.onend();
  });
  await page.waitForTimeout(650);
  assert.equal(
    await page
      .locator('[data-recording="orb"]')
      .getAttribute("data-recording-state"),
    "recording",
  );
  await page.locator('[data-recording="done"]').click();
  await page.locator('[data-recording="review"]').click();
  assert.equal(await page.locator("audio").count(), 1);
  assert.equal(
    await page.locator("[data-recording-transcript]").inputValue(),
    "",
  );
  assert.match(
    await page.locator(".recording-clip").innerText(),
    /未获得转写文字.*网络/,
  );
  assert.doesNotMatch(
    await page.locator(".recording-clip").innerText(),
    /机器转写 · 待核实（可能不完整）/,
  );
  await dismiss();
  await reset();
  // English uses the selected language. Unsupported browsers keep local recording available.
  await page.locator("[data-transcription-language]").selectOption("en-SG");
  await begin();
  await page.waitForFunction(() => window.__speechInstances.length === 5);
  assert.equal(
    await page.evaluate(() => window.__speechInstances[4].lang),
    "en-SG",
  );
  await page.evaluate(() =>
    window.__speechInstances[4].onerror({ error: "network" }),
  );
  await page.locator('[data-recording="speech-retry"]').click();
  await page.waitForFunction(() => window.__speechInstances.length === 6);
  await page.evaluate(() =>
    window.__speechInstances[5].result("Recovered English words.", true),
  );
  assert.equal(
    await page
      .locator('[data-recording="orb"]')
      .getAttribute("data-recording-state"),
    "recording",
  );
  await page.waitForTimeout(550);
  await page.locator('[data-recording="done"]').click();
  await reset();
  await page.locator('[data-recording="close"]').click();
  await page.evaluate(() => {
    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      configurable: true,
      value: undefined,
    });
  });
  await open();
  assert.equal(
    await page.locator("[data-transcription-enable]").isDisabled(),
    true,
  );
  await page.locator("[data-recording-consent]").check();
  await page.locator('[data-recording="orb"]').click();
  await page.waitForTimeout(650);
  await page.locator('[data-recording="done"]').click();
  await page.locator('[data-recording="review"]').click();
  assert.equal(await page.locator("audio").count(), 1);
  await dismiss();
  await reset();
  await page.locator('[data-recording="close"]').click();
  await page.evaluate(() => {
    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      value: window.__originalSpeech,
    });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      configurable: true,
      value: window.__originalWebkitSpeech,
    });
  });
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem("deepfamily.dfplan.demo.v1"),
    ),
    projectBefore,
  );
  console.log(
    "PASS: opt-in browser transcription, interim/final replacement, pause/mute, late final results, editable/raw preservation, TXT export, network failure, language selection and unsupported fallback (mocked provider).",
  );
}
