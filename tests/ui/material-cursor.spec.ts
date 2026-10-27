import { test, expect, type Page } from "@playwright/test";
const base = "http://127.0.0.1:4175/tests/ui/index.html";
async function open(p: Page, w = 1366, h = 768) {
  await p.setViewportSize({ width: w, height: h });
  await p.goto(base);
  await expect(
    p.getByRole("heading", { name: "Vamos con lo de hoy" }),
  ).toBeVisible();
  await p
    .locator(w >= 1000 ? ".ux-sidebar" : ".ux-bottom-nav")
    .getByRole("button", { name: "Más", exact: true })
    .click();
  await p.getByRole("button", { name: /Material de estudio/ }).click();
  await p.getByRole("button", { name: /\+ Nuevo/ }).click();
  await p
    .getByRole("textbox", { name: "Nombre del apartado" })
    .fill("Prueba de edición");
  await p
    .getByRole("button", { name: "Guardar apartado", exact: true })
    .click();
  await expect(p.getByRole("dialog")).toHaveCount(0);
  await p
    .getByRole("button", {
      name: "Abrir contenido de Prueba de edición",
      exact: true,
    })
    .click();
  await expect(p.locator(".material-prose")).toBeVisible();
}
async function editor(p: Page, html: string, pos?: number) {
  await p.locator(".material-prose").click();
  await p.evaluate(
    ({ html, pos }) => {
      const e = (document.querySelector(".material-prose") as any).editor;
      e.commands.setContent(html);
      e.commands.setTextSelection(pos ?? 1);
      e.view.focus();
    },
    { html, pos },
  );
}
async function position(p: Page) {
  return p.evaluate(() => {
    const e = (document.querySelector(".material-prose") as any).editor;
    return {
      from: e.state.selection.from,
      to: e.state.selection.to,
      text: e.state.doc.textContent,
    };
  });
}
async function instrumentation(p: Page) {
  await p.evaluate(() => {
    const e = (document.querySelector(".material-prose") as any).editor;
    const original = e.setOptions.bind(e);
    (window as any).__cursor = { options: 0, replacements: 0 };
    e.setOptions = (o: any) => {
      (window as any).__cursor.options++;
      return original(o);
    };
    e.on("transaction", ({ transaction: t }: any) => {
      if (t.getMeta("preventUpdate") === true)
        (window as any).__cursor.replacements++;
    });
  });
}
test("Escritura y autoguardado no reconfiguran ni reemplazan el editor", async ({
  page,
}) => {
  await open(page);
  await editor(
    page,
    "<p>Primera frase editable</p><p>Segunda frase editable</p>",
    10,
  );
  await instrumentation(page);
  await page.locator(".material-prose").pressSequentially("XYZ", { delay: 30 });
  await page.locator(".material-prose").press("Backspace");
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.entries((window as any).__opogcQA.state().settings).some(
          ([k, v]: any) =>
            k.startsWith("studyMaterialContent:") && v.html.includes("XY"),
        ),
      ),
    )
    .toBe(true);
  await expect(page.locator(".material-prose")).toBeFocused();
  const stats = await page.evaluate(() => (window as any).__cursor);
  expect(stats.replacements).toBe(0);
  expect(stats.options).toBe(0);
  expect((await position(page)).from).toBe(12);
});
for (const [width, height] of [
  [390, 844],
  [1366, 768],
])
  test(`Retroceso en mitad de un párrafo y Enter/Shift+Enter ${width}`, async ({
    page,
  }) => {
    await open(page, width, height);
    await editor(page, "<p>Primera línea</p><p>Segunda frase editable</p>", 22);
    const before = await position(page);
    await page.locator(".material-prose").press("Backspace");
    expect((await position(page)).from).toBe(before.from - 1);
    await page.locator(".material-prose").pressSequentially("X");
    expect((await position(page)).from).toBe(before.from);
    await page.locator(".material-prose").press("Enter");
    const afterEnter = await position(page);
    await page.locator(".material-prose").pressSequentially("Nueva");
    expect((await position(page)).from).toBe(afterEnter.from + 5);
    await page.locator(".material-prose").press("Shift+Enter");
    const soft = await position(page);
    await page.locator(".material-prose").press("Backspace");
    expect((await position(page)).from).toBe(soft.from - 1);
    const stable = await position(page);
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    expect(await position(page)).toEqual(stable);
  });
test("Borrar junto a negrita, en lista y en celda mantiene posición y formato", async ({
  page,
}) => {
  await open(page);
  for (const html of [
    "<p>Texto <strong>importante</strong> final</p>",
    "<ul><li><p>Primera viñeta</p></li><li><p>Segunda viñeta</p></li></ul>",
    "<table><tbody><tr><td><p>Primera celda</p></td><td><p>Segunda celda</p></td></tr></tbody></table>",
  ]) {
    await editor(page, html);
    const pos = await page.evaluate(() => {
      const e = (document.querySelector(".material-prose") as any).editor;
      let found = 0;
      e.state.doc.descendants((n: any, p: number) => {
        if (!found && n.isText && n.text.length > 4) found = p + 4;
      });
      e.commands.setTextSelection(found);
      e.view.focus();
      return found;
    });
    await page.locator(".material-prose").press("Backspace");
    expect((await position(page)).from).toBe(pos - 1);
    await page.locator(".material-prose").pressSequentially("Z");
    expect((await position(page)).from).toBe(pos);
  }
});
test("Deshacer y rehacer después de autoguardar conserva el texto y se puede reabrir", async ({
  page,
}) => {
  await open(page);
  await editor(page, "<p>Texto inicial</p>", 6);
  await page
    .locator(".material-sheet>.sheet-header")
    .getByRole("button", { name: "Cerrar", exact: true })
    .click();
  await expect(page.locator(".material-sheet")).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Abrir contenido de Prueba de edición",
      exact: true,
    })
    .click();
  await expect(page.locator(".material-prose")).toBeVisible();
  await page.evaluate(() => {
    const e = (document.querySelector(".material-prose") as any).editor;
    e.commands.setTextSelection(6);
    e.view.focus();
  });
  await page.locator(".material-prose").pressSequentially("XYZ");
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.entries((window as any).__opogcQA.state().settings).some(
          ([k, v]: any) =>
            k.startsWith("studyMaterialContent:") && v.html.includes("XYZ"),
        ),
      ),
    )
    .toBe(true);
  const written = await position(page);
  await page.locator(".material-prose").press("Control+z");
  expect((await position(page)).text).toBe("Texto inicial");
  await page.locator(".material-prose").press("Control+Shift+z");
  expect((await position(page)).text).toBe(written.text);
  await page
    .locator(".material-sheet>.sheet-header")
    .getByRole("button", { name: "Cerrar", exact: true })
    .click();
  await expect(page.locator(".material-sheet")).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Abrir contenido de Prueba de edición",
      exact: true,
    })
    .click();
  await expect(page.locator(".material-prose")).toHaveText(written.text);
});
test("Un guardado pendiente no roba foco ni permite cerrar con Escape; después vuelve a permitirlo", async ({
  page,
}) => {
  await open(page);
  await editor(page, "<p>Texto para corregir</p>", 8);
  // Settle initial insertion before retaining the next actual edit.
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.entries((window as any).__opogcQA.state().settings).some(
          ([k, v]: any) =>
            k.startsWith("studyMaterialContent:") &&
            v.html.includes("Texto para corregir"),
        ),
      ),
    )
    .toBe(true);
  await page.evaluate(() => (window as any).__opogcQA.holdMaterialSave());
  await page.locator(".material-prose").pressSequentially("XYZ");
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__opogcQA.materialSaveHeld()),
    )
    .toBe(true);
  await expect(page.locator(".material-prose")).toBeFocused();
  const before = await position(page);
  await page.locator(".material-prose").press("Escape");
  await expect(page.locator(".material-sheet")).toHaveCount(1);
  await page.locator(".material-prose").press("Backspace");
  expect((await position(page)).from).toBe(before.from - 1);
  const corrected = await position(page);
  await page.evaluate(() => (window as any).__opogcQA.releaseMaterialSave());
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.entries((window as any).__opogcQA.state().settings).some(
          ([k, v]: any) =>
            k.startsWith("studyMaterialContent:") &&
            v.html.includes("XY") &&
            !v.html.includes("XYZ"),
        ),
      ),
    )
    .toBe(true);
  await expect(page.locator(".material-prose")).toBeFocused();
  expect(await position(page)).toEqual(corrected);
  await expect(page.locator(".material-sheet")).toHaveCount(1);
  await page.locator(".material-prose").press("Escape");
  await expect(page.locator(".material-sheet")).toHaveCount(0);
});
