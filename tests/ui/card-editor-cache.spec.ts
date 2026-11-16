import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test("Producción: el editor se carga bajo demanda y su código está disponible offline en la PWA", async ({
  page,
  context,
}) => {
  const root = path.resolve("out/_next/static/chunks");
  const scripts = fs
    .readdirSync(root, { recursive: true })
    .map(String)
    .filter((name) => name.endsWith(".js"));
  const editor = scripts.filter((name) =>
    fs.readFileSync(path.join(root, name), "utf8").includes("Pegar Markdown"),
  );
  expect(editor).toHaveLength(1);
  const url = "/_next/static/chunks/" + editor[0].split(path.sep).join("/");
  const html = fs.readFileSync("out/index.html", "utf8");
  const initial = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(
    (match) => match[1],
  );
  expect(initial).not.toContain(url);
  await page.goto("http://127.0.0.1:3001");
  await expect(
    page.getByRole("heading", { name: "Configura OpoGC" }),
  ).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  const cached = await page.evaluate(async (url) => {
    const response = await fetch(url, { cache: "no-store" });
    return { status: response.status, text: await response.text() };
  }, url);
  expect(cached.status).toBe(200);
  expect(cached.text).toContain("Pegar Markdown");
  const dependencies = await page.evaluate(
    async (urls) =>
      Promise.all(
        urls.map(async (url) => {
          const response = await fetch(url, { cache: "no-store" });
          return response.status;
        }),
      ),
    scripts.map(
      (name) => "/_next/static/chunks/" + name.split(path.sep).join("/"),
    ),
  );
  expect(dependencies.every((status) => status === 200)).toBe(true);
  await context.setOffline(false);
});
