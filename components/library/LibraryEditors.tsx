"use client";
import { useState, type FormEvent } from "react";
import { AnnotatedCardImage, ImageAnnotator } from "../../app/CardImage";
import type {
  WrittenCriterion,
  WrittenEvaluation,
} from "../../app/CardImportModal";
import RichTextEditor, {
  plainRichText,
  sanitizeRichHtml,
} from "../../app/RichTextEditor";
import { uploadAttachment } from "../../lib/data/files";
import {
  Attachment,
  Card,
  CardType,
  Folder,
  WRITTEN_RUBRIC_PREFIX,
  cardCorrectOptions,
  colors,
  descendantFolderIds,
  encodeWrittenRubric,
  escapeHtml,
  flattenFolderTree,
  folderPathLabel,
  isMultipleChoiceType,
  nowIso,
  orthographyBackHtml,
  uid,
  writtenRubric,
} from "../../lib/study/legacy";
import { ModalShell } from "../sheets/ModalShell";

export function FolderModal({
  parentId,
  parentName,
  onClose,
  onCreate,
}: {
  parentId: string | null;
  parentName: string;
  onClose: () => void;
  onCreate: (folder: Folder) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(colors[0]);
  const isNested = Boolean(parentId);
  return (
    <ModalShell
      title={isNested ? "Añadir dentro" : "Crear tema"}
      subtitle={
        isNested
          ? `Se añadirá dentro de ${parentName}. Puedes seguir creando tantos niveles como necesites.`
          : "Crea un tema principal. Después podrás organizar dentro títulos, capítulos, artículos o cualquier otro nivel."
      }
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim())
            onCreate({
              id: uid(),
              name: name.trim(),
              color,
              parentId,
              createdAt: nowIso(),
            });
        }}
      >
        <label>
          Nombre
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={
              isNested
                ? "Ej. Título III / Artículo 76 / Apartado 1"
                : "Ej. Tema 4 · Derecho Penal"
            }
          />
        </label>
        <label>
          Color
          <div className="color-picker">
            {colors.map((item) => (
              <button
                type="button"
                key={item}
                className={color === item ? "selected" : ""}
                style={{ background: item }}
                onClick={() => setColor(item)}
                aria-label={`Color ${item}`}
              />
            ))}
          </div>
        </label>
        <button className="primary-button full" disabled={!name.trim()}>
          Crear {isNested ? "apartado" : "tema"}
        </button>
      </form>
    </ModalShell>
  );
}

export function MoveFolderModal({
  folders,
  folder,
  onClose,
  onMove,
}: {
  folders: Folder[];
  folder: Folder;
  onClose: () => void;
  onMove: (targetParentId: string | null) => void;
}) {
  const [targetParentId, setTargetParentId] = useState(folder.parentId ?? "");
  const blocked = descendantFolderIds(folders, folder.id);
  const options = flattenFolderTree(folders).filter(
    ({ folder: candidate }) => !blocked.has(candidate.id),
  );
  const currentPath = folderPathLabel(folders, folder.id);
  const targetPath = targetParentId
    ? folderPathLabel(folders, targetParentId)
    : "Biblioteca · nivel principal";
  const unchanged = (folder.parentId ?? "") === targetParentId;
  return (
    <ModalShell
      title="Mover tema o apartado"
      subtitle="Mueve la rama completa. Sus tarjetas, subapartados, progreso e historial se conservan."
      label="ORGANIZAR"
      onClose={onClose}
    >
      <div className="folder-move-summary">
        <span>VAS A MOVER</span>
        <strong>{folder.name}</strong>
        <small>{currentPath}</small>
      </div>
      <label>
        Nuevo destino
        <select
          value={targetParentId}
          onChange={(event) => setTargetParentId(event.target.value)}
        >
          <option value="">Biblioteca · nivel principal</option>
          {options.map(({ folder: candidate, depth }) => (
            <option key={candidate.id} value={candidate.id}>
              {"↳ ".repeat(depth)}
              {candidate.name}
            </option>
          ))}
        </select>
      </label>
      <div className="folder-move-destination">
        <span>QUEDARÁ DENTRO DE</span>
        <strong>{targetPath}</strong>
      </div>
      <div className="study-import-actions">
        <button className="secondary-button" onClick={onClose}>
          Cancelar
        </button>
        <button
          className="primary-button"
          disabled={unchanged}
          onClick={() => onMove(targetParentId || null)}
        >
          Mover
        </button>
      </div>
    </ModalShell>
  );
}

export function CardModal({
  folders,
  defaultFolder,
  initialCard,
  onClose,
  onSave,
}: {
  folders: Folder[];
  defaultFolder: string | null;
  initialCard: Card | null;
  onClose: () => void;
  onSave: (card: Card) => void;
}) {
  const [type, setType] = useState<CardType>(initialCard?.type ?? "basic");
  const [folderId, setFolderId] = useState(
    initialCard?.folderId ?? defaultFolder ?? folders[0]?.id ?? "",
  );
  const [front, setFront] = useState(initialCard?.front ?? "");
  const [back, setBack] = useState(initialCard?.back ?? "");
  const [options, setOptions] = useState(() => {
    const existing = initialCard?.options ?? [];
    return Array.from({ length: 4 }, (_, index) => existing[index] ?? "");
  });
  const initialCorrectOptions = initialCard
    ? cardCorrectOptions(initialCard)
    : [0];
  const [correctOption, setCorrectOption] = useState(
    initialCorrectOptions[0] ?? 0,
  );
  const [correctOptions, setCorrectOptions] = useState<number[]>(
    initialCorrectOptions,
  );
  const [multipleAnswers, setMultipleAnswers] = useState(
    Boolean(initialCard?.type === "test" && initialCorrectOptions.length > 1),
  );
  const [attachment, setAttachment] = useState<Attachment | null>(
    initialCard?.attachment ?? null,
  );
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState("");
  const [editingImage, setEditingImage] = useState(false);
  const [orthographyWord, setOrthographyWord] = useState(
    initialCard?.type === "orthography" ? plainRichText(initialCard.front) : "",
  );
  const [orthographyIsCorrect, setOrthographyIsCorrect] = useState(
    initialCard?.type === "orthography"
      ? initialCard.orthographyIsCorrect !== false
      : true,
  );
  const [orthographyCorrectForm, setOrthographyCorrectForm] = useState(
    initialCard?.type === "orthography"
      ? initialCard.orthographyCorrectForm
      : "",
  );
  const [orthographyExplanation, setOrthographyExplanation] = useState(
    initialCard?.type === "orthography"
      ? initialCard.orthographyExplanation
      : "",
  );
  const [orthographySource, setOrthographySource] = useState(
    initialCard?.type === "orthography" ? initialCard.orthographySource : "",
  );
  const [writtenEvaluation, setWrittenEvaluation] =
    useState<WrittenEvaluation | null>(() =>
      initialCard?.type === "written" ? writtenRubric(initialCard) : null,
    );
  const [writtenEditorError, setWrittenEditorError] = useState("");

  function updateWrittenCriterion(
    index: number,
    updater: (criterion: WrittenCriterion) => WrittenCriterion,
  ) {
    setWrittenEvaluation((current) =>
      current
        ? {
            ...current,
            criterios: current.criterios.map((criterion, criterionIndex) =>
              criterionIndex === index ? updater(criterion) : criterion,
            ),
          }
        : current,
    );
    setWrittenEditorError("");
  }

  function addWrittenCriterion() {
    setWrittenEvaluation((current) => {
      if (!current) return current;
      const number = current.criterios.length + 1;
      return {
        ...current,
        criterios: [
          ...current.criterios,
          {
            id: `criterio_${number}`,
            esperado: "",
            alternativas: [],
            puntos: 10,
            literal: false,
            critico: false,
            maximoSiFalla: null,
            minimoSimilitud: 0.8,
          },
        ],
      };
    });
  }

  function removeWrittenCriterion(index: number) {
    setWrittenEvaluation((current) =>
      current
        ? {
            ...current,
            criterios: current.criterios.filter(
              (_, criterionIndex) => criterionIndex !== index,
            ),
          }
        : current,
    );
  }

  async function compressIfNeeded(file: File) {
    if (file.size <= 5.5 * 1024 * 1024) return file;
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () =>
          reject(new Error("No se pudo preparar la imagen"));
        element.src = url;
      });
      const maxSide = 2200;
      const ratio = Math.min(
        1,
        maxSide / Math.max(image.naturalWidth, image.naturalHeight),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("No se pudo preparar la imagen");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.86),
      );
      if (!blob) throw new Error("No se pudo comprimir la imagen");
      return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
        type: "image/jpeg",
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function uploadImage(file: File): Promise<Attachment | null> {
    if (!file.type.startsWith("image/")) {
      setImageError("Selecciona una imagen");
      return null;
    }
    setUploadingImage(true);
    setImageError("");
    try {
      const prepared = await compressIfNeeded(file);
      const form = new FormData();
      form.append("file", prepared);
      const payload = { attachment: await uploadAttachment(prepared) };
      if (!payload.attachment) throw new Error("No se pudo subir la imagen");
      setAttachment(payload.attachment);
      return payload.attachment;
    } catch (reason) {
      setImageError(
        reason instanceof Error ? reason.message : "No se pudo subir la imagen",
      );
      return null;
    } finally {
      setUploadingImage(false);
    }
  }

  async function createHandwrittenAnswer() {
    setUploadingImage(true);
    setImageError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1600;
      canvas.height = 1200;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("No se pudo crear el lienzo");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("No se pudo crear el lienzo");
      const file = new File([blob], `respuesta-manuscrita-${Date.now()}.png`, {
        type: "image/png",
      });
      const form = new FormData();
      form.append("file", file);
      const payload = { attachment: await uploadAttachment(file) };
      if (!payload.attachment)
        throw new Error("No se pudo crear la respuesta manuscrita");
      setAttachment(payload.attachment);
      setEditingImage(true);
    } catch (reason) {
      setImageError(
        reason instanceof Error
          ? reason.message
          : "No se pudo crear la respuesta manuscrita",
      );
    } finally {
      setUploadingImage(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const base: Card = initialCard ?? {
      id: uid(),
      folderId: "",
      type,
      front: "",
      back: "",
      options: [],
      correctOption: 0,
      correctOptions: [0],
      dueAt: nowIso(),
      createdAt: nowIso(),
      lastReviewedAt: null,
      intervalDays: 0,
      ease: 0,
      repetitions: 0,
      lapses: 0,
      streak: 0,
      reviewCount: 0,
      successCount: 0,
      attachment: null,
      fsrsStability: 0,
      fsrsDifficulty: 0,
      orthographyIsCorrect: null,
      orthographyCorrectForm: "",
      orthographyExplanation: "",
      orthographySource: "",
      orthographyStage: 1,
    };
    if (type === "orthography" && !orthographyWord.trim()) return;
    if (
      type === "orthography" &&
      !orthographyIsCorrect &&
      !orthographyCorrectForm.trim()
    )
      return;
    if (type === "written") {
      if (!writtenEvaluation || !writtenEvaluation.criterios.length) {
        setWrittenEditorError(
          "La respuesta escrita necesita al menos un criterio de corrección.",
        );
        return;
      }
      const ids = new Set<string>();
      for (const criterion of writtenEvaluation.criterios) {
        if (!criterion.id.trim() || ids.has(criterion.id.trim())) {
          setWrittenEditorError("Cada criterio necesita un ID único.");
          return;
        }
        ids.add(criterion.id.trim());
        if (!criterion.esperado.trim()) {
          setWrittenEditorError(
            "Todos los criterios necesitan un texto esperado.",
          );
          return;
        }
        if (!(criterion.puntos > 0)) {
          setWrittenEditorError(
            "Los puntos de cada criterio deben ser mayores que 0.",
          );
          return;
        }
        if (criterion.minimoSimilitud < 0 || criterion.minimoSimilitud > 1) {
          setWrittenEditorError("La similitud mínima debe estar entre 0 y 1.");
          return;
        }
      }
      const { otraVezHasta, dificilHasta, bienHasta } =
        writtenEvaluation.umbrales;
      if (!(
        otraVezHasta >= 0 &&
        otraVezHasta < dificilHasta &&
        dificilHasta < bienHasta &&
        bienHasta < 100
      )) {
        setWrittenEditorError(
          "Los umbrales deben cumplir: Otra vez < Difícil < Bien < 100.",
        );
        return;
      }
    }
    setWrittenEditorError("");
    const finalOrthographyForm = orthographyIsCorrect
      ? orthographyCorrectForm.trim() || orthographyWord.trim()
      : orthographyCorrectForm.trim();
    const writtenOptions =
      type === "written" && writtenEvaluation
        ? [
            ...(initialCard?.options ?? []).filter(
              (item) => !item.startsWith(WRITTEN_RUBRIC_PREFIX),
            ),
            encodeWrittenRubric(writtenEvaluation),
          ]
        : (initialCard?.options ?? []);
    onSave({
      ...base,
      folderId,
      type,
      front:
        type === "orthography"
          ? sanitizeRichHtml(`<p>${escapeHtml(orthographyWord.trim())}</p>`)
          : sanitizeRichHtml(front),
      back:
        type === "orthography"
          ? orthographyBackHtml(
              orthographyWord.trim(),
              orthographyIsCorrect,
              finalOrthographyForm,
              orthographyExplanation.trim(),
              orthographySource.trim(),
            )
          : sanitizeRichHtml(back),
      options:
        type === "written"
          ? writtenOptions
          : isMultipleChoiceType(type)
            ? options.slice(0, 4).map((option) => option.trim())
            : [],
      correctOption: isMultipleChoiceType(type)
        ? ((type === "test" && multipleAnswers
            ? [...new Set(correctOptions)].sort((a, b) => a - b)[0]
            : correctOption) ?? 0)
        : 0,
      correctOptions: isMultipleChoiceType(type)
        ? type === "test" && multipleAnswers
          ? [...new Set(correctOptions)].sort((a, b) => a - b).length
            ? [...new Set(correctOptions)].sort((a, b) => a - b)
            : [0]
          : [Math.min(correctOption, 3)]
        : [],
      attachment: type === "orthography" ? null : attachment,
      orthographyIsCorrect:
        type === "orthography" ? orthographyIsCorrect : null,
      orthographyCorrectForm:
        type === "orthography" ? finalOrthographyForm : "",
      orthographyExplanation:
        type === "orthography" ? orthographyExplanation.trim() : "",
      orthographySource: type === "orthography" ? orthographySource.trim() : "",
      orthographyStage:
        type === "orthography" ? Math.max(1, base.orthographyStage || 1) : 1,
    });
  }

  return (
    <ModalShell
      title={initialCard ? "Editar tarjeta" : "Crear tarjeta"}
      subtitle="Crea flashcards, vocabulario, tests u ortografía. Las respuestas escritas con rúbrica se crean desde ChatGPT / JSON y después pueden editarse aquí."
      label={initialCard ? "EDITAR" : "NUEVO"}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="segmented five-types">
          <button
            type="button"
            className={type === "basic" ? "active" : ""}
            onClick={() => setType("basic")}
          >
            Flashcard
          </button>
          <button
            type="button"
            className={type === "choice" ? "active" : ""}
            onClick={() => setType("choice")}
          >
            Vocabulario
          </button>
          <button
            type="button"
            className={type === "test" ? "active" : ""}
            onClick={() => setType("test")}
          >
            Tipo test
          </button>
          <button
            type="button"
            className={type === "orthography" ? "active" : ""}
            onClick={() => setType("orthography")}
          >
            Ortografía
          </button>
          <button
            type="button"
            className={type === "written" ? "active" : ""}
            disabled={!initialCard || initialCard.type !== "written"}
            title={
              !initialCard
                ? "Las respuestas escritas se crean desde ChatGPT / JSON"
                : initialCard.type !== "written"
                  ? "No se convierte una tarjeta existente a respuesta escrita"
                  : "Editar respuesta escrita"
            }
            onClick={() =>
              initialCard?.type === "written" && setType("written")
            }
          >
            Respuesta escrita
          </button>
        </div>
        {type === "written" && (
          <div className="written-import-note">
            <strong>Respuesta escrita</strong>
            <span>
              Edita aquí la rúbrica importada. OpoGC seguirá usando estos
              criterios para calcular la precisión.
            </span>
          </div>
        )}
        <label>
          Tema / apartado
          <select
            value={folderId}
            onChange={(event) => setFolderId(event.target.value)}
          >
            <option value="">Sin carpeta</option>
            {flattenFolderTree(folders).map(({ folder, depth }) => (
              <option key={folder.id} value={folder.id}>
                {"↳ ".repeat(depth)}
                {folder.name}
              </option>
            ))}
          </select>
        </label>
        {type === "orthography" ? (
          <div className="orthography-manual-editor">
            <span className="flashcard-side-label">
              PALABRA · UNIDAD INDIVIDUAL DE ESTUDIO
            </span>
            <label>
              Palabra
              <input
                value={orthographyWord}
                onChange={(event) => setOrthographyWord(event.target.value)}
                placeholder="Ej. haciago"
              />
            </label>
            <div className="answer-mode-toggle orthography-correctness-toggle">
              <button
                type="button"
                className={orthographyIsCorrect ? "active" : ""}
                onClick={() => {
                  setOrthographyIsCorrect(true);
                  if (!orthographyCorrectForm.trim())
                    setOrthographyCorrectForm(orthographyWord);
                }}
              >
                Está bien escrita
              </button>
              <button
                type="button"
                className={!orthographyIsCorrect ? "active" : ""}
                onClick={() => setOrthographyIsCorrect(false)}
              >
                Está mal escrita
              </button>
            </div>
            <label>
              Forma correcta
              {!orthographyIsCorrect
                ? " · obligatoria"
                : " · puede coincidir con la palabra"}
              <input
                value={orthographyCorrectForm}
                onChange={(event) =>
                  setOrthographyCorrectForm(event.target.value)
                }
                placeholder={
                  orthographyIsCorrect
                    ? orthographyWord || "Forma correcta"
                    : "Ej. aciago"
                }
              />
            </label>
            <label>
              Explicación <small>(opcional)</small>
              <textarea
                value={orthographyExplanation}
                onChange={(event) =>
                  setOrthographyExplanation(event.target.value)
                }
                placeholder="La forma correcta es…"
              />
            </label>
            <label>
              Fuente <small>(opcional)</small>
              <input
                value={orthographySource}
                onChange={(event) => setOrthographySource(event.target.value)}
                placeholder="Ejercicio 1, p. 13"
              />
            </label>
            <p className="field-help">
              OpoGC no guardará esta palabra como un test fijo. La mezclará
              dinámicamente con otras tres y mantendrá su progreso SRS por
              separado.
            </p>
          </div>
        ) : (
          <>
            <div className="flashcard-side-editor question-editor">
              <span className="flashcard-side-label">ANVERSO · PREGUNTA</span>
              <label>Pregunta</label>
              <RichTextEditor
                value={front}
                onChange={setFront}
                placeholder="Escribe la pregunta"
              />
              {isMultipleChoiceType(type) && (
                <fieldset>
                  <legend>
                    {type === "test"
                      ? "Opciones del test"
                      : "Opciones de vocabulario"}
                  </legend>
                  {type === "test" && (
                    <div className="answer-mode-toggle">
                      <button
                        type="button"
                        className={!multipleAnswers ? "active" : ""}
                        onClick={() => {
                          setMultipleAnswers(false);
                          setCorrectOption(correctOptions[0] ?? correctOption);
                        }}
                      >
                        Respuesta única
                      </button>
                      <button
                        type="button"
                        className={multipleAnswers ? "active" : ""}
                        onClick={() => {
                          setMultipleAnswers(true);
                          setCorrectOptions((current) =>
                            current.length ? current : [correctOption],
                          );
                        }}
                      >
                        Respuesta múltiple
                      </button>
                    </div>
                  )}
                  {type === "test" && multipleAnswers && (
                    <p className="field-help">
                      Marca todas las opciones correctas. Al estudiar, habrá que
                      seleccionar exactamente ese conjunto.
                    </p>
                  )}
                  {options.map((option, index) => {
                    const checked =
                      type === "test" && multipleAnswers
                        ? correctOptions.includes(index)
                        : correctOption === index;
                    return (
                      <label className="option-input" key={index}>
                        <input
                          type={
                            type === "test" && multipleAnswers
                              ? "checkbox"
                              : "radio"
                          }
                          name={
                            type === "test" && multipleAnswers
                              ? undefined
                              : "correct"
                          }
                          checked={checked}
                          onChange={() => {
                            if (type === "test" && multipleAnswers)
                              setCorrectOptions((current) =>
                                current.includes(index)
                                  ? current.filter((value) => value !== index)
                                  : [...current, index],
                              );
                            else {
                              setCorrectOption(index);
                              setCorrectOptions([index]);
                            }
                          }}
                        />
                        <span>{String.fromCharCode(65 + index)}</span>
                        <input
                          value={option}
                          onChange={(event) =>
                            setOptions((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index ? event.target.value : item,
                              ),
                            )
                          }
                          placeholder={`Opción ${index + 1}`}
                        />
                      </label>
                    );
                  })}
                </fieldset>
              )}
            </div>
            <div className="flashcard-side-editor answer-editor">
              <span className="flashcard-side-label">REVERSO · RESPUESTA</span>
              <label>
                Texto de la respuesta <small>(opcional)</small>
              </label>
              <RichTextEditor
                value={back}
                onChange={setBack}
                placeholder="Puedes escribir una respuesta, añadir una imagen, escribir a mano o combinarlo"
              />
              <div className="card-media-field answer-media-field">
                <span className="card-media-label">
                  Respuesta visual <small>(opcional)</small>
                </span>
                {!attachment ? (
                  <div className="answer-media-actions">
                    <label className="file-drop compact answer-upload">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void uploadImage(file);
                        }}
                      />
                      <span>🖼</span>
                      <strong>
                        {uploadingImage
                          ? "Subiendo…"
                          : "Usar una imagen como respuesta"}
                      </strong>
                      <small>
                        Página de libro, esquema, captura, fotografía…
                      </small>
                    </label>
                    <button
                      type="button"
                      className="blank-answer-button"
                      disabled={uploadingImage}
                      onClick={() => void createHandwrittenAnswer()}
                    >
                      <span>✎</span>
                      <strong>Crear respuesta manuscrita</strong>
                      <small>
                        Abre un lienzo en blanco para Apple Pencil o dedo.
                      </small>
                    </button>
                  </div>
                ) : (
                  <div className="card-media-preview answer-media-preview">
                    <AnnotatedCardImage
                      attachment={attachment}
                      onOpen={() => setEditingImage(true)}
                    />
                    <div>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setEditingImage(true)}
                      >
                        ✎ Abrir / escribir
                      </button>
                      <button
                        type="button"
                        className="secondary-button danger"
                        onClick={() => setAttachment(null)}
                      >
                        Quitar respuesta visual
                      </button>
                    </div>
                    <small>
                      Esta imagen no se mostrará con la pregunta. Aparecerá
                      únicamente al mostrar la respuesta.
                    </small>
                  </div>
                )}
                {imageError && <p className="form-error">{imageError}</p>}
              </div>
            </div>

            {type === "written" && writtenEvaluation && (
              <div className="written-rubric-editor">
                <div className="written-rubric-head">
                  <div>
                    <span className="flashcard-side-label">
                      RÚBRICA DE CORRECCIÓN
                    </span>
                    <strong>
                      {writtenEvaluation.criterios.length} criterios
                    </strong>
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={addWrittenCriterion}
                  >
                    ＋ Criterio
                  </button>
                </div>
                <p className="field-help">
                  Puedes aflojar o endurecer cada criterio. Si el orden exacto
                  no importa, desactiva «Literal» y ajusta la similitud mínima.
                </p>
                <div className="written-normalization-grid">
                  <label>
                    <input
                      type="checkbox"
                      checked={
                        writtenEvaluation.normalizacion.ignorarMayusculas
                      }
                      onChange={(event) =>
                        setWrittenEvaluation({
                          ...writtenEvaluation,
                          normalizacion: {
                            ...writtenEvaluation.normalizacion,
                            ignorarMayusculas: event.target.checked,
                          },
                        })
                      }
                    />{" "}
                    Ignorar mayúsculas
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={
                        writtenEvaluation.normalizacion.ignorarPuntuacion
                      }
                      onChange={(event) =>
                        setWrittenEvaluation({
                          ...writtenEvaluation,
                          normalizacion: {
                            ...writtenEvaluation.normalizacion,
                            ignorarPuntuacion: event.target.checked,
                          },
                        })
                      }
                    />{" "}
                    Ignorar puntuación
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={writtenEvaluation.normalizacion.ignorarAcentos}
                      onChange={(event) =>
                        setWrittenEvaluation({
                          ...writtenEvaluation,
                          normalizacion: {
                            ...writtenEvaluation.normalizacion,
                            ignorarAcentos: event.target.checked,
                          },
                        })
                      }
                    />{" "}
                    Ignorar acentos
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={
                        writtenEvaluation.normalizacion.ignorarEspaciosExtra
                      }
                      onChange={(event) =>
                        setWrittenEvaluation({
                          ...writtenEvaluation,
                          normalizacion: {
                            ...writtenEvaluation.normalizacion,
                            ignorarEspaciosExtra: event.target.checked,
                          },
                        })
                      }
                    />{" "}
                    Ignorar espacios extra
                  </label>
                </div>

                <div className="written-rubric-criteria">
                  {writtenEvaluation.criterios.map((criterion, index) => (
                    <section
                      className="written-rubric-criterion"
                      key={`${criterion.id}-${index}`}
                    >
                      <div className="written-rubric-criterion-head">
                        <strong>Criterio {index + 1}</strong>
                        <button
                          type="button"
                          className="text-button danger-text"
                          disabled={writtenEvaluation.criterios.length <= 1}
                          onClick={() => removeWrittenCriterion(index)}
                        >
                          Eliminar
                        </button>
                      </div>
                      <div className="form-grid">
                        <label>
                          ID
                          <input
                            value={criterion.id}
                            onChange={(event) =>
                              updateWrittenCriterion(index, (current) => ({
                                ...current,
                                id: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label>
                          Puntos
                          <input
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={criterion.puntos}
                            onChange={(event) =>
                              updateWrittenCriterion(index, (current) => ({
                                ...current,
                                puntos: Number(event.target.value),
                              }))
                            }
                          />
                        </label>
                      </div>
                      <label>
                        Texto esperado
                        <textarea
                          value={criterion.esperado}
                          onChange={(event) =>
                            updateWrittenCriterion(index, (current) => ({
                              ...current,
                              esperado: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label>
                        Alternativas aceptadas <small>(una por línea)</small>
                        <textarea
                          value={criterion.alternativas.join("\n")}
                          onChange={(event) =>
                            updateWrittenCriterion(index, (current) => ({
                              ...current,
                              alternativas: event.target.value
                                .split(/\n/)
                                .map((value) => value.trim())
                                .filter(Boolean),
                            }))
                          }
                        />
                      </label>
                      <div className="written-rubric-flags">
                        <label>
                          <input
                            type="checkbox"
                            checked={criterion.literal}
                            onChange={(event) =>
                              updateWrittenCriterion(index, (current) => ({
                                ...current,
                                literal: event.target.checked,
                              }))
                            }
                          />{" "}
                          Literal
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={criterion.critico}
                            onChange={(event) =>
                              updateWrittenCriterion(index, (current) => ({
                                ...current,
                                critico: event.target.checked,
                              }))
                            }
                          />{" "}
                          Crítico
                        </label>
                      </div>
                      <div className="form-grid">
                        <label>
                          Similitud mínima
                          <input
                            type="number"
                            min="0"
                            max="1"
                            step="0.05"
                            value={criterion.minimoSimilitud}
                            onChange={(event) =>
                              updateWrittenCriterion(index, (current) => ({
                                ...current,
                                minimoSimilitud: Number(event.target.value),
                              }))
                            }
                          />
                        </label>
                        <label>
                          Máximo si falla <small>(vacío = sin límite)</small>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={criterion.maximoSiFalla ?? ""}
                            onChange={(event) =>
                              updateWrittenCriterion(index, (current) => ({
                                ...current,
                                maximoSiFalla:
                                  event.target.value === ""
                                    ? null
                                    : Number(event.target.value),
                              }))
                            }
                          />
                        </label>
                      </div>
                    </section>
                  ))}
                </div>

                <div className="written-thresholds">
                  <span className="flashcard-side-label">
                    UMBRALES AUTOMÁTICOS
                  </span>
                  <div className="form-grid three">
                    <label>
                      Otra vez hasta
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={writtenEvaluation.umbrales.otraVezHasta}
                        onChange={(event) =>
                          setWrittenEvaluation({
                            ...writtenEvaluation,
                            umbrales: {
                              ...writtenEvaluation.umbrales,
                              otraVezHasta: Number(event.target.value),
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      Difícil hasta
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={writtenEvaluation.umbrales.dificilHasta}
                        onChange={(event) =>
                          setWrittenEvaluation({
                            ...writtenEvaluation,
                            umbrales: {
                              ...writtenEvaluation.umbrales,
                              dificilHasta: Number(event.target.value),
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      Bien hasta
                      <input
                        type="number"
                        min="2"
                        max="99"
                        value={writtenEvaluation.umbrales.bienHasta}
                        onChange={(event) =>
                          setWrittenEvaluation({
                            ...writtenEvaluation,
                            umbrales: {
                              ...writtenEvaluation.umbrales,
                              bienHasta: Number(event.target.value),
                            },
                          })
                        }
                      />
                    </label>
                  </div>
                </div>
                {writtenEditorError && (
                  <p className="form-error">{writtenEditorError}</p>
                )}
              </div>
            )}
          </>
        )}
        <button
          className="primary-button full"
          disabled={
            uploadingImage ||
            (type === "orthography" &&
              (!orthographyWord.trim() ||
                (!orthographyIsCorrect && !orthographyCorrectForm.trim()))) ||
            (type === "written" && !writtenEvaluation)
          }
        >
          {initialCard
            ? "Guardar cambios"
            : type === "orthography"
              ? "Guardar palabra"
              : "Guardar tarjeta"}
        </button>
      </form>
      {editingImage && attachment && (
        <ImageAnnotator
          attachment={attachment}
          title={
            plainRichText(back) || plainRichText(front) || "Respuesta visual"
          }
          onClose={() => setEditingImage(false)}
        />
      )}
    </ModalShell>
  );
}
