"use client";
import { useRef, useState } from "react";
import {
  cardImportExample,
  cardImportPrompt,
  cardPromptTypes,
  type CardPromptType,
} from "../../lib/import/cardPrompts";

export default function ImportPromptPicker() {
  const [type, setType] = useState<CardPromptType>("flashcard");
  const [message, setMessage] = useState("");
  const [copying, setCopying] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const selected = useRef(type);
  selected.current = type;
  const prompt = cardImportPrompt(type);

  async function copy() {
    const requested = type;
    setCopying(true);
    setMessage("");
    try {
      await navigator.clipboard.writeText(prompt);
      if (selected.current === requested)
        setMessage("Prompt copiado. Pégalo en ChatGPT y añade tu material.");
    } catch {
      if (selected.current === requested) {
        setShowPrompt(true);
        setMessage(
          "No se ha podido copiar. Puedes seleccionar y copiar el texto de «Ver prompt».",
        );
      }
    } finally {
      setCopying(false);
    }
  }

  return (
    <section
      className="card-import-prompts"
      aria-label="Generar tarjetas con ChatGPT"
    >
      <p>
        Elige el tipo y copia el prompt para preparar tus tarjetas en ChatGPT.
      </p>
      <label>
        Tipo de tarjetas para el prompt
        <select
          value={type}
          onChange={(event) => {
            selected.current = event.target.value as CardPromptType;
            setType(selected.current);
            setMessage("");
          }}
        >
          {cardPromptTypes.map((item) => (
            <option key={item.type} value={item.type}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="secondary-button full"
        onClick={copy}
        disabled={copying}
      >
        {copying ? "Copiando…" : "Copiar prompt"}
      </button>
      {message && <p role="status">{message}</p>}
      <details
        open={showPrompt}
        onToggle={(event) => setShowPrompt(event.currentTarget.open)}
      >
        <summary>Ver prompt</summary>
        {showPrompt && (
          <textarea
            className="import-prompt-text"
            aria-label="Prompt para ChatGPT"
            readOnly
            value={prompt}
            rows={12}
          />
        )}
      </details>
      <details>
        <summary>Ver formato JSON</summary>
        <pre>{cardImportExample(type)}</pre>
      </details>
      <p className="field-help">
        Sustituye [TEMA] y [SUBTEMA] en el prompt. Después pega o carga el JSON
        aquí abajo. Puedes importar un archivo con varios tipos de tarjetas.
      </p>
    </section>
  );
}
