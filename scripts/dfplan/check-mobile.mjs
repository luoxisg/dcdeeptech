/** Browser-only QA dependency: PLAYWRIGHT_MODULE may point to an external installation. */
import assert from "node:assert/strict";
import { checkTranscription } from "./transcription-browser-check.mjs";
import { checkMobileLayout } from "./mobile-layout-browser-check.mjs";
import { checkRecording } from "./recording-browser-check.mjs";
import { checkInterview } from "./interview-browser-check.mjs";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_MODULE || "playwright",
);
const root = resolve(import.meta.dirname, "../..");
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, "http://localhost").pathname;
    if (path === "/favicon.ico") {
      res.writeHead(204).end();
      return;
    }
    const file = resolve(
      root,
      "." + path + (path.endsWith("/") ? "index.html" : ""),
    );
    if (!path.startsWith("/dfplan/") || !file.startsWith(root + "/dfplan/")) {
      res.writeHead(404).end();
      return;
    }
    res.setHeader(
      "Content-Type",
      {
        ".mjs": "text/javascript",
        ".js": "text/javascript",
        ".html": "text/html",
        ".css": "text/css",
        ".svg": "image/svg+xml",
      }[extname(file)] || "application/octet-stream",
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});
const errors = [],
  network = [],
  modules = new Map();
try {
  for (const width of [375, 390]) {
    const height = width === 375 ? 812 : 844;
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
      acceptDownloads: true,
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400)
        errors.push(response.url() + " " + response.status());
      const url = new URL(response.url());
      if (url.pathname.endsWith(".mjs")) {
        const values = modules.get(url.pathname) || new Set();
        values.add(url.search);
        modules.set(url.pathname, values);
      }
    });
    await page.route("**/*", (route) => {
      if (new URL(route.request().url()).origin !== base) {
        network.push(route.request().url());
        return route.abort();
      }
      return route.continue();
    });
    await page.addInitScript(() =>
      localStorage.setItem(
        "deepfamily.dfplan.v1",
        "LIVE_SENTINEL_DO_NOT_TOUCH",
      ),
    );
    await page.goto(base + "/dfplan/?demo=1");
    await page.locator(".weekly-focus").waitFor();
    await checkMobileLayout(page);
    const navigate = async (view) => {
      await page.evaluate(async (view) => {
        const { commands } =
          await import("/dfplan/src/application/command-bus.mjs");
        const viewport = document.querySelector('[data-slot="viewport"]');
        await commands.run("navigate", { view, scrollTop: viewport.scrollTop });
      }, view);
      await page.waitForFunction(
        (view) =>
          document
            .querySelector("[data-current-view]")
            ?.getAttribute("data-current-view") === view,
        view,
      );
      await page.waitForTimeout(100);
    };
    const dimensions = async (min) => {
      const problems = await page.evaluate((min) => {
        const visible = (e) =>
          !!e.getClientRects().length &&
          getComputedStyle(e).visibility !== "hidden";
        const region = document.querySelector("dialog[open]") || document.body;
        return {
          overflow:
            document.documentElement.scrollWidth > innerWidth ||
            document.querySelector('[data-slot="viewport"]').scrollWidth >
              innerWidth,
          small: [
            ...region.querySelectorAll(
              "button,input,select,textarea,a.btn,summary",
            ),
          ]
            .filter(visible)
            .map((e) => ({
              label:
                e.getAttribute("aria-label") ||
                e.textContent.trim().slice(0, 50),
              width: e.getBoundingClientRect().width,
              height: e.getBoundingClientRect().height,
            }))
            .filter((e) => e.width < min - 0.5 || e.height < min - 0.5),
        };
      }, min);
      assert.equal(problems.overflow, false, JSON.stringify(problems));
      assert.deepEqual(problems.small, []);
    };
    for (const elder of [true, false]) {
      if (!elder) await page.locator('[data-cmd="text-scale"]').click();
      for (const view of [
        "overview",
        "board",
        "list",
        "timeline",
        "history",
        "dashboard",
        "people",
        "interview",
        "facts",
        "security",
        "digitization",
      ]) {
        await navigate(view);
        await dimensions(elder ? 54 : 48);
      }
      await page.locator(".site-menu > summary").click();
      await page.locator('[data-cmd="language"]').click();
      await dimensions(elder ? 54 : 48);
      assert.equal(await page.locator(".capture-item").count(), 12);
      const quantity = page.locator('[data-quantity="documents"]');
      await quantity.fill("1234");
      assert.equal(await quantity.inputValue(), "1234");
      assert.equal(
        await quantity.evaluate((e) => e === document.activeElement),
        true,
      );
      await page.locator(".site-menu > summary").click();
      await page.locator('[data-cmd="language"]').click();
    }
    await navigate("overview");
    await page.locator('[data-cmd="text-scale"]').click();
    await page.evaluate(
      () => (document.querySelector('[data-slot="viewport"]').scrollTop = 250),
    );
    await navigate("list");
    await navigate("overview");
    assert.equal(
      await page
        .locator('[data-slot="viewport"]')
        .evaluate((e) => Math.round(e.scrollTop)),
      250,
    );
    await page.locator('.weekly-focus [data-cmd="editor"]').first().click();
    await page.locator("dialog[open]").waitFor();
    const title = page.locator('dialog input[name="title"]');
    await title.fill("手机输入焦点测试");
    await page.evaluate(async () => {
      const { store } = await import("/dfplan/src/application/store.mjs");
      store.update({ message: "background update", busy: true });
      store.update({ busy: false });
    });
    assert.equal(await title.inputValue(), "手机输入焦点测试");
    assert.equal(
      await title.evaluate((e) => e === document.activeElement),
      true,
    );
    // Simulate the visualViewport shrinking when an on-screen keyboard opens.
    await page.evaluate(() => {
      Object.defineProperty(window.visualViewport, "height", {
        configurable: true,
        value: 420,
      });
      window.visualViewport.dispatchEvent(new Event("resize"));
    });
    await page.waitForTimeout(80);
    const footer = await page.locator("dialog .sheet-actions").boundingBox();
    assert.ok(footer.y + footer.height <= 421, JSON.stringify(footer));
    assert.equal(
      await title.evaluate((e) => e === document.activeElement),
      true,
    );
    await dimensions(54);
    await page.evaluate(() => {
      delete window.visualViewport.height;
      window.visualViewport.dispatchEvent(new Event("resize"));
    });
    await page.locator('dialog [data-cmd="close"]').first().click();
    for (const kind of ["start", "import", "account"]) {
      await page.evaluate(async (kind) => {
        const { commands } =
          await import("/dfplan/src/application/command-bus.mjs");
        await commands.run(kind, {});
      }, kind);
      await page.locator("dialog[open]").waitFor();
      await dimensions(54);
      await page.locator('dialog [data-cmd="close"]').first().click();
    }
    await checkInterview(page);
    await checkRecording(page);
    await checkTranscription(page);
    await navigate("facts");
    await page.locator('[data-cmd="assertion"]').first().click();
    await page
      .locator('dialog textarea[name="text"]')
      .fill("演示事实 <img src=x onerror=alert(1)>");
    await page.locator('dialog input[name="source"]').fill("DEMO-REF");
    await page.locator('dialog button[type="submit"]').click();
    await page.locator(".assertion-card").waitFor();
    assert.equal(await page.locator(".assertion-card img").count(), 0);
    await page
      .locator('[data-cmd="fact-status"][data-status="confirmed"]')
      .click();
    await page.waitForTimeout(80);
    await dimensions(54);
    await page
      .locator('[data-cmd="fact-status"][data-status="conflict"]')
      .click();
    await page.waitForTimeout(80);
    await page.locator('[data-cmd="fact-note"]').click();
    await page.locator('dialog textarea[name="note"]').fill("保留不同说法");
    await page.locator('dialog button[type="submit"]').click();
    await page.locator(".assertion-card").waitFor();
    await page.waitForFunction(() =>
      document
        .querySelector(".assertion-card")
        ?.textContent.includes("保留不同说法"),
    );
    await navigate("history");
    for (const format of ["json", "csv"]) {
      const download = page.waitForEvent("download");
      await page.locator('[data-cmd="export-' + format + '"]').click();
      const file = await download;
      assert.ok((await file.path()).length > 0);
    }
    assert.equal(
      await page.evaluate(() => localStorage.getItem("deepfamily.dfplan.v1")),
      "LIVE_SENTINEL_DO_NOT_TOUCH",
    );
    await navigate("people");
    assert.equal(await page.locator('[data-cmd="dashboard-focus"]').count(), 5);
    console.log(
      "PASS " +
        width +
        "x" +
        height +
        ": routes, EN/ZH, 48/54px, overflow, scroll, keyboard simulation, facts, exports, demo isolation",
    );
    await context.close();
  }
  assert.deepEqual(
    network,
    [],
    "Demo must not contact Firebase or external services.",
  );
  assert.deepEqual(errors, []);
  for (const [url, versions] of modules)
    assert.equal(versions.size, 1, "Duplicate ESM " + url);
  console.log(
    "PASS: one URL per module; no browser errors or external requests.",
  );
} finally {
  await browser.close();
  server.close();
}
