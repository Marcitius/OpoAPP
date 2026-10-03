import { test, expect, type Page } from "@playwright/test";
const base = "http://127.0.0.1:4175/tests/ui/index.html";
async function open(page: Page, params = "") {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + params);
  await expect(
    page.getByRole("heading", { name: "Vamos con lo de hoy" }),
  ).toBeVisible();
}
async function more(page: Page, label: RegExp) {
  await page
    .locator(".ux-bottom-nav")
    .getByRole("button", { name: "Más", exact: true })
    .click();
  await page.getByRole("button", { name: label }).click();
}
async function grade(page: Page, label: string) {
  await page
    .getByRole("button", { name: "Mostrar respuesta", exact: true })
    .click();
  await page.getByRole("button", { name: label, exact: true }).click();
}
async function noTextFocus(page: Page) {
  expect(
    await page.evaluate(() =>
      document.activeElement?.matches(
        "input,textarea,select,[contenteditable=true]",
      ),
    ),
  ).toBe(false);
}
test("Aprendizaje nuevo: fallos espaciados, checkpoint tras recarga y graduación real", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-02T08:00:00Z") });
  await open(page, "?learning");
  await page
    .locator(".ux-bottom-nav")
    .getByRole("button", { name: "Estudiar", exact: true })
    .click();
  await page.getByRole("button", { name: /Aprender tarjetas/ }).click();
  await expect(page.locator(".review-prompt")).toContainText("Artículo 53");
  await grade(page, "Otra vez");
  await expect(page.locator(".review-prompt")).toContainText("Artículo 164");
  await grade(page, "Fácil");
  await grade(page, "Fácil");
  await expect(
    page.getByRole("heading", { name: "El refuerzo está preparado." }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/capturas/refuerzo-movil.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Salir y continuar después" }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Vamos con lo de hoy" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Repaso libre|Repasar ahora/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "El refuerzo está preparado." }),
  ).toBeVisible();
  await page.clock.fastForward(61_000);
  await expect(page.locator(".review-prompt")).toContainText("Artículo 53");
  await grade(page, "Otra vez");
  await expect(
    page.getByRole("heading", { name: "El refuerzo está preparado." }),
  ).toBeVisible();
  await page.clock.fastForward(61_000);
  await grade(page, "Bien");
  await expect(
    page.getByRole("heading", { name: "El refuerzo está preparado." }),
  ).toBeVisible();
  await page.clock.fastForward(601_000);
  await grade(page, "Bien");
  await expect(
    page.getByRole("heading", { name: "Un paso más cerca." }),
  ).toBeVisible();
  const s = await page.evaluate(() => (window as any).__opogcQA.state()),
    c = s.cards.find((c: any) => c.id === "basic1");
  expect(c.fsrsState).toBe(2);
  expect(c.fsrsReps).toBe(4);
  expect(c.reviewCount).toBe(1);
  expect(
    s.reviews
      .filter((r: any) => r.cardId === "basic1")
      .map((r: any) => r.rating),
  ).toEqual(["again", "again", "good", "good"]);
  expect(
    s.settings.activeCardSession.items.find((i: any) => i.id === "basic1")
      .status,
  ).toBe("remembered");
  await page.reload();
  const reopened = await page.evaluate(() => (window as any).__opogcQA.state());
  expect(reopened.cards.find((c: any) => c.id === "basic1").fsrsReps).toBe(4);
});
test("Plan rápido: mover Hoy ↔ Después conserva el ID y permite nota sin fecha", async ({
  page,
}) => {
  await open(page);
  await more(page, /Organizar temario/);
  await expect(page.getByRole("heading", { name: /Hoy 3/ })).toBeVisible();
  await page
    .getByRole("button", {
      name: "Opciones de Artículo 164 · Sentencias del Tribunal Constitucional",
    })
    .click();
  await noTextFocus(page);
  await page
    .getByRole("button", { name: "Estudiar después", exact: true })
    .click();
  const s = await page.evaluate(() => (window as any).__opogcQA.state());
  expect(s.studyTasks.find((t: any) => t.id === "task164").planBucket).toBe(
    "next",
  );
  expect(s.studyTasks.find((t: any) => t.id === "task164").plannedFor).toBe("");
  await page
    .getByRole("button", {
      name: "Opciones de Artículo 164 · Sentencias del Tribunal Constitucional",
    })
    .click();
  await page.getByRole("button", { name: "Fecha o nota opcional" }).click();
  await noTextFocus(page);
  await page.getByRole("textbox", { name: /Nota/ }).fill("Mi próximo apartado");
  await page.getByLabel("Fecha", { exact: true }).fill("");
  await page
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Opciones de Artículo 164 · Sentencias del Tribunal Constitucional",
    })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Añadir a hoy", exact: true })
    .click();
  const next = await page.evaluate(() => (window as any).__opogcQA.state());
  expect(next.studyTasks).toHaveLength(3);
  expect(next.studyTasks.find((t: any) => t.id === "task164").note).toBe(
    "Mi próximo apartado",
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "docs/capturas/organizar-movil.png",
    animations: "disabled",
  });
});
test("Biblioteca → temario: editar, cambiar jerarquía, previsualizar, enlazar y reimportar", async ({
  page,
}) => {
  await open(page);
  await more(page, /Biblioteca/);
  const before = await page.evaluate(() => (window as any).__opogcQA.state());
  async function bridge() {
    await page
      .getByRole("button", { name: "Opciones de la biblioteca", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Importar al temario de estudio",
        exact: true,
      })
      .click();
  }
  await bridge();
  await noTextFocus(page);
  await page
    .getByRole("textbox", { name: "Nombre de Artículo 53", exact: true })
    .fill("Garantías enlazadas");
  await page
    .getByRole("button", { name: "Jerarquía de Garantías enlazadas" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(2);
  await noTextFocus(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Jerarquía de Garantías enlazadas" })
    .click();
  await page.getByLabel("Nuevo padre del elemento").selectOption("");
  await page.getByLabel("Destino en el temario").selectOption("root");
  await page.getByRole("button", { name: /Previsualizar/ }).click();
  await expect(page.locator(".bridge-preview")).toContainText(
    "Garantías enlazadas",
  );
  await page.screenshot({
    path: "docs/capturas/biblioteca-temario-movil.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Confirmar importación" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const after = await page.evaluate(() => (window as any).__opogcQA.state()),
    node = after.studyNodes.find((n: any) => n.name === "Garantías enlazadas");
  expect(node.sourceCardIds).toEqual(["basic1"]);
  expect(node.parentId).toBe("root");
  expect(after.cards).toEqual(before.cards);
  expect(after.studyTasks).toEqual(before.studyTasks);
  await bridge();
  await page.getByRole("button", { name: /Previsualizar/ }).click();
  await page.getByRole("button", { name: "Confirmar importación" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const again = await page.evaluate(() => (window as any).__opogcQA.state());
  expect(again.studyNodes.map((n: any) => n.id).sort()).toEqual(
    after.studyNodes.map((n: any) => n.id).sort(),
  );
  await page
    .locator(".ux-bottom-nav")
    .getByRole("button", { name: "Estudiar", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Buscar apartado" })
    .fill("Artículo 53");
  await page
    .locator(".study-start-page .simple-row")
    .filter({ hasText: "Artículo 53" })
    .last()
    .click();
  await expect(page.locator(".review-v11")).toBeVisible();
  await expect(page.locator(".review-prompt")).toContainText("Artículo 53 CE");
});
test("Mover y reordenar tarjetas y ramas mantiene relaciones y datos después de recargar", async ({
  page,
}) => {
  await open(page);
  await more(page, /Biblioteca/);
  await page.locator(".folder-card").first().click();
  await page.locator(".subtopic-card").first().click();
  const rows = page.locator(".card-table .card-row");
  await rows
    .first()
    .getByRole("button", { name: "Mover o reordenar tarjeta" })
    .click();
  await page.getByRole("button", { name: "Mover abajo", exact: true }).click();
  let s = await page.evaluate(() => (window as any).__opogcQA.state());
  expect(s.cards.find((c: any) => c.id === "basic1").sortOrder).toBe(1);
  await rows
    .first()
    .getByRole("button", { name: "Mover o reordenar tarjeta" })
    .click();
  await noTextFocus(page);
  await page.getByLabel("Carpeta de destino").selectOption("deck");
  await page
    .getByRole("button", { name: "Mover tarjeta", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Opciones de la carpeta", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Sacar un nivel", exact: true })
    .click();
  await page.reload();
  s = await page.evaluate(() => (window as any).__opogcQA.state());
  expect(s.folders.find((f: any) => f.id === "deck2").parentId).toBe(null);
  expect(s.cards.find((c: any) => c.id === "basic2").folderId).toBe("deck");
  expect(s.cards.find((c: any) => c.id === "basic1").folderId).toBe("deck2");
  expect(s.cards.find((c: any) => c.id === "basic2").reviewCount).toBe(1);
});
test("Creación de tarjetas y formularios no enfocan campos al abrirse", async ({
  page,
}) => {
  await open(page);
  await more(page, /Biblioteca/);
  await page.getByRole("button", { name: "Tarjeta", exact: true }).click();
  await noTextFocus(page);
  const editor = page.locator("[contenteditable=true]");
  await editor.first().fill("Nueva pregunta");
  await editor.nth(1).fill("Nueva respuesta");
  await page
    .getByRole("button", { name: "Guardar tarjeta", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const s = await page.evaluate(() => (window as any).__opogcQA.state());
  expect(s.cards.some((c: any) => c.front.includes("Nueva pregunta"))).toBe(
    true,
  );
  await page
    .getByRole("button", { name: "Opciones de la biblioteca", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Crear carpeta", exact: true })
    .click();
  await noTextFocus(page);
  await page.getByRole("textbox", { name: "Nombre", exact: true }).click();
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe(
    "INPUT",
  );
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
});
