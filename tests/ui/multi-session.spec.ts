import { test, expect, type Page } from "@playwright/test";
const url = "http://127.0.0.1:4175/tests/ui/index.html";
async function open(page: Page, width = 390, height = 844) {
  await page.setViewportSize({ width, height });
  await page.goto(url);
  await expect(
    page.getByRole("heading", { name: "Vamos con lo de hoy" }),
  ).toBeVisible();
}
async function nav(page: Page, name: string) {
  await page
    .locator(
      (page.viewportSize()?.width ?? 390) >= 1000
        ? ".ux-sidebar"
        : ".ux-bottom-nav",
    )
    .getByRole("button", { name, exact: true })
    .click();
}
async function state(page: Page) {
  return page.evaluate(() => (window as any).__opogcQA.state());
}
async function receive(page: Page, snapshot: any) {
  await page.evaluate((s) => (window as any).__opogcQA.receive(s), snapshot);
}
async function pause(page: Page) {
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await expect(page.locator(".review-v11")).toHaveCount(0);
}
async function newCard(page: Page, query: string) {
  await nav(page, "Biblioteca");
  await page.getByRole("textbox", { name: "Buscar biblioteca" }).fill(query);
  await page.locator(".library-card-row .library-row-main").first().click();
  await expect(page.locator(".review-v11")).toBeVisible();
}
async function sessionList(page: Page, count = 2) {
  await page.getByRole("button", { name: `Ver las ${count} sesiones` }).click();
  const sheet = page.getByRole("dialog", {
    name: "Sesiones guardadas",
    exact: true,
  });
  await expect(sheet.locator(".resume-session")).toHaveCount(count);
  expect(
    await page.evaluate(() =>
      document.activeElement?.matches("input,textarea,[contenteditable=true]"),
    ),
  ).toBe(false);
  return sheet;
}
async function resume(page: Page, id: string) {
  const sheet = await sessionList(page);
  await sheet.locator(`[data-session-id="${id}"] .resume-session-main`).click();
}
for (const [width, height] of [
  [360, 800],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1366, 768],
  [1920, 1080],
]) {
  test(`Varias sesiones: crear, retomar, cerrar una y conservar otra ${width}x${height}`, async ({
    page,
  }) => {
    await open(page, width, height);
    await newCard(page, "Artículo 53");
    await page
      .getByRole("button", { name: "Mostrar respuesta", exact: true })
      .click();
    await pause(page);
    const first = (await state(page)).settings.activeCardSession.id;
    await newCard(page, "Respuesta escrita:");
    await page
      .getByRole("textbox", { name: "Tu respuesta" })
      .fill("Mi borrador pendiente");
    await pause(page);
    const second = (await state(page)).settings.activeCardSession.id;
    expect(first).not.toBe(second);
    await nav(page, "Repasar");
    const sheet = await sessionList(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
    await sheet
      .locator(`[data-session-id="${first}"] .resume-session-main`)
      .click();
    await expect(page.locator(".review-prompt")).toContainText("Artículo 53");
    await expect(page.locator(".review-answer-text")).toBeVisible();
    await pause(page);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Vamos con lo de hoy" }),
    ).toBeVisible();
    await resume(page, second);
    await expect(
      page.getByRole("textbox", { name: "Tu respuesta" }),
    ).toHaveValue("Mi borrador pendiente");
    await pause(page);
    const list = await sessionList(page);
    await list
      .locator(`[data-session-id="${first}"]`)
      .getByRole("button", { name: "Finalizar", exact: true })
      .click();
    const confirm = page.getByRole("dialog", {
      name: "¿Finalizar esta sesión?",
      exact: true,
    });
    await expect(confirm).toContainText("Solo se cerrará esta sesión");
    await confirm
      .getByRole("button", { name: "Finalizar sesión", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          !!(await state(page)).settings["closedCardSession:" + first],
      )
      .toBe(true);
    await expect(page.locator(".saved-sessions .resume-session")).toHaveCount(
      1,
    );
    expect(
      (await state(page)).settings["cardSession:" + second].presentation
        .writtenAnswer,
    ).toBe("Mi borrador pendiente");
    expect((await state(page)).reviews).toHaveLength(0);
    await page.locator(".saved-sessions .resume-session-main").click();
    await expect(
      page.getByRole("textbox", { name: "Tu respuesta" }),
    ).toHaveValue("Mi borrador pendiente");
  });
}
test("Dos sesiones offline conservan progreso y borrador después de reabrir", async ({
  page,
  context,
}) => {
  await open(page);
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await page
    .getByRole("button", { name: /Repasar ahora/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Mostrar respuesta", exact: true })
    .click();
  await page.getByRole("button", { name: "Bien", exact: true }).click();
  await expect(page.locator(".review-prompt")).toContainText("Artículo 164");
  await pause(page);
  const first = (await state(page)).settings.activeCardSession.id;
  await newCard(page, "Respuesta escrita:");
  await page
    .getByRole("textbox", { name: "Tu respuesta" })
    .fill("Borrador sin conexión");
  await pause(page);
  const second = (await state(page)).settings.activeCardSession.id;
  expect(
    (await page.evaluate(() => (window as any).__opogcQA.account())).queue
      .length,
  ).toBeGreaterThan(0);
  await context.setOffline(false);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Vamos con lo de hoy" }),
  ).toBeVisible();
  await resume(page, first);
  await expect(page.locator(".review-prompt")).toContainText("Artículo 164");
  await pause(page);
  await resume(page, second);
  await expect(page.getByRole("textbox", { name: "Tu respuesta" })).toHaveValue(
    "Borrador sin conexión",
  );
  expect((await state(page)).reviews).toHaveLength(1);
});
test("Dos dispositivos simulados: trabajar en otra sesión no interrumpe la abierta; cerrar una no cierra otra", async ({
  browser,
}) => {
  const ca = await browser.newContext(),
    cb = await browser.newContext();
  const a = await ca.newPage(),
    b = await cb.newPage();
  try {
    await open(a, 1366, 768);
    await open(b);
    await a
      .getByRole("button", { name: /Repasar ahora/ })
      .first()
      .click();
    await a
      .getByRole("button", { name: "Mostrar respuesta", exact: true })
      .click();
    await pause(a);
    const first = (await state(a)).settings.activeCardSession.id;
    await receive(b, await state(a));
    await a.locator(".saved-sessions .resume-session-main").click();
    await expect(a.locator(".review-prompt")).toContainText("Artículo 53");
    await newCard(b, "Respuesta escrita:");
    await b
      .getByRole("textbox", { name: "Tu respuesta" })
      .fill("Ley 40 pendiente");
    await pause(b);
    const second = (await state(b)).settings.activeCardSession.id;
    await receive(a, await state(b));
    await expect(a.locator(".review-v11")).toBeVisible();
    await expect(a.locator(".review-prompt")).toContainText("Artículo 53");
    await a.getByRole("button", { name: "Bien", exact: true }).click();
    await expect(a.locator(".review-prompt")).toContainText("Artículo 164");
    await pause(a);
    await receive(b, await state(a));
    await resume(b, first);
    await expect(b.locator(".review-prompt")).toContainText("Artículo 164");
    await pause(b);
    await resume(a, second);
    await expect(a.getByRole("textbox", { name: "Tu respuesta" })).toHaveValue(
      "Ley 40 pendiente",
    );
    const list = await sessionList(b);
    await list
      .locator(`[data-session-id="${first}"]`)
      .getByRole("button", { name: "Finalizar", exact: true })
      .click();
    await b
      .getByRole("dialog")
      .getByRole("button", { name: "Finalizar sesión", exact: true })
      .click();
    await expect
      .poll(
        async () => !!(await state(b)).settings["closedCardSession:" + first],
      )
      .toBe(true);
    await receive(a, await state(b));
    await expect(a.locator(".review-v11")).toBeVisible();
    await expect(a.getByRole("textbox", { name: "Tu respuesta" })).toHaveValue(
      "Ley 40 pendiente",
    );
    expect((await state(a)).reviews).toHaveLength(1);
  } finally {
    await ca.close();
    await cb.close();
  }
});
