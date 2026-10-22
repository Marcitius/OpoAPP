import { test, expect, type Page } from "@playwright/test";
const url = "http://127.0.0.1:4175/tests/ui/index.html";
async function open(p: Page, w = 390, h = 844) {
  await p.setViewportSize({ width: w, height: h });
  await p.goto(url);
  await expect(
    p.getByRole("heading", { name: "Vamos con lo de hoy" }),
  ).toBeVisible();
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
async function library(p: Page) {
  await nav(p, "Biblioteca");
}
async function state(p: Page) {
  return p.evaluate(() => (window as any).__opogcQA.state());
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
async function regular(p: Page) {
  await nav(p, "Repasar");
  await p
    .locator(".review-collections")
    .getByRole("button", { name: /^Regular\s/ })
    .click();
}
async function filter(p: Page, container: string) {
  await p
    .locator(container)
    .getByRole("button", { name: "Temas de Biblioteca", exact: true })
    .click();
  await noFocus(p);
  await p
    .getByRole("dialog")
    .last()
    .getByRole("button", {
      name: "Entrar en Constitución Española",
      exact: true,
    })
    .click();
  await p
    .getByRole("dialog")
    .last()
    .getByRole("button", {
      name: "Seleccionar Título IX · Tribunal Constitucional",
      exact: true,
    })
    .click();
  await p
    .getByRole("button", { name: "Aplicar selección", exact: true })
    .click();
}
test("Guardar antes de responder, valorar, cerrar y retirar conservando memoria", async ({
  page,
  context,
}) => {
  await open(page);
  await page
    .getByRole("button", { name: /Repasar ahora/ })
    .first()
    .click();
  const before = await state(page);
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Guardar para repasar", exact: true })
    .click();
  await noFocus(page);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Regular", exact: true })
    .click();
  await page.screenshot({
    path: "docs/capturas/guardar-repaso-movil.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  const saved = await state(page);
  expect(saved.cards).toEqual(before.cards);
  expect(saved.reviews).toEqual(before.reviews);
  await page
    .getByRole("button", { name: "Mostrar respuesta", exact: true })
    .click();
  await page.getByRole("button", { name: "Fácil", exact: true }).click();
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await context.setOffline(false);
  await page.reload();
  await regular(page);
  await expect(page.locator(".collection-card")).toHaveCount(1);
  await page.screenshot({
    path: "docs/capturas/colecciones-movil.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: /Empezar repaso/ }).click();
  await page
    .getByRole("dialog", { name: "Tienes una sesión guardada" })
    .getByRole("button", { name: "Finalizar actual y empezar otra" })
    .click();
  await page.getByRole("button", { name: /Guardada en 1 colección/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Regular", exact: true })
    .click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  expect((await state(page)).settings["reviewMembership:regular:basic1"]).toBe(
    false,
  );
});
test("Crear colección durante una tarjeta no abre el teclado ni avanza", async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole("button", { name: /Repasar ahora/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Guardar para repasar", exact: true })
    .click();
  await page
    .getByRole("button", { name: "+ Crear colección", exact: true })
    .click();
  await noFocus(page);
  await page
    .getByRole("textbox", { name: "Nombre de la colección" })
    .fill("Plazos importantes");
  await page
    .getByRole("button", { name: "Crear y guardar", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Plazos importantes", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.locator(".review-prompt")).toContainText("Artículo 53");
});
test("Biblioteca: padre e hijo y tarjeta seleccionados se mueven entre ramas sin perder datos", async ({
  page,
}) => {
  await open(page);
  await library(page);
  await page
    .getByRole("button", { name: "Opciones de la biblioteca", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Crear carpeta", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Nombre", exact: true })
    .fill("Destino de prueba");
  await page.getByRole("button", { name: "Crear tema", exact: true }).click();
  await expect
    .poll(async () =>
      (await state(page)).folders.some(
        (f: any) => f.name === "Destino de prueba",
      ),
    )
    .toBe(true);
  const before = await state(page);
  await page.getByRole("button", { name: "Seleccionar", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Seleccionar rama Constitución Española",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "Entrar en Constitución Española",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "Seleccionar rama Título IX · Tribunal Constitucional",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "Entrar en Título IX · Tribunal Constitucional",
      exact: true,
    })
    .click();
  await page
    .locator(".library-card-row")
    .first()
    .getByRole("button", { name: /Seleccionar tarjeta/ })
    .click();
  await page.screenshot({
    path: "docs/capturas/seleccion-biblioteca-movil.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Mover a…", exact: true }).click();
  await noFocus(page);
  await expect(
    page.getByRole("button", {
      name: "Seleccionar Constitución Española",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Seleccionar Destino de prueba", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mover selección", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  const after = await state(page);
  expect(after.cards).toEqual(before.cards);
  expect(after.reviews).toEqual(before.reviews);
  expect(after.studyTasks).toEqual(before.studyTasks);
  expect(after.folders.find((f: any) => f.id === "deck").parentId).toBe(
    after.folders.find((f: any) => f.name === "Destino de prueba").id,
  );
  expect(after.folders.find((f: any) => f.id === "deck2").parentId).toBe(
    "deck",
  );
});
test("Mover tarjeta a raíz mantiene pertenencia y el filtro por subtema responde al cambio", async ({
  page,
}) => {
  await open(page);
  await library(page);
  await filter(page, ".library-browser-v13");
  await expect(page.locator(".library-card-row")).toHaveCount(
    (await state(page)).cards.length,
  );
  await page.getByRole("button", { name: "Seleccionar", exact: true }).click();
  await page
    .locator(".library-card-row")
    .first()
    .getByRole("button", { name: /Seleccionar tarjeta/ })
    .click();
  await page
    .getByRole("button", { name: "Guardar para repasar", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Regular", exact: true })
    .click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Mover a…", exact: true }).click();
  await page
    .getByRole("button", { name: "Mover selección", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const s = await state(page);
  expect(s.cards.find((c: any) => c.id === "basic1").folderId).toBe(
    s.folders.find((f: any) => f.isUnfiled).id,
  );
  await regular(page);
  await filter(page, ".review-collections");
  await expect(page.locator(".collection-card")).toHaveCount(0);
  await page
    .locator(".review-collections")
    .getByRole("button", { name: "Temas de Biblioteca", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Todos los temas/ })
    .click();
  await page
    .getByRole("button", { name: "Aplicar selección", exact: true })
    .click();
  await expect(page.locator(".collection-card")).toHaveCount(1);
});
test("Temario: selección entre niveles mueve la rama conservando planificación e IDs", async ({
  page,
}) => {
  await open(page);
  await nav(page, "Más");
  await page.getByRole("button", { name: /Organizar temario/ }).click();
  await page.getByRole("button", { name: /Ver y organizar temario/ }).click();
  const before = await state(page);
  await page
    .getByRole("button", { name: "Opciones del temario", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Seleccionar varios", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Entrar en Derecho Constitucional",
      exact: true,
    })
    .click();
  await page
    .locator(".temario-row")
    .filter({ hasText: "Título IX" })
    .getByRole("button")
    .first()
    .click();
  await page
    .getByRole("button", {
      name: "Entrar en Título IX · Tribunal Constitucional",
      exact: true,
    })
    .click();
  await page
    .locator(".temario-row")
    .filter({ hasText: "Artículo 164" })
    .getByRole("button")
    .first()
    .click();
  await page.getByRole("button", { name: "Mover a…", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Entrar en Derecho Constitucional",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Seleccionar Título IX · Tribunal Constitucional",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("button", {
      name: "Seleccionar Título X · Reforma constitucional",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Mover selección", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const after = await state(page);
  expect(after.studyTasks).toEqual(before.studyTasks);
  expect(after.studyNodes.find((n: any) => n.id === "title").parentId).toBe(
    "reforma",
  );
  expect(after.studyNodes.find((n: any) => n.id === "article").parentId).toBe(
    "title",
  );
  expect(after.studyNodes.map((n: any) => n.id)).toEqual(
    before.studyNodes.map((n: any) => n.id),
  );
});
for (const [w, h] of [
  [360, 800],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1366, 768],
  [1920, 1080],
])
  test(`Filtros y colecciones ${w}x${h}: niveles, búsqueda, foco y capas`, async ({
    page,
  }) => {
    await open(page, w, h);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await nav(page, "Repasar");
    await page
      .locator(".review-collections")
      .getByRole("button", { name: "+ Colección", exact: true })
      .click();
    await noFocus(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await regular(page);
    await filter(page, ".review-collections");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page
      .locator(".review-collections")
      .getByRole("button", { name: "Apartados del temario", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Entrar en Derecho Constitucional",
        exact: true,
      })
      .click();
    await noFocus(page);
    if (w === 360)
      await page.screenshot({
        path: "docs/capturas/filtros-movil.png",
        animations: "disabled",
      });
    await page
      .getByRole("dialog")
      .getByRole("textbox", { name: "Buscar tema o apartado", exact: true })
      .fill("Nivel 12");
    await expect(
      page.getByRole("button", { name: /Seleccionar Nivel 12/ }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
test("Renombrar y eliminar colección persiste después de volver a abrir", async ({
  page,
}) => {
  await open(page);
  await nav(page, "Repasar");
  await page
    .getByRole("button", { name: "Editar colección Mal", exact: true })
    .click();
  await noFocus(page);
  await page
    .getByRole("textbox", { name: "Nombre", exact: true })
    .fill("Fallos para afianzar");
  await page
    .getByRole("button", { name: "Guardar colección", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Editar colección Fallos para afianzar",
      exact: true,
    })
    .click();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Eliminar colección", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await nav(page, "Repasar");
  await expect(
    page.getByRole("button", {
      name: "Editar colección Fallos para afianzar",
      exact: true,
    }),
  ).toHaveCount(0);
  expect((await state(page)).cards.length).toBeGreaterThan(0);
});
test("Varias tarjetas filtradas se mueven juntas sin modificar FSRS", async ({
  page,
}) => {
  await open(page);
  await library(page);
  await page
    .getByRole("textbox", { name: "Buscar biblioteca", exact: true })
    .fill("Artículo");
  await expect(page.locator(".library-card-row")).toHaveCount(2);
  const before = await state(page);
  await page.getByRole("button", { name: "Seleccionar", exact: true }).click();
  await page
    .getByRole("button", { name: "Seleccionar este nivel", exact: true })
    .click();
  await page.getByRole("button", { name: "Mover a…", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Seleccionar Constitución Española",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Mover selección", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const after = await state(page);
  for (const id of ["basic1", "basic2"]) {
    const a = before.cards.find((c: any) => c.id === id),
      b = after.cards.find((c: any) => c.id === id);
    expect(b.folderId).toBe("deck");
    expect(b.dueAt).toBe(a.dueAt);
    expect(b.reviewCount).toBe(a.reviewCount);
    expect(b.fsrsStability).toBe(a.fsrsStability);
  }
  expect(after.reviews).toEqual(before.reviews);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Vamos con lo de hoy" }),
  ).toBeVisible();
  expect(
    (await state(page)).cards
      .filter((c: any) => ["basic1", "basic2"].includes(c.id))
      .every((c: any) => c.folderId === "deck"),
  ).toBe(true);
});
