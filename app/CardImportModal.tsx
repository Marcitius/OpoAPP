"use client";

import { useMemo, useRef, useState } from "react";

export type ImportItemType = "flashcard" | "vocabulario" | "test";

export type ParsedImportItem = {
  tipo: ImportItemType;
  tema: string;
  subtema: string;
  pregunta: string;
  respuesta: string;
  opciones: string[];
  correcta: "A" | "B" | "C" | "D" | "";
  explicacion: string;
  fuente: string;
};

export type ImportResult = {
  imported: number;
  skipped: number;
  foldersCreated: number;
};

export const OPOGC_CHATGPT_PROMPT = `Convierte únicamente el contenido que te adjunte o pegue en contenido compatible con OpoGC.

REGLAS OBLIGATORIAS:
1. Devuelve exclusivamente un bloque de código JSON que contenga JSON válido. No añadas ninguna introducción ni explicación fuera del bloque.
2. La raíz debe ser exactamente un objeto con "version": 1 y un array llamado "items".
3. Puedes mezclar flashcards, vocabulario y tests en el mismo array. OpoGC los organizará automáticamente.
4. No inventes datos. Si una respuesta no puede obtenerse de la fuente, omite ese elemento.
5. Crea una sola idea examinable por elemento, evita duplicados y conserva literalmente artículos, cifras, fechas, plazos, excepciones y nombres propios.
6. Para una pregunta-respuesta usa "tipo": "flashcard", con "pregunta" y "respuesta".
7. Para antónimos, sinónimos, ortografía o analogías de vocabulario usa "tipo": "vocabulario", exactamente cuatro "opciones" y "correcta" como letra "A", "B", "C" o "D".
8. Para preguntas de examen con cuatro opciones que NO sean de vocabulario usa "tipo": "test", exactamente cuatro "opciones" y "correcta" como letra "A", "B", "C" o "D". No clasifiques todos los tests como vocabulario.
9. Usa "tema" para la agrupación principal y "subtema" para la categoría concreta. Por ejemplo: tema "Vocabulario" y subtema "Antónimos".
10. En "fuente", indica tema y página cuando se conozcan; en caso contrario usa una cadena vacía.
11. "explicacion" es opcional, pero cuando exista debe ser breve y servir para entender por qué la respuesta es correcta.
12. Dentro de cada elemento, todos los campos deben ser texto salvo "opciones", que es un array de cuatro textos. Usa siempre comillas rectas dobles y no uses comas finales.

ESTRUCTURA EXACTA:
{
  "version": 1,
  "items": [
    {
      "tipo": "flashcard",
      "tema": "Tema 1",
      "subtema": "Apartado",
      "pregunta": "Pregunta clara y autosuficiente",
      "respuesta": "Respuesta exacta y suficiente",
      "explicacion": "Explicación breve opcional",
      "fuente": "Tema y página"
    },
    {
      "tipo": "vocabulario",
      "tema": "Vocabulario",
      "subtema": "Antónimos",
      "pregunta": "¿Cuál es el antónimo de DÍSCOLO?",
      "opciones": ["Acucioso", "Obediente", "Vergonzoso", "Resuelto"],
      "correcta": "B",
      "explicacion": "Díscolo significa desobediente o indócil.",
      "fuente": ""
    },
    {
      "tipo": "test",
      "tema": "Constitución Española",
      "subtema": "Título Preliminar",
      "pregunta": "Pregunta de examen con cuatro opciones",
      "opciones": ["Opción A", "Opción B", "Opción C", "Opción D"],
      "correcta": "A",
      "explicacion": "Explicación breve opcional",
      "fuente": ""
    }
  ]
}

Si todavía no te he enviado el contenido, espera a que lo adjunte o lo pegue. Cuando lo recibas, responde solo con el bloque de código JSON.`;

function stripCodeFence(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseItem(value: unknown, index: number): ParsedImportItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Elemento ${index + 1}: debe ser un objeto`);
  }
  const row = value as Record<string, unknown>;
  const tipo = asString(row.tipo).toLocaleLowerCase("es") as ImportItemType;
  if (!["flashcard", "vocabulario", "test"].includes(tipo)) {
    throw new Error(`Elemento ${index + 1}: tipo no válido`);
  }
  const pregunta = asString(row.pregunta);
  if (!pregunta) throw new Error(`Elemento ${index + 1}: falta la pregunta`);

  const tema = asString(row.tema) || "Importado";
  const subtema = asString(row.subtema);
  const explicacion = asString(row.explicacion);
  const fuente = asString(row.fuente);

  if (tipo === "flashcard") {
    const respuesta = asString(row.respuesta);
    if (!respuesta) throw new Error(`Elemento ${index + 1}: la flashcard necesita respuesta`);
    return { tipo, tema, subtema, pregunta, respuesta, opciones: [], correcta: "", explicacion, fuente };
  }

  const opciones = Array.isArray(row.opciones) ? row.opciones.map(asString) : [];
  if (opciones.length !== 4 || opciones.some((option) => !option)) {
    throw new Error(`Elemento ${index + 1}: ${tipo} necesita exactamente cuatro opciones no vacías`);
  }
  const correcta = asString(row.correcta).toUpperCase();
  if (!["A", "B", "C", "D"].includes(correcta)) {
    throw new Error(`Elemento ${index + 1}: correcta debe ser A, B, C o D`);
  }

  return {
    tipo,
    tema,
    subtema,
    pregunta,
    respuesta: "",
    opciones,
    correcta: correcta as "A" | "B" | "C" | "D",
    explicacion,
    fuente,
  };
}

export function parseOpoGcImport(raw: string) {
  const cleaned = stripCodeFence(raw);
  if (!cleaned) throw new Error("Pega el JSON generado por ChatGPT o selecciona un archivo .json");
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("El contenido no es JSON válido");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("La raíz debe ser un objeto");
  const root = parsed as Record<string, unknown>;
  if (root.version !== 1) throw new Error('La raíz debe incluir exactamente "version": 1');
  if (!Array.isArray(root.items)) throw new Error('La raíz debe incluir un array llamado "items"');
  if (!root.items.length) throw new Error("El JSON no contiene elementos");
  return root.items.map((item, index) => parseItem(item, index));
}

export default function CardImportModal({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (items: ParsedImportItem[]) => ImportResult;
}) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState<ParsedImportItem[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const summary = useMemo(() => {
    if (!preview) return null;
    const counts = { flashcard: 0, vocabulario: 0, test: 0 };
    const themes = new Set<string>();
    preview.forEach((item) => {
      counts[item.tipo] += 1;
      themes.add(item.tema);
    });
    return { counts, themes: [...themes] };
  }, [preview]);

  function validate() {
    setError("");
    try {
      const parsed = parseOpoGcImport(raw);
      setPreview(parsed);
    } catch (reason) {
      setPreview(null);
      setError(reason instanceof Error ? reason.message : "No se pudo validar el JSON");
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(OPOGC_CHATGPT_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("No se pudo copiar automáticamente. Selecciona el prompt y cópialo manualmente.");
    }
  }

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setRaw(String(reader.result ?? ""));
      setPreview(null);
      setError("");
    };
    reader.onerror = () => setError("No se pudo leer el archivo");
    reader.readAsText(file);
  }

  function doImport() {
    if (!preview) return;
    const result = onImport(preview);
    if (result.imported > 0) onClose();
    else setError("No se ha añadido ninguna tarjeta: todas ya existían o no eran válidas.");
  }

  return (
    <div className="modal-backdrop import-modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="modal import-modal">
        <button className="modal-close" onClick={onClose}>×</button>
        <span className="section-label">CHATGPT + JSON</span>
        <h2>Crear o importar tarjetas con IA</h2>
        <p className="modal-subtitle">Copia el prompt en ChatGPT, adjunta o pega tu temario y después importa aquí el JSON. OpoGC detectará flashcards, vocabulario, tests y sus temas.</p>

        <div className="import-workflow">
          <section className="import-step">
            <div className="import-step-head"><span>1</span><div><strong>Genera el JSON en ChatGPT</strong><small>El prompt incluye los tres tipos compatibles.</small></div></div>
            <div className="prompt-preview">{OPOGC_CHATGPT_PROMPT}</div>
            <button type="button" className="secondary-button full-width" onClick={() => void copyPrompt()}>{copied ? "✓ Prompt copiado" : "Copiar prompt para ChatGPT"}</button>
          </section>

          <section className="import-step">
            <div className="import-step-head"><span>2</span><div><strong>Pega o sube el resultado</strong><small>También acepta un bloque ```json … ``` copiado directamente del chat.</small></div></div>
            <textarea className="json-import-textarea" value={raw} onChange={(event) => { setRaw(event.target.value); setPreview(null); setError(""); }} placeholder={'{\n  "version": 1,\n  "items": [ ... ]\n}'} />
            <input ref={fileRef} hidden type="file" accept="application/json,.json,text/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) readFile(file); }} />
            <div className="import-actions-row">
              <button type="button" className="secondary-button" onClick={() => fileRef.current?.click()}>Subir .json</button>
              <button type="button" className="primary-button" onClick={validate}>Validar JSON</button>
            </div>
            {error && <p className="form-error import-error">{error}</p>}
          </section>
        </div>

        {preview && summary && (
          <section className="import-preview">
            <div className="import-preview-head"><div><span className="section-label">PREVISUALIZACIÓN</span><h3>{preview.length} elementos válidos</h3></div><div className="import-counts"><span>{summary.counts.flashcard} flashcards</span><span>{summary.counts.vocabulario} vocabulario</span><span>{summary.counts.test} tests</span></div></div>
            <p><strong>Temas:</strong> {summary.themes.join(" · ")}</p>
            <div className="import-preview-list">
              {preview.slice(0, 8).map((item, index) => <div key={`${item.pregunta}-${index}`}><span className={`import-kind ${item.tipo}`}>{item.tipo}</span><strong>{item.pregunta}</strong><small>{item.tema}{item.subtema ? ` · ${item.subtema}` : ""}</small></div>)}
              {preview.length > 8 && <p className="muted">…y {preview.length - 8} elementos más.</p>}
            </div>
            <button className="primary-button full" onClick={doImport}>Importar {preview.length} elementos</button>
          </section>
        )}
      </section>
    </div>
  );
}
