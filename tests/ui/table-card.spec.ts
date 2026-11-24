import { test, expect, type Page, type Locator } from "@playwright/test";
import fs from "node:fs";
import {
  parseStudyTable,
  cellAnswer,
  tableHtml,
  type StudyTable,
} from "../../lib/tables/model";
const url = "http://127.0.0.1:4175/tests/ui/index.html";
const values = ["18", "4 años", "Sí", "12 miembros", "3 al año"];
function definition(count = 5): StudyTable {
  return parseStudyTable({
    columnas: ["Concepto", "Respuesta"],
    filas: Array.from({ length: count }, (_, i) => [
      `Concepto ${i + 1}`,
      {
        contenido: values[i] ?? String(i + 1),
        evaluable: true,
        alternativas: i === 1 ? ["4", "Cuatro años"] : [],
      },
    ]),
  });
}
const state = (p: Page) => p.evaluate(() => (window as any).__opogcQA.state());
async function nav(p: Page, name = "Biblioteca") {
  await p
    .locator(
      (p.viewportSize()?.width ?? 390) >= 1000
        ? ".ux-sidebar"
        : ".ux-bottom-nav",
    )
    .getByRole("button", { name, exact: true })
    .click();
}
async function open(p: Page, w = 390, h = 844) {
  await p.setViewportSize({ width: w, height: h });
  await p.goto(url);
  await expect(
    p.getByRole("heading", { name: "Vamos con lo de hoy" }),
  ).toBeVisible();
}
async function noFocus(p: Page) {
  expect(
    await p.evaluate(() =>
      document.activeElement?.matches(
        "input,textarea,select,[contenteditable=true]",
      ),
    ),
  ).toBe(false);
}
async function seed(
  p: Page,
  count = 5,
  title = "Tabla de prueba",
  mixed = false,
) {
  const snapshot = await state(p),
    table = definition(count),
    base = snapshot.cards[0];
  const card = {
    ...base,
    id: "table-ui",
    type: "table",
    front: `<p>${title}</p>`,
    back: tableHtml(table),
    table,
    reviewCount: 0,
    successCount: 0,
    lastReviewedAt: null,
    intervalDays: 0,
    repetitions: 0,
    lapses: 0,
    streak: 0,
    fsrsStability: 0,
    fsrsDifficulty: 0,
    fsrsReps: 0,
  };
  if (mixed)
    snapshot.cards = snapshot.cards.map((c: any) =>
      c.id === "basic1" ? { ...c, front: "<p>Mezcla normal</p>" } : c,
    );
  snapshot.cards = [card, ...snapshot.cards];
  await p.evaluate((s) => (window as any).__opogcQA.receive(s), snapshot);
  return table;
}
async function start(p: Page, title = "Tabla de prueba") {
  await nav(p);
  await p.getByRole("textbox", { name: "Buscar biblioteca" }).fill(title);
  await p.locator(".library-card-row .library-row-main").first().click();
  await expect(
    p.getByRole("region", { name: "Tabla para completar", exact: true }),
  ).toBeVisible();
  await expect(
    p.getByRole("button", { name: "Comprobar respuestas", exact: true }),
  ).toBeVisible();
}
const fields = (p: Page) => p.locator(".table-answer-field input");
async function fill(p: Page, table: StudyTable, correct = Infinity) {
  let n = 0;
  for (const input of await fields(p).all()) {
    const id = await input.getAttribute("id"),
      cell = table.rows
        .flatMap((row) => row.cells)
        .find((c) => id?.endsWith("-" + c.id))!;
    await input.fill(n++ < correct ? cellAnswer(cell) : "incorrecta");
  }
}
async function save(p: Page) {
  await p
    .getByRole("button", { name: /^Guardar [0-9,]+ y continuar$/ })
    .click();
}
async function leaveResult(p: Page) {
  await p
    .getByRole("button", { name: "Salir y conservar sesión", exact: true })
    .click();
}
async function pause(p: Page) {
  await p.getByRole("button", { name: "Salir", exact: true }).click();
  await expect(p.locator(".review-v11")).toHaveCount(0);
}
async function check(p: Page) {
  await p
    .getByRole("button", { name: "Comprobar respuestas", exact: true })
    .click();
  await expect(
    p.getByRole("status", { name: "Resultado de la tabla" }),
  ).toBeVisible();
}
async function setCell(
  p: Page,
  r: number,
  c: number,
  text: string,
  alternatives = "",
) {
  await p
    .getByRole("button", {
      name: `Editar celda fila ${r} columna ${c}`,
      exact: true,
    })
    .click();
  const sheet = p.getByRole("dialog", { name: "Editar celda", exact: true });
  await expect(
    sheet.getByRole("textbox", { name: "Contenido de la celda", exact: true }),
  ).toBeVisible();
  await noFocus(p);
  await sheet
    .getByRole("textbox", { name: "Contenido de la celda", exact: true })
    .fill(text);
  if (alternatives) {
    await sheet.getByLabel("Esta celda es evaluable").check();
    await sheet
      .getByRole("textbox", { name: "Alternativas admitidas" })
      .fill(alternatives);
  }
  await sheet
    .getByRole("button", { name: "Guardar celda", exact: true })
    .click();
  await expect(sheet).toHaveCount(0);
}

for (const [width, height] of [
  [360, 800],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1366, 768],
  [1920, 1080],
])
  test(`Tabla muda ${width}x${height}: completar, corregir y guardar una única nota`, async ({
    page,
  }) => {
    await open(page, width, height);
    const table = await seed(page);
    await start(page);
    await noFocus(page);
    await expect(fields(page)).toHaveCount(5);
    const id = await fields(page).first().getAttribute("id");
    await fill(page, table, 4);
    await expect(fields(page).first()).toHaveAttribute("id", id!);
    await check(page);
    await expect(
      page.getByRole("status", { name: "Resultado de la tabla" }),
    ).toContainText("8 / 10");
    await expect(page.locator(".table-answer-field.correct")).toHaveCount(4);
    await expect(page.locator(".table-answer-field.incorrect")).toHaveCount(1);
    await expect(page.locator(".table-answer-field.incorrect")).toContainText(
      "Solución: 3 al año",
    );
    expect((await state(page)).reviews).toHaveLength(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    if ([390, 768, 1366].includes(width))
      await page.screenshot({
        path: `test-results/table-study-${width}.png`,
        animations: "disabled",
      });
    await save(page);
    await expect.poll(async () => (await state(page)).reviews.length).toBe(1);
    const s = await state(page),
      review = s.reviews[0];
    expect(review.cardId).toBe("table-ui");
    expect(review.score).toBe(8);
    expect(review.scoreSource).toBe("table-objective");
    expect(review.answerEvidence.table.evaluated).toBe(5);
    expect(s.settings.activeCardSession.items).toHaveLength(1);
    expect(s.settings.activeCardSession.history).toHaveLength(1);
  });

test("Creación visual, edición de celdas, columnas, alternativas, vista previa y exportación JSON", async ({
  page,
}) => {
  await open(page);
  await nav(page);
  const before = await state(page);
  await page.getByRole("button", { name: "Tarjeta", exact: true }).click();
  await page.getByRole("button", { name: "Tabla muda", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Celdas de la tabla" }),
  ).toBeVisible();
  await noFocus(page);
  await page
    .getByRole("textbox", { name: "Enunciado de la tabla", exact: true })
    .fill("Tabla visual creada");
  await setCell(page, 2, 1, "Miembros");
  await setCell(page, 2, 2, "18");
  await setCell(page, 3, 1, "Mandato");
  await setCell(page, 3, 2, "4 años", "4\nCuatro años");
  await page
    .getByRole("button", { name: "Evaluar columna 2", exact: true })
    .click();
  await page.getByRole("button", { name: "+ Fila", exact: true }).click();
  await expect(page.locator(".table-grid-editor tbody>tr")).toHaveCount(4);
  await page
    .getByRole("button", { name: "Eliminar fila 4", exact: true })
    .click();
  await page.getByRole("button", { name: "+ Columna", exact: true }).click();
  await page
    .getByRole("button", { name: "Eliminar columna 3", exact: true })
    .click();
  await page.getByRole("button", { name: "Vista previa", exact: true }).click();
  await expect(fields(page)).toHaveCount(2);
  await noFocus(page);
  await fields(page).nth(0).fill("18");
  await fields(page).nth(1).fill("CUATRO AÑOS");
  await check(page);
  await expect(
    page.getByRole("status", { name: "Resultado de la tabla" }),
  ).toContainText("10 / 10");
  expect((await state(page)).cards).toHaveLength(before.cards.length);
  expect((await state(page)).reviews).toEqual(before.reviews);
  await page
    .getByRole("dialog", { name: "Vista previa de tabla muda", exact: true })
    .getByRole("button", { name: "Cerrar", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/table-editor-390.png",
    animations: "disabled",
  });
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar esta tabla (JSON)", exact: true })
    .click();
  const file = await download,
    template = JSON.parse(fs.readFileSync((await file.path())!, "utf8"));
  expect(template.tarjetas[0].tipo).toBe("tabla_muda");
  expect(template.tarjetas[0].tabla.rows).toHaveLength(3);
  await page
    .getByRole("dialog", { name: "Crear tarjeta", exact: true })
    .getByRole("button", { name: "Guardar tarjeta", exact: true })
    .evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const created = (await state(page)).cards.find((c: any) =>
    c.front.includes("Tabla visual creada"),
  );
  expect(created.type).toBe("table");
  expect(created.table.rows[2].cells[1].alternatives).toEqual([
    "4",
    "Cuatro años",
  ]);
  expect(
    (await state(page)).cards.filter((c: any) => c.id !== created.id),
  ).toEqual(before.cards);
});

test("Pegar Markdown crea una tabla editable; evaluar columna no obliga a escribir marcadores", async ({
  page,
}) => {
  await open(page);
  await nav(page);
  await page.getByRole("button", { name: "Tarjeta", exact: true }).click();
  await page.getByRole("button", { name: "Tabla muda", exact: true }).click();
  await page.getByRole("button", { name: "Pegar tabla", exact: true }).click();
  await noFocus(page);
  await page
    .getByRole("textbox", { name: "Tabla para pegar", exact: true })
    .fill(
      "| Concepto | Respuesta |\n| --- | --- |\n| **Miembros** | 18 |\n| Mandato | 4 años |",
    );
  await page.getByRole("button", { name: "Usar tabla", exact: true }).click();
  await expect(page.locator(".table-grid-editor strong")).toHaveText(
    "Miembros",
  );
  await page
    .getByRole("button", { name: "Evaluar columna 2", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Crear tarjeta", exact: true })
    .getByRole("button", { name: "Guardar tarjeta", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const c = (await state(page)).cards.find((c: any) => c.type === "table");
  expect(c.table.rows).toHaveLength(3);
  expect(c.table.rows[1].cells[1].evaluable).toBe(true);
  expect(c.back).not.toContain("{{");
});

test("Ocultación 25/50/75/100, máscara estable, campos visibles y nueva combinación", async ({
  page,
}) => {
  await open(page);
  await seed(page, 20);
  await start(page);
  for (const [pct, count] of [
    [25, 5],
    [50, 10],
    [75, 15],
    [100, 20],
  ]) {
    await page.getByRole("button", { name: "Ocultación", exact: true }).click();
    await noFocus(page);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: pct + "%", exact: true })
      .click();
    await page.getByRole("button", { name: "Aplicar", exact: true }).click();
    await expect(fields(page)).toHaveCount(count);
  }
  await page.getByRole("button", { name: "Ocultación", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "50%", exact: true })
    .click();
  await page.getByRole("button", { name: "Aplicar", exact: true }).click();
  const ids = await fields(page).evaluateAll((nodes) =>
    nodes.map((node) => node.id),
  );
  await fields(page).first().fill("Sin perder el cursor");
  await expect(fields(page).first()).toBeFocused();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const q = (window as any).__opogcQA,
          s = q.state().settings.activeCardSession,
          d = await q.draft("review-draft:ux-fixture-a:" + s.id);
        return Object.values(
          d?.presentation?.tableAttempt?.answers ?? {},
        ).includes("Sin perder el cursor");
      }),
    )
    .toBe(true);
  expect(
    await fields(page).evaluateAll((nodes) => nodes.map((node) => node.id)),
  ).toEqual(ids);
  await page
    .getByRole("button", { name: "Nueva combinación", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cambiar y vaciar", exact: true })
    .click();
  expect(
    await fields(page).evaluateAll((nodes) => nodes.map((node) => node.id)),
  ).not.toEqual(ids);
  await expect(fields(page).first()).toHaveValue("");
  expect(
    await page
      .locator(".interactive-study-table tbody td:not([data-evaluable])")
      .count(),
  ).toBe(20);
});

test("Mostrar soluciones en blanco guarda cero; reintentar no infla la primera nota", async ({
  page,
}) => {
  await open(page);
  const table = await seed(page);
  await start(page);
  await page
    .getByRole("button", { name: "Mostrar soluciones", exact: true })
    .click();
  await expect(
    page.getByRole("status", { name: "Resultado de la tabla" }),
  ).toContainText("0 / 10");
  await expect(page.locator(".table-cell-feedback")).toHaveCount(5);
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await fill(page, table);
  await check(page);
  await expect(
    page.getByRole("status", { name: "Resultado de la tabla" }),
  ).toContainText("10 / 10");
  await expect(page.getByText(/se conserva la primera nota/i)).toBeVisible();
  await page
    .getByRole("button", { name: "Guardar 0 y continuar", exact: true })
    .click();
  await expect.poll(async () => (await state(page)).reviews.length).toBe(1);
  const review = (await state(page)).reviews[0];
  expect(review.score).toBe(0);
  expect(review.answerEvidence.table.revealedWithoutAnswer).toBe(5);
  expect(review.answerEvidence.tablePracticeChecks).toBe(1);
});

test("Notas decimales en sesiones nuevas actualizan la media, sin cambiar las categorías de tarjetas normales", async ({
  page,
}) => {
  await open(page);
  const table = await seed(page, 12);
  await start(page);
  await fill(page, table, 9);
  await check(page);
  await save(page);
  await leaveResult(page);
  await start(page);
  await fill(page, table, 6);
  await check(page);
  await save(page);
  await leaveResult(page);
  await nav(page);
  await page
    .getByRole("textbox", { name: "Buscar biblioteca" })
    .fill("Tabla de prueba");
  await expect(page.locator(".library-card-row")).toContainText("Media 6,25");
  const reviews = (await state(page)).reviews;
  expect(reviews.map((r: any) => r.score)).toEqual([7.5, 5]);
  expect(reviews[0].cardSessionId).not.toBe(reviews[1].cardSessionId);
});

test("Salir y recargar conserva respuestas y porcentaje; volver tras comprobar no duplica la nota", async ({
  page,
}) => {
  await open(page);
  const table = await seed(page);
  await start(page);
  await page.getByRole("button", { name: "Ocultación", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "50%", exact: true })
    .click();
  await page.getByRole("button", { name: "Aplicar", exact: true }).click();
  await fields(page).first().fill("Mi respuesta pendiente");
  await pause(page);
  const saved = (await state(page)).settings.activeCardSession.presentation
    .tableAttempt;
  expect(saved.percentage).toBe(50);
  await page.reload();
  await page
    .getByRole("button", { name: /Continuar sesión/ })
    .first()
    .click();
  await expect(fields(page)).toHaveCount(3);
  await expect(fields(page).first()).toHaveValue("Mi respuesta pendiente");
  await fill(page, table);
  await check(page);
  await pause(page);
  await page.reload();
  await page
    .getByRole("button", { name: /Continuar sesión/ })
    .first()
    .click();
  await expect(
    page.getByRole("status", { name: "Resultado de la tabla" }),
  ).toContainText("10 / 10");
  expect((await state(page)).reviews).toHaveLength(0);
  await page
    .getByRole("button", { name: "Guardar 10 y continuar", exact: true })
    .evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
  await expect.poll(async () => (await state(page)).reviews.length).toBe(1);
});

test("Tabla y flashcard normal conviven en filtros y en una misma sesión; porcentaje antes de empezar", async ({
  page,
}) => {
  await open(page);
  const table = await seed(page, 4, "Mezcla tabla", true);
  await nav(page);
  await page.getByRole("textbox", { name: "Buscar biblioteca" }).fill("Mezcla");
  await page
    .getByRole("combobox", { name: "Filtrar tipo de tarjeta" })
    .selectOption("table");
  await expect(page.locator(".library-card-row")).toHaveCount(1);
  await expect(page.locator(".library-card-row")).toContainText("TABLA MUDA");
  await page
    .getByRole("combobox", { name: "Filtrar tipo de tarjeta" })
    .selectOption("basic");
  await expect(page.locator(".library-card-row")).toHaveCount(1);
  await expect(page.locator(".library-card-row")).toContainText(
    "Mezcla normal",
  );
  await page
    .getByRole("combobox", { name: "Filtrar tipo de tarjeta" })
    .selectOption("all");
  await page.getByRole("button", { name: "Seleccionar", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Seleccionar tarjeta Mezcla tabla",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "Seleccionar tarjeta Mezcla normal",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Estudiar selección", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Ocultación de tablas mudas" })
    .selectOption("50");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^En orden/ })
    .click();
  await expect(fields(page)).toHaveCount(2);
  await fill(page, table);
  await check(page);
  await save(page);
  await expect(page.locator(".review-prompt")).toHaveText("Mezcla normal");
  await expect(fields(page)).toHaveCount(0);
  await page
    .getByRole("button", { name: "Mostrar respuesta", exact: true })
    .click();
  await page.getByRole("button", { name: "Suficiente", exact: true }).click();
  await expect.poll(async () => (await state(page)).reviews.length).toBe(2);
  const s = await state(page);
  expect(s.reviews.map((r: any) => r.score)).toEqual([10, 5.5]);
  expect(s.settings.activeCardSession.items).toHaveLength(2);
  expect(s.settings.activeCardSession.tablePercentage).toBe(50);
});

test("Importación real de tabla y JSON antiguo conserva rutas profundas, formato y tipos", async ({
  page,
}) => {
  await open(page);
  await nav(page);
  const before = await state(page);
  await page.getByRole("button", { name: "Opciones de la biblioteca" }).click();
  await page
    .getByRole("button", { name: "Importar tarjetas JSON", exact: true })
    .click();
  await noFocus(page);
  const data = {
    tarjetas: [
      {
        tipo: "tabla_muda",
        ruta: ["Internacionales", "Pactos", "PIDCP", "Comité"],
        pregunta: "**Tabla importada**",
        tabla: {
          columnas: ["Concepto", "Respuesta"],
          filas: [
            [
              "Mandato",
              { contenido: "4 años", evaluable: true, alternativas: ["4"] },
            ],
          ],
          porcentajeOculto: 100,
        },
      },
      {
        tema: "Tema anterior",
        pregunta: "Normal antigua",
        respuesta: "{{Literal sin conversión}}",
      },
    ],
  };
  await page
    .getByRole("textbox", { name: "JSON de tarjetas" })
    .fill(JSON.stringify(data));
  await page.getByRole("button", { name: "Validar JSON", exact: true }).click();
  await page.getByRole("button", { name: /^Importar 2/ }).click();
  await expect
    .poll(async () => (await state(page)).cards.length)
    .toBe(before.cards.length + 2);
  const after = await state(page),
    table = after.cards.find((c: any) => c.type === "table"),
    normal = after.cards.find((c: any) => c.front.includes("Normal antigua"));
  expect(normal.type).toBe("basic");
  expect(normal.table).toBeUndefined();
  expect(table.front).toContain("<strong>Tabla importada</strong>");
  const path = [];
  let folder = after.folders.find((f: any) => f.id === table.folderId);
  while (folder) {
    path.unshift(folder.name);
    folder = after.folders.find((f: any) => f.id === folder.parentId);
  }
  expect(path).toEqual(["Internacionales", "Pactos", "PIDCP", "Comité"]);
  expect(
    after.folders.some((f: any) => f.name === "Pactos / PIDCP / Comité"),
  ).toBe(false);
});

test("Offline: comprobación y guardado duran, y la copia portable conserva tabla e historial", async ({
  page,
  context,
}) => {
  await open(page);
  const table = await seed(page);
  await start(page);
  await context.setOffline(true);
  await fill(page, table, 4);
  await check(page);
  await save(page);
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          Object.values(
            (await (window as any).__opogcQA.account()).rows,
          ).filter((r: any) => r.kind === "reviews").length,
      ),
    )
    .toBe(1);
  await context.setOffline(false);
  const round = await page.evaluate(async () => {
    const q = (window as any).__opogcQA;
    return q.roundtrip(await q.backup());
  });
  expect(round.cards.find((c: any) => c.id === "table-ui").table).toEqual(
    table,
  );
  expect(round.reviews[0].score).toBe(8);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Vamos con lo de hoy" }),
  ).toBeVisible();
  expect((await state(page)).reviews[0].answerEvidence.table.score).toBe(8);
});

test("Dos dispositivos simulados reanudan la misma máscara y respuestas y conservan una única nota", async ({
  page,
  browser,
}) => {
  await open(page);
  const table = await seed(page, 8);
  await start(page);
  await page.getByRole("button", { name: "Ocultación", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "50%", exact: true })
    .click();
  await page.getByRole("button", { name: "Aplicar", exact: true }).click();
  await fill(page, table);
  await pause(page);
  const handoff = await state(page),
    attempt = handoff.settings.activeCardSession.presentation.tableAttempt;
  const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
    }),
    other = await context.newPage();
  try {
    await open(other, 1366, 768);
    await other.evaluate((s) => (window as any).__opogcQA.receive(s), handoff);
    await other
      .getByRole("button", { name: /Continuar sesión/ })
      .first()
      .click();
    await expect(fields(other)).toHaveCount(4);
    const resumed = (await state(other)).settings.activeCardSession.presentation
      .tableAttempt;
    expect(resumed.hiddenIds).toEqual(attempt.hiddenIds);
    expect(resumed.answers).toEqual(attempt.answers);
    await check(other);
    await save(other);
    await expect(other.locator(".session-result-v12")).toBeVisible();
    const finished = await state(other);
    await page.evaluate((s) => (window as any).__opogcQA.receive(s), finished);
    expect((await state(page)).reviews).toHaveLength(1);
    expect((await state(page)).reviews[0].score).toBe(10);
  } finally {
    await context.close();
  }
});

test("Tabla ancha, rotación y altura reducida conservan el ejercicio sin desbordar la pantalla", async ({
  page,
}) => {
  await open(page);
  await seed(page);
  const snapshot = await state(page),
    c = snapshot.cards.find((c: any) => c.type === "table");
  c.table = parseStudyTable({
    columnas: ["A", "B", "C", "D", "E"],
    filas: Array.from({ length: 8 }, (_, i) => [
      "Concepto con texto largo " + i,
      ...Array.from({ length: 4 }, (_, j) => ({
        contenido: String(j),
        evaluable: true,
      })),
    ]),
  });
  c.back = tableHtml(c.table);
  await page.evaluate((s) => (window as any).__opogcQA.receive(s), snapshot);
  await start(page);
  await fields(page).first().fill("Texto largo");
  expect(
    await page
      .getByRole("region", { name: "Tabla para completar", exact: true })
      .evaluate((node) => node.scrollWidth > node.clientWidth),
  ).toBe(true);
  for (const size of [
    { width: 390, height: 500 },
    { width: 844, height: 390 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await expect(fields(page).first()).toHaveValue("Texto largo");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await expect
      .poll(async () => {
        const box = await page.locator(".review-controls").boundingBox();
        return box!.y + box!.height;
      })
      .toBeLessThanOrEqual(size.height + 1);
  }
});

test("Un fallo al guardar permite reintentar sin perder respuestas ni duplicar calificaciones", async ({
  page,
}) => {
  await open(page);
  const table = await seed(page);
  await start(page);
  await fill(page, table, 4);
  await check(page);
  await page.evaluate(() => (window as any).__opogcQA.failReviewSaveOnce());
  await save(page);
  await expect(page.getByText(/Fallo de valoración simulado/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Guardar 8 y continuar", exact: true }),
  ).toBeVisible();
  expect((await state(page)).reviews).toHaveLength(0);
  await expect(
    page.getByRole("status", { name: "Resultado de la tabla" }),
  ).toContainText("8 / 10");
  await save(page);
  await expect.poll(async () => (await state(page)).reviews.length).toBe(1);
  expect((await state(page)).reviews[0].score).toBe(8);
});

test("Tablas amplias con 2200 tarjetas: escribir conserva foco y no actualiza la cuenta por tecla", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url + "?performance");
  await expect(
    page.getByRole("heading", { name: "Vamos con lo de hoy" }),
  ).toBeVisible();
  await seed(page, 80);
  await start(page);
  await expect(fields(page)).toHaveCount(80);
  await page.evaluate(() => (window as any).__opogcQA.resetTimings());
  const first = fields(page).first(),
    id = await first.getAttribute("id"),
    started = Date.now();
  await first.pressSequentially("Respuesta seguida", { delay: 5 });
  expect(Date.now() - started).toBeLessThan(2500);
  await expect(first).toBeFocused();
  await expect(first).toHaveAttribute("id", id!);
  expect(
    (await page.evaluate(() => (window as any).__opogcQA.timings())).filter(
      (x: any) => x.kind === "local-update",
    ),
  ).toHaveLength(0);
  await pause(page);
  await page.reload();
  await page
    .getByRole("button", { name: /Continuar sesión/ })
    .first()
    .click();
  await expect(fields(page).first()).toHaveValue("Respuesta seguida");
});

test("Controles táctiles y ajustes no abren el teclado; la celda solo toma foco al tocarla", async ({
  browser,
}) => {
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    }),
    page = await context.newPage();
  try {
    await open(page);
    await seed(page);
    await start(page);
    await noFocus(page);
    await fields(page).first().tap();
    await expect(fields(page).first()).toBeFocused();
    await fields(page).first().pressSequentially("18");
    await page.getByRole("button", { name: "Ocultación", exact: true }).tap();
    await noFocus(page);
    await page.getByRole("button", { name: "Aplicar", exact: true }).tap();
    await noFocus(page);
    await expect(fields(page).first()).toHaveValue("18");
    await page
      .getByRole("button", { name: "Comprobar respuestas", exact: true })
      .tap();
    await expect(
      page.getByRole("status", { name: "Resultado de la tabla" }),
    ).toContainText("2 / 10");
  } finally {
    await context.close();
  }
});

test("La flashcard normal con una tabla y llaves sigue siendo tradicional; HTML de tablas mudas se sanea", async ({
  page,
}) => {
  await open(page);
  await seed(page);
  const snapshot = await state(page),
    table = snapshot.cards.find((c: any) => c.type === "table");
  table.table.rows[1].cells[1].html =
    '<script>window.__tableXss=true</script><p onclick="window.__tableXss=true"><strong>18</strong><img src="bad" onerror="window.__tableXss=true"></p>';
  snapshot.cards.find((c: any) => c.id === "basic1").front =
    "<p>Normal literal</p>";
  snapshot.cards.find((c: any) => c.id === "basic1").back =
    "<table><tr><td>{{18}}</td></tr></table>";
  await page.evaluate((s) => (window as any).__opogcQA.receive(s), snapshot);
  await start(page);
  await expect(
    page.locator(".table-exercise script,.table-exercise img"),
  ).toHaveCount(0);
  await fill(page, definition());
  await check(page);
  await save(page);
  expect(await page.evaluate(() => (window as any).__tableXss)).toBeUndefined();
  await leaveResult(page);
  await startNormal();
  async function startNormal() {
    await nav(page);
    await page
      .getByRole("textbox", { name: "Buscar biblioteca" })
      .fill("Normal literal");
    await page.locator(".library-card-row .library-row-main").first().click();
  }
  await expect(fields(page)).toHaveCount(0);
  await page
    .getByRole("button", { name: "Mostrar respuesta", exact: true })
    .click();
  await expect(page.locator(".review-answer-text")).toContainText("{{18}}");
  await page.getByRole("button", { name: "Notable", exact: true }).click();
  await expect.poll(async () => (await state(page)).reviews.length).toBe(2);
  const s = await state(page);
  expect(s.reviews.find((r: any) => r.cardId === "basic1").score).toBe(7.5);
  expect(s.cards.find((c: any) => c.id === "basic1").table).toBeUndefined();
});

test("Reforzar una tabla suspendida conserva el porcentaje elegido y no altera la primera media de la sesión", async ({
  page,
}) => {
  await open(page);
  const table = await seed(page, 20);
  await start(page);
  await page.getByRole("button", { name: "Ocultación", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "25%", exact: true })
    .click();
  await page.getByRole("button", { name: "Aplicar", exact: true }).click();
  await page
    .getByRole("button", { name: "Mostrar soluciones", exact: true })
    .click();
  await save(page);
  await page
    .getByRole("button", { name: "Volver a intentar pendientes", exact: true })
    .click();
  await expect(fields(page)).toHaveCount(5);
  await fill(page, table);
  await check(page);
  await save(page);
  await leaveResult(page);
  await nav(page);
  await page
    .getByRole("textbox", { name: "Buscar biblioteca" })
    .fill("Tabla de prueba");
  await expect(page.locator(".library-card-row")).toContainText("Media 0");
  const s = await state(page);
  expect(s.reviews.map((r: any) => r.score)).toEqual([0, 10]);
  expect(s.reviews[1].scoreKind).toBe("reinforcement");
  expect(s.settings.activeCardSession.items[0].tablePercentage).toBe(25);
});
