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
async function open(p: Page, w = 390, h = 844) {
  await p.setViewportSize({ width: w, height: h });
  await p.goto(url);
  await expect(
    p.getByRole("heading", { name: "Vamos con lo de hoy" }),
  ).toBeVisible();
  const s = await state(p),
    base = s.cards.find((c: any) => c.type === "basic");
  s.cards = [
    ...Array.from({ length: 6 }, (_, i) => ({
      ...base,
      id: `notes-${i}`,
      front: `<p>NotasPrueba ${i + 1}</p>`,
      back: "<p>Plazo y mayoría que lo decide.</p>",
      reviewCount: 0,
      fsrsReps: 0,
      successCount: 0,
      lastReviewedAt: null,
      repetitions: 0,
      fsrsStability: 0,
      fsrsDifficulty: 0,
    })),
    ...s.cards,
  ];
  await p.evaluate((s) => (window as any).__opogcQA.receive(s), s);
}
async function noFocus(p: Page) {
  expect(
    await p.evaluate(() =>
      document.activeElement?.matches("input,textarea,[contenteditable=true]"),
    ),
  ).toBe(false);
}
async function pool(p: Page) {
  await nav(p, "Biblioteca");
  await p
    .getByRole("textbox", { name: "Buscar biblioteca" })
    .fill("NotasPrueba");
  await p.getByRole("button", { name: "Seleccionar", exact: true }).click();
  await p
    .getByRole("button", { name: "Seleccionar este nivel", exact: true })
    .click();
  await p
    .getByRole("button", { name: "Estudiar selección", exact: true })
    .click();
  await p
    .getByRole("dialog", { name: "¿Cómo quieres estudiar?" })
    .getByRole("button", { name: /En orden/ })
    .click();
  await expect(p.locator(".review-prompt")).toHaveText("NotasPrueba 1");
}
async function grade(p: Page) {
  await p
    .getByRole("button", { name: "Mostrar respuesta", exact: true })
    .click();
  await p.getByRole("button", { name: "Notable", exact: true }).click();
}
async function actions(p: Page, action: string) {
  await p
    .getByRole("button", { name: "Opciones del repaso", exact: true })
    .click();
  await p
    .getByRole("dialog", { name: "En este repaso" })
    .getByRole("button", { name: action, exact: true })
    .click();
}
const front = (p: Page) =>
  p
    .getByRole("group", { name: "Editor de Pregunta", exact: true })
    .locator('[contenteditable="true"]');
const back = (p: Page) =>
  p
    .getByRole("group", { name: "Editor de Respuesta", exact: true })
    .locator('[contenteditable="true"]');
async function derive(p: Page, practice = false) {
  await actions(p, "Crear tarjeta derivada");
  const sheet = p.getByRole("dialog", {
    name: "Crear tarjeta derivada",
    exact: true,
  });
  await expect(sheet).toBeVisible();
  await noFocus(p);
  await front(p).fill("¿Quién decide el plazo más breve?");
  await back(p).fill("La mayoría indicada en la tarjeta de origen.");
  if (practice)
    await sheet
      .getByRole("radio", {
        name: "Guardar y practicar en esta sesión",
        exact: true,
      })
      .check();
  await sheet
    .getByRole("button", {
      name: practice
        ? "Guardar y practicar en esta sesión"
        : "Guardar y continuar",
      exact: true,
    })
    .click();
  await expect(sheet).toHaveCount(0);
}
for (const [w, h] of [
  [360, 800],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1366, 768],
  [1920, 1080],
]) {
  test(`Notas ${w}x${h}: guardar sin nota, recuperar, resolver y exportar`, async ({
    page: p,
  }) => {
    await open(p, w, h);
    await pool(p);
    const before = (await state(p)).reviews.length;
    await p.getByRole("button", { name: "Añadir nota", exact: true }).click();
    await noFocus(p);
    const sheet = p.getByRole("dialog", {
      name: "Notas de la tarjeta",
      exact: true,
    });
    await sheet
      .getByRole("textbox", { name: "Nota de la tarjeta", exact: true })
      .fill(
        "Recuerdo cinco años, pero olvido quién decide el plazo más breve.",
      );
    await sheet
      .getByRole("button", { name: "Guardar nota", exact: true })
      .click();
    await expect(sheet.locator(".note-text")).toContainText("olvido quién");
    expect((await state(p)).reviews.length).toBe(before);
    await sheet
      .getByRole("button", { name: "Marcar resuelta", exact: true })
      .click();
    await expect(sheet.locator(".card-notes-list")).toContainText("Resuelta");
    await sheet.getByRole("button", { name: "Cerrar", exact: true }).click();
    await expect(
      p.getByRole("button", { name: "Notas · 1", exact: true }),
    ).toBeVisible();
    expect(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await p.getByRole("button", { name: "Salir", exact: true }).click();
    await p.reload();
    await expect
      .poll(
        async () =>
          Object.values((await state(p)).settings).filter((v: any) =>
            v?.text?.includes("olvido quién"),
          ).length,
      )
      .toBe(1);
  });
}
test("Derivada permanente: misma carpeta, historial independiente y relación accesible", async ({
  page: p,
}) => {
  await open(p);
  await pool(p);
  await derive(p);
  const s = await state(p),
    child = s.cards.find((c: any) => c.derivation?.sourceCardId === "notes-0");
  expect(child.folderId).toBe(
    s.cards.find((c: any) => c.id === "notes-0").folderId,
  );
  expect(child.reviewCount).toBe(0);
  expect(
    s.settings.activeCardSession.items.some((i: any) => i.id === child.id),
  ).toBe(false);
  await expect(p.locator(".review-prompt")).toHaveText("NotasPrueba 1");
  await p
    .getByRole("button", { name: "Tarjetas relacionadas", exact: true })
    .click();
  await expect(
    p.getByRole("dialog", { name: "Tarjetas relacionadas" }),
  ).toContainText("¿Quién decide el plazo más breve?");
});
test("Práctica derivada: no inmediata, sin media artificial ni cambios en FSRS", async ({
  page: p,
}) => {
  await open(p);
  await pool(p);
  await derive(p, true);
  const first = await state(p),
    child = first.cards.find(
      (c: any) => c.derivation?.sourceCardId === "notes-0",
    );
  for (let i = 0; i < 3; i++) {
    await expect(p.locator(".review-prompt")).not.toContainText(
      "¿Quién decide",
    );
    await grade(p);
  }
  await expect(p.locator(".review-prompt")).toHaveText(
    "¿Quién decide el plazo más breve?",
  );
  await p.getByRole("button", { name: "Salir", exact: true }).click();
  await expect(p.locator(".review-v11")).toHaveCount(0);
  await p.reload();
  await expect(
    p.getByRole("heading", { name: "Vamos con lo de hoy" }),
  ).toBeVisible();
  await p
    .getByRole("button", { name: /Continuar.*NotasPrueba|Continuar sesión/ })
    .first()
    .click();
  await expect(p.locator(".review-prompt")).toHaveText(
    "¿Quién decide el plazo más breve?",
  );
  await grade(p);
  await expect(p.locator(".review-prompt")).not.toContainText("¿Quién decide");
  const s = await state(p),
    r = s.reviews.find((r: any) => r.cardId === child.id);
  expect(r.learningContext).toBe("derived-guided");
  expect(r.scoreKind).toBe("reinforcement");
  const after = s.cards.find((c: any) => c.id === child.id);
  expect(after.fsrsStability).toBe(child.fsrsStability);
  expect(after.reviewCount).toBe(0);
});
test("Eliminar estudiando: cancelar no borra; confirmar avanza y limpia sesiones, backup e historial permanecen", async ({
  page: p,
}) => {
  await open(p);
  await pool(p);
  await p.getByRole("button", { name: "Añadir nota", exact: true }).click();
  const notes = p.getByRole("dialog", { name: "Notas de la tarjeta" });
  await notes
    .getByRole("textbox", { name: "Nota de la tarjeta" })
    .fill("Conservar para el informe");
  await notes
    .getByRole("button", { name: "Guardar nota", exact: true })
    .click();
  await expect(notes.locator(".note-text")).toBeVisible();
  await notes.getByRole("button", { name: "Cerrar", exact: true }).click();
  await actions(p, "Eliminar tarjeta");
  await noFocus(p);
  await p
    .getByRole("dialog", { name: "Eliminar tarjeta", exact: true })
    .getByRole("button", { name: "Cancelar", exact: true })
    .click();
  expect((await state(p)).cards.some((c: any) => c.id === "notes-0")).toBe(
    true,
  );
  await actions(p, "Eliminar tarjeta");
  await p
    .getByRole("button", { name: "Eliminar y continuar", exact: true })
    .click();
  await expect(p.locator(".review-prompt")).toHaveText("NotasPrueba 2");
  const s = await state(p);
  expect(s.cards.some((c: any) => c.id === "notes-0")).toBe(false);
  expect(s.reviews.some((r: any) => r.cardId === "notes-0")).toBe(false);
  expect(s.settings["deletedCard:notes-0"]).toBeTruthy();
  const backup = await p.evaluate(async () => {
    const qa = (window as any).__opogcQA;
    return qa.roundtrip(await qa.backup());
  });
  expect(backup.settings["deletedCard:notes-0"].card.id).toBe("notes-0");
  await grade(p);
  await expect(p.locator(".review-prompt")).toHaveText("NotasPrueba 3");
});
test("Biblioteca y buscador permiten consultar notas sin iniciar otra sesión", async ({
  page: p,
}) => {
  await open(p);
  await nav(p, "Biblioteca");
  await p
    .getByRole("textbox", { name: "Buscar biblioteca" })
    .fill("NotasPrueba 1");
  await p
    .locator(".library-card-row")
    .first()
    .getByRole("button", { name: "Mover o reordenar tarjeta" })
    .click();
  await p
    .getByRole("dialog")
    .getByRole("button", { name: "Notas de la tarjeta", exact: true })
    .click();
  const notes = p.getByRole("dialog", { name: "Notas de la tarjeta" });
  await notes
    .getByRole("textbox", { name: "Nota de la tarjeta" })
    .fill("Desde Biblioteca");
  await notes
    .getByRole("button", { name: "Guardar nota", exact: true })
    .click();
  await expect(notes.locator(".note-text")).toHaveText("Desde Biblioteca");
  await notes.getByRole("button", { name: "Cerrar", exact: true }).click();
  await nav(p, "Hoy");
  await p.getByRole("button", { name: "Buscar tarjetas", exact: true }).click();
  const search = p.getByRole("dialog", { name: "Buscar tarjetas" });
  await search.getByRole("searchbox").fill("NotasPrueba 1");
  await search.locator(".global-search-results button").first().click();
  await search
    .getByRole("button", { name: "Notas de la tarjeta", exact: true })
    .click();
  await expect(
    p.getByRole("dialog", { name: "Notas de la tarjeta" }),
  ).toContainText("Desde Biblioteca");
});
test("Crear respuesta escrita manualmente y aceptar corrección conserva evidencia automática", async ({
  page: p,
}) => {
  await open(p);
  await nav(p, "Biblioteca");
  await p.getByRole("button", { name: "Tarjeta", exact: true }).click();
  await p
    .getByRole("button", { name: "Respuesta escrita", exact: true })
    .click();
  await noFocus(p);
  await front(p).fill("EscrituraManual ¿Quién decide?");
  await back(p).fill("La mayoría absoluta de los miembros");
  await p.getByRole("button", { name: "Guardar tarjeta", exact: true }).click();
  await expect(p.getByRole("dialog")).toHaveCount(0);
  let s = await state(p);
  const card = s.cards.find((c: any) => c.front.includes("EscrituraManual"));
  expect(card.type).toBe("written");
  expect(card.options.some((o: string) => o.includes("mayoría absoluta"))).toBe(
    true,
  );
  await p
    .getByRole("textbox", { name: "Buscar biblioteca" })
    .fill("EscrituraManual");
  await p.locator(".library-row-main").first().click();
  await p
    .getByRole("textbox", { name: "Tu respuesta", exact: true })
    .fill("Respuesta equivalente para mi revisión");
  await p
    .getByRole("button", { name: "Comprobar respuesta", exact: true })
    .click();
  await p
    .getByRole("button", {
      name: "Después de revisar mi respuesta, considero que es correcta",
      exact: true,
    })
    .click();
  await expect
    .poll(
      async () =>
        (await state(p)).reviews.filter((r: any) => r.cardId === card.id)
          .length,
    )
    .toBe(1);
  s = await state(p);
  const r = s.reviews.find((r: any) => r.cardId === card.id);
  expect(r.score).toBe(10);
  expect(r.scoreSource).toBe("self-reviewed");
  expect(r.answerEvidence.selfReview.automaticScore).toBeLessThan(10);
  expect(r.answerEvidence.text).toContain("equivalente");
});
test("Tabla muda: aceptar respuesta revisada guarda una sola nota, sin alterar el resultado automático", async ({
  page: p,
}) => {
  await open(p);
  const s = await state(p),
    table = parseStudyTable({
      columnas: ["Concepto", "Respuesta"],
      filas: [
        ["Duración", { contenido: "4 años", evaluable: true }],
        ["Quién", { contenido: "El órgano", evaluable: true }],
      ],
    });
  const card = {
    ...s.cards[0],
    id: "self-table",
    type: "table",
    front: "<p>TablaRevisada</p>",
    back: tableHtml(table),
    table,
  };
  s.cards.unshift(card);
  await p.evaluate((s) => (window as any).__opogcQA.receive(s), s);
  await nav(p, "Biblioteca");
  await p
    .getByRole("textbox", { name: "Buscar biblioteca" })
    .fill("TablaRevisada");
  await p.locator(".library-row-main").first().click();
  await expect(p.locator(".table-answer-field input")).toHaveCount(2);
  for (const field of await p.locator(".table-answer-field input").all())
    await field.fill("Mi alternativa");
  await p
    .getByRole("button", { name: "Comprobar respuestas", exact: true })
    .click();
  await p
    .getByRole("button", {
      name: "Después de revisar mi respuesta, considero que es correcta",
      exact: true,
    })
    .click();
  await expect
    .poll(
      async () =>
        (await state(p)).reviews.filter((r: any) => r.cardId === "self-table")
          .length,
    )
    .toBe(1);
  const r = (await state(p)).reviews.find(
    (r: any) => r.cardId === "self-table",
  );
  expect(r.score).toBe(10);
  expect(r.answerEvidence.table.score).toBe(0);
  expect(r.answerEvidence.selfReview.automaticScore).toBe(0);
  expect(r.scoreSource).toBe("self-reviewed");
});
test("Tabla sin responder no ofrece aceptar como correcta", async ({
  page: p,
}) => {
  await open(p);
  const s = await state(p),
    table = parseStudyTable({
      columnas: ["Concepto", "Respuesta"],
      filas: [["Duración", { contenido: "4 años", evaluable: true }]],
    });
  s.cards.unshift({
    ...s.cards[0],
    id: "blank-table",
    type: "table",
    front: "<p>TablaVacía</p>",
    back: tableHtml(table),
    table,
  });
  await p.evaluate((s) => (window as any).__opogcQA.receive(s), s);
  await nav(p, "Biblioteca");
  await p
    .getByRole("textbox", { name: "Buscar biblioteca" })
    .fill("TablaVacía");
  await p.locator(".library-row-main").first().click();
  await p
    .getByRole("button", { name: "Mostrar soluciones", exact: true })
    .click();
  await expect(
    p.getByRole("button", {
      name: "Después de revisar mi respuesta, considero que es correcta",
      exact: true,
    }),
  ).toHaveCount(0);
});

test("Informe descargado incluye notas sin calificación y derivadas creadas ese día", async ({
  page: p,
}) => {
  const fs = await import("node:fs");
  await open(p);
  await pool(p);
  await p.getByRole("button", { name: "Añadir nota", exact: true }).click();
  const notes = p.getByRole("dialog", { name: "Notas de la tarjeta" });
  await notes
    .getByRole("textbox", { name: "Nota de la tarjeta" })
    .fill("No recuerdo la mayoría exigida");
  await notes
    .getByRole("button", { name: "Guardar nota", exact: true })
    .click();
  await expect(notes.locator(".note-text")).toBeVisible();
  await notes.getByRole("button", { name: "Cerrar", exact: true }).click();
  await derive(p);
  await p.getByRole("button", { name: "Salir", exact: true }).click();
  await nav(p, "Progreso");
  await p.getByRole("button", { name: /Informe diario para ChatGPT/ }).click();
  const downloading = p.waitForEvent("download");
  await p
    .getByRole("button", { name: "Exportar para ChatGPT", exact: true })
    .click();
  const json = JSON.parse(
    fs.readFileSync((await (await downloading).path())!, "utf8"),
  );
  expect(
    json.notesActivity.some(
      (e: any) => e.note.text === "No recuerdo la mayoría exigida",
    ),
  ).toBe(true);
  expect(
    json.derivedCardsCreated.some((e: any) => e.sourceCardId === "notes-0"),
  ).toBe(true);
  expect(json.attempts).toHaveLength(0);
});
test("Eliminar una tarjeta ya calificada conserva su intento y permite restaurar la copia", async ({
  page: p,
}) => {
  await open(p);
  await pool(p);
  await grade(p);
  await expect(p.locator(".review-prompt")).toHaveText("NotasPrueba 2");
  await actions(p, "Volver a la tarjeta anterior");
  await expect(p.locator(".review-prompt")).toHaveText("NotasPrueba 1");
  await actions(p, "Eliminar tarjeta");
  await p
    .getByRole("button", { name: "Eliminar y continuar", exact: true })
    .click();
  await expect(p.locator(".review-prompt")).toHaveText("NotasPrueba 2");
  const copy = await p.evaluate(async () => {
    const qa = (window as any).__opogcQA;
    return qa.roundtrip(await qa.backup());
  });
  expect(copy.reviews.filter((r: any) => r.cardId === "notes-0")).toHaveLength(
    1,
  );
  expect(copy.cards.some((c: any) => c.id === "notes-0")).toBe(false);
  await grade(p);
  await expect(p.locator(".review-prompt")).toHaveText("NotasPrueba 3");
});
test("Borrar la última tarjeta deja una sesión finalizable, sin puntuación inventada", async ({
  page: p,
}) => {
  await open(p);
  await nav(p, "Biblioteca");
  await p
    .getByRole("textbox", { name: "Buscar biblioteca" })
    .fill("NotasPrueba 1");
  await p.locator(".library-row-main").first().click();
  await actions(p, "Eliminar tarjeta");
  await p
    .getByRole("button", { name: "Eliminar y continuar", exact: true })
    .click();
  await expect(p.locator(".review-prompt")).toHaveCount(0);
  await expect(
    p.getByRole("button", { name: "Finalizar sesión", exact: true }),
  ).toBeVisible();
  const s = await state(p);
  expect(s.settings.activeCardSession.items).toHaveLength(0);
  expect(s.reviews.filter((r: any) => r.cardId === "notes-0")).toHaveLength(0);
});

test("Editar la original avisa a la derivada; confirmar la revisión no cambia su respuesta ni progreso", async ({
  page: p,
}) => {
  await open(p);
  await pool(p);
  await derive(p);
  await p.getByRole("button", { name: "Salir", exact: true }).click();
  await expect(p.locator(".review-v11")).toHaveCount(0);
  const s = await state(p),
    child = s.cards.find((c: any) => c.derivation?.sourceCardId === "notes-0");
  const before = child.back;
  s.cards = s.cards.map((c: any) =>
    c.id === "notes-0"
      ? { ...c, back: "<p>La original tiene una condición nueva</p>" }
      : c,
  );
  await p.evaluate((s) => (window as any).__opogcQA.receive(s), s);
  await nav(p, "Biblioteca");
  await p
    .getByRole("textbox", { name: "Buscar biblioteca" })
    .fill("¿Quién decide el plazo más breve?");
  await p
    .getByRole("button", { name: "Cancelar selección", exact: true })
    .click();
  await p.locator(".library-row-main").first().click();
  await p
    .getByRole("button", { name: "Tarjetas relacionadas", exact: true })
    .click();
  const related = p.getByRole("dialog", { name: "Tarjetas relacionadas" });
  await expect(related).toContainText("El contenido de origen ha cambiado");
  await related
    .getByRole("button", { name: "He revisado esta derivada", exact: true })
    .click();
  await expect(
    related.getByRole("button", {
      name: "He revisado esta derivada",
      exact: true,
    }),
  ).toHaveCount(0);
  const after = (await state(p)).cards.find((c: any) => c.id === child.id);
  expect(after.back).toBe(before);
  expect(after.reviewCount).toBe(0);
});
