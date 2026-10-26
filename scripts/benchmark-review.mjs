import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
const root = process.cwd(),
  require = createRequire(root + "/package.json"),
  { chromium } = require("@playwright/test");
const server = spawn(
  process.execPath,
  [
    root + "/node_modules/vite/bin/vite.js",
    "--config",
    root + "/vite.test.config.ts",
    "--port",
    "4176",
  ],
  { cwd: root, stdio: "ignore" },
);
let browser;
try {
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch("http://127.0.0.1:4176/tests/ui/index.html")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  browser = await chromium.launch({
    ...(process.env.CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE }
      : {}),
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
    headless: true,
  });
  const samples = [];
  for (let n = 0; n < 3; n++) {
    const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
      }),
      page = await ctx.newPage();
    page.setDefaultTimeout(120000);
    console.error("sample", n, "opening");
    await page.goto("http://127.0.0.1:4176/tests/ui/index.html?performance");
    await page.getByRole("heading", { name: "Vamos con lo de hoy" }).waitFor();
    await page
      .locator(".ux-bottom-nav")
      .getByRole("button", { name: "Biblioteca", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Buscar biblioteca" })
      .fill("Respuesta escrita:");
    await page.locator(".library-card-row .library-row-main").first().click();
    console.error("sample", n, "session open");
    const input = page.getByRole("textbox", { name: "Tu respuesta" });
    await input.waitFor();
    await page.waitForTimeout(2200);
    await page.evaluate(() => window.__opogcQA.resetTimings());
    const start = performance.now();
    await input.pressSequentially("contenido esencial", { delay: 10 });
    const typingMs = performance.now() - start;
    console.error("typed", typingMs);
    await page.waitForTimeout(2200);
    const timings = await page.evaluate(() => window.__opogcQA.timings());
    const checkStart = performance.now();
    await page
      .getByRole("button", { name: "Comprobar respuesta", exact: true })
      .click();
    await page.locator(".written-result-summary").waitFor();
    const checkMs = performance.now() - checkStart;
    const saveStart = performance.now();
    await page
      .getByRole("button", { name: "Guardar y continuar", exact: true })
      .click();
    await page.locator(".session-result-v12").waitFor();
    const advanceMs = performance.now() - saveStart;
    samples.push({
      typingMs,
      checkMs,
      advanceMs,
      reactCommits: timings.filter((x) => x.kind === "react").length,
      reactMs: timings
        .filter((x) => x.kind === "react")
        .reduce((s, x) => s + x.ms, 0),
      localUpdates: timings.filter((x) => x.kind === "local-update"),
    });
    await ctx.close();
  }
  fs.writeFileSync(
    process.argv[2] ?? "performance-review.json",
    JSON.stringify(
      { cards: 2200, reviews: 4000, characters: 18, samples },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(samples));
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
