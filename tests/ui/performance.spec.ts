import { test, expect, type Page } from "@playwright/test";
const url = "http://127.0.0.1:4175/tests/ui/index.html";
async function openWritten(page: Page, large = false) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url + (large ? "?performance" : ""));
  await expect(
    page.getByRole("heading", { name: "Vamos con lo de hoy" }),
  ).toBeVisible();
  await page
    .locator(".ux-bottom-nav")
    .getByRole("button", { name: "Biblioteca", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Buscar biblioteca" })
    .fill("Respuesta escrita:");
  await page.locator(".library-card-row .library-row-main").first().click();
  await expect(
    page.getByRole("textbox", { name: "Tu respuesta" }),
  ).toBeVisible();
}
const state = (page: Page) =>
  page.evaluate(() => (window as any).__opogcQA.state());
async function waitDraft(page: Page, id: string, text: string) {
  await expect
    .poll(() =>
      page.evaluate(
        async ({ id, text }) => {
          const d = await (window as any).__opogcQA.draft(
            "review-draft:ux-fixture-a:" + id,
          );
          return d?.presentation?.writtenAnswer === text;
        },
        { id, text },
      ),
    )
    .toBe(true);
}
test("2200 tarjetas y 4000 repasos: escribir no actualiza la cuenta ni recorre Biblioteca", async ({
  page,
}) => {
  test.setTimeout(90000);
  await openWritten(page, true);
  await expect
    .poll(
      async () => !!(await state(page)).settings.activeCardSession.presentation,
    )
    .toBe(true);
  await page.evaluate(() => (window as any).__opogcQA.resetTimings());
  const t = Date.now();
  await page
    .getByRole("textbox", { name: "Tu respuesta" })
    .pressSequentially("contenido esencial", { delay: 5 });
  expect(Date.now() - t).toBeLessThan(2500);
  const timings = await page.evaluate(() =>
    (window as any).__opogcQA.timings(),
  );
  expect(timings.filter((x: any) => x.kind === "local-update")).toHaveLength(0);
  await page
    .getByRole("button", { name: "Comprobar respuesta", exact: true })
    .click();
  await expect(page.locator(".written-result-summary")).toContainText("100%");
  await page
    .getByRole("button", { name: "Guardar y continuar", exact: true })
    .click();
  await expect(page.locator(".session-result-v12")).toBeVisible();
  expect((await state(page)).reviews).toHaveLength(4001);
});
test("Recarga antes del checkpoint global recupera el último borrador local", async ({
  page,
}) => {
  await openWritten(page);
  const id = (await state(page)).settings.activeCardSession.id;
  await page
    .getByRole("textbox", { name: "Tu respuesta" })
    .fill("Respuesta aún sin sincronizar");
  await waitDraft(page, id, "Respuesta aún sin sincronizar");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Vamos con lo de hoy" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Continuar sesión/ }).click();
  await expect(page.getByRole("textbox", { name: "Tu respuesta" })).toHaveValue(
    "Respuesta aún sin sincronizar",
  );
  expect((await state(page)).reviews).toHaveLength(0);
});
test("Un fallo al guardar la valoración conserva respuesta y permite reintentar sin duplicar historial", async ({
  page,
}) => {
  await openWritten(page);
  await page
    .getByRole("textbox", { name: "Tu respuesta" })
    .fill("contenido esencial");
  await page
    .getByRole("button", { name: "Comprobar respuesta", exact: true })
    .click();
  await expect(page.locator(".written-result-summary")).toContainText("100%");
  await page.evaluate(() => (window as any).__opogcQA.failReviewSaveOnce());
  await page
    .getByRole("button", { name: "Guardar y continuar", exact: true })
    .click();
  await expect(page.getByText(/Fallo de valoración simulado/)).toBeVisible();
  expect((await state(page)).reviews).toHaveLength(0);
  await page
    .getByRole("button", { name: "Guardar y continuar", exact: true })
    .click();
  await expect(page.locator(".session-result-v12")).toBeVisible();
  expect((await state(page)).reviews).toHaveLength(1);
});
test("Elegir varias opciones y comprobar de inmediato utiliza la selección actual", async ({
  page,
}) => {
  await openWritten(page);
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await expect(page.locator(".review-v11")).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Buscar biblioteca" })
    .fill("Test múltiple:");
  await page.locator(".library-card-row .library-row-main").first().click();
  await page.locator(".review-options button").nth(0).click();
  await page.locator(".review-options button").nth(1).click();
  await page.getByRole("button", { name: "Comprobar", exact: true }).click();
  await expect(page.locator(".choice-feedback")).toHaveText("✓ Correcto");
});
test("Escribir durante un checkpoint lento conserva el texto posterior tras recargar", async ({
  page,
}) => {
  await openWritten(page);
  await expect
    .poll(
      async () => !!(await state(page)).settings.activeCardSession.presentation,
    )
    .toBe(true);
  const id = (await state(page)).settings.activeCardSession.id;
  await page.evaluate(() => (window as any).__opogcQA.holdCheckpoint());
  await page
    .getByRole("textbox", { name: "Tu respuesta" })
    .fill("Primer texto");
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__opogcQA.checkpointWaiting()),
    )
    .toBe(true);
  await page
    .getByRole("textbox", { name: "Tu respuesta" })
    .fill("Texto más reciente");
  await waitDraft(page, id, "Texto más reciente");
  await page.evaluate(() => (window as any).__opogcQA.releaseCheckpoint());
  await expect
    .poll(() =>
      page.evaluate(async (id) => {
        const qa = (window as any).__opogcQA,
          d = await qa.draft("review-draft:ux-fixture-a:" + id);
        return (
          d?.presentation.writtenAnswer === "Texto más reciente" &&
          d.base === qa.state().settings["cardSession:" + id].updatedAt
        );
      }, id),
    )
    .toBe(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Vamos con lo de hoy" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Continuar sesión/ }).click();
  await expect(page.getByRole("textbox", { name: "Tu respuesta" })).toHaveValue(
    "Texto más reciente",
  );
});
