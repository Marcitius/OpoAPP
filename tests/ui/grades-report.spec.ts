import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
const url = "http://127.0.0.1:4175/tests/ui/index.html";
async function open(p: Page, w = 390, h = 844) {
  await p.setViewportSize({ width: w, height: h });
  await p.goto(url);
  await expect(
    p.getByRole("heading", { name: "Vamos con lo de hoy" }),
  ).toBeVisible();
}
async function nav(p: Page, name: string) {
  await p
    .locator(
      (p.viewportSize()?.width ?? 390) >= 1000
        ? ".ux-sidebar"
        : ".ux-bottom-nav",
    )
    .getByRole("button", { name, exact: true })
    .click();
}
async function state(p: Page) {
  return p.evaluate(() => (window as any).__opogcQA.state());
}
async function card(p: Page, q = "Artículo 53") {
  await nav(p, "Biblioteca");
  await p.getByRole("textbox", { name: "Buscar biblioteca" }).fill(q);
  await p.locator(".library-card-row .library-row-main").first().click();
  await expect(p.locator(".review-v11")).toBeVisible();
}
async function reveal(p: Page) {
  await p
    .getByRole("button", { name: "Mostrar respuesta", exact: true })
    .click();
}
async function score(p: Page, n: number) {
  const count = (await state(p)).reviews.length;
  await p.getByRole("button", { name: `Nota ${n}`, exact: true }).click();
  await expect
    .poll(async () => (await state(p)).reviews.length)
    .toBe(count + 1);
}
async function exit(p: Page) {
  await p.getByRole("button", { name: "Salir", exact: true }).click();
  await expect(p.locator(".review-v11,.session-result-v12")).toHaveCount(0);
}
async function noOverflow(p: Page) {
  expect(
    await p.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}
for (const [w, h] of [
  [360, 800],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1366, 768],
  [1920, 1080],
])
  test(`Notas 1–10: cinco aprueba, no reaparece y se conserva al reabrir ${w}`, async ({
    page,
  }) => {
    await open(page, w, h);
    await card(page);
    await reveal(page);
    await expect(page.locator(".score-buttons button")).toHaveCount(10);
    await noOverflow(page);
    await expect(
      page.getByRole("button", { name: "Nota 5", exact: true }),
    ).toBeInViewport();
    await score(page, 5);
    await expect(page.locator(".session-result-v12")).toBeVisible();
    let s = await state(page);
    expect(s.reviews.at(-1).score).toBe(5);
    expect(s.reviews.at(-1).rating).toBe("hard");
    expect(s.reviews.at(-1).scoreKind).toBe("recall");
    expect(s.settings.activeCardSession.items[0].status).toBe("remembered");
    await exit(page);
    await page.reload();
    await page.getByRole("button", { name: /Continuar sesión/ }).click();
    await expect(page.locator(".session-result-v12")).toBeVisible();
    expect((await state(page)).reviews).toHaveLength(1);
  });
test("Un fallo se puede reforzar explícitamente sin inflar la media ni crear notas al continuar", async ({
  page,
}) => {
  await open(page, 360, 800);
  await card(page);
  await reveal(page);
  await score(page, 2);
  await expect(page.locator(".session-result-v12")).toBeVisible();
  await page
    .getByRole("button", { name: "Volver a intentar pendientes" })
    .click();
  await reveal(page);
  expect(
    await page
      .locator(".review-context")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "Opciones del repaso", exact: true }),
  ).toBeInViewport();
  await noOverflow(page);
  await expect(page.locator(".score-help").last()).toContainText("no modifica");
  await score(page, 8);
  await exit(page);
  await card(page);
  await reveal(page);
  await expect(page.locator(".recall-score")).toContainText("Media 2.0");
  await score(page, 9);
  await exit(page);
  const rows = (await state(page)).reviews;
  expect(rows.map((r: any) => r.scoreKind)).toEqual([
    "recall",
    "reinforcement",
    "reinforcement",
  ]);
  await nav(page, "Progreso");
  await page
    .getByRole("button", { name: /Informe diario para ChatGPT/ })
    .click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar para ChatGPT", exact: true })
    .click();
  const json = JSON.parse(
    fs.readFileSync((await (await download).path())!, "utf8"),
  );
  expect(json.summary.distinctCards).toBe(1);
  expect(json.summary.attempts).toBe(3);
  expect(json.cards[0].averageRecall).toBe(2);
  expect(json.attempts[0].content.question).toContain("Artículo 53");
  expect(json.planningContext).toBeUndefined();
});
test("Un test incorrecto registra selección y no permite aprobar por una nota alta", async ({
  page,
}) => {
  await open(page);
  await card(page, "Vocabulario:");
  await page.locator(".review-options button").nth(1).click();
  await page.getByRole("button", { name: "Comprobar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Nota 7", exact: true }),
  ).toBeDisabled();
  await score(page, 3);
  const r = (await state(page)).reviews.at(-1);
  expect(r.score).toBe(3);
  expect(r.correct).toBe(false);
  expect(r.answerEvidence.selectedOptions).toEqual([1]);
  expect(r.answerEvidence.objectiveCorrect).toBe(false);
});
test("Respuesta escrita conserva texto y rúbrica junto a la nota elegida", async ({
  page,
}) => {
  await open(page);
  await card(page, "Respuesta escrita:");
  await page
    .getByRole("textbox", { name: "Tu respuesta" })
    .fill("contenido esencial");
  await page
    .getByRole("button", { name: "Comprobar respuesta", exact: true })
    .click();
  await expect(page.locator(".written-result-summary")).toContainText("100%");
  await score(page, 6);
  const r = (await state(page)).reviews.at(-1);
  expect(r.score).toBe(6);
  expect(r.answerEvidence.text).toBe("contenido esencial");
  expect(r.accuracy).toBe(100);
  expect(r.answerEvidence.writtenCriteria.length).toBeGreaterThan(0);
  await expect(page.locator(".session-result-v12")).toBeVisible();
});
test("Filtrar por media selecciona solo suspendidas y conserva Aprender, Aleatorio y el modo por nota", async ({
  page,
}) => {
  await open(page);
  await card(page);
  await reveal(page);
  await score(page, 2);
  await exit(page);
  await nav(page, "Biblioteca");
  await page.getByRole("textbox", { name: "Buscar biblioteca" }).fill("");
  await page.getByText("Filtrar por nota", { exact: true }).click();
  await page
    .getByLabel("Filtrar por nota", { exact: true })
    .selectOption("failed");
  await expect(page.locator(".library-card-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Seleccionar", exact: true }).click();
  await page.locator(".library-card-row .selection-check").click();
  await page
    .getByRole("button", { name: "Estudiar selección", exact: true })
    .click();
  const sheet = page.getByRole("dialog", {
    name: "¿Cómo quieres estudiar?",
    exact: true,
  });
  await expect(sheet.getByRole("button", { name: /Aleatorio/ })).toBeVisible();
  await expect(sheet.getByRole("button", { name: /Aprender/ })).toBeVisible();
  await sheet
    .getByLabel("Filtrar por nota", { exact: true })
    .selectOption("failed");
  await sheet.getByRole("button", { name: /Peor nota primero/ }).click();
  expect(
    (await state(page)).settings.activeCardSession.items.map((i: any) => i.id),
  ).toEqual(["basic1"]);
});
test("Informe con contexto incluye pendientes y sesión abierta; fecha vacía de actividad no inventa resultados", async ({
  page,
}) => {
  await open(page);
  await card(page);
  await exit(page);
  await nav(page, "Progreso");
  await page
    .getByRole("button", { name: /Informe diario para ChatGPT/ })
    .click();
  expect(
    await page.evaluate(() =>
      document.activeElement?.matches("input,textarea,[contenteditable=true]"),
    ),
  ).toBe(false);
  await page
    .getByLabel("Añadir contexto para planificar", { exact: false })
    .check();
  await page
    .getByLabel("Fecha del informe", { exact: true })
    .fill("2025-01-01");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar para ChatGPT", exact: true })
    .click();
  const json = JSON.parse(
    fs.readFileSync((await (await download).path())!, "utf8"),
  );
  expect(json.summary.attempts).toBe(0);
  expect(json.planningContext.openSessions).toHaveLength(1);
  expect(json.planningContext.plannedStudy.length).toBeGreaterThan(0);
  expect(json.instructionsForChatGPT).toContain("refuerzo");
  await noOverflow(page);
});
test("Finalizar varias seleccionadas, cancelar y finalizar todas conserva historial y cierres tras recarga", async ({
  page,
}) => {
  await open(page, 360, 800);
  await card(page);
  await reveal(page);
  await score(page, 7);
  await exit(page);
  for (const q of ["Artículo 164", "Respuesta escrita:"]) {
    await card(page, q);
    await exit(page);
  }
  const before = await state(page);
  expect(
    Object.keys(before.settings).filter(
      (k) => k.startsWith("cardSession:") && before.settings[k],
    ),
  ).toHaveLength(3);
  await page
    .getByRole("button", { name: "Ver las 3 sesiones", exact: true })
    .click();
  let sheet = page.getByRole("dialog", {
    name: "Sesiones guardadas",
    exact: true,
  });
  await sheet.getByRole("checkbox").nth(0).check();
  await sheet.getByRole("checkbox").nth(1).check();
  await sheet
    .getByRole("button", { name: "Finalizar selección (2)", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Volver sin finalizar", exact: true })
    .click();
  expect((await state(page)).reviews).toEqual(before.reviews);
  await page
    .getByRole("button", { name: "Finalizar selección (2)", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar finalización", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await state(page)).reviews).toEqual(before.reviews);
  await page
    .getByRole("button", { name: "Gestionar sesión", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Finalizar todas", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar finalización", exact: true })
    .click();
  await expect(page.locator(".saved-sessions")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".saved-sessions")).toHaveCount(0);
  const after = await state(page);
  expect(
    Object.keys(after.settings).filter((k) =>
      k.startsWith("finishedCardSession:"),
    ),
  ).toHaveLength(3);
  expect(after.reviews).toEqual(before.reviews);
});

test("Cierre múltiple offline y recepción en otro dispositivo conservan notas e informe sin duplicados", async ({
  browser,
}) => {
  const ca = await browser.newContext(),
    cb = await browser.newContext();
  const a = await ca.newPage(),
    b = await cb.newPage();
  try {
    await open(a);
    await card(a);
    await reveal(a);
    await score(a, 2);
    await exit(a);
    await card(a, "Artículo 164");
    await exit(a);
    await open(b);
    await b.evaluate(
      (s) => (window as any).__opogcQA.receive(s),
      await state(a),
    );
    await a
      .getByRole("button", { name: /Continuar sesión/ })
      .first()
      .click();
    await expect(a.locator(".review-v11")).toBeVisible();
    await cb.setOffline(true);
    await b.evaluate(() => window.dispatchEvent(new Event("offline")));
    await b
      .getByRole("button", { name: "Ver las 2 sesiones", exact: true })
      .click();
    await b
      .getByRole("button", { name: "Finalizar todas", exact: true })
      .click();
    await b
      .getByRole("button", { name: "Confirmar finalización", exact: true })
      .click();
    await expect(b.locator(".saved-sessions")).toHaveCount(0);
    await expect
      .poll(
        async () =>
          Object.keys((await state(b)).settings).filter((k) =>
            k.startsWith("closedCardSession:"),
          ).length,
      )
      .toBe(2);
    const closed = await state(b);
    await a.evaluate((s) => (window as any).__opogcQA.receive(s), closed);
    await expect(a.locator(".review-v11")).toHaveCount(0);
    expect((await state(a)).reviews).toHaveLength(1);
    await nav(b, "Progreso");
    await b
      .getByRole("button", { name: /Informe diario para ChatGPT/ })
      .click();
    const download = b.waitForEvent("download");
    await b
      .getByRole("button", { name: "Exportar para ChatGPT", exact: true })
      .click();
    const json = JSON.parse(
      fs.readFileSync((await (await download).path())!, "utf8"),
    );
    expect(json.cards[0].averageRecall).toBe(2);
    expect(json.summary.attempts).toBe(1);
    expect(json.finishedSessions).toHaveLength(2);
  } finally {
    await ca.close();
    await cb.close();
  }
});
