/** Opt-in real Whisper inference, not mocked SpeechRecognition. Public test audio only.
 * ASR_FIXTURE=/path/chinese.webm ASR_EXPECT='快乐' node scripts/dfplan/check-local-asr-browser.mjs
 * Downloads pinned public assets (~70 MB); never run automatically in normal CI.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname, basename } from "node:path";
const fixture = process.env.ASR_FIXTURE;
if (!fixture)
  throw Error("ASR_FIXTURE must name a public/non-sensitive speech fixture");
const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_MODULE || "playwright",
);
const root = resolve(import.meta.dirname, "../..");
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, "http://localhost").pathname;
    const file = resolve(
      root,
      "." + path + (path.endsWith("/") ? "index.html" : ""),
    );
    if (!file.startsWith(root + "/dfplan/")) {
      res.writeHead(404).end();
      return;
    }
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".mjs": "text/javascript",
        ".js": "text/javascript",
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
const proxyURL = process.env.HTTPS_PROXY || process.env.https_proxy;
const u = proxyURL ? new URL(proxyURL) : null;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
  ...(u
    ? {
        proxy: {
          server: u.origin,
          bypass: "127.0.0.1,localhost",
          ...(u.username
            ? {
                username: decodeURIComponent(u.username),
                password: decodeURIComponent(u.password),
              }
            : {}),
        },
      }
    : {}),
});
try {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    ignoreHTTPSErrors: !!u,
    acceptDownloads: true,
  });
  const page = await context.newPage(),
    requests = [],
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) =>
    requests.push({
      method: r.method(),
      url: new URL(r.url()).origin + new URL(r.url()).pathname,
    }),
  );
  await page.goto(base + "/dfplan/?demo=1");
  await page.locator('[data-cmd="voice-open"]:visible').first().click();
  const before = await page.evaluate(() =>
    localStorage.getItem("deepfamily.dfplan.demo.v1"),
  );
  assert.equal(
    requests.some((r) =>
      /huggingface.co|jsdelivr.net.*transformers/.test(r.url),
    ),
    false,
    "model must be lazy",
  );
  await page.locator("[data-import-audio]").setInputFiles(fixture);
  await page.locator("dialog[open]").waitFor();
  assert.match(
    await page.locator("[data-transcript-summary]").textContent(),
    /未获得/,
  );
  await page
    .locator("[data-local-language]")
    .selectOption(process.env.ASR_LANGUAGE || "zh-CN");
  const started = Date.now();
  await page.locator('[data-recording="local-transcribe"]').click();
  await page.waitForFunction(
    () =>
      document.querySelector("[data-recording-transcript]")?.value?.trim() ||
      document
        .querySelector("[data-local-status]")
        ?.textContent?.includes("失败"),
    {},
    { timeout: 600000 },
  );
  const text = await page.locator("[data-recording-transcript]").inputValue();
  assert.ok(
    text.trim(),
    await page.locator("[data-local-status]").textContent(),
  );
  if (process.env.ASR_EXPECT)
    assert.match(text, new RegExp(process.env.ASR_EXPECT));
  assert.equal(
    requests.some((r) => !["GET", "HEAD"].includes(r.method)),
    false,
    "audio must not be uploaded",
  );
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem("deepfamily.dfplan.demo.v1"),
    ),
    before,
    "family/demo project unchanged",
  );
  for (const [width, height, elder] of [
    [375, 812, true],
    [390, 844, false],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(
      (elder) =>
        (document.documentElement.dataset.textScale = elder
          ? "elder"
          : "standard"),
      elder,
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "no document overflow",
    );
    const bad = await page
      .locator("dialog[open] button:visible,dialog[open] select:visible")
      .evaluateAll(
        (nodes, min) =>
          nodes
            .filter(
              (n) =>
                n.getBoundingClientRect().height < min ||
                n.getBoundingClientRect().width < min,
            )
            .map((n) => n.textContent),
        elder ? 54 : 48,
      );
    assert.deepEqual(bad, []);
  }
  const editor = page.locator("[data-recording-transcript]");
  await editor.fill(text + "（人工核对）");
  assert.equal(
    await editor.evaluate((el) => document.activeElement === el),
    true,
  );
  assert.equal(
    await page.locator('[data-recording="local-transcribe"]').isDisabled(),
    true,
    "manual edit protected",
  );
  const exported = page.waitForEvent("download");
  await page.locator('[data-recording="notes"]').click();
  const download = await exported;
  const body = await readFile(await download.path(), "utf8");
  assert.ok(body.includes(text));
  assert.ok(body.includes("人工核对"));
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      status: "REAL_ASR_UI_PASS",
      fixture: basename(fixture),
      text,
      elapsedSeconds: Math.round((Date.now() - started) / 1000),
      requests: requests.length,
      audioUploaded: false,
      mobileWidths: [375, 390],
    }),
  );
  await context.close();
} finally {
  await browser.close();
  server.close();
}
