"use client";

import { useMemo, useRef, useState } from "react";

export type ImportItemType = "flashcard" | "vocabulario" | "test" | "ortografia";
export type AnswerLetter = "A" | "B" | "C" | "D";

export type ParsedImportItem = {
  tipo: ImportItemType;
  tema: string;
  subtema: string;
  pregunta: string;
  respuesta: string;
  opciones: string[];
  correcta: AnswerLetter | "";
  correctas: AnswerLetter[];
  palabra: string;
  esCorrecta: boolean | null;
  formaCorrecta: string;
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
3. Puedes mezclar flashcards, vocabulario, tests y ortografía en el mismo array. OpoGC los organizará automáticamente.
4. No inventes datos. Si una respuesta no puede obtenerse de la fuente, omite ese elemento.
5. Crea una sola idea examinable por elemento, evita duplicados y conserva literalmente artículos, cifras, fechas, plazos, excepciones, grafías y nombres propios.
6. Para una pregunta-respuesta usa "tipo": "flashcard", con "pregunta" y "respuesta".
7. Para antónimos, sinónimos, analogías u otras preguntas de vocabulario usa "tipo": "vocabulario", exactamente cuatro "opciones" y "correcta" como letra "A", "B", "C" o "D". El vocabulario siempre es de respuesta única.
8. Para preguntas de examen con cuatro opciones que NO sean de vocabulario usa "tipo": "test". Si solo hay una respuesta correcta usa "correcta": "A". Si hay varias respuestas correctas usa "correctas": ["A", "C"]. No uses ambos campos a la vez.
9. Para ejercicios de ortografía NO construyas tests fijos de cuatro opciones. Cada palabra debe ser un elemento independiente con "tipo": "ortografia", "palabra", "es_correcta" y "forma_correcta". "es_correcta" debe ser boolean: true o false, sin comillas. Si la palabra está mal escrita, "forma_correcta" debe contener su grafía correcta. Si ya está bien escrita, "forma_correcta" puede coincidir con "palabra".
10. En ortografía conserva cada palabra de la fuente como una unidad independiente. No agrupes cuatro palabras en un mismo elemento: OpoGC formará los grupos dinámicamente y cambiará sus posiciones y acompañantes en cada sesión.
11. Usa "tema" para la agrupación principal y "subtema" para la categoría concreta. OpoGC creará una jerarquía Tema → Subtema. Ejemplo: tema "Ortografía" y subtema "Ejercicio 1".
12. En "fuente", indica tema, artículo, ejercicio y/o página cuando se conozcan; en caso contrario usa una cadena vacía.
13. "explicacion" es opcional, pero cuando exista debe ser breve y servir para entender la respuesta o la grafía correcta.
14. Todos los campos son texto salvo "opciones" (array de cuatro textos), "correctas" (array de letras) y "es_correcta" (boolean). Usa comillas rectas dobles y no uses comas finales.

ESTRUCTURA EXACTA:
{
  "version": 1,
  "items": [
    {
      "tipo": "flashcard",
      "tema": "Tema 1: Derecho Constitucional",
      "subtema": "Título Preliminar",
      "pregunta": "Pregunta clara y autosuficiente",
      "respuesta": "Respuesta exacta y suficiente",
      "explicacion": "Explicación breve opcional",
      "fuente": "Artículo o página"
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
      "tema": "Tema 1: Derecho Constitucional",
      "subtema": "Título Preliminar",
      "pregunta": "Selecciona todas las respuestas correctas",
      "opciones": ["Opción A", "Opción B", "Opción C", "Opción D"],
      "correctas": ["A", "C"],
      "explicacion": "Explicación breve opcional",
      "fuente": ""
    },
    {
      "tipo": "ortografia",
      "tema": "Ortografía",
      "subtema": "Ejercicio 1",
      "palabra": "haciago",
      "es_correcta": false,
      "forma_correcta": "aciago",
      "explicacion": "La forma correcta es «aciago».",
      "fuente": "Ejercicio 1, p. 13"
    },
    {
      "tipo": "ortografia",
      "tema": "Ortografía",
      "subtema": "Ejercicio 1",
      "palabra": "reventar",
      "es_correcta": true,
      "forma_correcta": "reventar",
      "explicacion": "",
      "fuente": "Ejercicio 1, p. 13"
    }
  ]
}

Si todavía no te he enviado el contenido, espera a que lo adjunte o lo pegue. Cuando lo recibas, responde solo con el bloque de código JSON.`;

function stripCodeFence(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asLetter(value: unknown): AnswerLetter | "" {
  const letter = asString(value).toUpperCase();
  return ["A", "B", "C", "D"].includes(letter) ? letter as AnswerLetter : "";
}

function emptyItemBase(tipo: ImportItemType, tema: string, subtema: string, explicacion: string, fuente: string): ParsedImportItem {
  return {
    tipo,
    tema,
    subtema,
    pregunta: "",
    respuesta: "",
    opciones: [],
    correcta: "",
    correctas: [],
    palabra: "",
    esCorrecta: null,
    formaCorrecta: "",
    explicacion,
    fuente,
  };
}

function parseItem(value: unknown, index: number): ParsedImportItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Elemento ${index + 1}: debe ser un objeto`);
  const row = value as Record<string, unknown>;
  const tipo = asString(row.tipo).toLocaleLowerCase("es") as ImportItemType;
  if (!["flashcard", "vocabulario", "test", "ortografia"].includes(tipo)) throw new Error(`Elemento ${index + 1}: tipo no válido`);

  const rawTema = asString(row.tema);
  const tema = rawTema || (tipo === "ortografia" ? "" : "Importado");
  if (tipo === "ortografia" && !tema) throw new Error(`Elemento ${index + 1}: ortografía necesita "tema"`);
  const subtema = asString(row.subtema);
  const explicacion = asString(row.explicacion);
  const fuente = asString(row.fuente);
  const base = emptyItemBase(tipo, tema, subtema, explicacion, fuente);

  if (tipo === "ortografia") {
    const palabra = asString(row.palabra);
    if (!palabra) throw new Error(`Elemento ${index + 1}: ortografía necesita "palabra"`);
    if (typeof row.es_correcta !== "boolean") throw new Error(`Elemento ${index + 1}: "es_correcta" debe ser true o false, sin comillas`);
    const esCorrecta = row.es_correcta;
    const formaCorrectaRaw = asString(row.forma_correcta);
    if (!esCorrecta && !formaCorrectaRaw) throw new Error(`Elemento ${index + 1}: si "es_correcta" es false, falta "forma_correcta"`);
    const formaCorrecta = formaCorrectaRaw || palabra;
    return { ...base, palabra, esCorrecta, formaCorrecta };
  }

  const pregunta = asString(row.pregunta);
  if (!pregunta) throw new Error(`Elemento ${index + 1}: falta la pregunta`);

  if (tipo === "flashcard") {
    const respuesta = asString(row.respuesta);
    if (!respuesta) throw new Error(`Elemento ${index + 1}: la flashcard necesita respuesta`);
    return { ...base, pregunta, respuesta };
  }

  const opciones = Array.isArray(row.opciones) ? row.opciones.map(asString) : [];
  if (opciones.length !== 4 || opciones.some((option) => !option)) throw new Error(`Elemento ${index + 1}: ${tipo} necesita exactamente cuatro opciones no vacías`);

  const correcta = asLetter(row.correcta);
  const correctasRaw = Array.isArray(row.correctas) ? row.correctas.map(asLetter).filter(Boolean) as AnswerLetter[] : [];
  const correctas = [...new Set(correctasRaw)];

  if (tipo === "vocabulario") {
    if (!correcta) throw new Error(`Elemento ${index + 1}: vocabulario necesita "correcta" con A, B, C o D`);
    if (correctas.length) throw new Error(`Elemento ${index + 1}: vocabulario no admite "correctas" múltiples`);
    return { ...base, pregunta, opciones, correcta, correctas: [correcta] };
  }

  if (correcta && correctas.length) throw new Error(`Elemento ${index + 1}: usa "correcta" o "correctas", pero no ambos`);
  const finalCorrectas = correctas.length ? correctas : correcta ? [correcta] : [];
  if (!finalCorrectas.length) throw new Error(`Elemento ${index + 1}: el test necesita "correcta" o "correctas"`);

  return { ...base, pregunta, opciones, correcta: finalCorrectas.length === 1 ? finalCorrectas[0] : "", correctas: finalCorrectas };
}

export function parseOpoGcImport(raw: string) {
  const cleaned = stripCodeFence(raw);
  if (!cleaned) throw new Error("Pega el JSON generado por ChatGPT o selecciona un archivo .json");
  let parsed: unknown;
  try { parsed = JSON.parse(cleaned); } catch { throw new Error("El contenido no es JSON válido"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("La raíz debe ser un objeto");
  const root = parsed as Record<string, unknown>;
  if (root.version !== 1) throw new Error('La raíz debe incluir exactamente "version": 1');
  if (!Array.isArray(root.items)) throw new Error('La raíz debe incluir un array llamado "items"');
  if (!root.items.length) throw new Error("El JSON no contiene elementos");
  return root.items.map((item, index) => parseItem(item, index));
}

function itemTitle(item: ParsedImportItem) {
  return item.tipo === "ortografia" ? item.palabra : item.pregunta;
}

export default function CardImportModal({ onClose, onImport }: { onClose: () => void; onImport: (items: ParsedImportItem[]) => ImportResult }) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState<ParsedImportItem[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const summary = useMemo(() => {
    if (!preview) return null;
    const counts = { flashcard: 0, vocabulario: 0, test: 0, ortografia: 0, multiple: 0 };
    const themes = new Set<string>();
    preview.forEach((item) => {
      counts[item.tipo] += 1;
      if (item.tipo === "test" && item.correctas.length > 1) counts.multiple += 1;
      themes.add(item.tema);
    });
    return { counts, themes: [...themes] };
  }, [preview]);

  function validate() {
    setError("");
    try { setPreview(parseOpoGcImport(raw)); }
    catch (reason) { setPreview(null); setError(reason instanceof Error ? reason.message : "No se pudo validar el JSON"); }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(OPOGC_CHATGPT_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { setError("No se pudo copiar automáticamente. Selecciona el prompt y cópialo manualmente."); }
  }

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => { setRaw(String(reader.result ?? "")); setPreview(null); setError(""); };
    reader.onerror = () => setError("No se pudo leer el archivo");
    reader.readAsText(file);
  }

  function doImport() {
    if (!preview) return;
    const result = onImport(preview);
    if (result.imported > 0) onClose();
    else setError("No se ha añadido ningún elemento: todos ya existían o no eran válidos.");
  }

  return (
    <div className="modal-backdrop import-modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="modal import-modal">
        <button className="modal-close" onClick={onClose}>×</button>
        <span className="section-label">CHATGPT + JSON</span>
        <h2>Crear o importar contenido con IA</h2>
        <p className="modal-subtitle">Copia el prompt en ChatGPT, adjunta o pega tu material y después importa el JSON. OpoGC detectará Tema → Subtema, flashcards, vocabulario, tests y palabras de ortografía.</p>

        <div className="import-workflow">
          <section className="import-step">
            <div className="import-step-head"><span>1</span><div><strong>Genera el JSON en ChatGPT</strong><small>El prompt incluye tests múltiples y ortografía como unidades individuales.</small></div></div>
            <div className="prompt-preview">{OPOGC_CHATGPT_PROMPT}</div>
            <button type="button" className="secondary-button full-width" onClick={() => void copyPrompt()}>{copied ? "✓ Prompt copiado" : "Copiar prompt para ChatGPT"}</button>
          </section>
          <section className="import-step">
            <div className="import-step-head"><span>2</span><div><strong>Pega o sube el resultado</strong><small>Acepta JSON puro o un bloque ```json … ``` copiado del chat.</small></div></div>
            <textarea className="json-import-textarea" value={raw} onChange={(event) => { setRaw(event.target.value); setPreview(null); setError(""); }} placeholder={'{\n  "version": 1,\n  "items": [ ... ]\n}'} />
            <input ref={fileRef} hidden type="file" accept="application/json,.json,text/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) readFile(file); }} />
            <div className="import-actions-row"><button type="button" className="secondary-button" onClick={() => fileRef.current?.click()}>Subir .json</button><button type="button" className="primary-button" onClick={validate}>Validar JSON</button></div>
            {error && <p className="form-error import-error">{error}</p>}
          </section>
        </div>

        {preview && summary && (
          <section className="import-preview">
            <div className="import-preview-head"><div><span className="section-label">PREVISUALIZACIÓN</span><h3>{preview.length} elementos válidos</h3></div><div className="import-counts"><span>{summary.counts.flashcard} flashcards</span><span>{summary.counts.vocabulario} vocabulario</span><span>{summary.counts.test} tests</span><span>{summary.counts.ortografia} ortografía</span>{summary.counts.multiple > 0 && <span>{summary.counts.multiple} tests múltiples</span>}</div></div>
            <p><strong>Temas:</strong> {summary.themes.join(" · ")}</p>
            <div className="import-preview-list">
              {preview.slice(0, 8).map((item, index) => <div key={`${itemTitle(item)}-${index}`}><span className={`import-kind ${item.tipo}`}>{item.tipo}</span><strong>{itemTitle(item)}</strong><small>{item.tema}{item.subtema ? ` · ${item.subtema}` : ""}{item.tipo === "test" && item.correctas.length > 1 ? " · respuesta múltiple" : item.tipo === "ortografia" ? item.esCorrecta ? " · correcta" : ` · → ${item.formaCorrecta}` : ""}</small></div>)}
              {preview.length > 8 && <p className="muted">…y {preview.length - 8} elementos más.</p>}
            </div>
            <button className="primary-button full" onClick={doImport}>Importar {preview.length} elementos</button>
          </section>
        )}
      </section>
    </div>
  );
}
