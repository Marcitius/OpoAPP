"use client";

import { useMemo, useRef, useState } from "react";

export const ALLOWED_IMPORT_TYPES = ["flashcard", "vocabulario", "test", "ortografia", "respuesta_escrita"] as const;
export type ImportItemType = (typeof ALLOWED_IMPORT_TYPES)[number];
export type AnswerLetter = "A" | "B" | "C" | "D";

export type WrittenCriterion = {
  id: string;
  esperado: string;
  alternativas: string[];
  puntos: number;
  literal: boolean;
  critico: boolean;
  maximoSiFalla: number | null;
  minimoSimilitud: number;
};

export type WrittenEvaluation = {
  normalizacion: {
    ignorarMayusculas: boolean;
    ignorarPuntuacion: boolean;
    ignorarAcentos: boolean;
    ignorarEspaciosExtra: boolean;
  };
  criterios: WrittenCriterion[];
  umbrales: {
    otraVezHasta: number;
    dificilHasta: number;
    bienHasta: number;
  };
};

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
  evaluacion: WrittenEvaluation | null;
};

export type ImportResult = {
  imported: number;
  skipped: number;
  foldersCreated: number;
};

export const OPOGC_CHATGPT_PROMPT = `Convierte únicamente el contenido que te adjunte o pegue en contenido compatible con OpoGC.

REGLAS OBLIGATORIAS:
1. Devuelve exclusivamente un bloque de código JSON válido. No añadas introducción ni explicación fuera del JSON.
2. La raíz debe ser exactamente un objeto con "version": 1 y un array "items".
3. Puedes mezclar "flashcard", "vocabulario", "test", "ortografia" y "respuesta_escrita".
4. No inventes datos. Usa únicamente la fuente proporcionada. Si algo no puede obtenerse de ella, omítelo.
5. Conserva literalmente artículos, cifras, fechas, plazos, excepciones, expresiones jurídicas y nombres propios.
6. Para flashcards usa "tipo": "flashcard", "pregunta" y "respuesta".
7. Para vocabulario usa cuatro "opciones" y una "correcta" A-D.
8. Para test usa cuatro "opciones" y "correcta" o "correctas" si hay varias.
9. Para ortografía cada palabra debe ser un elemento independiente con "palabra", "es_correcta" y "forma_correcta".
10. Para práctica de respuesta escrita usa "tipo": "respuesta_escrita". ChatGPT debe definir TODA la rúbrica; OpoGC no decidirá qué palabras son importantes. Incluye "pregunta", "respuesta", "evaluacion.normalizacion", "evaluacion.criterios" y "evaluacion.umbrales".
11. Cada criterio de respuesta escrita debe tener "id", "esperado", "alternativas", "puntos", "literal", "critico", "maximo_si_falla" y "minimo_similitud". Los puntos representan la importancia del concepto y pueden sumar cualquier cantidad; OpoGC los normalizará a 100 %.
12. Si una expresión debe ser exactamente esa (por ejemplo "interés general"), usa "literal": true y no incluyas como alternativa una expresión jurídicamente distinta.
13. Si aceptas formas equivalentes, decláralas explícitamente en "alternativas". Para "literal": false, "minimo_similitud" define de 0 a 1 el porcentaje mínimo de palabras del criterio que deben aparecer para considerarlo cumplido.
14. "critico": true sirve para identificar conceptos esenciales. Si fallarlo debe limitar la nota máxima, define "maximo_si_falla" (0-100); si no quieres límite usa null.
15. "umbrales" debe definir "otra_vez_hasta", "dificil_hasta" y "bien_hasta". Ejemplo 59, 79 y 94 produce: 0-59 Otra vez; 60-79 Difícil; 80-94 Bien; 95-100 Fácil.
16. Usa "tema" y "subtema" para organizar. En "fuente" indica artículo, tema, ejercicio o página cuando se conozca.

EJEMPLO DE RESPUESTA ESCRITA:
{
  "version": 1,
  "items": [
    {
      "tipo": "respuesta_escrita",
      "tema": "Tema 1: Derecho Constitucional",
      "subtema": "Artículo 2",
      "pregunta": "La Constitución se fundamenta en...",
      "respuesta": "la indisoluble unidad de la Nación española, patria común e indivisible de todos los españoles",
      "evaluacion": {
        "normalizacion": {
          "ignorar_mayusculas": true,
          "ignorar_puntuacion": true,
          "ignorar_acentos": false,
          "ignorar_espacios_extra": true
        },
        "criterios": [
          {
            "id": "unidad",
            "esperado": "indisoluble unidad",
            "alternativas": [],
            "puntos": 30,
            "literal": true,
            "critico": true,
            "maximo_si_falla": 79,
            "minimo_similitud": 1
          },
          {
            "id": "nacion",
            "esperado": "Nación española",
            "alternativas": [],
            "puntos": 20,
            "literal": true,
            "critico": true,
            "maximo_si_falla": 79,
            "minimo_similitud": 1
          },
          {
            "id": "patria",
            "esperado": "patria común e indivisible",
            "alternativas": [],
            "puntos": 30,
            "literal": true,
            "critico": true,
            "maximo_si_falla": 79,
            "minimo_similitud": 1
          },
          {
            "id": "todos",
            "esperado": "todos los españoles",
            "alternativas": [],
            "puntos": 20,
            "literal": false,
            "critico": false,
            "maximo_si_falla": null,
            "minimo_similitud": 0.8
          }
        ],
        "umbrales": {
          "otra_vez_hasta": 59,
          "dificil_hasta": 79,
          "bien_hasta": 94
        }
      },
      "explicacion": "",
      "fuente": "Artículo 2 CE"
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

function asImportType(value: unknown): ImportItemType | null {
  const tipo = asString(value).toLocaleLowerCase("es");
  return (ALLOWED_IMPORT_TYPES as readonly string[]).includes(tipo) ? tipo as ImportItemType : null;
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
    evaluacion: null,
  };
}

function asNumber(value: unknown, fallback = NaN) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function parseWrittenEvaluation(value: unknown, index: number): WrittenEvaluation {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Elemento ${index + 1}: respuesta_escrita necesita "evaluacion"`);
  const evaluation = value as Record<string, unknown>;
  const normalizationRaw = evaluation.normalizacion;
  if (!normalizationRaw || typeof normalizationRaw !== "object" || Array.isArray(normalizationRaw)) throw new Error(`Elemento ${index + 1}: falta "evaluacion.normalizacion"`);
  const normalization = normalizationRaw as Record<string, unknown>;

  if (!Array.isArray(evaluation.criterios) || !evaluation.criterios.length) throw new Error(`Elemento ${index + 1}: "evaluacion.criterios" debe contener al menos un criterio`);
  const ids = new Set<string>();
  const criterios = evaluation.criterios.map((raw, criterionIndex): WrittenCriterion => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`Elemento ${index + 1}, criterio ${criterionIndex + 1}: formato no válido`);
    const row = raw as Record<string, unknown>;
    const id = asString(row.id);
    const esperado = asString(row.esperado);
    const puntos = asNumber(row.puntos);
    if (!id || ids.has(id)) throw new Error(`Elemento ${index + 1}, criterio ${criterionIndex + 1}: "id" vacío o duplicado`);
    ids.add(id);
    if (!esperado) throw new Error(`Elemento ${index + 1}, criterio ${criterionIndex + 1}: falta "esperado"`);
    if (!(puntos > 0)) throw new Error(`Elemento ${index + 1}, criterio ${criterionIndex + 1}: "puntos" debe ser mayor que 0`);
    const alternativas = Array.isArray(row.alternativas) ? row.alternativas.map(asString).filter(Boolean) : [];
    const literal = asBoolean(row.literal, true);
    const critico = asBoolean(row.critico, false);
    const maxRaw = row.maximo_si_falla;
    const maximoSiFalla = maxRaw === null || maxRaw === undefined ? null : asNumber(maxRaw);
    if (maximoSiFalla !== null && (maximoSiFalla < 0 || maximoSiFalla > 100)) throw new Error(`Elemento ${index + 1}, criterio ${criterionIndex + 1}: "maximo_si_falla" debe estar entre 0 y 100 o ser null`);
    const minimoSimilitud = asNumber(row.minimo_similitud, literal ? 1 : 0.8);
    if (minimoSimilitud < 0 || minimoSimilitud > 1) throw new Error(`Elemento ${index + 1}, criterio ${criterionIndex + 1}: "minimo_similitud" debe estar entre 0 y 1`);
    return { id, esperado, alternativas, puntos, literal, critico, maximoSiFalla, minimoSimilitud };
  });

  const thresholdsRaw = evaluation.umbrales;
  if (!thresholdsRaw || typeof thresholdsRaw !== "object" || Array.isArray(thresholdsRaw)) throw new Error(`Elemento ${index + 1}: falta "evaluacion.umbrales"`);
  const thresholds = thresholdsRaw as Record<string, unknown>;
  const otraVezHasta = asNumber(thresholds.otra_vez_hasta);
  const dificilHasta = asNumber(thresholds.dificil_hasta);
  const bienHasta = asNumber(thresholds.bien_hasta);
  if (![otraVezHasta, dificilHasta, bienHasta].every((value) => value >= 0 && value <= 100) || !(otraVezHasta < dificilHasta && dificilHasta < bienHasta)) {
    throw new Error(`Elemento ${index + 1}: umbrales inválidos; deben ser crecientes entre 0 y 100`);
  }

  return {
    normalizacion: {
      ignorarMayusculas: asBoolean(normalization.ignorar_mayusculas, true),
      ignorarPuntuacion: asBoolean(normalization.ignorar_puntuacion, true),
      ignorarAcentos: asBoolean(normalization.ignorar_acentos, false),
      ignorarEspaciosExtra: asBoolean(normalization.ignorar_espacios_extra, true),
    },
    criterios,
    umbrales: { otraVezHasta, dificilHasta, bienHasta },
  };
}

function parseItem(value: unknown, index: number): ParsedImportItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Elemento ${index + 1}: debe ser un objeto`);
  const row = value as Record<string, unknown>;
  const tipo = asImportType(row.tipo);
  if (!tipo) throw new Error(`Elemento ${index + 1}: tipo no válido`);

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

  if (tipo === "respuesta_escrita") {
    const respuesta = asString(row.respuesta);
    if (!respuesta) throw new Error(`Elemento ${index + 1}: respuesta_escrita necesita "respuesta"`);
    const evaluacion = parseWrittenEvaluation(row.evaluacion, index);
    return { ...base, pregunta, respuesta, evaluacion };
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

function itemKindLabel(item: ParsedImportItem) {
  return item.tipo === "respuesta_escrita" ? "respuesta escrita" : item.tipo;
}

export default function CardImportModal({ onClose, onImport }: { onClose: () => void; onImport: (items: ParsedImportItem[]) => ImportResult }) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState<ParsedImportItem[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const summary = useMemo(() => {
    if (!preview) return null;
    const counts = { flashcard: 0, vocabulario: 0, test: 0, ortografia: 0, respuesta_escrita: 0, multiple: 0 };
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
        <p className="modal-subtitle">Copia el prompt en ChatGPT, adjunta o pega tu material y después importa el JSON. OpoGC detectará Tema → Subtema, flashcards, vocabulario, tests, ortografía y respuestas escritas.</p>

        <div className="import-workflow">
          <section className="import-step">
            <div className="import-step-head"><span>1</span><div><strong>Genera el JSON en ChatGPT</strong><small>El prompt incluye tests múltiples, ortografía y rúbricas completas para respuesta escrita.</small></div></div>
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
            <div className="import-preview-head"><div><span className="section-label">PREVISUALIZACIÓN</span><h3>{preview.length} elementos válidos</h3></div><div className="import-counts"><span>{summary.counts.flashcard} flashcards</span><span>{summary.counts.vocabulario} vocabulario</span><span>{summary.counts.test} tests</span><span>{summary.counts.ortografia} ortografía</span><span>{summary.counts.respuesta_escrita} escritas</span>{summary.counts.multiple > 0 && <span>{summary.counts.multiple} tests múltiples</span>}</div></div>
            <p><strong>Temas:</strong> {summary.themes.join(" · ")}</p>
            <div className="import-preview-list">
              {preview.slice(0, 8).map((item, index) => <div key={`${itemTitle(item)}-${index}`}><span className={`import-kind ${item.tipo}`}>{itemKindLabel(item)}</span><strong>{itemTitle(item)}</strong><small>{item.tema}{item.subtema ? ` · ${item.subtema}` : ""}{item.tipo === "test" && item.correctas.length > 1 ? " · respuesta múltiple" : item.tipo === "ortografia" ? item.esCorrecta ? " · correcta" : ` · → ${item.formaCorrecta}` : item.tipo === "respuesta_escrita" ? ` · ${item.evaluacion?.criterios.length ?? 0} criterios` : ""}</small></div>)}
              {preview.length > 8 && <p className="muted">…y {preview.length - 8} elementos más.</p>}
            </div>
            <button className="primary-button full" onClick={doImport}>Importar {preview.length} elementos</button>
          </section>
        )}
      </section>
    </div>
  );
}
