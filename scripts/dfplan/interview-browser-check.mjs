import assert from "node:assert/strict";
/** Exercises only local scripted content and fake microphone permission; no live recording. */
export async function checkInterview(page) {
  const navigate = async (view) => {
    await page.evaluate(async (view) => {
      const { commands } =
        await import("/dfplan/src/application/command-bus.mjs");
      await commands.run("navigate", { view });
    }, view);
    await page.waitForTimeout(100);
  };
  await navigate("list");
  await page.locator('[data-task-id="WU-05"] [data-view="interview"]').click();
  await page.locator(".interview-workspace").waitFor();
  if (process.env.DFPLAN_SCREENSHOT_DIR)
    await page.screenshot({
      path:
        process.env.DFPLAN_SCREENSHOT_DIR +
        "/interview-" +
        page.viewportSize().width +
        ".png",
    });
  const before = await page.evaluate(() =>
    localStorage.getItem("deepfamily.dfplan.demo.v1"),
  );
  await page.evaluate(() => {
    window.__micRequests = 0;
    window.__micStops = 0;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: () => {
        window.__micRequests++;
        return new Promise((resolve) => (window.__resolveMic = resolve));
      },
    });
  });
  assert.equal(await page.evaluate(() => window.__micRequests), 0);
  await page.locator("[data-interview-primary]").click();
  await page.locator("[data-interview-primary]").click();
  await page.locator("[data-interview-primary]").click();
  await page.waitForFunction(() =>
    document
      .querySelector("[data-interview-count]")
      ?.textContent.startsWith("1 /"),
  );
  await page.locator('[data-cmd="interview-review"]').click();
  await page.locator("dialog[open]").waitFor();
  const draft = page.locator('dialog textarea[name="body"]');
  await draft.fill("手工笔记 <img src=x onerror=alert(1)>");
  await page.evaluate(async () => {
    const { store } = await import("/dfplan/src/application/store.mjs");
    store.update({ message: "background update" });
  });
  assert.equal(
    await draft.inputValue(),
    "手工笔记 <img src=x onerror=alert(1)>",
  );
  assert.equal(
    await draft.evaluate((el) => el === document.activeElement),
    true,
  );
  assert.equal(await page.locator("dialog img").count(), 0);
  const pending = page.waitForEvent("download");
  await page.locator('dialog button[type="submit"]').click();
  const file = await pending;
  const { readFile } = await import("node:fs/promises");
  assert.match(await readFile(await file.path(), "utf8"), /手工笔记/);
  assert.match(await readFile(await file.path(), "utf8"), /脚本示例/);
  await page.locator('dialog [data-cmd="close"]').first().click();
  await navigate("overview");
  await navigate("interview");
  await page.locator('[data-cmd="interview-review"]').click();
  assert.equal(
    await page.locator('dialog textarea[name="body"]').inputValue(),
    "手工笔记 <img src=x onerror=alert(1)>",
  );
  await page.locator('dialog [data-cmd="close"]').first().click();
  await page.locator(".interview-workspace details summary").click();
  await page.locator("[data-interview-microphone]").click();
  assert.equal(await page.evaluate(() => window.__micRequests), 1);
  await navigate("overview");
  await page.evaluate(() =>
    window.__resolveMic({
      getTracks: () => [{ stop: () => window.__micStops++ }],
    }),
  );
  await page.waitForTimeout(50);
  assert.equal(await page.evaluate(() => window.__micStops), 1);
  const session = await page.evaluate(async () => {
    const { interviewSession } =
      await import("/dfplan/src/application/interview-session.mjs");
    return interviewSession.getState();
  });
  assert.equal(session.paused, true);
  assert.equal(session.completed.length, 1);
  await navigate("interview");
  await page.locator('[data-cmd="interview-reset"]').click();
  await page.locator("dialog[open]").waitFor();
  await page.locator('dialog [data-cmd="close"]').first().click();
  await page.locator('[data-cmd="interview-review"]').click();
  assert.equal(
    await page.locator('dialog textarea[name="body"]').inputValue(),
    "手工笔记 <img src=x onerror=alert(1)>",
  );
  await page.locator('dialog [data-cmd="close"]').first().click();
  await page.locator('[data-cmd="interview-reset"]').click();
  await page.locator('dialog button[type="submit"]').click();
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));
  assert.match(await page.locator("[data-interview-count]").innerText(), /^0/);
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem("deepfamily.dfplan.demo.v1"),
    ),
    before,
    "Interview must not save or change project data.",
  );
  await page.locator('[data-cmd="language"]').click();
  await page.waitForFunction(() =>
    document
      .querySelector("[data-interview-primary]")
      ?.textContent.includes("Start sample"),
  );
  assert.match(await page.locator("#page-title").innerText(), /Oral history/);
  await page.locator('[data-cmd="language"]').click();
  await page.waitForFunction(() =>
    document
      .querySelector("[data-interview-primary]")
      ?.textContent.includes("开始示例"),
  );
  console.log(
    "PASS: interview entry, interruption, pause, editable draft, TXT export, XSS escaping, reset confirmation, pending microphone cleanup and project isolation.",
  );
}
