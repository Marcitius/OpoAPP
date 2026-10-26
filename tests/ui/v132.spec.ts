import { test, expect, type Page } from "@playwright/test";
const url = "http://127.0.0.1:4175/tests/ui/index.html";
async function open(page: Page, params = "", width = 390, height = 844) {
  await page.setViewportSize({ width, height });
  await page.goto(url + params);
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
async function grade(page: Page, label: string) {
  await page
    .getByRole("button", { name: "Mostrar respuesta", exact: true })
    .click();
  await page.getByRole("button", { name: label, exact: true }).click();
}
async function libraryCard(page: Page, query: string) {
  await nav(page, "Biblioteca");
  await page.getByRole("textbox", { name: "Buscar biblioteca" }).fill(query);
  await page.locator(".library-card-row .library-row-main").first().click();
}
async function pause(page: Page) {
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await expect(page.locator(".review-v11")).toHaveCount(0);
}
async function noKeyboard(page: Page) {
  expect(
    await page.evaluate(() =>
      document.activeElement?.matches(
        "input,textarea,select,[contenteditable=true]",
      ),
    ),
  ).toBe(false);
}

test("Biblioteca está a una pulsación y el temario sigue en Más", async ({
  page,
}) => {
  await open(page);
  await expect(page.locator(".ux-bottom-nav button")).toHaveText([
    "Hoy",
    "Biblioteca",
    "Repasar",
    "Progreso",
    "Más",
  ]);
  await nav(page, "Biblioteca");
  await expect(
    page.getByRole("textbox", { name: "Buscar biblioteca" }),
  ).toBeVisible();
  await nav(page, "Más");
  await page.getByRole("button", { name: /Temario y planificación/ }).click();
  await expect(
    page.getByRole("textbox", { name: "Buscar tema o apartado" }),
  ).toBeVisible();
});
test("69 seleccionadas: una pausa larga no devuelve Bien ni bloquea las nuevas", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.clock.install({ time: new Date("2026-10-20T10:00:00Z") });
  await open(page, "?bulk&session69");
  await page
    .getByRole("button", { name: /Repasar ahora/ })
    .first()
    .click();
  await grade(page, "Otra vez");
  await page.clock.fastForward(300000);
  for (let i = 2; i <= 9; i++) {
    await expect(page.locator(".review-prompt")).toHaveText(
      "Repaso consecutivo " + i,
    );
    await grade(page, "Bien");
  }
  await expect(page.locator(".review-prompt")).toHaveText(
    "Repaso consecutivo 1",
  );
  await expect(page.locator(".immersion-header")).toContainText(
    "9 / 69 vistas",
  );
  await grade(page, "Bien");
  for (let i = 10; i <= 69; i++) {
    await expect(page.locator(".review-prompt")).toHaveText(
      "Repaso consecutivo " + i,
    );
    if (i === 20) await page.clock.fastForward(600000);
    await grade(page, "Bien");
  }
  await expect(page.locator(".session-result-v12")).toBeVisible();
  const s = await state(page);
  expect(s.reviews).toHaveLength(70);
  expect(
    s.settings.activeCardSession.items.every(
      (i: any) => i.status === "remembered",
    ),
  ).toBe(true);
  expect(
    s.cards.find((c: any) => c.id === "bulk-0").fsrsReps,
  ).toBeGreaterThanOrEqual(2);
});
test("Salir conserva tarjeta y cara; recargar y continuar desde Biblioteca no reinicia", async ({
  page,
  context,
}) => {
  await open(page, "?learning");
  await page
    .getByRole("button", { name: /Repaso libre|Repasar ahora/ })
    .first()
    .click();
  await grade(page, "Bien");
  await expect(page.locator(".review-prompt")).toContainText("Artículo 164");
  await page
    .getByRole("button", { name: "Mostrar respuesta", exact: true })
    .click();
  await context.setOffline(true);
  await pause(page);
  const before = await state(page);
  expect(before.settings.activeCardSession.presentation.revealed).toBe(true);
  expect(
    before.settings.activeCardSession.presentation.queue[
      before.settings.activeCardSession.presentation.index
    ].cardId,
  ).toBe("basic2");
  await context.setOffline(false);
  await page.reload();
  await nav(page, "Biblioteca");
  await page.getByRole("button", { name: /Continuar sesión/ }).click();
  await expect(page.locator(".review-prompt")).toContainText("Artículo 164");
  await expect(page.locator(".review-answer-text")).toBeVisible();
  await noKeyboard(page);
  expect((await state(page)).reviews).toEqual(before.reviews);
  await page.getByRole("button", { name: "Bien", exact: true }).click();
  await expect(page.locator(".review-prompt")).toContainText(
    "Concepto de repaso 3",
  );
});
for (const query of ["Respuesta escrita:", "Test múltiple:"])
  test("Borrador y selección se conservan: " + query, async ({ page }) => {
    await open(page);
    await libraryCard(page, query);
    if (query.startsWith("Respuesta"))
      await page
        .getByRole("textbox", { name: "Tu respuesta" })
        .fill("contenido pendiente");
    else {
      await page.locator(".review-options button").nth(0).click();
      await page.locator(".review-options button").nth(1).click();
    }
    await pause(page);
    await page.reload();
    await page.getByRole("button", { name: /Continuar sesión/ }).click();
    await noKeyboard(page);
    if (query.startsWith("Respuesta"))
      await expect(
        page.getByRole("textbox", { name: "Tu respuesta" }),
      ).toHaveValue("contenido pendiente");
    else
      await expect(page.locator(".review-options button.selected")).toHaveCount(
        2,
      );
    expect((await state(page)).reviews).toHaveLength(0);
  });
test("Empezar otra selección conserva ambas sesiones y permite retomar la anterior", async ({
  page,
}) => {
  await open(page);
  await libraryCard(page, "Artículo 53");
  await pause(page);
  const old = (await state(page)).settings.activeCardSession;
  await libraryCard(page, "Artículo 164");
  await expect(page.locator(".review-prompt")).toContainText("Artículo 164");
  const next = await state(page);
  expect(next.settings.activeCardSession.id).not.toBe(old.id);
  expect(next.settings["cardSession:" + old.id].items).toEqual(old.items);
  expect(next.settings["closedCardSession:" + old.id]).toBeUndefined();
  await pause(page);
  await page.getByRole("button", { name: "Ver las 2 sesiones" }).click();
  const dialog = page.getByRole("dialog", { name: "Sesiones guardadas" });
  await expect(dialog.locator(".resume-session")).toHaveCount(2);
  await noKeyboard(page);
  await dialog
    .locator(`[data-session-id="${old.id}"] .resume-session-main`)
    .click();
  await expect(page.locator(".review-prompt")).toContainText("Artículo 53");
  expect((await state(page)).reviews).toHaveLength(0);
});
test("Una vuelta completada permanece hasta Finalizar; una débil no se presenta como aprendida", async ({
  page,
}) => {
  await open(page);
  await libraryCard(page, "Artículo 53");
  await grade(page, "Otra vez");
  await expect(page.locator(".session-result-v12")).toBeVisible();
  await expect(page.locator(".session-result-counts")).toContainText(
    "1A reforzar",
  );
  await page.getByRole("button", { name: "Salir y conservar sesión" }).click();
  await expect(page.locator(".session-result-v12")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: /Continuar sesión/ }).click();
  await expect(page.locator(".session-result-v12")).toBeVisible();
  await page
    .getByRole("button", { name: "Finalizar sesión", exact: true })
    .click();
  await expect(page.locator(".resume-session")).toHaveCount(0);
  await expect
    .poll(async () => (await state(page)).settings.activeCardSession)
    .toBeNull();
  expect((await state(page)).reviews).toHaveLength(1);
});
test("Dos dispositivos simulados: traspaso exacto y cierre remoto sin duplicar la valoración", async ({
  browser,
}) => {
  const desktop = await browser.newContext({
      viewport: { width: 1366, height: 768 },
    }),
    mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
  const a = await desktop.newPage(),
    b = await mobile.newPage();
  try {
    await open(a, "", 1366, 768);
    await open(b);
    await a
      .getByRole("button", { name: /Repasar ahora/ })
      .first()
      .click();
    await grade(a, "Bien");
    await expect(a.locator(".review-prompt")).toContainText("Artículo 164");
    await a
      .getByRole("button", { name: "Mostrar respuesta", exact: true })
      .click();
    await pause(a);
    const fromA = await state(a);
    expect(
      fromA.settings.activeCardSession.presentation.queue[
        fromA.settings.activeCardSession.presentation.index
      ].cardId,
    ).toBe("basic2");
    await b.evaluate(
      (snapshot) => (window as any).__opogcQA.receive(snapshot),
      fromA,
    );
    await b.getByRole("button", { name: /Continuar sesión/ }).click();
    await expect(b.locator(".review-prompt")).toContainText("Artículo 164");
    await expect(b.locator(".review-answer-text")).toBeVisible();
    await noKeyboard(b);
    await b.getByRole("button", { name: "Bien", exact: true }).click();
    await pause(b);
    const fromB = await state(b);
    await a.evaluate(
      (snapshot) => (window as any).__opogcQA.receive(snapshot),
      fromB,
    );
    await a.getByRole("button", { name: /Continuar sesión/ }).click();
    await expect(a.locator(".review-prompt")).toHaveText(
      "Concepto de repaso 3",
    );
    expect((await state(a)).reviews).toHaveLength(2);
    // A remote close also dismisses an already open, stale session on A.
    await b
      .locator(".resume-session")
      .getByRole("button", { name: "Finalizar", exact: true })
      .click();
    await b
      .getByRole("dialog")
      .getByRole("button", { name: "Finalizar sesión", exact: true })
      .click();
    await expect
      .poll(async () => (await state(b)).settings.activeCardSession)
      .toBeNull();
    await a.evaluate(
      (snapshot) => (window as any).__opogcQA.receive(snapshot),
      await state(b),
    );
    await expect(a.locator(".review-v11")).toHaveCount(0);
    expect((await state(a)).settings.activeCardSession).toBeNull();
  } finally {
    await desktop.close();
    await mobile.close();
  }
});
