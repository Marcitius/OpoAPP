import { test, expect, type Locator, type Page } from "@playwright/test";
const base = "http://127.0.0.1:4175/tests/ui/index.html";
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
  await p.goto(base);
  await expect(
    p.getByRole("heading", { name: "Vamos con lo de hoy" }),
  ).toBeVisible();
  await nav(p, "Biblioteca");
}
async function create(p: Page) {
  await p.getByRole("button", { name: "Tarjeta", exact: true }).click();
  await expect(
    p.getByRole("group", { name: "Editor de Pregunta", exact: true }),
  ).toBeVisible();
  await expect(front(p)).toBeVisible();
  await expect(back(p)).toBeVisible();
  await noFocus(p);
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
const front = (p: Page) =>
  p.getByRole("textbox", { name: "Escribe la pregunta", exact: true });
const back = (p: Page) =>
  p.getByRole("textbox", { name: /Puedes escribir una respuesta/ });
const tools = (p: Page, field = "Respuesta") =>
  p.getByRole("toolbar", { name: `Formato de ${field}`, exact: true });
const state = (p: Page) => p.evaluate(() => (window as any).__opogcQA.state());
async function paste(field: Locator, text: string, html = "") {
  await field.click();
  await field.evaluate(
    (node, { text, html }) => {
      const data = new DataTransfer();
      data.setData("text/plain", text);
      if (html) data.setData("text/html", html);
      node.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: data,
        }),
      );
    },
    { text, html },
  );
}
async function save(p: Page, name = "Guardar tarjeta") {
  await p
    .getByRole("dialog")
    .getByRole("button", { name, exact: true })
    .click();
  await expect(p.getByRole("dialog")).toHaveCount(0);
}
async function editRow(p: Page, query: string) {
  await p
    .getByRole("textbox", { name: "Buscar biblioteca", exact: true })
    .fill(query);
  await p
    .locator(".library-card-row")
    .first()
    .getByRole("button", { name: "Editar tarjeta", exact: true })
    .click();
  await expect(front(p)).toBeVisible();
  await expect(back(p)).toBeVisible();
  await noFocus(p);
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
  test(`Tarjetas ${w}x${h}: crear, pegar, guardar, reabrir y estudiar con formato`, async ({
    page,
  }) => {
    await open(page, w, h);
    await create(page);
    await paste(
      front(page),
      "## Pregunta con formato\n\n**¿Quién redacta las actas?**",
    );
    await paste(
      back(page),
      "### Funciones\n\n**Redacta** y *autoriza*.\n\n- Actas\n- Certificaciones\n\n1. Primera\n2. Segunda\n\n| Órgano | Función |\n| --- | --- |\n| Secretario | Actas |",
    );
    await expect(front(page).locator("h2")).toHaveText("Pregunta con formato");
    await expect(back(page).locator("strong")).toHaveText("Redacta");
    await expect(back(page).locator("em")).toHaveText("autoriza");
    await expect(back(page).locator("ul>li")).toHaveCount(2);
    await expect(back(page).locator("ol>li")).toHaveCount(2);
    await expect(back(page).locator("table")).toHaveCount(1);
    for (const name of [
      "Negrita",
      "Cursiva",
      "Subrayado",
      "Lista con viñetas",
      "Lista numerada",
      "Más formato",
    ]) {
      const box = await tools(page)
        .getByRole("button", { name, exact: true })
        .boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    if (w === 390 || w === 1366) {
      await back(page).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/card-edit-${w}.png` });
    }
    await save(page);
    const s = await state(page),
      card = s.cards.find((c: any) => c.front.includes("Pregunta con formato"));
    expect(card).toBeTruthy();
    await expect
      .poll(() =>
        page.evaluate(
          async (id) =>
            (await (window as any).__opogcQA.account()).rows["cards:" + id]
              ?.data.back,
          card.id,
        ),
      )
      .toBe(card.back);
    await page.reload();
    await nav(page, "Biblioteca");
    await editRow(page, "Pregunta con formato");
    await expect(back(page).locator("h3")).toHaveText("Funciones");
    await expect(back(page).locator("table")).toHaveCount(1);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cerrar", exact: true })
      .click();
    await page.locator(".library-card-row .library-row-main").first().click();
    await expect(page.locator(".review-prompt h2")).toHaveText(
      "Pregunta con formato",
    );
    await page
      .getByRole("button", { name: "Mostrar respuesta", exact: true })
      .click();
    await expect(page.locator(".review-answer-text strong")).toHaveText(
      "Redacta",
    );
    await expect(page.locator(".review-answer-text ul")).toHaveCSS(
      "list-style-type",
      "disc",
    );
    await expect(page.locator(".review-answer-text ol")).toHaveCSS(
      "list-style-type",
      "decimal",
    );
    await expect(page.locator(".review-answer-text table")).toBeVisible();
    if (w === 390 || w === 1366)
      await page.screenshot({ path: `test-results/card-read-${w}.png` });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  });
}

test("La barra aplica títulos, listas, énfasis, subrayado, colores, sangría, tablas y deshacer sin enviar el formulario", async ({
  page,
}) => {
  await open(page, 1366, 768);
  await create(page);
  await front(page).fill("Pregunta de la barra");
  await back(page).fill("Texto editable");
  await back(page).press("Control+a");
  const t = tools(page);
  for (const name of ["Negrita", "Cursiva", "Subrayado"])
    await t.getByRole("button", { name, exact: true }).click();
  await expect(back(page).locator("strong em u")).toHaveText("Texto editable");
  await t.getByLabel("Estilo de párrafo", { exact: true }).selectOption("4");
  await expect(back(page).locator("h4")).toHaveText("Texto editable");
  await t.getByRole("button", { name: "Más formato", exact: true }).click();
  await t.getByLabel("Fuente", { exact: true }).selectOption("Georgia");
  await t.getByLabel("Tamaño de letra", { exact: true }).selectOption("24px");
  await t.getByLabel("Color del texto", { exact: true }).fill("#bb2222");
  await t.getByRole("button", { name: "Resaltar", exact: true }).click();
  await t.getByLabel("Interlineado", { exact: true }).selectOption("1.5");
  await t.getByLabel("Alineación", { exact: true }).selectOption("center");
  await t
    .getByRole("button", { name: "Aumentar sangría", exact: true })
    .click();
  await expect(back(page).locator("h4")).toHaveAttribute("data-indent", "1");
  expect(
    await back(page)
      .locator("h4")
      .evaluate((node) => {
        const css = getComputedStyle(node);
        return (
          Number.parseFloat(css.lineHeight) / Number.parseFloat(css.fontSize)
        );
      }),
  ).toBeCloseTo(1.5, 2);
  await expect(back(page).locator("span").first()).toHaveAttribute(
    "style",
    /font-family: Georgia/,
  );
  await expect(back(page).locator("span").first()).toHaveAttribute(
    "style",
    /font-size: 24px/,
  );
  await expect(back(page).locator("mark")).toHaveCount(1);
  await back(page).press("Control+End");
  await back(page).press("Enter");
  await t.getByRole("button", { name: "Lista numerada", exact: true }).click();
  await page.keyboard.type("Paso uno");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Paso dos");
  await expect(back(page).locator("ol>li")).toHaveCount(2);
  await t.getByRole("button", { name: "Insertar tabla", exact: true }).click();
  await expect(back(page).locator("table")).toHaveCount(1);
  await t.getByRole("button", { name: "Añadir fila", exact: true }).click();
  await expect(back(page).locator("tr")).toHaveCount(4);
  await t.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect(back(page).locator("tr")).toHaveCount(3);
  await expect(
    page.getByRole("dialog", { name: "Crear tarjeta", exact: true }),
  ).toBeVisible();
  expect(
    (await state(page)).cards.some((c: any) =>
      c.front.includes("Pregunta de la barra"),
    ),
  ).toBe(false);
  await save(page);
  const c = (await state(page)).cards.find((c: any) =>
    c.front.includes("Pregunta de la barra"),
  );
  for (const tag of ["<h4", "<strong", "<em", "<u", "<mark", "<ol", "<table"])
    expect(c.back).toContain(tag);
});

test("Controles táctiles: formato sin teclado automático y listas anidadas editables", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  try {
    await open(page);
    await create(page);
    await tools(page, "Pregunta")
      .getByRole("button", { name: "Más formato", exact: true })
      .tap();
    await noFocus(page);
    await front(page).fill("Pregunta táctil");
    await back(page).fill("Primero");
    await back(page).press("End");
    await tools(page)
      .getByRole("button", { name: "Lista con viñetas", exact: true })
      .tap();
    await back(page).press("Enter");
    await back(page).pressSequentially("Segundo");
    await tools(page)
      .getByRole("button", { name: "Más formato", exact: true })
      .tap();
    await tools(page)
      .getByRole("button", { name: "Aumentar sangría", exact: true })
      .tap();
    await expect(back(page).locator("ul ul>li")).toHaveText("Segundo");
    await tools(page)
      .getByRole("button", { name: "Reducir sangría", exact: true })
      .tap();
    await expect(back(page).locator("ul>li")).toHaveCount(2);
    await tools(page)
      .getByRole("button", { name: "Lista numerada", exact: true })
      .tap();
    await expect(back(page).locator("ol>li")).toHaveCount(2);
    await save(page);
    const c = (await state(page)).cards.find((c: any) =>
      c.front.includes("Pregunta táctil"),
    );
    expect(c.back).toContain("<ol>");
  } finally {
    await context.close();
  }
});

test("El pegado HTML conserva celdas combinadas, fuente y listas alfabéticas; un fragmento subrayado mantiene su estilo", async ({
  page,
}) => {
  await open(page);
  await create(page);
  await front(page).fill("Pegado de Word");
  await paste(
    back(page),
    "Contenido",
    '<h5>Apartado</h5><p><span style="font-family: Georgia; font-size: 24px; color: rgb(150, 20, 20)"><strong>Texto</strong></span></p><ol type="a" start="3"><li>Uno</li><li>Dos</li></ol><table><tr><th colspan="2">Título</th></tr><tr><td>A</td><td>B</td></tr></table>',
  );
  await expect(back(page).locator("h5")).toHaveText("Apartado");
  await expect(back(page).locator("span").first()).toHaveCSS(
    "font-size",
    "24px",
  );
  await expect(back(page).locator("ol")).toHaveAttribute("start", "3");
  await expect(back(page).locator("ol")).toHaveAttribute("type", "a");
  await expect(back(page).locator("th")).toHaveAttribute("colspan", "2");
  await back(page).press("Control+End");
  await back(page).press("ArrowDown");
  await paste(back(page), "Subrayado", "<u>Subrayado</u>");
  await expect(back(page).locator("u")).toHaveText("Subrayado");
  await save(page);
  await editRow(page, "Pegado de Word");
  await expect(back(page).locator("u")).toHaveText("Subrayado");
  await expect(back(page).locator("th")).toHaveAttribute("colspan", "2");
});

for (const [width, height] of [
  [390, 844],
  [1366, 768],
])
  test(`Cursor estable: retroceso y saltos de línea en ambas caras ${width}`, async ({
    page,
  }) => {
    await open(page, width, height);
    await create(page);
    for (const field of [front(page), back(page)]) {
      await field.click();
      await field.evaluate((node) => {
        const e = (node as any).editor;
        e.commands.setContent(
          "<p>Primera línea</p><p>Segunda frase editable</p>",
        );
        e.commands.setTextSelection(22);
        e.view.focus();
        const options = e.setOptions.bind(e);
        (node as any).__stats = { options: 0, replacements: 0 };
        e.setOptions = (o: any) => {
          (node as any).__stats.options++;
          return options(o);
        };
        e.on("transaction", ({ transaction: t }: any) => {
          if (t.getMeta("preventUpdate") === true)
            (node as any).__stats.replacements++;
        });
      });
      const position = () =>
        field.evaluate((node) => (node as any).editor.state.selection.from);
      const before = await position();
      await field.press("Backspace");
      expect(await position()).toBe(before - 1);
      await field.pressSequentially("X");
      expect(await position()).toBe(before);
      await field.press("Enter");
      const split = await position();
      await field.pressSequentially("Nueva");
      expect(await position()).toBe(split + 5);
      await field.press("Shift+Enter");
      const br = await position();
      await field.press("Backspace");
      expect(await position()).toBe(br - 1);
      expect(await field.evaluate((node) => (node as any).__stats)).toEqual({
        options: 0,
        replacements: 0,
      });
      await expect(field).toBeFocused();
    }
  });

test("Hojas de Markdown y enlaces no abren el teclado, y pegar no guarda ni cierra la tarjeta", async ({
  page,
}) => {
  await open(page);
  await create(page);
  await tools(page)
    .getByRole("button", { name: "Más formato", exact: true })
    .click();
  await noFocus(page);
  await tools(page)
    .getByRole("button", { name: "Pegar texto de ChatGPT", exact: true })
    .click();
  await noFocus(page);
  const sheet = page.getByRole("dialog", {
    name: "Pegar texto de ChatGPT",
    exact: true,
  });
  await sheet
    .getByRole("textbox", { name: "Texto con Markdown" })
    .fill("## Título\n\n**Contenido**\n\n• Uno\n• Dos");
  await sheet
    .getByRole("button", { name: "Insertar con formato", exact: true })
    .click();
  await expect(sheet).toHaveCount(0);
  await expect(back(page).locator("h2")).toHaveText("Título");
  await expect(back(page).locator("ul>li")).toHaveCount(2);
  await noFocus(page);
  await tools(page)
    .getByRole("button", { name: "Enlace", exact: true })
    .click();
  await noFocus(page);
  await page
    .getByRole("dialog", { name: "Enlace", exact: true })
    .getByRole("button", { name: "Cerrar", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Crear tarjeta", exact: true }),
  ).toBeVisible();
});

test("Edición offline en repaso guarda formato sin cambiar notas, historial, sesión ni adjuntos; copia portable conserva el HTML", async ({
  page,
  context,
}) => {
  await page.goto(base);
  await expect(
    page.getByRole("heading", { name: "Vamos con lo de hoy" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Repasar ahora/ })
    .first()
    .click();
  await expect(page.locator(".review-prompt")).toBeVisible();
  const before = await state(page);
  await page
    .getByRole("button", { name: "Opciones del repaso", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Editar tarjeta", exact: true })
    .click();
  await expect(back(page)).toBeVisible();
  await noFocus(page);
  await context.setOffline(true);
  await back(page).fill("");
  await paste(
    back(page),
    "## Respuesta corregida\n\n**Dato clave**\n\n1. Condición\n2. Excepción",
  );
  await save(page, "Guardar cambios");
  const after = await state(page),
    old = before.cards.find((c: any) => c.id === "basic1"),
    edited = after.cards.find((c: any) => c.id === "basic1");
  expect({ ...edited, back: old.back }).toEqual(old);
  expect(after.reviews).toEqual(before.reviews);
  expect(after.settings.activeCardSession.history).toEqual(
    before.settings.activeCardSession.history,
  );
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (await (window as any).__opogcQA.account()).rows["cards:basic1"]?.data
            .back,
      ),
    )
    .toBe(edited.back);
  await context.setOffline(false);
  const restored = await page.evaluate(async () => {
    const q = (window as any).__opogcQA;
    return q.roundtrip(await q.backup());
  });
  expect(restored.cards.find((c: any) => c.id === "basic1").back).toBe(
    edited.back,
  );
  await page.reload();
  await page
    .getByRole("button", { name: /Continuar sesión/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Mostrar respuesta", exact: true })
    .click();
  await expect(page.locator(".review-answer-text strong")).toHaveText(
    "Dato clave",
  );
});

for (const [query, type] of [
  ["Vocabulario:", "choice"],
  ["Test: ¿Qué cámara", "test"],
  ["Respuesta escrita:", "written"],
])
  test(`Editar contenido con formato conserva el comportamiento de ${type}`, async ({
    page,
  }) => {
    await open(page);
    const before = await state(page);
    await editRow(page, query);
    await back(page).fill("");
    await paste(back(page), "**contenido esencial**\n\n- Referencia");
    await save(page, "Guardar cambios");
    const old = before.cards.find(
        (c: any) => c.type === type && (type !== "test" || c.id === "test"),
      ),
      after = (await state(page)).cards.find((c: any) => c.id === old.id);
    expect({ ...after, back: old.back }).toEqual(old);
    expect(after.back).toContain("<strong>contenido esencial</strong>");
  });
