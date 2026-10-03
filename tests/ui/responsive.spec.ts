import { test, expect, type Page } from "@playwright/test";
const base = "http://127.0.0.1:4175/tests/ui/index.html";
const captures = "docs/capturas";
async function open(page: Page) {
  await page.goto(base);
  await expect(
    page.getByRole("heading", { name: "Vamos con lo de hoy" }),
  ).toBeVisible();
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}
async function nav(page: Page, width: number, label: string) {
  await page
    .locator(width >= 1000 ? ".ux-sidebar" : ".ux-bottom-nav")
    .getByRole("button", { name: label, exact: true })
    .click();
}
const sizes = [
  ["iphone-pequeno", 390, 844],
  ["iphone-grande", 430, 932],
  ["android-pequeno", 360, 800],
  ["android-grande", 412, 915],
  ["ipad-vertical", 768, 1024],
  ["ipad-horizontal", 1024, 768],
  ["desktop", 1366, 768],
  ["desktop-grande", 1920, 1080],
] as const;
for (const [label, width, height] of sizes) {
  test(`${label}: navegación, estudio, repaso, temario y capas`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await open(page);
    await noOverflow(page);
    const links = page.locator(
      width >= 1000 ? ".ux-sidebar nav" : ".ux-bottom-nav",
    );
    await expect(links.getByRole("button")).toHaveCount(5);
    if (width < 1000) {
      const b = await links.boundingBox();
      expect(b!.y + b!.height).toBeLessThanOrEqual(height + 1);
      expect(b!.height).toBeGreaterThanOrEqual(65);
    }
    if (label === "iphone-pequeno")
      await page.screenshot({
        path: `${captures}/hoy-movil.png`,
        animations: "disabled",
      });
    if (label === "ipad-horizontal")
      await page.screenshot({
        path: `${captures}/ipad.png`,
        animations: "disabled",
      });
    if (label === "desktop")
      await page.screenshot({
        path: `${captures}/desktop.png`,
        animations: "disabled",
      });
    await page
      .getByRole("button", { name: /Repasar ahora/ })
      .first()
      .click();
    await expect(page.locator(".review-v11")).toBeVisible();
    await page
      .getByRole("button", { name: "Mostrar respuesta", exact: true })
      .click();
    await expect(page.locator(".review-rating-buttons")).toBeVisible();
    if (label === "iphone-pequeno")
      await page.screenshot({
        path: `${captures}/repaso-movil.png`,
        animations: "disabled",
      });
    const footer = await page.locator(".review-controls").boundingBox();
    expect(footer!.y + footer!.height).toBeLessThanOrEqual(height + 1);
    await page.getByRole("button", { name: "Bien", exact: true }).click();
    await expect(page.locator(".review-prompt")).toBeVisible();
    await page
      .locator(".review-v11")
      .getByRole("button", { name: "Salir", exact: true })
      .click();
    await page
      .getByRole("button", { name: /Continuar estudio/ })
      .first()
      .click();
    await expect(page.locator(".study-session")).toBeVisible();
    if (label === "iphone-pequeno")
      await page.screenshot({
        path: `${captures}/estudio-movil.png`,
        animations: "disabled",
      });
    await page
      .getByRole("button", { name: "Terminar estudio", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "¿Cómo ha ido?" }),
    ).toBeVisible();
    await noOverflow(page);
    await page.getByRole("button", { name: "Bien", exact: true }).click();
    await page
      .getByRole("textbox", { name: /Nota/ })
      .fill("Mejor literalidad.");
    await page
      .getByRole("button", { name: "Guardar y siguiente", exact: true })
      .click();
    await expect(page.locator(".study-session-content h1")).toHaveText(
      "Artículo 53 · Garantías de los derechos",
    );
    await page
      .locator(".study-session")
      .getByRole("button", { name: "Salir", exact: true })
      .click();
    await nav(page, width, "Más");
    await page.getByRole("button", { name: /Organizar temario/ }).click();
    await page
      .locator(".study-view-switch")
      .getByRole("button", { name: "Temario", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Mi temario", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Derecho Constitucional/ })
      .first()
      .click();
    await page
      .getByRole("button", { name: /Título IX · Tribunal Constitucional/ })
      .first()
      .click();
    if (label === "iphone-pequeno")
      await page.screenshot({
        path: `${captures}/temario-movil.png`,
        animations: "disabled",
      });
    const before = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
    await page
      .getByRole("button", {
        name: "Acciones de Artículo 164 · Sentencias del Tribunal Constitucional",
        exact: true,
      })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page
      .getByRole("button", { name: "Editar o mover", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Editar elemento del temario" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    await page.waitForTimeout(80);
    expect(await page.evaluate(() => ({ x: scrollX, y: scrollY }))).toEqual(
      before,
    );
    await noOverflow(page);
    await nav(page, width, "Progreso");
    await expect(
      page.getByRole("heading", { name: "Dedica tiempo a esto" }),
    ).toBeVisible();
    if (label === "iphone-pequeno")
      await page.screenshot({
        path: `${captures}/progreso-movil.png`,
        animations: "disabled",
      });
    expect(errors).toEqual([]);
  });
}
test("Varias tarjetas consecutivas, FSRS y registros individuales", async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole("button", { name: /Repasar ahora/ })
    .first()
    .click();
  for (let i = 0; i < 5; i++) {
    await page
      .getByRole("button", { name: "Mostrar respuesta", exact: true })
      .click();
    await page.getByRole("button", { name: "Bien", exact: true }).click();
  }
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__opogcQA.state().reviews.length),
    )
    .toBe(5);
  const s = await page.evaluate(() => (window as any).__opogcQA.state());
  expect(s.reviews).toHaveLength(5);
  expect(new Set(s.reviews.map((r: any) => r.id)).size).toBe(5);
  expect(s.cards.filter((c: any) => c.reviewCount > 1).length).toBe(5);
});
test("Bien, Regular y Mal con nota, siguiente automático y recarga IndexedDB", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: /Continuar estudio/ }).click();
  for (const [index, label] of ["Bien", "Regular", "Mal"].entries()) {
    await page
      .getByRole("button", { name: "Terminar estudio", exact: true })
      .click();
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.getByRole("textbox", { name: /Nota/ }).fill(`Nota ${index + 1}`);
    await page
      .getByRole("button", { name: "Guardar y siguiente", exact: true })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "Un paso más cerca." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Volver a Hoy", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Vamos con lo de hoy" }),
  ).toBeVisible();
  const s = await page.evaluate(() => (window as any).__opogcQA.state());
  expect(s.studyTasks.filter((t: any) => t.status === "done")).toHaveLength(3);
  expect(s.studyTasks.map((t: any) => t.assessment).sort()).toEqual([
    "bien",
    "mal",
    "regular",
  ]);
  expect(s.studyTasks.map((t: any) => t.completionNote).sort()).toEqual([
    "Nota 1",
    "Nota 2",
    "Nota 3",
  ]);
  const a = await page.evaluate(() => (window as any).__opogcQA.account());
  expect(
    Object.values(a.rows).filter(
      (r: any) => r.kind === "studySessions" && !r.deleted,
    ),
  ).toHaveLength(3);
  expect(a.queue.length).toBeGreaterThan(0);
});
test("Árbol: crear, editar, mover, reordenar y eliminar conservando IDs", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await nav(page, 390, "Más");
  await page.getByRole("button", { name: /Organizar temario/ }).click();
  await page
    .locator(".study-view-switch")
    .getByRole("button", { name: "Temario", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Añadir elemento", exact: true })
    .last()
    .click();
  await page
    .getByRole("textbox", { name: "Nombre", exact: true })
    .fill("Tema de prueba");
  await page
    .getByRole("button", { name: "Añadir al temario", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).__opogcQA
          .state()
          .studyNodes.some((n: any) => n.name === "Tema de prueba"),
      ),
    )
    .toBe(true);
  let s = await page.evaluate(() => (window as any).__opogcQA.state());
  const id = s.studyNodes.find((n: any) => n.name === "Tema de prueba").id;
  await page
    .getByRole("button", { name: "Acciones de Tema de prueba", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Subir en este nivel", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        (id) =>
          (window as any).__opogcQA
            .state()
            .studyNodes.find((n: any) => n.id === id).sortOrder,
        id,
      ),
    )
    .toBe(0);
  await page
    .getByRole("button", { name: "Acciones de Tema de prueba", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Editar o mover", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Nombre", exact: true })
    .fill("Tema renombrado");
  await page.getByLabel("Ubicación", { exact: true }).selectOption("root");
  await page
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        (id) =>
          (window as any).__opogcQA
            .state()
            .studyNodes.find((n: any) => n.id === id).parentId,
        id,
      ),
    )
    .toBe("root");
  await page
    .getByRole("button", { name: /Derecho Constitucional/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Acciones de Tema renombrado", exact: true })
    .click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", {
      name: "Eliminar elemento y subapartados",
      exact: true,
    })
    .click();
  await expect
    .poll(async () =>
      page.evaluate(
        (id) =>
          !(window as any).__opogcQA
            .state()
            .studyNodes.some((n: any) => n.id === id),
        id,
      ),
    )
    .toBe(true);
});
test("Biblioteca: búsqueda, tipos, test, vocabulario, escrita y ortografía", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await nav(page, 390, "Más");
  await page.getByRole("button", { name: /Biblioteca/ }).click();
  const search = page.getByRole("textbox", { name: "Buscar biblioteca" });
  await search.fill("Vocabulario:");
  await page.locator(".library-result-main").first().click();
  await page.locator(".review-options button").first().click();
  await page.getByRole("button", { name: "Comprobar", exact: true }).click();
  await page.getByRole("button", { name: "Bien", exact: true }).click();
  await page.getByRole("button", { name: "Volver a Hoy", exact: true }).click();
  await nav(page, 390, "Más");
  await page.getByRole("button", { name: /Biblioteca/ }).click();
  await search.fill("Test múltiple:");
  await page.locator(".library-result-main").first().click();
  await page.locator(".review-options button").nth(0).click();
  await page.locator(".review-options button").nth(1).click();
  await page.getByRole("button", { name: "Comprobar", exact: true }).click();
  await expect(page.getByText("✓ Correcto", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Bien", exact: true }).click();
  await page.getByRole("button", { name: "Volver a Hoy", exact: true }).click();
  await nav(page, 390, "Más");
  await page.getByRole("button", { name: /Biblioteca/ }).click();
  await search.fill("Respuesta escrita:");
  await page.locator(".library-result-main").first().click();
  await page
    .getByRole("textbox", { name: "Tu respuesta", exact: true })
    .fill("contenido esencial");
  await page
    .getByRole("button", { name: "Comprobar respuesta", exact: true })
    .click();
  await expect(page.getByText("100%", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Guardar y continuar", exact: true })
    .click();
  await page.getByRole("button", { name: "Volver a Hoy", exact: true }).click();
  await nav(page, 390, "Más");
  await page.getByRole("button", { name: /Biblioteca/ }).click();
  await search.fill("espavilar");
  await page.locator(".library-result-main").first().click();
  await page.getByRole("button", { name: "espavilar", exact: true }).click();
  await page.getByRole("button", { name: "Corregir", exact: true }).click();
  await expect(
    page.getByText("espavilar → espabilar", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  const s = await page.evaluate(() => (window as any).__opogcQA.state());
  expect(s.reviews).toHaveLength(4);
});
test("Tarjeta larga: scroll interior y valoración siempre accesible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await open(page);
  await nav(page, 360, "Más");
  await page.getByRole("button", { name: /Biblioteca/ }).click();
  await page
    .getByRole("textbox", { name: "Buscar biblioteca" })
    .fill("Tarjeta larga:");
  await page.locator(".library-result-main").first().click();
  await page
    .getByRole("button", { name: "Mostrar respuesta", exact: true })
    .click();
  await page
    .locator(".review-stage")
    .evaluate((el) => (el.scrollTop = el.scrollHeight));
  await expect(
    page.getByRole("button", { name: "Bien", exact: true }),
  ).toBeInViewport();
  await noOverflow(page);
  await page.getByRole("button", { name: "Bien", exact: true }).click();
});
test("Psicotécnicos, nota e intento existentes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await nav(page, 390, "Más");
  await page.getByRole("button", { name: /Psicotécnicos/ }).click();
  await expect(
    page.getByRole("heading", { name: "Psico 14 · Vocabulario", exact: true }),
  ).toBeVisible();
  await page
    .locator(".psych-card")
    .filter({
      has: page.getByRole("heading", {
        name: "Psico 14 · Vocabulario",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Ver ficha", exact: true })
    .click();
  await expect(
    page.getByText("Repasar los sinónimos.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "＋ Registrar intento", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await noOverflow(page);
});
test("Bottom sheet: arrastre, teclado reducido, foco y cuenta", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await nav(page, 390, "Más");
  await page.getByRole("button", { name: /Preferencias de estudio/ }).click();
  const handle = page.locator(".sheet-drag-area");
  const box = await handle.boundingBox();
  await page.mouse.move(box!.x + 50, box!.y + 10);
  await page.mouse.down();
  await page.mouse.move(box!.x + 50, box!.y + 105, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: /Preferencias de estudio/ }).click();
  await page.setViewportSize({ width: 390, height: 500 });
  await expect
    .poll(async () => {
      const sheet = await page.getByRole("dialog").boundingBox();
      return sheet!.y + sheet!.height;
    })
    .toBeLessThanOrEqual(501);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Cuenta y datos/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Cuenta", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("cuenta-de-pruebas@example.test", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
});
test("Production PWA: manifest, iconos, Service Worker y recarga offline", async ({
  page,
  context,
}) => {
  await page.goto("http://127.0.0.1:3001");
  await expect(
    page.getByRole("heading", { name: "Configura OpoGC" }),
  ).toBeVisible();
  const manifest = await page.evaluate(
    async () => await (await fetch("/manifest.webmanifest")).json(),
  );
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.some((x: any) => x.sizes === "192x192")).toBe(true);
  expect(manifest.icons.some((x: any) => x.sizes === "512x512")).toBe(true);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Configura OpoGC" }),
  ).toBeVisible();
  await context.setOffline(false);
});
test("50 tarjetas consecutivas sin reconfigurar ni perder registros", async ({
  page,
}) => {
  await page.goto(base + "?bulk=1");
  await page.getByRole("button", { name: /Repasar ahora/ }).click();
  for (let i = 0; i < 50; i++) {
    await page
      .getByRole("button", { name: "Mostrar respuesta", exact: true })
      .click();
    await page.getByRole("button", { name: "Bien", exact: true }).click();
  }
  await expect(
    page.getByRole("heading", { name: "Un paso más cerca." }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__opogcQA.state().reviews.length),
    )
    .toBe(50);
});
test("Doce niveles, atrás y cambio de orientación sin overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await nav(page, 390, "Más");
  await page.getByRole("button", { name: /Organizar temario/ }).click();
  await page
    .locator(".study-view-switch")
    .getByRole("button", { name: "Temario", exact: true })
    .click();
  await page
    .getByRole("button", { name: /Derecho Constitucional/ })
    .first()
    .click();
  for (let i = 1; i <= 12; i++) {
    await page
      .locator(".temario-row-main")
      .filter({ hasText: `Nivel ${i} ·` })
      .click();
    await noOverflow(page);
  }
  await page.setViewportSize({ width: 844, height: 390 });
  await noOverflow(page);
  await expect(
    page.getByRole("button", { name: "Estudiar este apartado", exact: false }),
  ).toBeVisible();
  await page.locator(".temario-toolbar").getByRole("button").first().click();
  await expect(page.locator(".temario-location h2")).toContainText("Nivel 11");
});
test("Altura visual del teclado con layout intacto", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await nav(page, 390, "Más");
  await page.getByRole("button", { name: /Preferencias de estudio/ }).click();
  await page.evaluate(() => {
    document.documentElement.style.setProperty("--visual-height", "480px");
    document.documentElement.style.setProperty("--visual-offset", "80px");
  });
  await expect
    .poll(async () => {
      const b = await page.getByRole("dialog").boundingBox();
      return b!.y + b!.height;
    })
    .toBeLessThanOrEqual(561);
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await noOverflow(page);
});
test("Offline: valoración duradera y backup portable con IDs e historial", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await context.setOffline(true);
  await page.getByRole("button", { name: /Continuar estudio/ }).click();
  await page
    .getByRole("button", { name: "Terminar estudio", exact: true })
    .click();
  await page.getByRole("button", { name: "Mal", exact: true }).click();
  await page.getByRole("textbox", { name: /Nota/ }).fill("Nota offline");
  await page
    .getByRole("button", { name: "Guardar y siguiente", exact: true })
    .click();
  await expect(page.locator(".study-session-content h1")).toContainText(
    "Artículo 53",
  );
  const result = await page.evaluate(async () => {
    const qa = (window as any).__opogcQA;
    const backup = await qa.backup();
    const parsed = qa.roundtrip(JSON.parse(JSON.stringify(backup)));
    return { state: qa.state(), parsed, account: await qa.account() };
  });
  expect(
    result.parsed.studyTasks.filter(
      (t: any) => t.completionNote === "Nota offline",
    ),
  ).toHaveLength(1);
  expect(result.parsed.studyNodes.map((n: any) => n.id)).toEqual(
    result.state.studyNodes.map((n: any) => n.id),
  );
  expect(result.account.queue.length).toBeGreaterThan(0);
  await context.setOffline(false);
});
test("Cuenta vacía: sin reinicio ni inserción de datos de ejemplo", async ({
  page,
}) => {
  await page.goto(base + "?empty=1");
  await expect(
    page.getByRole("button", { name: /Repaso libre/ }),
  ).toBeVisible();
  const s = await page.evaluate(() => (window as any).__opogcQA.state());
  expect(s.cards).toHaveLength(0);
  expect(s.studyNodes).toHaveLength(0);
  expect(s.reviews).toHaveLength(0);
  await page.getByRole("button", { name: /Estudiar ahora/ }).click();
  await expect(
    page.getByRole("heading", { name: "Tu preparación empieza aquí" }),
  ).toBeVisible();
});

test("Editor e importación de tarjetas: pantalla completa móvil", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await nav(page, 390, "Más");
  await page.getByRole("button", { name: /Biblioteca/ }).click();
  await page.getByRole("button", { name: "Tarjeta", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toHaveClass(/sheet-fullscreen/);
  await expect(sheet.locator("select").first()).toBeVisible();
  await noOverflow(page);
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page
    .getByRole("button", { name: "Opciones de la biblioteca", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Importar tarjetas JSON", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveClass(/sheet-fullscreen/);
  await expect(page.getByRole("dialog").locator("textarea")).toBeVisible();
  await noOverflow(page);
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
});
test("Imagen y PDF sobre un formulario: capas, foco y Escape", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/pdf.min.mjs*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: 'export const GlobalWorkerOptions={}; export const getDocument=()=>({promise:Promise.reject(new Error("UI fixture: no remote file"))});',
    }),
  );
  await page.goto(base + "?overlay=1");
  for (const [label, selector] of [
    ["imagen", ".image-annotator"],
    ["PDF", ".pdf-editor"],
  ]) {
    await page
      .getByRole("button", { name: `Abrir ${label} de prueba`, exact: true })
      .click();
    await expect(page.locator(selector)).toBeVisible();
    expect(
      await page.locator(selector).evaluate((el) => {
        const portal = el.parentElement;
        return (
          portal?.classList.contains("overlay-portal") &&
          portal.parentElement === document.body
        );
      }),
    ).toBe(true);
    const b = await page.locator(selector).boundingBox();
    expect(b!.width).toBe(390);
    expect(b!.height).toBe(844);
    expect(
      await page
        .locator(selector)
        .evaluate((el) => parseInt(getComputedStyle(el).zIndex)),
    ).toBeGreaterThan(10000);
    await page.keyboard.press("Escape");
    await expect(page.locator(selector)).toHaveCount(0);
    await expect(
      page.getByRole("dialog", { name: "Formulario con adjunto", exact: true }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Planificación v10: repasos existentes conservados y sin duplicar contadores", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "?legacy-plan=1");
  await expect(
    page.getByRole("button", { name: /Estudiar ahora/ }),
  ).toBeVisible();
  await nav(page, 390, "Repasar");
  await page.getByRole("button", { name: /Repasos del temario/ }).click();
  await expect(page.locator(".study-session-content h1")).toContainText(
    "Artículo 164",
  );
  await page
    .getByRole("button", { name: "Terminar estudio", exact: true })
    .click();
  await page.getByRole("button", { name: "Regular", exact: true }).click();
  await page
    .getByRole("button", { name: "Guardar y siguiente", exact: true })
    .click();
  await expect(page.locator(".study-session-content h1")).toContainText(
    "Artículo 53",
  );
  const task = await page.evaluate(() =>
    (window as any).__opogcQA
      .state()
      .studyTasks.find((t: any) => t.id === "task164"),
  );
  expect(task.reason).toBe("literalidad");
  expect(task.assessment).toBe("regular");
});

test("Prioridad de estudio: continúa solo los elementos planificados como estudio", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "?mixed-plan=1");
  await page
    .locator(".priority-row")
    .filter({ hasText: "Estudio planificado" })
    .click();
  await expect(page.locator(".study-session-content h1")).toContainText(
    "Artículo 53",
  );
  await page
    .getByRole("button", { name: "Terminar estudio", exact: true })
    .click();
  await page.getByRole("button", { name: "Bien", exact: true }).click();
  await page
    .getByRole("button", { name: "Guardar y siguiente", exact: true })
    .click();
  await expect(page.locator(".study-session-content h1")).toContainText(
    "Artículo 167",
  );
  const t = await page.evaluate(() =>
    (window as any).__opogcQA
      .state()
      .studyTasks.find((t: any) => t.id === "task164"),
  );
  expect(t.status).toBe("pending");
});
