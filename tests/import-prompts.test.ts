import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCardImport } from "../app/CardImportModal";
import {
  cardImportExample,
  cardImportPrompt,
  cardPromptTypes,
} from "../lib/import/cardPrompts";

for (const { type, label } of cardPromptTypes) {
  test(`${label}: the JSON schema copied in its prompt is accepted by the real importer`, () => {
    const prompt = cardImportPrompt(type);
    const json = prompt
      .split("ESTRUCTURA JSON:\n")[1]
      .split("\n\nMATERIAL:")[0];
    const [card] = parseCardImport(JSON.parse(json));
    assert.equal(card.tipo, type);
    assert.equal(card.tema, "[TEMA]");
    assert.equal(card.subtema, "[SUBTEMA]");
    assert.deepEqual(JSON.parse(json), JSON.parse(cardImportExample(type)));
    if (type === "test" || type === "vocabulario") {
      assert.equal(card.opciones.length, 4);
      assert.equal(card.correctas.length, 1);
    }
    if (type === "ortografia") {
      assert.equal(card.esCorrecta, false);
      assert.ok(card.formaCorrecta);
    }
    if (type === "respuesta_escrita") {
      assert.equal(card.evaluacion?.criterios[0].minimoSimilitud, 1);
      assert.ok(card.evaluacion?.criterios[0].alternativas.length);
    }
    if (type === "tabla_muda") {
      assert.equal(card.tabla?.rows[1].cells[1].evaluable, true);
      assert.equal(card.tabla?.percentage, 100);
    }
  });
}
