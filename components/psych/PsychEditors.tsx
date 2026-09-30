"use client";
import { useState, type FormEvent } from "react";
import { uploadAttachment } from "../../lib/data/files";
import {
  Attempt,
  PsychTest,
  nowIso,
  todayKey,
  uid,
} from "../../lib/study/legacy";
import { ModalShell } from "../sheets/ModalShell";

export function PsychModal({
  initialTest,
  onClose,
  onSave,
}: {
  initialTest: PsychTest | null;
  onClose: () => void;
  onSave: (test: PsychTest) => void;
}) {
  const [name, setName] = useState(initialTest?.name ?? "");
  const [category, setCategory] = useState(
    initialTest?.category ?? "Razonamiento verbal",
  );
  const [total, setTotal] = useState(initialTest?.totalQuestions ?? 0);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");

  async function readJson(response: Response) {
    const text = await response.text();
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      if (response.status === 413)
        throw new Error(
          "El documento es demasiado grande para enviarlo de una sola vez",
        );
      throw new Error(`No se pudo subir el documento (${response.status})`);
    }
  }

  async function uploadDirect(selectedFile: File) {
    const attachment = await uploadAttachment(selectedFile, (progress) =>
      setUploadProgress(progress),
    );
    return attachment;
  }
  const uploadInParts = uploadDirect;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setUploading(true);
    setUploadProgress(0);
    setError("");
    try {
      let attachment = initialTest?.attachment ?? null;
      if (file) {
        if (file.size > 50 * 1024 * 1024)
          throw new Error("El archivo no puede superar 50 MB");
        attachment =
          file.size <= 6 * 1024 * 1024
            ? await uploadDirect(file)
            : await uploadInParts(file);
      }
      const base = initialTest ?? {
        id: uid(),
        attempts: [],
        createdAt: nowIso(),
        attachment: null,
        name: "",
        category: "",
        totalQuestions: 0,
      };
      onSave({
        ...base,
        name: name.trim(),
        category: category.trim(),
        totalQuestions: Math.max(0, total),
        attachment,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar");
      setUploading(false);
    }
  }

  return (
    <ModalShell
      title={initialTest ? "Editar psicotécnico" : "Añadir psicotécnico"}
      subtitle={
        initialTest
          ? "Cambia los datos de la ficha sin perder el historial de intentos."
          : "Guarda el documento y registra todos tus intentos. Ningún campo es obligatorio."
      }
      label={initialTest ? "EDITAR" : "NUEVO"}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <label>
          Nombre <small>(opcional)</small>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ej. Cuadernillo verbal 01"
          />
        </label>
        <div className="form-grid">
          <label>
            Categoría
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option>Razonamiento verbal</option>
              <option>Razonamiento numérico</option>
              <option>Razonamiento abstracto</option>
              <option>Atención y percepción</option>
              <option>Memoria</option>
              <option>Mixto</option>
              <option>Otro</option>
            </select>
          </label>
          <label>
            Preguntas
            <input
              type="number"
              min="0"
              value={total}
              onChange={(event) => setTotal(Number(event.target.value))}
            />
          </label>
        </div>
        <label className="file-drop">
          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <span>⇧</span>
          <strong>
            {file
              ? file.name
              : initialTest?.attachment?.name
                ? `Actual: ${initialTest.attachment.name}`
                : "Seleccionar PDF o imagen"}
          </strong>
          <small>
            {initialTest?.attachment && !file
              ? "Selecciona otro archivo solo si quieres sustituirlo · "
              : ""}
            Máximo 50 MB
          </small>
        </label>
        {uploading && (
          <div className="upload-progress">
            <span style={{ width: `${uploadProgress}%` }} />
            <small>{uploadProgress}%</small>
          </div>
        )}
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button full" disabled={uploading}>
          {uploading
            ? `Subiendo… ${uploadProgress}%`
            : initialTest
              ? "Guardar cambios"
              : "Guardar psicotécnico"}
        </button>
      </form>
    </ModalShell>
  );
}

export function AttemptModal({
  test,
  initialAttempt,
  onClose,
  onSave,
}: {
  test: PsychTest;
  initialAttempt: Attempt | null;
  onClose: () => void;
  onSave: (attempt: Attempt) => void;
}) {
  const [date, setDate] = useState(
    initialAttempt?.date.slice(0, 10) ?? todayKey(),
  );
  const [correct, setCorrect] = useState(initialAttempt?.correct ?? 0);
  const [wrong, setWrong] = useState(initialAttempt?.wrong ?? 0);
  const [blank, setBlank] = useState(initialAttempt?.blank ?? 0);
  const [minutes, setMinutes] = useState(initialAttempt?.minutes ?? 0);
  const [score, setScore] = useState(initialAttempt?.score ?? 0);
  const [notes, setNotes] = useState(initialAttempt?.notes ?? "");
  const registered = correct + wrong + blank;
  const expected = test.totalQuestions || 0;
  return (
    <ModalShell
      title={initialAttempt ? "Editar intento" : "Registrar intento"}
      subtitle={test.name || "Psicotécnico sin nombre"}
      label={initialAttempt ? "EDITAR" : "NUEVO"}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const attemptDate = date
            ? new Date(`${date}T12:00:00`).toISOString()
            : nowIso();
          onSave({
            id: initialAttempt?.id ?? uid(),
            date: attemptDate,
            correct,
            wrong,
            blank,
            score,
            minutes,
            notes: notes.trim(),
          });
        }}
      >
        <label>
          Fecha
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <div className="form-grid three">
          <label>
            Aciertos
            <input
              type="number"
              min="0"
              value={correct}
              onChange={(event) => setCorrect(Number(event.target.value))}
            />
          </label>
          <label>
            Fallos
            <input
              type="number"
              min="0"
              value={wrong}
              onChange={(event) => setWrong(Number(event.target.value))}
            />
          </label>
          <label>
            Blancas
            <input
              type="number"
              min="0"
              value={blank}
              onChange={(event) => setBlank(Number(event.target.value))}
            />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Puntuación
            <input
              type="number"
              step="0.01"
              value={score}
              onChange={(event) => setScore(Number(event.target.value))}
            />
          </label>
          <label>
            Tiempo (min)
            <input
              type="number"
              min="0"
              step="0.1"
              value={minutes}
              onChange={(event) => setMinutes(Number(event.target.value))}
            />
          </label>
        </div>
        <label>
          Notas
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Qué te ha costado, errores repetidos…"
          />
        </label>
        <p
          className={`attempt-total ${expected && registered !== expected ? "warning" : ""}`}
        >
          Registradas: <strong>{registered}</strong>
          {expected ? ` de ${expected} preguntas` : " preguntas"}
          {expected && registered !== expected
            ? " · comprueba el total si procede"
            : ""}
        </p>
        <button className="primary-button full">
          {initialAttempt ? "Guardar cambios" : "Guardar intento"}
        </button>
      </form>
    </ModalShell>
  );
}
