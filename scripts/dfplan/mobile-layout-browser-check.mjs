import assert from "node:assert/strict";
/** Real DOM layout/state checks, synthetic microphone; never accesses live family records. */
export async function checkMobileLayout(page) {
  const navigate = async (view) => {
    await page.evaluate(async (view) => {
      const { commands } =
        await import("/dfplan/src/application/command-bus.mjs");
      await commands.run("navigate", { view, scrollTop: 0 });
    }, view);
    await page.waitForTimeout(100);
  };
  await navigate("overview");
  const before = await page.evaluate(() =>
    localStorage.getItem("deepfamily.dfplan.demo.v1"),
  );
  for (const elder of [false, true]) {
    await page.evaluate(async (elder) => {
      const { store } = await import("/dfplan/src/application/store.mjs");
      store.update({ elder });
    }, elder);
    const header = await page.locator('[data-slot="header"]').boundingBox();
    assert.ok(
      header.height >= 52 && header.height <= 56,
      JSON.stringify(header),
    );
    assert.equal(
      await page.locator('[data-slot="header"] > .header-main').count(),
      1,
    );
    assert.equal(
      await page
        .locator('.site-menu [data-cmd="navigate"]:not([data-view="handover"])')
        .count(),
      4,
    );
    assert.deepEqual(
      await page
        .locator('.site-menu [data-cmd="navigate"]:not([data-view="handover"])')
        .evaluateAll((nodes) => nodes.map((n) => n.dataset.view)),
      ["dashboard", "people", "security", "history"],
    );
    assert.equal(
      await page
        .locator('[data-slot="mobile-tabbar"]')
        .evaluate((n) => n.tagName),
      "NAV",
    );
    assert.equal(await page.locator(".mobile-tabs button").count(), 5);
    const paths = await page
      .locator(".mobile-tabs svg path")
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("d")));
    assert.notEqual(paths[1], paths[4]);
    await page.locator(".site-menu > summary").click();
    assert.deepEqual(
      await page
        .locator(".site-menu button")
        .evaluateAll(
          (nodes, min) =>
            nodes
              .filter(
                (n) =>
                  n.getBoundingClientRect().width < min ||
                  n.getBoundingClientRect().height < min,
              )
              .map((n) => n.textContent),
          elder ? 54 : 48,
        ),
      [],
    );
    if (process.env.DFPLAN_SCREENSHOT_DIR)
      await page.screenshot({
        path:
          process.env.DFPLAN_SCREENSHOT_DIR +
          `/mobile-menu-${page.viewportSize().width}-${elder}.png`,
      });
    await page.locator('.site-menu [data-view="people"]').click();
    assert.equal(await page.locator(".site-menu").getAttribute("open"), null);
    await page.locator(".site-menu > summary").click();
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".site-menu").getAttribute("open"), null);
    await page.locator(".site-menu > summary").click();
    await page.locator('[data-cmd="language"]').click();
    assert.equal(await page.locator(".site-menu").getAttribute("open"), null);
    await page.locator(".site-menu > summary").click();
    await page.locator('[data-cmd="language"]').click();
    await page.locator('.mobile-tabs [data-cmd="voice-open"]').click();
    const start = page.locator('[data-recording="start"]');
    await start.waitFor({ state: "visible" });
    assert.equal(await start.isVisible(), true);
    assert.equal(await start.isDisabled(), true);
    for (const action of ["mute", "pause", "done", "finish"])
      assert.equal(
        await page.locator(`[data-recording="${action}"]`).isVisible(),
        false,
      );
    for (const selector of [
      "[data-recording-consent]",
      "[data-transcription-enable]",
    ]) {
      const field = page.locator(selector);
      await field.locator("..").scrollIntoViewIfNeeded();
      const fits = await field.evaluate((el) => {
        const label = el.closest("label"),
          body = el.closest(".recorder-body"),
          a = label.getBoundingClientRect(),
          b = body.getBoundingClientRect();
        return a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5;
      });
      assert.equal(fits, true, selector + " clipped");
    }
    await page.locator("[data-recording-consent]").check();
    assert.equal(await start.isEnabled(), true);
    if (process.env.DFPLAN_SCREENSHOT_DIR)
      await page.screenshot({
        path:
          process.env.DFPLAN_SCREENSHOT_DIR +
          `/mobile-idle-${page.viewportSize().width}-${elder}.png`,
      });
    await start.click();
    await page.waitForFunction(
      () =>
        document.querySelector('[data-recording="orb"]')?.dataset
          .recordingState === "recording",
    );
    assert.equal(await start.isVisible(), false);
    for (const action of ["mute", "pause", "done", "finish"])
      assert.equal(
        await page.locator(`[data-recording="${action}"]`).isVisible(),
        true,
      );
    await page.locator('[data-recording="done"]').click();
    await start.waitFor({ state: "visible" });
    assert.equal(
      await page.locator('[data-recording="finish"]').isVisible(),
      false,
    );
    await page.locator('[data-recording="reset"]').click();
    await page.locator('[data-recording="confirm-reset"]').click();
    await page.locator('[data-recording="close"]').click();
    await navigate("digitization");
    await page.locator("[data-capture-budget]").waitFor();
    const budget = page.locator("[data-capture-budget]");
    for (const top of [0, 900, 999999]) {
      await page
        .locator('[data-slot="viewport"]')
        .evaluate((el, top) => (el.scrollTop = top), top);
      await page.waitForTimeout(40);
      const rect = await budget.boundingBox(),
        bar = await page.locator('[data-slot="mobile-tabbar"]').boundingBox();
      assert.ok(
        rect.y >= header.height &&
          rect.y + rect.height <= bar.y + 1 &&
          bar.y - (rect.y + rect.height) <= 32,
        JSON.stringify({ rect, bar }),
      );
    }
    await page
      .locator('[data-slot="viewport"]')
      .evaluate((el) => (el.scrollTop = 0));
    if (process.env.DFPLAN_SCREENSHOT_DIR)
      await page.screenshot({
        path:
          process.env.DFPLAN_SCREENSHOT_DIR +
          `/mobile-budget-${page.viewportSize().width}-${elder}.png`,
      });
    const input = page.locator('[data-quantity="documents"]');
    await input.fill("12");
    const expected = await page.evaluate(async () => {
      const { budgetSummaryMarkup } =
        await import("/dfplan/src/ui/views/digitization.mjs");
      return String(budgetSummaryMarkup());
    });
    assert.ok(expected.includes("已选"));
    assert.match(await budget.innerText(), /已选/);
    const initial = await budget.innerText();
    await page
      .locator('[data-cmd="capture-step"][data-id="photos"][data-delta="1"]')
      .click();
    assert.notEqual(await budget.innerText(), initial);
    await navigate("overview");
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
  }
  // Capturing/clearing audio does not edit task/history data; quantity selections are transient UI state.
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem("deepfamily.dfplan.demo.v1"),
    ),
    before,
  );
  console.log(
    "PASS: 56px header, four-entry drawer, microphone tab, consent reachability, idle/recording controls, live sticky budget and unchanged project storage.",
  );
}
