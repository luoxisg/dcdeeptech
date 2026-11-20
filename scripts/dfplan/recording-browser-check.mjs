import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
/** Uses Chromium's synthetic microphone with the real MediaRecorder and audio decoder. */
export async function checkRecording(page) {
  const before = await page.evaluate(() =>
    localStorage.getItem("deepfamily.dfplan.demo.v1"),
  );
  await page.evaluate(() => {
    window.__captureCalls = 0;
    window.__captureStreams = [];
    window.__captureOriginal = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async (opts) => {
        window.__captureCalls++;
        const stream = await window.__captureOriginal(opts);
        window.__captureStreams.push(stream);
        return stream;
      },
    });
  });
  const open = async () => {
    await page.locator('[data-cmd="voice-open"]:visible').first().click();
    await page.locator(".recorder-overlay").waitFor();
  };
  const review = async () => {
    await page.locator('[data-recording="review"]').click();
    await page.locator(".recorder-sheet[open]").waitFor();
  };
  const dismiss = async () => {
    await page.locator('[data-recording="dismiss"]').first().click();
  };
  const sizes = async (min) => {
    assert.deepEqual(
      await page.locator(".recorder-overlay").evaluate(
        (root, min) =>
          Array.from(
            root.querySelectorAll("button,input,textarea,summary,audio"),
          )
            .filter((el) => el.getClientRects().length)
            .map((el) => ({
              tag: el.tagName,
              text: el.textContent.trim().slice(0, 25),
              w: el.getBoundingClientRect().width,
              h: el.getBoundingClientRect().height,
            }))
            .filter((rect) => rect.w < min - 0.5 || rect.h < min - 0.5),
        min,
      ),
      [],
    );
    assert.equal(
      await page
        .locator(".recorder-overlay")
        .evaluate((el) => el.scrollWidth <= innerWidth),
      true,
    );
  };
  await open();
  assert.equal(await page.evaluate(() => window.__captureCalls), 0);
  assert.equal(await page.locator('[data-recording="orb"]').isDisabled(), true);
  await sizes(54);
  await page.locator("[data-recording-consent]").check();
  await page.locator('[data-recording="orb"]').click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-recording="orb"]')
        ?.getAttribute("data-recording-state") === "recording",
  );
  await page.waitForTimeout(1200);
  if (process.env.DFPLAN_SCREENSHOT_DIR)
    await page.screenshot({
      path:
        process.env.DFPLAN_SCREENSHOT_DIR +
        "/real-recording-" +
        page.viewportSize().width +
        ".png",
    });
  await page.locator('[data-recording="pause"]').click();
  const paused = await page.locator(".recording-timer").innerText();
  await page.waitForTimeout(1100);
  assert.equal(await page.locator(".recording-timer").innerText(), paused);
  await page.locator('[data-recording="mute"]').click();
  assert.equal(
    await page.evaluate(
      () => window.__captureStreams[0].getAudioTracks()[0].enabled,
    ),
    false,
  );
  await page.locator('[data-recording="mute"]').click();
  await page.locator('[data-recording="pause"]').click();
  await page.waitForTimeout(650);
  await page.locator('[data-recording="done"]').click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-recording="orb"]')
        ?.getAttribute("data-recording-state") === "idle",
  );
  assert.match(await page.locator(".recording-round").innerText(), /2/);
  assert.equal(
    await page.evaluate(() =>
      window.__captureStreams.every((stream) =>
        stream.getTracks().every((track) => track.readyState === "ended"),
      ),
    ),
    true,
  );
  await review();
  await sizes(54);
  assert.equal(await page.locator("audio").count(), 1);
  const media = await page.locator("audio").evaluate(async (audio) => {
    const bytes = await (await fetch(audio.src)).arrayBuffer();
    const context = new AudioContext();
    try {
      const buffer = await context.decodeAudioData(bytes.slice(0));
      return {
        bytes: bytes.byteLength,
        duration: buffer.duration,
        nonzero: buffer
          .getChannelData(0)
          .some((value) => Math.abs(value) > 0.001),
      };
    } finally {
      await context.close();
    }
  });
  assert.ok(media.bytes > 1000);
  assert.ok(media.duration > 0);
  assert.equal(
    media.nonzero,
    true,
    "Recorded real synthetic audio, not an empty or silent placeholder.",
  );
  await page.locator("audio").evaluate((audio) => audio.play());
  await page.waitForTimeout(150);
  assert.ok(
    await page.locator("audio").evaluate((audio) => audio.currentTime > 0),
  );
  await page.locator("audio").evaluate((audio) => audio.pause());
  const note = page.locator("[data-recording-note]").first();
  await note.fill("真实录音笔记 <img src=x onerror=alert(1)>");
  assert.equal(
    await note.evaluate((el) => el === document.activeElement),
    true,
  );
  assert.equal(await page.locator(".recorder-sheet img").count(), 0);
  await page.evaluate(() => {
    Object.defineProperty(visualViewport, "height", {
      configurable: true,
      value: 420,
    });
    visualViewport.dispatchEvent(new Event("resize"));
  });
  await page.waitForTimeout(80);
  const actions = await page
    .locator(".recorder-sheet .sheet-actions")
    .boundingBox();
  assert.ok(actions.y + actions.height <= 421);
  assert.equal(
    await note.evaluate((el) => el === document.activeElement),
    true,
  );
  await page.evaluate(() => {
    delete visualViewport.height;
    visualViewport.dispatchEvent(new Event("resize"));
  });
  let pending = page.waitForEvent("download");
  await page.locator('[data-recording="download"]').click();
  const audioFile = await pending;
  const bytes = await readFile(await audioFile.path());
  assert.equal(bytes.length, media.bytes);
  assert.match(audioFile.suggestedFilename(), /\.(webm|m4a|ogg|aac|bin)$/);
  pending = page.waitForEvent("download");
  await page.locator('[data-recording="notes"]').click();
  const notes = await pending;
  assert.match(await readFile(await notes.path(), "utf8"), /真实录音笔记/);
  await dismiss();
  await page.locator('[data-recording="close"]').click();
  await open();
  await review();
  assert.match(
    await page.locator("[data-recording-note]").inputValue(),
    /真实录音笔记/,
  );
  await dismiss();
  await page.locator('[data-recording="orb"]').click();
  await page.waitForTimeout(750);
  await page.locator('[data-recording="close"]').click();
  assert.equal(
    await page.evaluate(() =>
      window.__captureStreams.every((stream) =>
        stream.getTracks().every((track) => track.readyState === "ended"),
      ),
    ),
    true,
  );
  await open();
  await review();
  assert.equal(await page.locator("audio").count(), 2);
  await dismiss();
  await page.locator('[data-recording="reset"]').click();
  await dismiss();
  await review();
  assert.equal(await page.locator("audio").count(), 2);
  await dismiss();
  await page.locator('[data-recording="reset"]').click();
  await page.locator('[data-recording="confirm-reset"]').click();
  assert.equal(
    await page.locator('[data-recording="review"]').isDisabled(),
    true,
  );
  await page.evaluate(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: () => new Promise((resolve) => (window.__lateCapture = resolve)),
    });
    window.__lateStops = 0;
  });
  await page.locator("[data-recording-consent]").check();
  await page.locator('[data-recording="orb"]').click();
  await page.locator('[data-recording="close"]').click();
  await page.evaluate(() =>
    window.__lateCapture({
      getTracks: () => [{ stop: () => window.__lateStops++ }],
    }),
  );
  await page.waitForTimeout(50);
  assert.equal(await page.evaluate(() => window.__lateStops), 1);
  await open();
  await page.evaluate(() =>
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        throw new DOMException("Denied", "NotAllowedError");
      },
    }),
  );
  await page.locator('[data-recording="orb"]').click();
  await page.waitForFunction(() =>
    document.querySelector(".recording-error")?.textContent.includes("权限"),
  );
  assert.equal(
    await page.locator('[data-recording="review"]').isDisabled(),
    true,
  );
  await page.locator('[data-recording="scale"]').click();
  await sizes(48);
  await page.locator('[data-recording="scale"]').click();
  await page.locator('[data-recording="close"]').click();
  // The previous scripted / configured-AI interface remains available as an explicit option.
  await open();
  await page.locator(".recorder-options summary").click();
  await page.locator('[data-recording="advanced"]').click();
  await page.locator('[data-voice="settings"]').waitFor();
  await page.locator('[data-voice="close"]').click();
  await page.locator(".site-menu > summary").click();
  await page.locator('[data-cmd="language"]').click();
  await open();
  assert.match(
    await page.locator("#recorder-title").innerText(),
    /Oral history/,
  );
  assert.match(
    await page.locator(".recorder-consent").first().innerText(),
    /consent/,
  );
  await page.locator('[data-recording="close"]').click();
  await page.locator(".site-menu > summary").click();
  await page.locator('[data-cmd="language"]').click();
  await page.evaluate(() =>
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: window.__captureOriginal,
    }),
  );
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem("deepfamily.dfplan.demo.v1"),
    ),
    before,
  );
  console.log(
    "PASS: real MediaRecorder bytes, non-silent decode, playback, pause/mute, downloads, close/reopen, reset, denied/late permissions, keyboard, advanced modes and project isolation.",
  );
}
