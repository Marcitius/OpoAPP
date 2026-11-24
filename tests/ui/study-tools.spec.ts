import { test, expect, type Page } from "@playwright/test";
import { parseStudyTable, tableHtml } from "../../lib/tables/model";

const url = "http://127.0.0.1:4175/tests/ui/index.html";
const state = (p: Page) => p.evaluate(() => (window as any).__opogcQA.state());
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
async function open(p: Page, w = 390, h = 844, params = "") {
  await p.setViewportSize({ width: w, height: h });
  await p.goto(url + params);
  await expect(
    p.getByRole("heading", { name: "Vamos con lo de hoy" }),
  ).toBeVisible();
}
async function noKeyboard(p: Page) {
  expect(
    await p.evaluate(() =>
      document.activeElement?.matches("input,textarea,[contenteditable=true]"),
    ),
  ).toBe(false);
}
async function seed(p: Page, n = 8) {
  const s = await state(p),
    base = s.cards.find((c: any) => c.type === "basic");
  s.cards = [
    ...Array.from({ length: n }, (_, i) => ({
      ...base,
      id: `queue-${i + 1}`,
      front: `<p>ColaVisible ${i + 1}</p>`,
      back: `<p>${i === 7 ? "Valor secreto ocho" : `Respuesta de prueba ${i + 1}`}</p>`,
      options: [],
      correctOptions: [],
      reviewCount: 0,
      successCount: 0,
      repetitions: 0,
      lapses: 0,
      streak: 0,
      lastReviewedAt: null,
      fsrsStability: 0,
      fsrsDifficulty: 0,
      dueAt: new Date().toISOString(),
    })),
    ...s.cards,
  ];
  await p.evaluate((s) => (window as any).__opogcQA.receive(s), s);
}
async function search(p: Page) {
  await p.getByRole("button", { name: "Buscar tarjetas", exact: true }).click();
  const sheet = p.getByRole("dialog", { name: "Buscar tarjetas", exact: true });
  await expect(
    sheet.getByRole("searchbox", { name: "Buscar por pregunta o respuesta" }),
  ).toBeVisible();
  return sheet;
}
async function startPool(p: Page, mode = /En orden/, first = 1) {
  await nav(p, "Biblioteca");
  await p
    .getByRole("textbox", { name: "Buscar biblioteca" })
    .fill("ColaVisible");
  await p.getByRole("button", { name: "Seleccionar", exact: true }).click();
  await p
    .getByRole("button", { name: "Seleccionar este nivel", exact: true })
    .click();
  await p
    .getByRole("button", { name: "Estudiar selección", exact: true })
    .click();
  await p
    .getByRole("dialog", { name: "¿Cómo quieres estudiar?" })
    .getByRole("button", { name: mode })
    .click();
  await expect(p.locator(".review-prompt")).toHaveText("ColaVisible " + first);
}
const queue = (p: Page) => p.locator("#live-session-queue");
async function showQueue(p: Page) {
  await p
    .getByRole("button", { name: "Ver cola de la sesión", exact: true })
    .click();
  await expect(queue(p)).toBeVisible();
  return queue(p);
}
async function closeQueue(p: Page) {
  if ((p.viewportSize()?.width ?? 390) >= 768)
    await p.getByRole("button", { name: "Cerrar cola de la sesión" }).click();
  else
    await p
      .getByRole("dialog", { name: "Cola de la sesión" })
      .getByRole("button", { name: "Cerrar", exact: true })
      .click();
  await expect(queue(p)).toHaveCount(0);
}
async function grade(p: Page, label = "Notable") {
  await p
    .getByRole("button", { name: "Mostrar respuesta", exact: true })
    .click();
  await p.getByRole("button", { name: label, exact: true }).click();
}
async function nextIds(p: Page) {
  return queue(p)
    .locator('[data-queue-section="upcoming"] li')
    .evaluateAll((nodes) =>
      nodes.map((n) => (n as HTMLElement).dataset.queueId),
    );
}

test("Una sesión de tres de v15.5 conserva la tarjeta abierta; en la vuelta voluntaria el peor historial desempata los dos suspensos", async ({
  page,
}) => {
  await open(page);
  await seed(page, 3);
  const s = await state(page),
    past = new Date(Date.now() - 86400_000).toISOString();
  for (const [id, score] of [
    [1, 9],
    [2, 2],
  ]) {
    s.reviews.push({
      id: "old-" + id,
      cardId: "queue-" + id,
      cardSessionId: "older",
      score,
      scoreKind: "recall",
      rating: score === 9 ? "easy" : "again",
      correct: score >= 5,
      reviewedAt: past,
    });
  }
  await page.evaluate((v) => (window as any).__opogcQA.receive(v), s);
  await startPool(page);
  await grade(page, "Suspendida");
  await expect(page.locator(".review-prompt")).toHaveText("ColaVisible 2");
  await grade(page, "Suspendida");
  await expect(page.locator(".review-prompt")).toHaveText("ColaVisible 3");
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await expect(page.locator(".review-v11")).toHaveCount(0);
  const checkpoint = await state(page),
    legacy = checkpoint.settings.activeCardSession;
  delete legacy.priorityBasis;
  for (const item of legacy.items) {
    delete item.priorityScore;
    if (item.status === "reinforce") item.gap = 2;
  }
  checkpoint.settings["cardSession:" + legacy.id] = legacy;
  await page.evaluate((v) => (window as any).__opogcQA.receive(v), checkpoint);
  await page.reload();
  await page.getByRole("button", { name: /Continuar sesión/ }).click();
  await expect(page.locator(".review-prompt")).toHaveText("ColaVisible 3");
  await grade(page);
  await expect(page.locator(".session-result-v12")).toContainText("A reforzar");
  await expect(page.locator(".session-result-counts")).toContainText(
    "2A reforzar",
  );
  const saved = (await state(page)).settings.activeCardSession;
  expect(saved.id).toBe(legacy.id);
  expect(saved.history).toHaveLength(3);
  expect(saved.items.slice(0, 2).map((i: any) => i.priorityScore)).toEqual([
    9, 2,
  ]);
  await page
    .getByRole("button", { name: "Volver a intentar pendientes" })
    .click();
  await expect(page.locator(".review-prompt")).toHaveText("ColaVisible 2");
  await grade(page);
  await expect(page.locator(".review-prompt")).toHaveText("ColaVisible 1");
  await grade(page);
  await expect(page.locator(".session-result-v12")).toBeVisible();
  const rows = (await state(page)).reviews.filter(
    (r: any) => r.cardSessionId === legacy.id,
  );
  expect(rows.map((r: any) => r.scoreKind)).toEqual([
    "recall",
    "recall",
    "recall",
    "reinforcement",
    "reinforcement",
  ]);
});

test("Aprender empieza por la peor evolución al empatar las medias, sin cambiar el orden elegido en otros modos", async ({
  page,
}) => {
  await open(page);
  await seed(page, 3);
  const s = await state(page),
    past = Date.now() - 86400_000;
  for (const [id, values] of [
    [1, [2, 8]],
    [2, [8, 2]],
  ] as const) {
    values.forEach((v, i) =>
      s.reviews.push({
        id: id + "-" + i,
        cardId: "queue-" + id,
        cardSessionId: "old-" + i,
        score: v,
        scoreKind: "recall",
        rating: v < 5 ? "again" : "good",
        correct: v >= 5,
        reviewedAt: new Date(past + i * 1000).toISOString(),
      }),
    );
  }
  await page.evaluate((v) => (window as any).__opogcQA.receive(v), s);
  await startPool(page, /Aprender/, 2);
  await grade(page);
  await expect(page.locator(".review-prompt")).toHaveText("ColaVisible 1");
  await grade(page);
  await expect(page.locator(".review-prompt")).toHaveText("ColaVisible 3");
});

for (const [w, h] of [
  [360, 800],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1366, 768],
  [1920, 1080],
]) {
  test(`Hoy y cola ${w}x${h}: búsqueda por respuesta, orden vivo y aprobadas sin cambiar el algoritmo`, async ({
    page,
  }) => {
    await open(page, w, h);
    await seed(page, 10);
    const initial = await state(page);
    const sheet = await search(page);
    await noKeyboard(page);
    await sheet
      .getByRole("searchbox", { name: "Buscar por pregunta o respuesta" })
      .fill("VALOR secreto OCHO");
    await expect(sheet.locator(".global-search-results li")).toHaveCount(1);
    await expect(sheet.locator(".global-search-results li")).toContainText(
      "Coincide en la respuesta",
    );
    await sheet.locator(".global-search-results button").click();
    await expect(
      sheet.getByRole("region", { name: "Vista de la tarjeta" }),
    ).toContainText("Valor secreto ocho");
    await sheet.getByRole("button", { name: /Volver a resultados/ }).click();
    await expect(
      sheet.getByRole("searchbox", { name: "Buscar por pregunta o respuesta" }),
    ).toHaveValue("VALOR secreto OCHO");
    if (w === 390)
      await page.screenshot({
        path: "test-results/search-390.png",
        animations: "disabled",
      });
    await sheet.getByRole("button", { name: "Cerrar", exact: true }).click();
    expect((await state(page)).reviews).toEqual(initial.reviews);
    await startPool(page);
    await showQueue(page);
    await noKeyboard(page);
    expect((await nextIds(page)).slice(0, 3)).toEqual([
      "queue-2",
      "queue-3",
      "queue-4",
    ]);
    if (w < 768) await closeQueue(page);
    await grade(page, "Suspendida");
    await expect(page.locator(".review-prompt")).toHaveText("ColaVisible 2");
    if (w < 768) await showQueue(page);
    await expect
      .poll(() => nextIds(page))
      .toEqual([
        "queue-3",
        "queue-4",
        "queue-5",
        "queue-6",
        "queue-7",
        "queue-8",
        "queue-9",
        "queue-1",
        "queue-10",
      ]);
    await expect(
      queue(page).locator(
        '[data-queue-section="upcoming"] [data-queue-id="queue-1"]',
      ),
    ).toContainText("Última 2,5");
    if (w >= 768)
      await expect(
        queue(page).locator(
          '[data-queue-section="upcoming"] [data-queue-id="queue-1"] .queue-move',
        ),
      ).toBeVisible();
    if (w === 1024)
      await page.screenshot({
        path: "test-results/queue-1024.png",
        animations: "disabled",
      });
    if (w < 768) await closeQueue(page);
    await grade(page);
    await expect(page.locator(".review-prompt")).toHaveText("ColaVisible 3");
    if (w < 768) await showQueue(page);
    expect(await nextIds(page)).not.toContain("queue-2");
    await queue(page).getByText("Aprobadas · 1", { exact: true }).click();
    await expect(
      queue(page).locator(
        '[data-queue-section="approved"] [data-queue-id="queue-2"]',
      ),
    ).toBeVisible();
    if (w === 390)
      await page.screenshot({
        path: "test-results/queue-390.png",
        animations: "disabled",
      });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    const result = await state(page);
    expect(result.reviews.length - initial.reviews.length).toBe(2);
    expect(JSON.stringify(result.reviews)).not.toContain("queue-preview-");
    expect(JSON.stringify(result.settings)).not.toContain("queue-preview-");
    await closeQueue(page);
  });
}

test("Cola de 137 tarjetas: paginación de previsión sin escribir notas ni cambiar orden al abrir y cerrar", async ({
  page,
}) => {
  await open(page, 1024, 768);
  await seed(page, 137);
  await startPool(page);
  const before = await state(page);
  await showQueue(page);
  expect(await nextIds(page)).toHaveLength(30);
  await queue(page).getByRole("button", { name: "Mostrar 30 más" }).click();
  expect(await nextIds(page)).toHaveLength(60);
  await closeQueue(page);
  await showQueue(page);
  expect((await nextIds(page)).slice(0, 3)).toEqual([
    "queue-2",
    "queue-3",
    "queue-4",
  ]);
  const after = await state(page);
  expect(after.reviews).toEqual(before.reviews);
  expect(after.settings.activeCardSession.items).toEqual(
    before.settings.activeCardSession.items,
  );
  expect(after.settings.activeCardSession.turn).toBe(
    before.settings.activeCardSession.turn,
  );
});

test("La cola reanudada tras recarga refleja las mismas valoraciones y no introduce intentos simulados", async ({
  page,
}) => {
  await open(page, 1024, 768);
  await seed(page);
  await startPool(page);
  await grade(page, "Suspendida");
  await showQueue(page);
  const expected = await nextIds(page);
  await closeQueue(page);
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await expect(page.locator(".review-v11")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Vamos con lo de hoy" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Continuar sesión/ })
    .first()
    .click();
  await showQueue(page);
  expect(await nextIds(page)).toEqual(expected);
  expect((await state(page)).reviews).toHaveLength(1);
});

test("Búsqueda global: editar desde la vista actualiza resultados sin cambiar ID, historial ni notas", async ({
  page,
}) => {
  await open(page);
  await seed(page);
  const before = await state(page);
  const sheet = await search(page);
  await sheet
    .getByRole("searchbox", { name: "Buscar por pregunta o respuesta" })
    .fill("secreto ocho");
  await sheet.locator(".global-search-results button").click();
  await sheet
    .getByRole("button", { name: "Editar tarjeta", exact: true })
    .click();
  const editor = page.getByRole("dialog").last();
  await expect(
    editor.getByRole("group", { name: "Editor de Respuesta", exact: true }),
  ).toBeVisible();
  await noKeyboard(page);
  await editor
    .getByRole("group", { name: "Editor de Respuesta", exact: true })
    .locator('[contenteditable="true"]')
    .fill("Respuesta modificada aguacate");
  await editor
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await sheet.getByRole("button", { name: /Volver a resultados/ }).click();
  await expect(sheet.locator(".global-search-results li")).toHaveCount(0);
  await sheet
    .getByRole("searchbox", { name: "Buscar por pregunta o respuesta" })
    .fill("aguacate");
  await expect(sheet.locator(".global-search-results li")).toHaveCount(1);
  const after = await state(page);
  expect(after.cards.find((c: any) => c.id === "queue-8").back).toContain(
    "aguacate",
  );
  expect(after.cards.find((c: any) => c.id === "queue-8").reviewCount).toBe(0);
  expect(after.reviews).toEqual(before.reviews);
});

test("Buscar en 2200 tarjetas no actualiza la cuenta por tecla y funciona sin conexión", async ({
  page,
  context,
}) => {
  await open(page, 390, 844, "?performance");
  const before = await state(page);
  const sheet = await search(page);
  await page.evaluate(() => (window as any).__opogcQA.resetTimings());
  await sheet
    .getByRole("searchbox", { name: "Buscar por pregunta o respuesta" })
    .pressSequentially("contenido esencial", { delay: 5 });
  await expect(
    sheet.locator(".global-search-results li").first(),
  ).toBeVisible();
  const timings = await page.evaluate(() =>
    (window as any).__opogcQA.timings(),
  );
  expect(timings.filter((x: any) => x.kind === "local-update")).toHaveLength(0);
  await context.setOffline(true);
  await sheet
    .getByRole("searchbox", { name: "Buscar por pregunta o respuesta" })
    .fill("contenido esencial");
  await expect(
    sheet.locator(".global-search-results li").first(),
  ).toBeVisible();
  expect((await state(page)).reviews).toEqual(before.reviews);
  await context.setOffline(false);
});

test("Respuesta escrita y rotación con cola abierta conservan borrador y foco al seguir escribiendo", async ({
  page,
}) => {
  await open(page, 1024, 768);
  await nav(page, "Biblioteca");
  await page
    .getByRole("textbox", { name: "Buscar biblioteca" })
    .fill("Respuesta escrita:");
  await page.locator(".library-card-row .library-row-main").first().click();
  const input = page.getByRole("textbox", { name: "Tu respuesta" });
  await input.fill("contenido");
  await showQueue(page);
  await input.pressSequentially(" esencial", { delay: 5 });
  await expect(input).toHaveValue("contenido esencial");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("dialog", { name: "Cola de la sesión" }),
  ).toBeVisible();
  await noKeyboard(page);
  await closeQueue(page);
  await expect(input).toHaveValue("contenido esencial");
  expect((await state(page)).reviews).toHaveLength(0);
});

test("Una tabla muda se encuentra por su alternativa y se estudia con su interfaz y cola, sin notas por consultar", async ({
  page,
}) => {
  await open(page, 1024, 768);
  const s = await state(page);
  const t = parseStudyTable({
    columnas: ["Dato", "Respuesta"],
    filas: [
      [
        "Mandato",
        {
          contenido: "Cuatro años",
          evaluable: true,
          alternativas: ["cuatrienio exclusivo"],
        },
      ],
    ],
  });
  s.cards = [
    {
      ...s.cards[0],
      id: "table-search",
      type: "table",
      front: "<p>Tabla buscable</p>",
      back: tableHtml(t),
      table: t,
    },
    ...s.cards,
  ];
  await page.evaluate((s) => (window as any).__opogcQA.receive(s), s);
  const sheet = await search(page);
  await sheet
    .getByRole("searchbox", { name: "Buscar por pregunta o respuesta" })
    .fill("cuatrienio exclusivo");
  await sheet.locator(".global-search-results button").click();
  await expect(
    sheet.getByRole("region", { name: "Vista de la tarjeta" }),
  ).toContainText("Cuatro años");
  await sheet
    .getByRole("button", { name: "Estudiar tarjeta", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Comprobar respuestas", exact: true }),
  ).toBeVisible();
  await showQueue(page);
  await page.locator(".table-answer-field input").fill("Cuatro años");
  await page
    .getByRole("button", { name: "Comprobar respuestas", exact: true })
    .click();
  expect((await state(page)).reviews).toHaveLength(0);
  await page
    .getByRole("button", { name: "Guardar 10 y continuar", exact: true })
    .click();
  await expect(page.locator(".session-result-v12")).toBeVisible();
  await expect(
    queue(page).getByText("Aprobadas · 1", { exact: true }),
  ).toBeVisible();
  expect((await state(page)).reviews).toHaveLength(1);
});

test("Ortografía mantiene sus grupos y puede consultar la cola sin corregir ni perder las marcas", async ({
  page,
}) => {
  await open(page, 1024, 768);
  await nav(page, "Biblioteca");
  await page.getByLabel("Filtrar tipo de tarjeta").selectOption("orthography");
  await page.locator(".library-card-row .library-row-main").first().click();
  await expect(page.locator(".orthography-options")).toBeVisible();
  await page.locator(".orthography-option").first().click();
  const marked = await page
    .locator('.orthography-option[aria-pressed="true"]')
    .count();
  await showQueue(page);
  await closeQueue(page);
  expect(
    await page.locator('.orthography-option[aria-pressed="true"]').count(),
  ).toBe(marked);
  expect((await state(page)).reviews).toHaveLength(0);
});
