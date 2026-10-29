import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
const base = "http://127.0.0.1:4175/tests/ui/index.html";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
const file = { name: "Esquema.png", mimeType: "image/png", buffer: png };
async function open(p: Page, width = 390, height = 844) {
  await p.setViewportSize({ width, height });
  await p.goto(base);
  await expect(
    p.getByRole("heading", { name: "Vamos con lo de hoy" }),
  ).toBeVisible();
  await p
    .locator(width >= 1000 ? ".ux-sidebar" : ".ux-bottom-nav")
    .getByRole("button", { name: "Más", exact: true })
    .click();
  await p.getByRole("button", { name: /Material de estudio/ }).click();
  await p.getByRole("button", { name: /\+ Nuevo/ }).click();
  await p
    .getByRole("textbox", { name: "Nombre del apartado" })
    .fill("Material con imágenes");
  await p
    .getByRole("button", { name: "Guardar apartado", exact: true })
    .click();
  await expect(p.getByRole("dialog")).toHaveCount(0);
  await doc(p);
}
async function doc(p: Page) {
  await p
    .getByRole("button", {
      name: "Abrir contenido de Material con imágenes",
      exact: true,
    })
    .click();
  await expect(p.locator(".material-prose")).toBeVisible();
}
async function close(p: Page) {
  await p
    .locator(".material-sheet>.sheet-header")
    .getByRole("button", { name: "Cerrar", exact: true })
    .click();
  await expect(p.locator(".material-sheet")).toHaveCount(0);
}
async function upload(p: Page) {
  await p
    .getByLabel("Seleccionar imágenes", { exact: true })
    .setInputFiles(file);
  await loaded(p);
}
async function loaded(p: Page, count = 1) {
  await expect(p.locator(".material-image img")).toHaveCount(count);
  await expect
    .poll(() =>
      p
        .locator(".material-image img")
        .first()
        .evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
    )
    .toBe(true);
}
for (const [width, height] of [
  [390, 844],
  [768, 1024],
  [1366, 768],
])
  test(`Imagen privada: insertar, editar tamaño y reabrir ${width}`, async ({
    page,
  }) => {
    await open(page, width, height);
    await page.locator(".material-prose").fill("Antes de la imagen");
    await upload(page);
    await page.locator(".material-image img").click();
    await expect(
      page.getByLabel("Tamaño de imagen", { exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Tamaño de imagen", { exact: true })
      .selectOption("50");
    await page
      .getByLabel("Alineación de imagen", { exact: true })
      .selectOption("right");
    await expect(page.locator(".material-image")).toHaveAttribute(
      "data-align",
      "right",
    );
    await expect(page.locator(".material-image")).toHaveAttribute(
      "style",
      /width: 50%/,
    );
    await close(page);
    const state = await page.evaluate(() => (window as any).__opogcQA.state());
    const content = Object.entries(state.settings).find(([k]) =>
      k.startsWith("studyMaterialContent:"),
    )![1] as any;
    expect(content.html).toContain("data-material-image");
    expect(content.html).not.toContain("blob:");
    expect(content.html).not.toContain("base64");
    await doc(page);
    await loaded(page);
    await expect(page.locator(".material-image")).toHaveAttribute(
      "data-align",
      "right",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  });
test("Pegar captura y arrastrar archivo insertan imágenes sin escribir URLs temporales", async ({
  page,
}) => {
  await open(page);
  await page.locator(".material-prose").click();
  await page.evaluate((base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
      data = new DataTransfer();
    data.items.add(new File([bytes], "Captura.png", { type: "image/png" }));
    data.setData("text/html", "<p><strong>Texto de la captura</strong></p>");
    data.setData("text/plain", "Texto de la captura");
    document.querySelector(".material-prose")!.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: data,
      }),
    );
  }, png.toString("base64"));
  await loaded(page);
  await expect(page.locator(".material-prose strong")).toHaveText(
    "Texto de la captura",
  );
  await page.evaluate((base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
      data = new DataTransfer();
    data.items.add(new File([bytes], "Arrastrada.png", { type: "image/png" }));
    const el = document.querySelector(".material-prose")!,
      rect = el.getBoundingClientRect();
    el.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: data,
        clientX: rect.x + 20,
        clientY: rect.y + 20,
      }),
    );
  }, png.toString("base64"));
  await loaded(page, 2);
  await close(page);
  await doc(page);
  await loaded(page, 2);
});
test("Descripción, quitar y deshacer conservan la imagen y el teclado no se abre al mostrar opciones", async ({
  page,
}) => {
  await open(page);
  await upload(page);
  await page.locator(".material-image img").click();
  await page
    .getByRole("button", { name: "Descripción de imagen", exact: true })
    .click();
  expect(
    await page.evaluate(() =>
      document.activeElement?.matches("input,textarea,[contenteditable=true]"),
    ),
  ).toBe(false);
  await page
    .getByRole("textbox", { name: "Descripción de imagen", exact: true })
    .fill("Esquema del procedimiento");
  await page
    .getByRole("button", { name: "Guardar descripción", exact: true })
    .click();
  await expect(page.locator(".material-image img")).toHaveAttribute(
    "alt",
    "Esquema del procedimiento",
  );

  await page.locator(".material-image img").click();
  await page
    .getByRole("button", { name: "Quitar imagen", exact: true })
    .click();
  await expect(page.locator(".material-image")).toHaveCount(0);
  await page.getByRole("button", { name: "Más formato", exact: true }).click();
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await loaded(page);
});
test("Exportar HTML incluye los bytes y la imagen guardada se puede reabrir offline", async ({
  page,
  context,
}) => {
  await open(page);
  await upload(page);
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar HTML", exact: true })
    .click();
  const d = await download;
  const html = fs.readFileSync((await d.path())!, "utf8");
  expect(html).toContain('src="data:image/png;base64,');
  expect(html).not.toContain("blob:");
  await close(page);
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await doc(page);
  await loaded(page);
  await page
    .getByLabel("Seleccionar imágenes", { exact: true })
    .setInputFiles(file);
  await expect(page.getByRole("alert")).toContainText("conexión");
  await loaded(page);
  await context.setOffline(false);
});
test("SVG se rechaza sin modificar el contenido y se pueden insertar dos archivos juntos", async ({
  page,
}) => {
  await open(page);
  await page.getByLabel("Seleccionar imágenes", { exact: true }).setInputFiles({
    name: "no.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
  });
  await expect(page.getByRole("alert")).toContainText("PNG");
  await expect(page.locator(".material-image")).toHaveCount(0);
  await page
    .getByLabel("Seleccionar imágenes", { exact: true })
    .setInputFiles([file, { ...file, name: "Segundo.png" }]);
  await loaded(page, 2);
});
test("Escribir durante la subida mantiene el texto y la posición de inserción", async ({
  page,
}) => {
  await open(page);
  await page.locator(".material-prose").fill("Texto");
  await page.locator(".material-prose").press("Control+End");
  await page.evaluate(() => (window as any).__opogcQA.holdImageUpload());
  await page
    .getByLabel("Seleccionar imágenes", { exact: true })
    .setInputFiles(file);
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__opogcQA.imageUploadHeld()),
    )
    .toBe(true);
  await expect(
    page
      .locator(".material-sheet>.sheet-header")
      .getByRole("button", { name: "Cerrar", exact: true }),
  ).toBeDisabled();
  await page.locator(".material-prose").pressSequentially(" añadido");
  await page.evaluate(() => (window as any).__opogcQA.releaseImageUpload());
  await loaded(page);
  await expect(page.locator(".material-prose")).toContainText("Texto añadido");
  await close(page);
  await doc(page);
  await loaded(page);
  await expect(page.locator(".material-prose")).toContainText("Texto añadido");
});
