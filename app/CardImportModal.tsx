"use client";
import BottomSheet from "../components/sheets/BottomSheet";
import { useState } from "react";
import {
  buildCardPrompt,
  cardPromptLabels,
  type CardPromptKind,
} from "../lib/chatgptPrompts";
export interface WrittenCriterion {
  id: string;
  esperado: string;
  alternativas: string[];
  puntos: number;
  literal: boolean;
  critico: boolean;
  maximoSiFalla: number | null;
  minimoSimilitud: number;
}
export interface WrittenEvaluation {
  criterios: WrittenCriterion[];
  normalizacion: {
    ignorarMayusculas: boolean;
    ignorarAcentos: boolean;
    ignorarPuntuacion: boolean;
    ignorarEspaciosExtra: boolean;
  };
  umbrales: { otraVezHasta: number; dificilHasta: number; bienHasta: number };
}
export interface ParsedImportItem {
  tipo:
    "flashcard" | "test" | "vocabulario" | "ortografia" | "respuesta_escrita";
  tema: string;
  subtema: string;
  pregunta: string;
  respuesta: string;
  explicacion: string;
  fuente: string;
  opciones: string[];
  correctas: string[];
  palabra: string;
  esCorrecta: boolean | null;
  formaCorrecta: string;
  evaluacion: WrittenEvaluation | null;
}
export function parseCardImport(value: any): ParsedImportItem[] {
  const raw = Array.isArray(value)
    ? value
    : (value?.tarjetas ?? value?.cards ?? value?.items);
  if (!Array.isArray(raw))
    throw new Error("Usa un array JSON o un objeto con tarjetas.");
  return raw.map((x: any, i: number) => {
    const type = x.tipo ?? "flashcard";
    if (
      ![
        "flashcard",
        "test",
        "vocabulario",
        "ortografia",
        "respuesta_escrita",
      ].includes(type)
    )
      throw new Error(`Tipo desconocido en la tarjeta ${i + 1}.`);
    const options = Array.isArray(x.opciones)
      ? x.opciones.map(String)
      : x.opciones && typeof x.opciones === "object"
        ? ["A", "B", "C", "D"].map((k) => String(x.opciones[k] ?? ""))
        : [];
    const correct = Array.isArray(x.correctas)
      ? x.correctas
      : [x.correcta ?? x.respuestaCorrecta ?? ""];
    const item: ParsedImportItem = {
      tipo: type,
      tema: String(x.tema ?? "Sin tema"),
      subtema: String(x.subtema ?? ""),
      pregunta: String(x.pregunta ?? x.front ?? ""),
      respuesta: String(x.respuesta ?? x.back ?? ""),
      explicacion: String(x.explicacion ?? ""),
      fuente: String(x.fuente ?? ""),
      opciones: options,
      correctas: correct.map((x: any) => String(x).toUpperCase()),
      palabra: String(x.palabra ?? ""),
      esCorrecta:
        typeof x.esCorrecta === "boolean"
          ? x.esCorrecta
          : typeof x.es_correcta === "boolean"
            ? x.es_correcta
            : null,
      formaCorrecta: String(x.formaCorrecta ?? x.forma_correcta ?? ""),
      evaluacion: x.evaluacion ?? null,
    };
    if (type === "ortografia") {
      if (
        !item.palabra ||
        item.esCorrecta === null ||
        (!item.esCorrecta && !item.formaCorrecta)
      )
        throw new Error(
          `Faltan palabra, esCorrecta o formaCorrecta en ${i + 1}.`,
        );
    } else if (!item.pregunta.trim())
      throw new Error(`Falta la pregunta en ${i + 1}.`);
    if (
      ["test", "vocabulario"].includes(type) &&
      (options.length !== 4 ||
        !item.correctas.length ||
        item.correctas.some((x) => !["A", "B", "C", "D"].includes(x)))
    )
      throw new Error(
        `La tarjeta ${i + 1} necesita cuatro opciones y letras correctas A–D.`,
      );
    if (type === "respuesta_escrita" && item.evaluacion) {
      const ev = item.evaluacion;
      const ids = new Set();
      if (!Array.isArray(ev.criterios) || !ev.criterios.length)
        throw new Error("La rúbrica necesita criterios.");
      ev.criterios = ev.criterios.map((c: any, j: number) => {
        if (!c.esperado || !Number.isFinite(c.puntos) || c.puntos <= 0)
          throw new Error("Cada criterio necesita texto y puntos positivos.");
        const id = String(c.id ?? `criterio_${j + 1}`);
        if (ids.has(id))
          throw new Error("Los IDs de los criterios deben ser distintos.");
        ids.add(id);
        return {
          ...c,
          id,
          alternativas: c.alternativas ?? [],
          literal: !!c.literal,
          critico: !!c.critico,
          maximoSiFalla: c.maximoSiFalla ?? null,
          minimoSimilitud: c.minimoSimilitud ?? 0.8,
        };
      });
      ev.normalizacion = {
        ignorarMayusculas: true,
        ignorarAcentos: false,
        ignorarPuntuacion: true,
        ignorarEspaciosExtra: true,
        ...(ev.normalizacion as Partial<WrittenEvaluation["normalizacion"]>),
      };
      ev.umbrales = {
        otraVezHasta: 40,
        dificilHasta: 65,
        bienHasta: 85,
        ...(ev.umbrales as Partial<WrittenEvaluation["umbrales"]>),
      };
    }
    return item;
  });
}
const example = JSON.stringify(
  {
    tarjetas: [
      {
        tipo: "flashcard",
        tema: "Mi tema",
        subtema: "Mi apartado",
        pregunta: "Pregunta",
        respuesta: "Respuesta",
        explicacion: "",
        fuente: "",
      },
    ],
  },
  null,
  2,
);
export default function CardImportModal({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (items: ParsedImportItem[]) => void;
}) {
  const [text, setText] = useState(""),
    [error, setError] = useState("");
  const [promptType, setPromptType] =
  useState<CardPromptKind>("flashcard");
const [promptCopied, setPromptCopied] = useState(false);

const generatedPrompt = buildCardPrompt(promptType);

async function copyPrompt() {
  try {
    await navigator.clipboard.writeText(generatedPrompt);
    setPromptCopied(true);
    window.setTimeout(() => setPromptCopied(false), 1800);
  } catch {
    setPromptCopied(false);
  }
}
  const [items, setItems] = useState<ParsedImportItem[] | null>(null);
  function check() {
    try {
      setItems(
        parseCardImport(
          JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")),
        ),
      );
      setError("");
    } catch (e) {
      setItems(null);
      setError((e as Error).message);
    }
  }
  return (
    <BottomSheet
      title="Importar tarjetas"
      onClose={onClose}
      fullScreen
      className="legacy-editor card-import-editor"
    >
      <p>
        Admite flashcards, test, vocabulario, ortografía y respuestas escritas
        con rúbrica.
      </p>
      <section className="import-step">
  <div className="import-step-head">
    <span>AI</span>
    <div>
      <strong>Crear con ChatGPT</strong>
      <small>
        Copia el prompt, adjunta tu material en ChatGPT y pega aquí el
        JSON generado.
      </small>
    </div>
  </div>

  <label>
    ¿Qué quieres crear?
    <select
      value={promptType}
      onChange={(e) => {
        setPromptType(e.target.value as CardPromptKind);
        setPromptCopied(false);
      }}
    >
      {Object.entries(cardPromptLabels).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  </label>

  <button
    type="button"
    className="secondary-button full-width"
    onClick={copyPrompt}
  >
    {promptCopied ? "✓ Prompt copiado" : "Copiar prompt para ChatGPT"}
  </button>

  <details>
    <summary>Ver prompt completo</summary>
    <pre className="prompt-preview">{generatedPrompt}</pre>
  </details>
</section>
      <details>
        <summary>Ver formato JSON</summary>
        <pre style={{ whiteSpace: "pre-wrap" }}>{example}</pre>
        <p>
          Test/vocabulario: opciones (4 textos), correctas (letras A–D).
          Ortografía: palabra, esCorrecta, formaCorrecta. Escrita: respuesta y
          evaluacion con criterios, normalizacion y umbrales.
        </p>
      </details>
      <label>
        Archivo JSON
        <input
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            if (e.target.files?.[0]) setText(await e.target.files[0].text());
            setItems(null);
          }}
        />
      </label>
      <textarea
        className="import-paste"
        aria-label="JSON de tarjetas"
        placeholder="Pega el JSON"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setItems(null);
        }}
      />
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {items ? (
        <>
          <p>{items.length} tarjetas listas para importar.</p>
          <button
            className="primary-button full"
            onClick={() => onImport(items)}
          >
            Importar {items.length} tarjetas
          </button>
        </>
      ) : (
        <button
          className="primary-button full"
          disabled={!text.trim()}
          onClick={check}
        >
          Validar JSON
        </button>
      )}
    </BottomSheet>
  );
}
