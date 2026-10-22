import { test, expect, type Page } from "@playwright/test";
const url = "http://127.0.0.1:4175/tests/ui/index.html";
async function open(p: Page, w = 390, h = 844) {
  await p.setViewportSize({ width: w, height: h });
  await p.goto(url);
  await expect(
    p.getByRole("heading", { name: "Vamos con lo de hoy" }),
  ).toBeVisible();
}
async function state(p: Page) {
  return p.evaluate(() => (window as any).__opogcQA.state());
}
async function nav(p: Page, name: string) {
  if (name === "Estudiar") {
    await nav(p, "Más");
    await p.getByRole("button", { name: /Temario y planificación/ }).click();
    return;
  }
  await p
    .locator(
      (p.viewportSize()?.width ?? 390) >= 1000
        ? ".ux-sidebar"
        : ".ux-bottom-nav",
    )
    .getByRole("button", { name, exact: true })
    .click();
}
async function noKeyboard(p: Page) {
  expect(
    await p.evaluate(() =>
      document.activeElement?.matches(
        "input,textarea,select,[contenteditable=true]",
      ),
    ),
  ).toBe(false);
}
async function saveRegular(p: Page) {
  await p
    .getByRole("button", { name: /Repasar ahora/ })
    .first()
    .click();
  await p
    .getByRole("button", { name: "Guardar para repasar", exact: true })
    .click();
  await p
    .getByRole("dialog")
    .getByRole("button", { name: "Regular", exact: true })
    .click();
  await p
    .getByRole("dialog")
    .getByRole("button", { name: "Continuar", exact: true })
    .click();
  await p.getByRole("button", { name: "Opciones del repaso" }).click();
  await p
    .getByRole("button", { name: "Finalizar sesión", exact: true })
    .click();
  await p
    .getByRole("dialog")
    .getByRole("button", { name: "Finalizar sesión", exact: true })
    .click();
  await nav(p, "Repasar");
  await p
    .locator(".review-collections")
    .getByRole("button", { name: /^Regular\s/ })
    .click();
}
for (const [w, h] of [
  [390, 844],
  [1366, 768],
])
  test(`Editar en directo sin valorar ni avanzar, persistir y continuar ${w}`, async ({
    page,
    context,
  }) => {
    await open(page, w, h);
    await page
      .getByRole("button", { name: /Repasar ahora/ })
      .first()
      .click();
    await expect(page.locator(".review-v11")).toBeVisible();
    const before = await state(page);
    await page
      .getByRole("button", { name: "Mostrar respuesta", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Opciones del repaso", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Editar tarjeta", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Editar tarjeta",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await noKeyboard(page);
    await context.setOffline(true);
    await dialog
      .getByRole("textbox", { name: "Escribe la pregunta", exact: true })
      .fill("Pregunta corregida en directo");
    await dialog
      .getByRole("textbox", { name: /Puedes escribir una respuesta/ })
      .fill("Respuesta corregida sin perder memoria");
    await dialog
      .getByRole("button", { name: "Guardar cambios", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator(".review-prompt")).toHaveText(
      "Pregunta corregida en directo",
    );
    const after = await state(page);
    expect(after.reviews).toEqual(before.reviews);
    expect(after.settings.activeCardSession.id).toBe(
      before.settings.activeCardSession.id,
    );
    expect(after.settings.activeCardSession.history).toEqual(
      before.settings.activeCardSession.history,
    );
    expect(
      after.settings.activeCardSession.items.map(({ seen, ...i }: any) => i),
    ).toEqual(
      before.settings.activeCardSession.items.map(({ seen, ...i }: any) => i),
    );
    const old = before.cards.find((c: any) => c.id === "basic1"),
      edited = after.cards.find((c: any) => c.id === "basic1");
    expect({ ...edited, front: old.front, back: old.back }).toEqual(old);
    await page.getByRole("button", { name: "Salir", exact: true }).click();
    await context.setOffline(false);
    await page.reload();
    await nav(page, "Estudiar");
    await page
      .getByRole("button", { name: /Retomar sesión de tarjetas/ })
      .click();
    await expect(page.locator(".review-prompt")).toHaveText(
      "Pregunta corregida en directo",
    );
    // Editing the prompt intentionally resets the face and draft in v13.1.
    await page
      .getByRole("button", { name: "Mostrar respuesta", exact: true })
      .click();
    await expect(page.locator(".review-answer-text")).toHaveText(
      "Respuesta corregida sin perder memoria",
    );
    await page.getByRole("button", { name: "Fácil", exact: true }).click();
    await expect(page.locator(".review-prompt")).toContainText("Artículo 164");
    expect((await state(page)).reviews.length).toBe(before.reviews.length + 1);
  });
test("Cancelar edicion conserva la tarjeta y permite seguir valorando", async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole("button", { name: /Repasar ahora/ })
    .first()
    .click();
  const before = await state(page);
  await page.getByRole("button", { name: "Opciones del repaso" }).click();
  await page
    .getByRole("button", { name: "Editar tarjeta", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Escribe la pregunta", exact: true })
    .fill("No guardar");
  await page
    .getByRole("dialog", { name: "Editar tarjeta" })
    .getByRole("button", { name: "Cerrar", exact: true })
    .click();
  expect((await state(page)).cards).toEqual(before.cards);
  await expect(page.locator(".review-prompt")).toContainText("Artículo 53");
});
test("Quitar en sesion elimina solo la pertenencia y finaliza, incluso offline", async ({
  page,
  context,
}) => {
  await open(page);
  await saveRegular(page);
  await page.getByRole("button", { name: /Empezar repaso/ }).click();
  await expect(page.locator(".review-v11")).toBeVisible();
  const before = await state(page);
  expect(before.settings.activeCardSession.sourceCollectionId).toBe("regular");
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Opciones del repaso", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", {
      name: "Quitar de «Regular» y continuar",
      exact: true,
    })
    .click();
  await expect(page.locator(".session-result-v12")).toBeVisible();
  const after = await state(page);
  expect(after.settings["reviewMembership:regular:basic1"]).toBe(false);
  expect(after.cards).toEqual(before.cards);
  expect(after.reviews).toEqual(before.reviews);
  expect(after.settings.activeCardSession.items).toHaveLength(0);
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await context.setOffline(false);
  await page.reload();
  await nav(page, "Repasar");
  await page
    .locator(".review-collections")
    .getByRole("button", { name: /^Regular\s/ })
    .click();
  await expect(page.locator(".collection-card")).toHaveCount(0);
});
test("Coleccion de origen sigue disponible al reabrir y quitar en la lista", async ({
  page,
}) => {
  await open(page);
  await saveRegular(page);
  await page.getByRole("button", { name: /Empezar repaso/ }).click();
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await page.reload();
  await nav(page, "Estudiar");
  await page
    .getByRole("button", { name: /Retomar sesión de tarjetas/ })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Quitar de «Regular» y continuar",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await nav(page, "Repasar");
  await page
    .locator(".review-collections")
    .getByRole("button", { name: /^Regular\s/ })
    .click();
  const before = await state(page);
  await page.getByRole("button", { name: /Quitar de Regular:/ }).click();
  await expect(page.locator(".collection-card")).toHaveCount(0);
  expect((await state(page)).cards).toEqual(before.cards);
  expect((await state(page)).settings.activeCardSession.items).toHaveLength(0);
});
for (const [label, mode] of [
  ["Aprender", "learn"],
  ["Aleatorio", "random"],
  ["En orden", "all"],
  ["Más falladas", "weakest"],
  ["Repasos pendientes", "recommended"],
])
  test(`Biblioteca multiseleccion permite modo ${label}`, async ({ page }) => {
    await open(page, 360, 800);
    if (mode === "weakest") {
      await page
        .getByRole("button", { name: /Repasar ahora/ })
        .first()
        .click();
      await page
        .getByRole("button", { name: "No me la sé", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Continuar", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Opciones del repaso" }).click();
      await page
        .getByRole("button", { name: "Finalizar sesión", exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Finalizar sesión", exact: true })
        .click();
    }
    await nav(page, "Biblioteca");
    await page
      .getByRole("button", { name: "Seleccionar", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Seleccionar rama Constitución Española",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Estudiar selección", exact: true })
      .click();
    const sheet = page.getByRole("dialog", { name: "¿Cómo quieres estudiar?" });
    await expect(sheet).toBeVisible();
    await noKeyboard(page);
    await expect(sheet).toContainText("11 tarjetas de tu selección");
    await sheet
      .getByRole("button", { name: new RegExp("^" + label + "(?:\\s|$)") })
      .click();
    await expect(page.locator(".review-v11")).toBeVisible();
    const s = await state(page);
    expect(s.settings.activeCardSession.mode).toBe(mode);
    expect(
      s.settings.activeCardSession.items.every(
        (i: any) =>
          s.cards.find((c: any) => c.id === i.id).type !== "orthography",
      ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
test("Selector desde Estudiar, cancelar, y modo en coleccion conserva contexto", async ({
  page,
}) => {
  await open(page);
  await nav(page, "Estudiar");
  await page
    .getByRole("button", { name: /Estudiar tarjetas de esta selección/ })
    .click();
  await expect(
    page.getByRole("dialog", { name: "¿Cómo quieres estudiar?" }),
  ).toBeVisible();
  await noKeyboard(page);
  await page.keyboard.press("Escape");
  expect((await state(page)).settings.activeCardSession).toBeUndefined();
  await nav(page, "Hoy");
  await saveRegular(page);
  await page
    .getByRole("button", { name: "Elegir modo de estudio", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Aleatorio/ })
    .click();
  await expect(page.locator(".review-v11")).toBeVisible();
  const s = await state(page);
  expect(s.settings.activeCardSession.mode).toBe("random");
  expect(s.settings.activeCardSession.sourceCollectionId).toBe("regular");
  await expect(
    page.getByRole("button", {
      name: "Quitar de «Regular» y continuar",
      exact: true,
    }),
  ).toBeVisible();
});
test("Retirar una tarjeta fallada avanza a la siguiente de la coleccion sin borrar su intento", async ({
  page,
}) => {
  await open(page, 768, 1024);
  await nav(page, "Biblioteca");
  await page
    .getByRole("textbox", { name: "Buscar biblioteca" })
    .fill("Artículo");
  await page.getByRole("button", { name: "Seleccionar", exact: true }).click();
  await page
    .getByRole("button", { name: "Seleccionar este nivel", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Guardar para repasar", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Regular", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Mal", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Continuar", exact: true })
    .click();
  await nav(page, "Repasar");
  await page
    .locator(".review-collections")
    .getByRole("button", { name: /^Regular\s/ })
    .click();
  await expect(page.locator(".collection-card")).toHaveCount(2);
  await page.getByRole("button", { name: /Empezar repaso/ }).click();
  await page.getByRole("button", { name: "No me la sé", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Continuar", exact: true }),
  ).toBeVisible();
  const before = await state(page);
  await page
    .getByRole("button", {
      name: "Quitar de «Regular» y continuar",
      exact: true,
    })
    .click();
  await expect(page.locator(".review-prompt")).toContainText("Artículo 164");
  const after = await state(page);
  expect(after.reviews).toEqual(before.reviews);
  expect(after.cards).toEqual(before.cards);
  expect(after.settings["reviewMembership:mal:basic1"]).toBe(true);
  expect(after.settings["reviewMembership:regular:basic1"]).toBe(false);
  expect(after.settings.activeCardSession.items.map((i: any) => i.id)).toEqual([
    "basic2",
  ]);
});
test("Seleccion mixta permite elegir ortografia sin mezclar tarjetas", async ({
  page,
}) => {
  await open(page, 430, 932);
  await nav(page, "Biblioteca");
  await page.getByRole("button", { name: "Seleccionar", exact: true }).click();
  await page
    .getByRole("button", { name: "Seleccionar todo", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Estudiar selección", exact: true })
    .click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: /Ortografía · 1/ }).click();
  await expect(sheet).toContainText("1 palabra de tu selección");
  await sheet.getByRole("button", { name: /^Aleatorio/ }).click();
  await expect(page.locator(".orthography-overlay")).toBeVisible();
  const s = await state(page);
  expect(s.settings.activeCardSession.mode).toBe("random");
  expect(s.settings.activeCardSession.format).toBe("orthography");
  expect(s.settings.activeCardSession.items.map((i: any) => i.id)).toEqual([
    "ortho",
  ]);
});
