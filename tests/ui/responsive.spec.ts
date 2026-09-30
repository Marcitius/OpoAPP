import { test, expect } from "@playwright/test";
for (const [label, width, height] of [
  ["small-mobile", 320, 568],
  ["iphone", 390, 844],
  ["android", 412, 915],
  ["tablet", 768, 1024],
  ["ipad-landscape", 1024, 768],
  ["laptop", 1366, 768],
  ["desktop", 1920, 1080],
] as const) {
  test(
    label + " — existing application, tree and stable overlays",
    async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("http://127.0.0.1:4174/tests/ui/index.html");
      await expect(
        page.getByRole("heading", { name: "Tu sesión de hoy" }),
      ).toBeVisible();
      const navigation = page.locator(
        width <= 780 ? ".bottom-nav" : ".sidebar",
      );
      await navigation.getByRole("button", { name: /Estudio/ }).click();
      await expect(
        page.getByRole("heading", { name: "Organización de estudio" }),
      ).toBeVisible();
      await expect(
        page
          .getByText("Artículo 164 — Sentencias del Tribunal Constitucional", {
            exact: true,
          })
          .first(),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      ).toBe(true);
      const baseline = await page.evaluate(() => ({
        x: window.scrollX,
        y: window.scrollY,
      }));
      await page
        .getByRole("button", { name: "Importar / actualizar", exact: false })
        .first()
        .click();
      await expect(page.locator(".study-import-modal")).toBeVisible();
      const box = await page.locator(".study-import-modal").boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
      await page.getByRole("button", { name: "Cancelar", exact: true }).click();
      await page.waitForTimeout(80);
      expect(
        await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY })),
      ).toEqual(baseline);
      expect(errors).toEqual([]);
      await page.screenshot({
        path: `test-results/${label}.png`,
        fullPage: true,
      });
    },
  );
}
test("Production PWA manifest, service worker and offline application shell", async ({
  page,
  context,
}) => {
  await page.goto("http://127.0.0.1:3000");
  await expect(
    page.getByRole("heading", { name: "Configura OpoGC" }),
  ).toBeVisible();
  const manifest = await page.evaluate(
    async () => await (await fetch("/manifest.webmanifest")).json(),
  );
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.some((x: any) => x.sizes === "192x192")).toBe(true);
  expect(manifest.icons.some((x: any) => x.sizes === "512x512")).toBe(true);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await page.waitForTimeout(500);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Configura OpoGC" }),
  ).toBeVisible();
  await context.setOffline(false);
});
