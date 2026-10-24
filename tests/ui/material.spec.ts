import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import { markdownToMaterial } from "../../lib/material/format";
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
  await nav(p, "Más");
  await p.getByRole("button", { name: /Material de estudio/ }).click();
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
async function create(p: Page, name = "Ley 39/2015") {
  await p.getByRole("button", { name: /\+ Nuevo/ }).click();
  await noFocus(p);
  await p.getByRole("textbox", { name: "Nombre del apartado" }).fill(name);
  await p
    .getByRole("button", { name: "Guardar apartado", exact: true })
    .click();
  await expect(p.getByRole("dialog")).toHaveCount(0);
}
async function doc(p: Page, name = "Ley 39/2015") {
  await p
    .getByRole("button", { name: "Abrir contenido de " + name, exact: true })
    .click();
  await expect(p.locator(".material-prose")).toBeVisible();
  await noFocus(p);
}
async function closeDoc(p: Page) {
  await p
    .locator(".material-sheet>.sheet-header")
    .getByRole("button", { name: "Cerrar", exact: true })
    .click();
  await expect(p.locator(".material-sheet")).toHaveCount(0);
}
async function state(p: Page) {
  return p.evaluate(() => (window as any).__opogcQA.state());
}
async function paste(p: Page, text: string, html = "") {
  await p.locator(".material-prose").click();
  await p.evaluate(
    ({ text, html }) => {
      const data = new DataTransfer();
      data.setData("text/plain", text);
      if (html) data.setData("text/html", html);
      document.querySelector(".material-prose")!.dispatchEvent(
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
for (const [w, h] of [
  [360, 800],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1366, 768],
  [1920, 1080],
])
  test(`Material ${w}x${h}: crear, Markdown, lectura, cierre y recarga`, async ({
    page,
  }) => {
    await open(page, w, h);
    await create(page);
    await doc(page);
    await paste(
      page,
      "# Mi ley\n\n**Clave** y *condición*.\n\n- Uno\n- Dos\n\n| Órgano | Función |\n| --- | --- |\n| A | B |",
    );
    await expect(page.locator(".material-prose h1")).toHaveText("Mi ley");
    await expect(page.locator(".material-prose strong")).toHaveText("Clave");
    await expect(page.locator(".material-prose em")).toHaveText("condición");
    await expect(page.locator(".material-prose li")).toHaveCount(2);
    await expect(page.locator(".material-prose table")).toHaveCount(1);
    await page
      .getByRole("button", { name: "Modo lectura", exact: true })
      .click();
    await expect(page.locator(".material-prose")).toHaveAttribute(
      "contenteditable",
      "false",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await closeDoc(page);
    const before = await state(page);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Vamos con lo de hoy" }),
    ).toBeVisible();
    await nav(page, "Biblioteca");
    await page
      .getByRole("button", { name: "Material de estudio", exact: true })
      .click();
    await doc(page);
    await expect(page.locator(".material-prose strong")).toHaveText("Clave");
    expect((await state(page)).cards).toEqual(before.cards);
    expect((await state(page)).reviews).toEqual(before.reviews);
  });
test("Formato real: negrita, color, fuente, tamaño, tablas, sangría y deshacer", async ({
  page,
}) => {
  await open(page, 1366, 768);
  await create(page);
  await doc(page);
  await page.locator(".material-prose").fill("Un párrafo editable");
  await page.locator(".material-prose").press("Control+a");
  await page.getByRole("button", { name: "Negrita", exact: true }).click();
  await expect(page.locator(".material-prose strong")).toHaveText(
    "Un párrafo editable",
  );
  await page.getByRole("button", { name: "Más formato", exact: true }).click();
  await page.getByLabel("Fuente", { exact: true }).selectOption("Georgia");
  await page
    .getByLabel("Tamaño de letra", { exact: true })
    .selectOption("24px");
  await expect(page.locator(".material-prose span").first()).toHaveAttribute(
    "style",
    /font-size: 24px/,
  );
  await page.getByLabel("Interlineado", { exact: true }).selectOption("1.5");
  await expect(page.locator(".material-prose p").first()).toHaveAttribute(
    "style",
    /line-height: 1.5/,
  );
  await page.getByLabel("Alineación", { exact: true }).selectOption("center");
  await expect(page.locator(".material-prose p").first()).toHaveAttribute(
    "style",
    /text-align: center/,
  );
  await page
    .getByRole("button", { name: "Aumentar sangría", exact: true })
    .click();
  await expect(page.locator(".material-prose p").first()).toHaveAttribute(
    "data-indent",
    "1",
  );
  await page.locator(".material-prose").press("Control+End");
  await page.locator(".material-prose").press("Tab");
  await expect(page.locator(".material-prose p").first()).toHaveAttribute(
    "data-indent",
    "2",
  );
  await page.locator(".material-prose").press("Shift+Tab");
  await expect(page.locator(".material-prose p").first()).toHaveAttribute(
    "data-indent",
    "1",
  );
  await page
    .getByRole("button", { name: "Insertar tabla", exact: true })
    .click();
  await expect(page.locator(".material-prose table")).toHaveCount(1);
  await page.getByRole("button", { name: "Añadir fila", exact: true }).click();
  await expect(page.locator(".material-prose tr")).toHaveCount(4);
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect(page.locator(".material-prose tr")).toHaveCount(3);
  await closeDoc(page);
});
test("Copiar Biblioteca conserva tarjetas e IDs y permite organizar ramas de material", async ({
  page,
}) => {
  await open(page);
  const old = await state(page);
  await page
    .getByRole("button", {
      name: "Copiar estructura de Biblioteca",
      exact: true,
    })
    .click();
  await noFocus(page);
  await expect(page.getByLabel("Vista previa de la estructura")).toContainText(
    "Constitución Española",
  );
  await page
    .getByRole("button", { name: "Crear estructura de material", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".material-node-row")).toHaveCount(1);
  await page
    .getByRole("button", {
      name: "Copiar estructura de Biblioteca",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Crear estructura de material", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const after = await state(page);
  expect(after.cards).toEqual(old.cards);
  expect(after.folders).toEqual(old.folders);
  expect(
    Object.keys(after.settings).filter((k) =>
      k.startsWith("studyMaterialNode:"),
    ),
  ).toHaveLength(2);
  await page.locator(".material-node-main").first().click();
  await create(page, "Apuntes propios");
  await page
    .getByRole("button", { name: "Acciones de material Apuntes propios" })
    .click();
  await page
    .getByRole("button", { name: "Cambiar nombre", exact: true })
    .click();
  await noFocus(page);
  await page
    .getByRole("textbox", { name: "Nombre del apartado" })
    .fill("Apuntes corregidos");
  await page
    .getByRole("button", { name: "Guardar apartado", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Acciones de material Apuntes corregidos" })
    .click();
  await page
    .getByRole("button", { name: "Subir un nivel", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Atrás", exact: true }).click();
  await expect(page.locator(".material-node-row")).toHaveCount(2);
});
test("Pegado HTML conserva formato y exporta; guardado offline permite reabrir", async ({
  page,
  context,
}) => {
  await open(page);
  await create(page);
  await doc(page);
  await context.setOffline(true);
  await paste(
    page,
    "Título Dato",
    '<h3>Título importado</h3><p><u>Subrayado</u> <span style="color: rgb(255, 0, 0); font-size: 20px">Color</span></p><table><tr><td colspan="2">Dato</td></tr></table>',
  );
  await expect(page.locator(".material-prose h3")).toHaveText(
    "Título importado",
  );
  await expect(page.locator(".material-prose u")).toHaveText("Subrayado");
  await expect(page.locator(".material-prose td")).toHaveAttribute(
    "colspan",
    "2",
  );
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar HTML", exact: true })
    .click();
  expect((await download).suggestedFilename()).toContain(".html");
  await closeDoc(page);
  expect(
    (await page.evaluate(() => (window as any).__opogcQA.account())).queue
      .length,
  ).toBeGreaterThan(0);
  await context.setOffline(false);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Vamos con lo de hoy" }),
  ).toBeVisible();
  await nav(page, "Más");
  await page.getByRole("button", { name: /Material de estudio/ }).click();
  await doc(page);
  await expect(page.locator(".material-prose u")).toHaveText("Subrayado");
});
test("Conflicto remoto conserva ambas versiones con guardar como copia", async ({
  page,
}) => {
  await open(page);
  await create(page);
  await doc(page);
  await page.locator(".material-prose").fill("Primera versión");
  await closeDoc(page);
  await doc(page);
  await page.clock.install();
  await page.locator(".material-prose").fill("Mi edición pendiente");
  const remote = await state(page);
  const key = Object.keys(remote.settings).find((k) =>
    k.startsWith("studyMaterialContent:"),
  )!;
  remote.settings[key] = {
    version: 1,
    html: "<p>Versión del otro dispositivo</p>",
    updatedAt: new Date().toISOString(),
  };
  await page.evaluate((s) => (window as any).__opogcQA.receive(s), remote);
  await expect(
    page.getByRole("button", { name: "Guardar mi texto como copia" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Guardar mi texto como copia" })
    .click();
  await expect(page.locator(".material-sheet")).toHaveCount(0);
  const saved = await state(page);
  expect(saved.settings[key].html).toContain("Versión del otro dispositivo");
  expect(
    Object.values(saved.settings).some((v: any) =>
      v?.html?.includes("Mi edición pendiente"),
    ),
  ).toBe(true);
});
test("Documento guardado se abre con el formato en otro dispositivo simulado", async ({
  browser,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  try {
    const p = await a.newPage(),
      q = await b.newPage();
    await open(p);
    await create(p);
    await doc(p);
    await paste(p, "## Mi contenido\n\n**Importante**");
    await closeDoc(p);
    await open(q);
    await q.evaluate(
      (s) => (window as any).__opogcQA.receive(s),
      await state(p),
    );
    await doc(q);
    await expect(q.locator(".material-prose h2")).toHaveText("Mi contenido");
    await expect(q.locator(".material-prose strong")).toHaveText("Importante");
  } finally {
    await a.close();
    await b.close();
  }
});
if (process.env.OPOGC_SOURCE_TEXT)
  test("Texto real adjunto: importar íntegro y conservar títulos, listas y todos los párrafos", async ({
    page,
  }) => {
    const source = fs.readFileSync(process.env.OPOGC_SOURCE_TEXT!, "utf8");
    const expected = markdownToMaterial(source);
    await open(page);
    await create(page);
    await doc(page);
    await page
      .getByLabel("Importar archivo de texto", { exact: true })
      .setInputFiles(process.env.OPOGC_SOURCE_TEXT!);
    await expect(page.locator(".material-prose h1").first()).toContainText(
      "LEY 39/2015",
    );
    await expect(
      page.locator(
        ".material-prose h1,.material-prose h2,.material-prose h3,.material-prose h4,.material-prose h5,.material-prose h6",
      ),
    ).toHaveCount(28);
    const compare = await page.evaluate((html) => {
      const ref = document.createElement("div");
      ref.innerHTML = html;
      const words = (el: Element) => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const strings = [];
        let n;
        while ((n = walker.nextNode())) strings.push(n.textContent);
        return strings.join(" ").replace(/\s+/g, " ").trim();
      };
      return {
        expected: words(ref),
        actual: words(document.querySelector(".material-prose")!),
      };
    }, expected);
    expect(compare.actual).toBe(compare.expected);
    await closeDoc(page);
    await doc(page);
    await expect(page.locator(".material-prose")).toContainText(
      "objeto de la comparecencia",
    );
  });
test("Recarga brusca recupera un borrador local antes del autoguardado", async ({
  page,
}) => {
  await open(page);
  await create(page);
  await doc(page);
  await page.clock.install();
  await page.locator(".material-prose").fill("Borrador aún sin enviar");
  const s = await state(page),
    key = Object.keys(s.settings).find((k) =>
      k.startsWith("studyMaterialNode:"),
    )!,
    id = s.settings[key].id,
    draftKey = "material-draft:ux-fixture-a:" + id;
  await expect
    .poll(() =>
      page.evaluate((k) => (window as any).__opogcQA.draft(k), draftKey),
    )
    .toEqual(
      expect.objectContaining({
        html: expect.stringContaining("Borrador aún sin enviar"),
      }),
    );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Vamos con lo de hoy" }),
  ).toBeVisible();
  await nav(page, "Más");
  await page.getByRole("button", { name: /Material de estudio/ }).click();
  await doc(page);
  await expect(page.locator(".material-prose")).toHaveText(
    "Borrador aún sin enviar",
  );
});
test("Borrador de un apartado eliminado remotamente se recupera como nuevo documento", async ({
  page,
}) => {
  await open(page);
  await create(page);
  await doc(page);
  await page.clock.install();
  await page.locator(".material-prose").fill("Contenido que quiero conservar");
  const s = await state(page),
    key = Object.keys(s.settings).find((k) =>
      k.startsWith("studyMaterialNode:"),
    )!;
  s.settings[key] = { ...s.settings[key], deleted: true };
  await page.evaluate((value) => (window as any).__opogcQA.receive(value), s);
  await page
    .getByRole("button", { name: "Recuperar texto como nuevo apartado" })
    .click();
  await expect(page.locator(".material-prose")).toHaveText(
    "Contenido que quiero conservar",
  );
});
test("Un fallo de guardado conserva el texto local y permite reintentar", async ({
  page,
}) => {
  await open(page);
  await create(page);
  await doc(page);
  await page.locator(".material-prose").fill("Texto que no debe perderse");
  await page.evaluate(() => (window as any).__opogcQA.failMaterialSaveOnce());
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Reintentar guardado" }),
  ).toBeVisible();
  await expect(page.locator(".material-prose")).toHaveText(
    "Texto que no debe perderse",
  );
  await page.getByRole("button", { name: "Reintentar guardado" }).click();
  await closeDoc(page);
  await doc(page);
  await expect(page.locator(".material-prose")).toHaveText(
    "Texto que no debe perderse",
  );
});
