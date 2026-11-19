import { test, expect, type Page } from "@playwright/test";
import {
  cardImportExample,
  cardImportPrompt,
  cardPromptTypes,
} from "../../lib/import/cardPrompts";

const url = "http://127.0.0.1:4175/tests/ui/index.html";
async function open(page: Page) {
  await page.goto(url);
  await expect(
    page.getByRole("heading", { name: "Vamos con lo de hoy" }),
  ).toBeVisible();
  await page
    .locator(
      (page.viewportSize()?.width ?? 390) >= 1000
        ? ".ux-sidebar"
        : ".ux-bottom-nav",
    )
    .getByRole("button", { name: "Biblioteca", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Opciones de la biblioteca", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Importar tarjetas JSON", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Importar tarjetas" }),
  ).toBeVisible();
}
const state = (page: Page) =>
  page.evaluate(() => (window as any).__opogcQA.state());
async function noAutoKeyboard(page: Page) {
  expect(
    await page.evaluate(() =>
      document.activeElement?.matches("input,textarea,[contenteditable=true]"),
    ),
  ).toBe(false);
}

for (const [width, height] of [
  [360, 800],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1366, 768],
  [1920, 1080],
]) {
  test(`Importar ${width}x${height}: selector y copia de los seis prompts, sin pérdida del JSON ni desbordamiento`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.addInitScript(() => {
      (window as any).__promptCopies = [];
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            (window as any).__promptCopies.push(text);
          },
        },
      });
    });
    await open(page);
    await noAutoKeyboard(page);
    const before = await state(page);
    const picker = page.getByRole("region", {
      name: "Generar tarjetas con ChatGPT",
    });
    const input = page.getByRole("textbox", { name: "JSON de tarjetas" });
    const draft = '{"tarjetas": []}';
    await input.fill(draft);
    await expect(picker.getByRole("combobox")).toHaveValue("flashcard");
    await expect(picker.getByRole("combobox").locator("option")).toHaveCount(6);
    for (const { type } of cardPromptTypes) {
      await picker.getByRole("combobox").selectOption(type);
      await picker
        .getByRole("button", { name: "Copiar prompt", exact: true })
        .click();
      await expect(picker.getByRole("status")).toContainText("Prompt copiado");
      const copied = await page.evaluate(() =>
        (window as any).__promptCopies.at(-1),
      );
      expect(copied).toBe(cardImportPrompt(type));
      const schema = JSON.parse(
        copied.split("ESTRUCTURA JSON:\n")[1].split("\n\nMATERIAL:")[0],
      );
      expect(schema.tarjetas[0].tipo).toBe(type);
      await expect(input).toHaveValue(draft);
    }
    await picker.getByText("Ver prompt", { exact: true }).click();
    await expect(
      picker.getByRole("textbox", { name: "Prompt para ChatGPT" }),
    ).toHaveValue(cardImportPrompt("respuesta_escrita"));
    await noAutoKeyboard(page);
    await picker.getByText("Ver formato JSON", { exact: true }).click();
    await expect(picker.locator("pre")).toHaveText(
      cardImportExample("respuesta_escrita"),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    const after = await state(page);
    expect(after.cards).toEqual(before.cards);
    expect(after.reviews).toEqual(before.reviews);
    if (width === 390) {
      await picker.getByText("Ver prompt", { exact: true }).click();
      await picker.getByText("Ver formato JSON", { exact: true }).click();
      await picker.getByRole("combobox").selectOption("tabla_muda");
      await picker.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: "test-results/import-prompts-390.png",
        animations: "disabled",
      });
    }
  });
}

test("Copiar prompt utiliza el portapapeles real del navegador", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await open(page);
  await page
    .getByRole("combobox", { name: "Tipo de tarjetas para el prompt" })
    .selectOption("tabla_muda");
  await page
    .getByRole("button", { name: "Copiar prompt", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Generar tarjetas con ChatGPT" })
      .getByRole("status"),
  ).toContainText("Prompt copiado");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    cardImportPrompt("tabla_muda"),
  );
});

for (const mode of ["denied", "unavailable"] as const) {
  test(`Portapapeles ${mode}: texto manual accesible sin abrir el teclado ni alterar el borrador`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((mode) => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value:
          mode === "unavailable"
            ? undefined
            : {
                writeText: async () => {
                  throw new DOMException("Denied", "NotAllowedError");
                },
              },
      });
    }, mode);
    await open(page);
    await page
      .getByRole("combobox", { name: "Tipo de tarjetas para el prompt" })
      .selectOption("test");
    const input = page.getByRole("textbox", { name: "JSON de tarjetas" });
    await input.fill("Mi JSON sin terminar");
    await page
      .getByRole("button", { name: "Copiar prompt", exact: true })
      .click();
    await expect(
      page
        .getByRole("region", { name: "Generar tarjetas con ChatGPT" })
        .getByRole("status"),
    ).toContainText("No se ha podido copiar");
    const manual = page.getByRole("textbox", { name: "Prompt para ChatGPT" });
    await expect(manual).toBeVisible();
    await expect(manual).toHaveValue(cardImportPrompt("test"));
    await expect(manual).toHaveAttribute("readonly", "");
    await noAutoKeyboard(page);
    await expect(input).toHaveValue("Mi JSON sin terminar");
    await page
      .getByRole("combobox", { name: "Tipo de tarjetas para el prompt" })
      .selectOption("tabla_muda");
    await expect(manual).toHaveValue(cardImportPrompt("tabla_muda"));
    await expect(
      page
        .getByRole("region", { name: "Generar tarjetas con ChatGPT" })
        .getByRole("status"),
    ).toHaveCount(0);
  });
}

test("Elegir o copiar otro prompt conserva la validación y permite importar los seis tipos mezclados", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => {} },
    }),
  );
  await open(page);
  const before = await state(page);
  const tarjetas = cardPromptTypes.map(({ type }) => ({
    ...JSON.parse(cardImportExample(type)).tarjetas[0],
    tema: "Prompts de prueba",
    subtema: "Importación mixta",
    pregunta: `Importada ${type}`,
  }));
  await page
    .getByRole("textbox", { name: "JSON de tarjetas" })
    .fill(JSON.stringify({ tarjetas }));
  await page.getByRole("button", { name: "Validar JSON", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Importar 6 tarjetas", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Tipo de tarjetas para el prompt" })
    .selectOption("ortografia");
  await page
    .getByRole("button", { name: "Copiar prompt", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Importar 6 tarjetas", exact: true })
    .click();
  await expect
    .poll(async () => (await state(page)).cards.length)
    .toBe(before.cards.length + 6);
  const after = await state(page);
  const folder = after.folders.find((f: any) => f.name === "Importación mixta");
  const cards = after.cards.filter((c: any) => c.folderId === folder.id);
  expect(cards.map((c: any) => c.type).sort()).toEqual(
    ["basic", "test", "table", "choice", "orthography", "written"].sort(),
  );
  expect(
    cards.find((c: any) => c.type === "table").table.rows[1].cells[1].evaluable,
  ).toBe(true);
  expect(cards.find((c: any) => c.type === "written").options[0]).toContain(
    "Concepto clave",
  );
  expect(after.reviews).toEqual(before.reviews);
});
