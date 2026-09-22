"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import PdfAnnotator from "./PdfAnnotator";
import { AnnotatedCardImage, ImageAnnotator, ImageLightbox } from "./CardImage";
import RichTextEditor, { plainRichText, RichContent, sanitizeRichHtml } from "./RichTextEditor";
import { applyFsrsReview, fsrsCurrentRetrievability, fsrsDueLabel } from "./fsrs";
import { fitPersonalMemoryModel, personalModelLabel, predictPersonalRecall } from "./memoryModel";
import CardImportModal, { type ParsedImportItem, type WrittenCriterion, type WrittenEvaluation } from "./CardImportModal";
import OrthographyStudy, { type OrthographyStudyCard, type OrthographyStudyResult } from "./OrthographyStudy";

type Tab = "today" | "library" | "psych" | "progress";
type CardType = "basic" | "choice" | "test" | "orthography" | "written";
type Rating = "again" | "hard" | "good" | "easy";
type StudyMode = "recommended" | "random" | "all" | "learn" | "weakest";
type ReviewQueueItem = { cardId: string; reinforcement: boolean; reason: "scheduled" | "again" | "hard" };
type PsychSort = "oldest" | "recent" | "last-low" | "last-high" | "avg-low" | "avg-high" | "attempts-low" | "attempts-high" | "name";

type Folder = {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
  createdAt: string;
};

type Card = {
  id: string;
  folderId: string;
  type: CardType;
  front: string;
  back: string;
  options: string[];
  correctOption: number;
  correctOptions: number[];
  dueAt: string;
  createdAt: string;
  lastReviewedAt: string | null;
  intervalDays: number;
  ease: number;
  repetitions: number;
  lapses: number;
  streak: number;
  reviewCount: number;
  successCount: number;
  attachment: Attachment | null;
  fsrsStability: number;
  fsrsDifficulty: number;
  orthographyIsCorrect: boolean | null;
  orthographyCorrectForm: string;
  orthographyExplanation: string;
  orthographySource: string;
  orthographyStage: number;
};

type Review = {
  id: string;
  cardId: string;
  rating: Rating;
  correct: boolean;
  reviewedAt: string;
  responseMs?: number;
  sessionMode?: StudyMode;
  reinforcement?: boolean;
  predictedRecall?: number;
  fsrsRetrievability?: number;
};

type Attachment = {
  id: string;
  key: string;
  name: string;
  type: string;
  size: number;
  url: string;
};

type Attempt = {
  id: string;
  date: string;
  correct: number;
  wrong: number;
  blank: number;
  score: number;
  minutes: number;
  notes: string;
};

type PsychTest = {
  id: string;
  name: string;
  category: string;
  totalQuestions: number;
  attachment: Attachment | null;
  attempts: Attempt[];
  createdAt: string;
};

type AppState = {
  version: 1;
  folders: Folder[];
  cards: Card[];
  reviews: Review[];
  psychTests: PsychTest[];
  settings: { dailyReviewGoal: number; dailyNewLimit: number; seedVersion?: number };
};

const colors = ["#285943", "#B66A3C", "#6F5B8C", "#2C6E8F", "#8A784D"];
const uid = () => typeof crypto !== "undefined" && "randomUUID" in crypto
  ? crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
const nowIso = () => new Date().toISOString();
const todayKey = () => new Date().toISOString().slice(0, 10);
const isMultipleChoiceType = (type: CardType) => type === "choice" || type === "test";
const isMultipleChoiceCard = (card: Card) => isMultipleChoiceType(card.type);
const isOrthographyCard = (card: Card) => card.type === "orthography";
const isWrittenCard = (card: Card) => card.type === "written";
const cardCorrectOptions = (card: Card) => {
  const values = Array.isArray(card.correctOptions) && card.correctOptions.length ? card.correctOptions : [card.correctOption];
  return [...new Set(values.filter((value) => Number.isInteger(value) && value >= 0 && value < 4))].sort((a, b) => a - b);
};
const isMultipleAnswerTest = (card: Card) => card.type === "test" && cardCorrectOptions(card).length > 1;
const sameNumberSet = (a: number[], b: number[]) => a.length === b.length && [...a].sort((x, y) => x - y).every((value, index) => value === [...b].sort((x, y) => x - y)[index]);
const cardTypeLabel = (type: CardType) => type === "orthography" ? "ORTO" : type === "written" ? "ESCRITA" : type === "test" ? "TEST" : type === "choice" ? "VOCAB" : "FLASHCARD";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function importedBackHtml(item: ParsedImportItem) {
  const parts: string[] = [];
  if ((item.tipo === "flashcard" || item.tipo === "respuesta_escrita") && item.respuesta) parts.push(`<p>${escapeHtml(item.respuesta).replaceAll("\n", "<br>")}</p>`);
  if (item.explicacion) parts.push(`<p><strong>Explicación:</strong> ${escapeHtml(item.explicacion).replaceAll("\n", "<br>")}</p>`);
  const meta = [item.fuente ? `<span><strong>Fuente:</strong> ${escapeHtml(item.fuente)}</span>` : ""].filter(Boolean);
  if (meta.length) parts.push(`<div class="imported-card-meta">${meta.join(" · ")}</div>`);
  return sanitizeRichHtml(parts.join(""));
}

function orthographyBackHtml(word: string, isCorrect: boolean, correctForm: string, explanation: string, source: string) {
  const parts: string[] = [];
  if (isCorrect) parts.push(`<p><strong>${escapeHtml(correctForm || word)}</strong> está correctamente escrita.</p>`);
  else parts.push(`<p><strong>${escapeHtml(word)}</strong> → <strong>${escapeHtml(correctForm)}</strong></p>`);
  if (explanation) parts.push(`<p>${escapeHtml(explanation).replaceAll("\n", "<br>")}</p>`);
  if (source) parts.push(`<div class="imported-card-meta"><span><strong>Fuente:</strong> ${escapeHtml(source)}</span></div>`);
  return sanitizeRichHtml(parts.join(""));
}

function normalizedQuestion(value: string) {
  return value.trim().toLocaleLowerCase("es").replace(/\s+/g, " ");
}


const WRITTEN_RUBRIC_PREFIX = "__OPOGC_WRITTEN_RUBRIC__:";
const WRITTEN_STATS_PREFIX = "__OPOGC_WRITTEN_STATS__:";

type WrittenCriterionResult = {
  id: string;
  esperado: string;
  puntos: number;
  conseguido: number;
  cumplido: boolean;
  critico: boolean;
  similitud: number;
};

type WrittenAnswerResult = {
  accuracy: number;
  rating: Rating;
  criteria: WrittenCriterionResult[];
  criticalMisses: string[];
};

type WrittenStats = {
  attempts: number;
  totalAccuracy: number;
  recent: number[];
  criteria: Record<string, { attempts: number; hits: number }>;
};

function encodeWrittenRubric(evaluation: WrittenEvaluation) {
  return `${WRITTEN_RUBRIC_PREFIX}${JSON.stringify(evaluation)}`;
}

function writtenRubric(card: Card): WrittenEvaluation | null {
  if (!isWrittenCard(card)) return null;
  const raw = card.options.find((item) => item.startsWith(WRITTEN_RUBRIC_PREFIX));
  if (!raw) return null;
  try { return JSON.parse(raw.slice(WRITTEN_RUBRIC_PREFIX.length)) as WrittenEvaluation; }
  catch { return null; }
}

function writtenStats(card: Card): WrittenStats {
  const empty: WrittenStats = { attempts: 0, totalAccuracy: 0, recent: [], criteria: {} };
  if (!isWrittenCard(card)) return empty;
  const raw = card.options.find((item) => item.startsWith(WRITTEN_STATS_PREFIX));
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw.slice(WRITTEN_STATS_PREFIX.length)) as Partial<WrittenStats>;
    return {
      attempts: Math.max(0, Number(parsed.attempts ?? 0)),
      totalAccuracy: Math.max(0, Number(parsed.totalAccuracy ?? 0)),
      recent: Array.isArray(parsed.recent) ? parsed.recent.map(Number).filter(Number.isFinite).slice(-8) : [],
      criteria: parsed.criteria && typeof parsed.criteria === "object" ? parsed.criteria : {},
    };
  } catch { return empty; }
}

function writtenAverageAccuracy(card: Card) {
  const stats = writtenStats(card);
  return stats.attempts ? stats.totalAccuracy / stats.attempts : null;
}

function writtenRecentAccuracy(card: Card) {
  const stats = writtenStats(card);
  if (!stats.recent.length) return writtenAverageAccuracy(card);
  return stats.recent.reduce((sum, value) => sum + value, 0) / stats.recent.length;
}

function writtenAccuracyRisk(card: Card) {
  if (!isWrittenCard(card)) return 0;
  const accuracy = writtenRecentAccuracy(card);
  return accuracy === null ? 0.5 : Math.max(0, Math.min(1, 1 - accuracy / 100));
}

function normalizeWrittenText(value: string, evaluation: WrittenEvaluation) {
  let result = value.trim();
  if (evaluation.normalizacion.ignorarMayusculas) result = result.toLocaleLowerCase("es");
  if (evaluation.normalizacion.ignorarAcentos) result = result.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (evaluation.normalizacion.ignorarPuntuacion) result = result.replace(/[^\p{L}\p{N}\s]/gu, " ");
  if (evaluation.normalizacion.ignorarEspaciosExtra) result = result.replace(/\s+/g, " ").trim();
  return result;
}

function tokenCoverage(answer: string, candidate: string) {
  const expected = [...new Set(candidate.split(/\s+/).filter(Boolean))];
  if (!expected.length) return 0;
  const answerTokens = new Set(answer.split(/\s+/).filter(Boolean));
  return expected.filter((token) => answerTokens.has(token)).length / expected.length;
}

function evaluateWrittenAnswer(card: Card, answer: string): WrittenAnswerResult | null {
  const evaluation = writtenRubric(card);
  if (!evaluation) return null;
  const normalizedAnswer = normalizeWrittenText(answer, evaluation);
  const totalPoints = evaluation.criterios.reduce((sum, criterion) => sum + Math.max(0, criterion.puntos), 0);
  if (!totalPoints) return null;

  const criteria: WrittenCriterionResult[] = evaluation.criterios.map((criterion) => {
    const candidates = [criterion.esperado, ...criterion.alternativas]
      .map((candidate) => normalizeWrittenText(candidate, evaluation))
      .filter(Boolean);
    let bestSimilarity = 0;
    let passed = false;
    for (const candidate of candidates) {
      const exact = normalizedAnswer.includes(candidate);
      const similarity = exact ? 1 : tokenCoverage(normalizedAnswer, candidate);
      bestSimilarity = Math.max(bestSimilarity, similarity);
      if (criterion.literal ? exact : similarity >= criterion.minimoSimilitud) passed = true;
    }
    return {
      id: criterion.id,
      esperado: criterion.esperado,
      puntos: criterion.puntos,
      // La nota usa precisión gradual aunque el criterio no llegue al umbral.
      // "cumplido" sigue siendo binario para aplicar criticidad y límites máximos.
      conseguido: passed ? criterion.puntos : criterion.puntos * bestSimilarity,
      cumplido: passed,
      critico: criterion.critico,
      similitud: bestSimilarity,
    };
  });

  let accuracy = Math.round(criteria.reduce((sum, criterion) => sum + criterion.conseguido, 0) / totalPoints * 100);
  for (const [index, criterion] of evaluation.criterios.entries()) {
    if (criteria[index]?.cumplido) continue;
    if (criterion.maximoSiFalla !== null) accuracy = Math.min(accuracy, Math.round(criterion.maximoSiFalla));
  }
  accuracy = Math.max(0, Math.min(100, accuracy));

  const { otraVezHasta, dificilHasta, bienHasta } = evaluation.umbrales;
  const rating: Rating = accuracy <= otraVezHasta ? "again" : accuracy <= dificilHasta ? "hard" : accuracy <= bienHasta ? "good" : "easy";
  return {
    accuracy,
    rating,
    criteria,
    criticalMisses: criteria.filter((criterion) => criterion.critico && !criterion.cumplido).map((criterion) => criterion.esperado),
  };
}

function applyWrittenStats(card: Card, result: WrittenAnswerResult) {
  if (!isWrittenCard(card)) return card;
  const current = writtenStats(card);
  const criteria = { ...current.criteria };
  for (const item of result.criteria) {
    const previous = criteria[item.id] ?? { attempts: 0, hits: 0 };
    criteria[item.id] = { attempts: previous.attempts + 1, hits: previous.hits + (item.cumplido ? 1 : 0) };
  }
  const next: WrittenStats = {
    attempts: current.attempts + 1,
    totalAccuracy: current.totalAccuracy + result.accuracy,
    recent: [...current.recent, result.accuracy].slice(-8),
    criteria,
  };
  const options = card.options.filter((item) => !item.startsWith(WRITTEN_STATS_PREFIX));
  return { ...card, options: [...options, `${WRITTEN_STATS_PREFIX}${JSON.stringify(next)}`] };
}

function initialState(): AppState {
  const vocabularyId = uid();
  const psychId = uid();
  const makeCard = (front: string, back: string, options: string[], correctOption: number): Card => ({
    id: uid(),
    folderId: vocabularyId,
    type: "choice",
    front,
    back,
    options,
    correctOption,
    correctOptions: [correctOption],
    dueAt: nowIso(),
    createdAt: nowIso(),
    lastReviewedAt: null,
    intervalDays: 0,
    ease: 2.35,
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
  });

  return {
    version: 1,
    folders: [
      { id: vocabularyId, name: "Vocabulario psicotécnico", color: colors[0], parentId: null, createdAt: nowIso() },
      { id: psychId, name: "Conceptos del temario", color: colors[2], parentId: null, createdAt: nowIso() },
    ],
    cards: [
      makeCard("¿Qué significa LOCUAZ?", "Que habla mucho o con facilidad.", ["Reservado", "Hablador", "Inconstante", "Prudente"], 1),
      makeCard("¿Cuál es el sinónimo de EFÍMERO?", "Breve o de corta duración.", ["Duradero", "Breve", "Complejo", "Inmóvil"], 1),
      makeCard("¿Cuál es el antónimo de PARSIMONIA?", "Prisa o celeridad.", ["Calma", "Mesura", "Prisa", "Lentitud"], 2),
    ],
    reviews: [],
    psychTests: [],
    settings: { dailyReviewGoal: 30, dailyNewLimit: 12, seedVersion: 0 },
  };
}

function scheduleCard(card: Card, rating: Rating): Card {
  return applyFsrsReview(card, rating);
}

const CONSTITUTION_FOLDER_NAME = "Tema 1: derecho constitucional";
const CONSTITUTION_FOLDER_ID = "seed-tema-1-derecho-constitucional";

type SeedCard = { id: string; front: string; back: string; type?: CardType; options?: string[]; correctOption?: number };

const constitutionSeedCards: SeedCard[] = [
  { id: "ce-pre-01", front: "<strong>Preámbulo:</strong> ¿cuáles son los seis verbos que ordenan la voluntad de la Nación española?", back: "<ol><li><strong>Garantizar</strong></li><li><strong>Consolidar</strong></li><li><strong>Proteger</strong></li><li><strong>Promover</strong></li><li><strong>Establecer</strong></li><li><strong>Colaborar</strong></li></ol>" },
  { id: "ce-pre-02", front: "Preámbulo · <strong>Garantizar</strong>: completa la idea.", back: "Garantizar la <strong>convivencia democrática</strong> dentro de la Constitución y de las leyes conforme a un <strong>orden económico y social justo</strong>." },
  { id: "ce-pre-03", front: "Preámbulo · <strong>Consolidar</strong>: ¿qué se consolida y qué debe asegurar?", back: "Un <strong>Estado de Derecho</strong> que asegure el <strong>imperio de la ley</strong> como expresión de la voluntad popular." },
  { id: "ce-pre-04", front: "Preámbulo · <strong>Proteger</strong>: ¿a quién y en qué ámbitos?", back: "A todos los españoles y pueblos de España en el ejercicio de los <strong>derechos humanos</strong>, sus <strong>culturas y tradiciones</strong>, <strong>lenguas</strong> e <strong>instituciones</strong>." },
  { id: "ce-pre-05", front: "Preámbulo · <strong>Promover</strong>: ¿qué progreso y con qué finalidad?", back: "El progreso de la <strong>cultura y de la economía</strong> para asegurar a todos una <strong>digna calidad de vida</strong>." },
  { id: "ce-pre-06", front: "Preámbulo · <strong>Establecer</strong> y <strong>Colaborar</strong>: ¿qué dos objetivos finales se proclaman?", back: "<ul><li>Establecer una <strong>sociedad democrática avanzada</strong>.</li><li>Colaborar en el fortalecimiento de unas <strong>relaciones pacíficas</strong> y de <strong>eficaz cooperación</strong> entre todos los pueblos de la Tierra.</li></ul>" },
  { id: "ce-a1-01", front: "<strong>Artículo 1.1 CE:</strong> ¿cómo se constituye España y cuáles son los valores superiores?", back: "España se constituye en un <strong>Estado social y democrático de Derecho</strong>.<br><br>Valores superiores: <strong>libertad, justicia, igualdad y pluralismo político</strong>." },
  { id: "ce-a1-02", front: "<strong>Artículo 1.2 CE:</strong> ¿dónde reside la soberanía nacional?", back: "En el <strong>pueblo español</strong>, del que emanan los poderes del Estado." },
  { id: "ce-a1-03", front: "<strong>Artículo 1.3 CE:</strong> ¿cuál es la forma política del Estado español?", back: "La <strong>Monarquía parlamentaria</strong>." },
  { id: "ce-a2-01", front: "<strong>Artículo 2 CE:</strong> ¿en qué tres ideas se apoya el precepto?", back: "<ul><li><strong>Indisoluble unidad</strong> de la Nación española.</li><li>Derecho a la <strong>autonomía</strong> de nacionalidades y regiones.</li><li><strong>Solidaridad</strong> entre todas ellas.</li></ul>" },
  { id: "ce-a2-02", front: "Artículo 2 CE: completa: «Nación española, patria común e ____ de todos los españoles». ", back: "<strong>Indivisible</strong>." },
  { id: "ce-a3-01", front: "<strong>Artículo 3.1 CE:</strong> castellano: ¿qué deber y qué derecho tienen todos los españoles?", back: "<ul><li><strong>Deber de conocerla</strong>.</li><li><strong>Derecho a usarla</strong>.</li></ul>" },
  { id: "ce-a3-02", front: "<strong>Artículo 3.2 CE:</strong> ¿cuándo serán oficiales las demás lenguas españolas?", back: "En las respectivas <strong>Comunidades Autónomas</strong>, de acuerdo con sus <strong>Estatutos</strong>." },
  { id: "ce-a3-03", front: "<strong>Artículo 3.3 CE:</strong> ¿cómo califica la Constitución la riqueza de las modalidades lingüísticas?", back: "Como un <strong>patrimonio cultural</strong> que será objeto de especial <strong>respeto y protección</strong>." },
  { id: "ce-a4-01", front: "<strong>Artículo 4.1 CE:</strong> describe la bandera de España.", back: "Tres franjas horizontales: <strong>roja, amarilla y roja</strong>; la amarilla tiene <strong>doble anchura</strong> que cada una de las rojas." },
  { id: "ce-a4-02", front: "<strong>Artículo 4.2 CE:</strong> ¿qué pueden reconocer los Estatutos y cómo se utilizan?", back: "Pueden reconocer <strong>banderas y enseñas propias</strong> de las CCAA. Se utilizarán <strong>junto a la bandera de España</strong> en sus edificios públicos y actos oficiales." },
  { id: "ce-a5-01", front: "<strong>Artículo 5 CE:</strong> ¿cuál es la capital del Estado?", back: "La <strong>villa de Madrid</strong>." },
  { id: "ce-a6-01", front: "<strong>Artículo 6 CE:</strong> ¿qué tres funciones cumplen los partidos políticos?", back: "<ul><li>Expresan el <strong>pluralismo político</strong>.</li><li>Concurren a la <strong>formación y manifestación de la voluntad popular</strong>.</li><li>Son instrumento fundamental para la <strong>participación política</strong>.</li></ul>" },
  { id: "ce-a6-02", front: "Artículo 6 CE: creación, actividad, estructura y funcionamiento de los partidos.", back: "Creación y actividad: <strong>libres</strong> dentro del respeto a la Constitución y a la ley.<br>Estructura interna y funcionamiento: deberán ser <strong>democráticos</strong>." },
  { id: "ce-a7-01", front: "<strong>Artículo 7 CE:</strong> ¿a qué contribuyen sindicatos y asociaciones empresariales?", back: "A la <strong>defensa y promoción de los intereses económicos y sociales</strong> que les son propios." },
  { id: "ce-a7-02", front: "Artículo 7 CE: ¿qué exige sobre su creación, actividad y organización interna?", back: "Creación y actividad <strong>libres</strong> dentro del respeto a la Constitución y a la ley; estructura interna y funcionamiento <strong>democráticos</strong>." },
  { id: "ce-a8-01", front: "<strong>Artículo 8.1 CE:</strong> ¿qué cuerpos constituyen las Fuerzas Armadas?", back: "<ul><li>Ejército de Tierra.</li><li>Armada.</li><li>Ejército del Aire.</li></ul>" },
  { id: "ce-a8-02", front: "<strong>Artículo 8.1 CE:</strong> ¿cuáles son las tres misiones de las Fuerzas Armadas?", back: "<ul><li>Garantizar la <strong>soberanía e independencia</strong> de España.</li><li>Defender su <strong>integridad territorial</strong>.</li><li>Defender el <strong>ordenamiento constitucional</strong>.</li></ul>" },
  { id: "ce-a8-03", front: "<strong>Artículo 8.2 CE:</strong> ¿qué norma regula las bases de la organización militar?", back: "Una <strong>ley orgánica</strong>, conforme a los principios de la Constitución." },
  { id: "ce-a9-01", front: "<strong>Artículo 9.1 CE:</strong> ¿quiénes están sujetos a la Constitución y al resto del ordenamiento jurídico?", back: "Los <strong>ciudadanos</strong> y los <strong>poderes públicos</strong>." },
  { id: "ce-a9-02", front: "<strong>Artículo 9.2 CE:</strong> ¿qué corresponde promover a los poderes públicos?", back: "Las condiciones para que la <strong>libertad y la igualdad</strong> del individuo y de los grupos en que se integra sean <strong>reales y efectivas</strong>." },
  { id: "ce-a9-03", front: "Artículo 9.2 CE: además de promover condiciones, ¿qué dos actuaciones deben realizar los poderes públicos?", back: "<ul><li><strong>Remover los obstáculos</strong> que impidan o dificulten la plenitud de libertad e igualdad.</li><li><strong>Facilitar la participación</strong> de todos los ciudadanos en la vida política, económica, cultural y social.</li></ul>" },
  { id: "ce-a9-04", front: "<strong>Artículo 9.3 CE:</strong> enumera los principios y garantías constitucionales.", back: "<ul><li>Legalidad.</li><li>Jerarquía normativa.</li><li>Publicidad de las normas.</li><li>Irretroactividad de disposiciones sancionadoras no favorables o restrictivas de derechos individuales.</li><li>Seguridad jurídica.</li><li>Responsabilidad.</li><li>Interdicción de la arbitrariedad de los poderes públicos.</li></ul>" },
  { id: "ce-a9-05", front: "Artículo 9.3 CE: ¿qué tipo de disposiciones tienen garantizada la <strong>irretroactividad</strong>?", back: "Las disposiciones <strong>sancionadoras no favorables</strong> o <strong>restrictivas de derechos individuales</strong>." },
];

function normalizeAndSeed(state: AppState) {
  let changed = false;
  const seedVersion = Number(state.settings.seedVersion ?? 0);
  let folders = [...state.folders];
  let cards = state.cards.map((card) => {
    const normalized = {
      ...card,
      attachment: card.attachment ?? null,
      correctOptions: Array.isArray(card.correctOptions) && card.correctOptions.length ? card.correctOptions : (isMultipleChoiceType(card.type) ? [Number(card.correctOption ?? 0)] : []),
      fsrsStability: Number(card.fsrsStability ?? (card.reviewCount > 0 ? Math.max(1, card.intervalDays || 1) : 0)),
      fsrsDifficulty: Number(card.fsrsDifficulty ?? (card.reviewCount > 0 ? 5 : 0)),
      orthographyIsCorrect: typeof card.orthographyIsCorrect === "boolean" ? card.orthographyIsCorrect : null,
      orthographyCorrectForm: String(card.orthographyCorrectForm ?? ""),
      orthographyExplanation: String(card.orthographyExplanation ?? ""),
      orthographySource: String(card.orthographySource ?? ""),
      orthographyStage: Math.max(1, Number(card.orthographyStage ?? 1)),
    };
    if (card.attachment === undefined || card.correctOptions === undefined || card.fsrsStability === undefined || card.fsrsDifficulty === undefined || card.orthographyIsCorrect === undefined || card.orthographyCorrectForm === undefined || card.orthographyStage === undefined) changed = true;
    return normalized;
  });

  let theme = folders.find((item) => !item.parentId && item.name.trim().toLocaleLowerCase("es") === CONSTITUTION_FOLDER_NAME.toLocaleLowerCase("es"));

  if (seedVersion < 1) {
    if (!theme) {
      theme = { id: CONSTITUTION_FOLDER_ID, name: CONSTITUTION_FOLDER_NAME, color: "#2C6E8F", parentId: null, createdAt: nowIso() };
      folders.push(theme);
      changed = true;
    }
    const existing = new Set(cards.map((card) => card.id));
    for (const seed of constitutionSeedCards) {
      if (existing.has(seed.id)) continue;
      cards.push({
        id: seed.id, folderId: theme.id, type: seed.type ?? "basic", front: seed.front, back: seed.back, options: seed.options ?? [],
        correctOption: seed.correctOption ?? 0, correctOptions: seed.type && seed.type !== "basic" ? [seed.correctOption ?? 0] : [],
        dueAt: nowIso(), createdAt: nowIso(), lastReviewedAt: null, intervalDays: 0, ease: 0, repetitions: 0, lapses: 0, streak: 0, reviewCount: 0, successCount: 0, attachment: null, fsrsStability: 0, fsrsDifficulty: 0,
        orthographyIsCorrect: null, orthographyCorrectForm: "", orthographyExplanation: "", orthographySource: "", orthographyStage: 1,
      });
      changed = true;
    }
  }

  // V8: reorganiza únicamente las tarjetas semilla que ya existan; no resucita tarjetas borradas.
  if (seedVersion < 2) {
    theme = theme ?? folders.find((item) => !item.parentId && item.name.trim().toLocaleLowerCase("es") === CONSTITUTION_FOLDER_NAME.toLocaleLowerCase("es"));
    const hasSeedCards = cards.some((card) => card.id.startsWith("ce-pre-") || /^ce-a[1-9]-/.test(card.id));
    if (theme && hasSeedCards) {
      let preamble = folders.find((folder) => folder.parentId === theme!.id && folder.name.toLocaleLowerCase("es") === "preámbulo");
      let preliminary = folders.find((folder) => folder.parentId === theme!.id && folder.name.toLocaleLowerCase("es") === "título preliminar");
      if (!preamble) { preamble = { id: "seed-subtema-preambulo", name: "Preámbulo", color: theme.color, parentId: theme.id, createdAt: nowIso() }; folders.push(preamble); }
      if (!preliminary) { preliminary = { id: "seed-subtema-titulo-preliminar", name: "Título Preliminar", color: theme.color, parentId: theme.id, createdAt: nowIso() }; folders.push(preliminary); }
      cards = cards.map((card) => card.id.startsWith("ce-pre-") ? { ...card, folderId: preamble!.id } : /^ce-a[1-9]-/.test(card.id) ? { ...card, folderId: preliminary!.id } : card);
      changed = true;
    }
  }

  const nextSeedVersion = Math.max(seedVersion, 2);
  if (nextSeedVersion !== seedVersion) changed = true;
  return { state: { ...state, folders, cards, settings: { ...state.settings, seedVersion: nextSeedVersion } }, changed };
}


function isStudyableCard(card: Card) {
  return Boolean(card.front.trim() || card.back.trim() || card.options.some((option) => option.trim()));
}

function scoreLabel(value: number) {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(value);
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function psychStats(test: PsychTest) {
  const attempts = [...test.attempts].sort((a, b) => b.date.localeCompare(a.date));
  const last = attempts[0] ?? null;
  const best = attempts.length ? Math.max(...attempts.map((attempt) => attempt.score)) : null;
  const average = attempts.length ? attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length : null;
  return { attempts, last, best, average };
}

function sortPsychTests(tests: PsychTest[], sort: PsychSort) {
  const result = [...tests];
  const stats = (test: PsychTest) => psychStats(test);
  result.sort((a, b) => {
    const aStats = stats(a);
    const bStats = stats(b);
    if (sort === "name") return (a.name || "Sin nombre").localeCompare(b.name || "Sin nombre", "es", { sensitivity: "base" });
    if (sort === "attempts-low") return a.attempts.length - b.attempts.length || a.createdAt.localeCompare(b.createdAt);
    if (sort === "attempts-high") return b.attempts.length - a.attempts.length || a.createdAt.localeCompare(b.createdAt);
    if (sort === "oldest") {
      if (!aStats.last && bStats.last) return -1;
      if (aStats.last && !bStats.last) return 1;
      return (aStats.last?.date ?? a.createdAt).localeCompare(bStats.last?.date ?? b.createdAt);
    }
    if (sort === "recent") {
      if (!aStats.last && bStats.last) return 1;
      if (aStats.last && !bStats.last) return -1;
      return (bStats.last?.date ?? b.createdAt).localeCompare(aStats.last?.date ?? a.createdAt);
    }
    const aValue = sort.startsWith("avg") ? aStats.average : aStats.last?.score ?? null;
    const bValue = sort.startsWith("avg") ? bStats.average : bStats.last?.score ?? null;
    if (aValue === null && bValue !== null) return 1;
    if (aValue !== null && bValue === null) return -1;
    if (aValue === null || bValue === null) return 0;
    return sort.endsWith("low") ? aValue - bValue : bValue - aValue;
  });
  return result;
}

function shuffled<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

type LearnStat = { seen: number; again: number; hard: number; good: number; easy: number; cooldownUntil: number };

function descendantFolderIds(folders: Folder[], folderId: string) {
  const ids = new Set<string>([folderId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const folder of folders) {
      if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) {
        ids.add(folder.id);
        changed = true;
      }
    }
  }
  return ids;
}

function cardsInFolderScope(state: AppState, folderId?: string) {
  if (!folderId) return state.cards.filter(isStudyableCard);
  const ids = descendantFolderIds(state.folders, folderId);
  return state.cards.filter((card) => ids.has(card.folderId) && isStudyableCard(card));
}

const isContinuousStudyMode = (mode: StudyMode) => mode === "learn" || mode === "weakest";

function failureCount(cardId: string, reviews: Review[]) {
  return reviews.reduce((count, review) => count + (review.cardId === cardId && !review.correct ? 1 : 0), 0);
}

function recentFailureCount(cardId: string, reviews: Review[], take = 8) {
  return reviews
    .filter((review) => review.cardId === cardId)
    .slice(-take)
    .reduce((count, review) => count + (!review.correct ? 1 : 0), 0);
}

function weaknessScore(card: Card, reviews: Review[], model: ReturnType<typeof fitPersonalMemoryModel>, now = new Date()) {
  const failures = failureCount(card.id, reviews);
  const writtenRisk = writtenAccuracyRisk(card);
  const hasWrittenEvidence = writtenAverageAccuracy(card) !== null;
  if (!failures && (!hasWrittenEvidence || writtenRisk <= 0.05)) return 0;
  const cardReviews = reviews.filter((review) => review.cardId === card.id);
  const failRate = cardReviews.length ? failures / cardReviews.length : 0;
  const recentFailures = recentFailureCount(card.id, reviews);
  const recall = predictPersonalRecall(card, reviews, model, now).probability;
  return failRate * 5
    + recentFailures * 1.45
    + Math.min(failures, 8) * 0.7
    + Math.min(card.lapses, 6) * 0.75
    + (1 - recall) * 2.2
    + writtenRisk * 4.2;
}

function weakestStudyCards(cards: Card[], reviews: Review[], model: ReturnType<typeof fitPersonalMemoryModel>) {
  const now = new Date();
  const failed = cards
    .filter((card) => failureCount(card.id, reviews) > 0 || (writtenAverageAccuracy(card) !== null && writtenAccuracyRisk(card) > 0.05))
    .sort((a, b) => weaknessScore(b, reviews, model, now) - weaknessScore(a, reviews, model, now))
    .slice(0, 30);
  if (!failed.length) return [];

  // Si aún hay muy pocas falladas, añadimos hasta 4 tarjetas de apoyo para evitar
  // repetir la misma de forma inmediata y confundir memoria de trabajo con aprendizaje.
  if (failed.length < 4) {
    const failedIds = new Set(failed.map((card) => card.id));
    const support = cards
      .filter((card) => card.reviewCount > 0 && !failedIds.has(card.id))
      .sort((a, b) =>
        predictPersonalRecall(a, reviews, model, now).probability
        - predictPersonalRecall(b, reviews, model, now).probability,
      )
      .slice(0, 4 - failed.length);
    return [...failed, ...support];
  }
  return failed;
}

function chooseLearnCard(
  cards: Card[],
  reviews: Review[],
  model: ReturnType<typeof fitPersonalMemoryModel>,
  stats: Map<string, LearnStat>,
  turn: number,
  excludeId?: string,
) {
  if (!cards.length) return null;
  const now = new Date();
  const allowed = cards.filter((card) => {
    const stat = stats.get(card.id);
    return (!stat || stat.cooldownUntil <= turn) && (cards.length <= 1 || card.id !== excludeId);
  });
  const pool = allowed.length ? allowed : cards.filter((card) => cards.length <= 1 || card.id !== excludeId);
  const finalPool = pool.length ? pool : cards;
  return [...finalPool].sort((a, b) => {
    const score = (card: Card) => {
      const stat = stats.get(card.id);
      const recall = predictPersonalRecall(card, reviews, model, now).probability;
      const failRate = card.reviewCount > 0 ? 1 - card.successCount / Math.max(1, card.reviewCount) : 0.45;
      const writtenRisk = writtenAccuracyRisk(card);
      const unseenBoost = !stat || stat.seen === 0 ? 0.9 : 0;
      const sessionBoost = stat ? stat.again * 2.7 + stat.hard * 1.35 - stat.good * 0.28 - stat.easy * 1.55 : 0;
      return 0.35 + (1 - recall) * 2.4 + failRate * 1.25 + writtenRisk * 2.6 + unseenBoost + sessionBoost + Math.random() * 0.18;
    };
    return score(b) - score(a);
  })[0] ?? null;
}

type OrthographySessionStat = { seen: number; correct: number; wrong: number; cooldownUntil: number };
type OrthographySessionState = {
  folderId: string | null;
  mode: StudyMode;
  groupIds: string[];
  results: OrthographyStudyResult[] | null;
  groupNumber: number;
  responses: number;
  correctResponses: number;
  scopeLabel: string;
};

function orthographyCardWeight(
  card: Card,
  reviews: Review[],
  model: ReturnType<typeof fitPersonalMemoryModel>,
  stat: OrthographySessionStat | undefined,
  turn: number,
  previousIds: Set<string>,
  mode: StudyMode,
) {
  if (mode === "random") return 1 + Math.random() * 0.35;
  const now = new Date();
  const due = card.reviewCount > 0 && new Date(card.dueAt).getTime() <= now.getTime();
  const recall = predictPersonalRecall(card, reviews, model, now).probability;
  const failRate = card.reviewCount > 0 ? 1 - card.successCount / Math.max(1, card.reviewCount) : 0.45;
  const failures = failureCount(card.id, reviews);
  const recentFailures = recentFailureCount(card.id, reviews);
  const sessionWrong = stat?.wrong ?? 0;
  const sessionCorrect = stat?.correct ?? 0;
  const newBoost = card.reviewCount === 0 ? 4.2 : 0;
  const dueBoost = due ? 6.2 : 0;
  const difficultyBoost = failRate * 3 + Math.min(5, card.lapses) * 0.55 + (1 - recall) * 2.4;
  const sessionBoost = sessionWrong * 3.2 - sessionCorrect * 0.45;
  const unseenBoost = !stat || stat.seen === 0 ? 1.3 : 0;
  const weakestBoost = mode === "weakest"
    ? (failures > 0
      ? 8 + failRate * 7 + recentFailures * 2.2 + Math.min(failures, 8) * 0.9 + Math.min(card.lapses, 6)
      : -0.55)
    : 0;
  let weight = 0.8 + dueBoost + newBoost + difficultyBoost + sessionBoost + unseenBoost + weakestBoost;
  if (stat && stat.cooldownUntil > turn) weight *= 0.14;
  if (previousIds.has(card.id) && sessionWrong <= sessionCorrect) weight *= 0.28;
  if (mode === "all" && (!stat || stat.seen === 0)) weight += 2.2;
  return Math.max(0.08, weight);
}

function chooseOrthographyGroup(
  cards: Card[],
  reviews: Review[],
  model: ReturnType<typeof fitPersonalMemoryModel>,
  stats: Map<string, OrthographySessionStat>,
  turn: number,
  previousGroup: string[],
  mode: StudyMode,
) {
  const orthographyCards = cards.filter(isOrthographyCard);
  const targetSize = Math.min(4, orthographyCards.length);
  if (!targetSize) return [];
  const previousIds = new Set(previousGroup);
  const ready = orthographyCards.filter((card) => (stats.get(card.id)?.cooldownUntil ?? 0) <= turn);
  let available = [...(ready.length >= targetSize ? ready : orthographyCards)];
  const selected: Card[] = [];

  while (selected.length < targetSize && available.length) {
    const weights = available.map((card) => orthographyCardWeight(card, reviews, model, stats.get(card.id), turn, previousIds, mode));
    const total = weights.reduce((sum, value) => sum + value, 0);
    let pick = Math.random() * total;
    let index = available.length - 1;
    for (let candidateIndex = 0; candidateIndex < available.length; candidateIndex += 1) {
      pick -= weights[candidateIndex];
      if (pick <= 0) { index = candidateIndex; break; }
    }
    selected.push(available[index]);
    available.splice(index, 1);
  }

  if (selected.length === targetSize && targetSize >= 3 && Math.random() < 0.68) {
    const allCorrect = selected.every((card) => card.orthographyIsCorrect === true);
    const allIncorrect = selected.every((card) => card.orthographyIsCorrect === false);
    if (allCorrect || allIncorrect) {
      const desired = allCorrect ? false : true;
      const alternatives = orthographyCards.filter((card) => card.orthographyIsCorrect === desired && !selected.some((item) => item.id === card.id));
      if (alternatives.length) {
        const replacement = alternatives[Math.floor(Math.random() * alternatives.length)];
        selected[selected.length - 1] = replacement;
      }
    }
  }

  return shuffled(selected);
}

function orthographyStudyCard(card: Card): OrthographyStudyCard {
  return {
    id: card.id,
    word: plainRichText(card.front),
    isCorrect: card.orthographyIsCorrect === true,
    correctForm: card.orthographyCorrectForm || plainRichText(card.front),
    explanation: card.orthographyExplanation || "",
    source: card.orthographySource || "",
  };
}

export default function OpoApp() {
  const [tab, setTab] = useState<Tab>("today");
  const [state, setState] = useState<AppState | null>(null);
  const [sync, setSync] = useState<"loading" | "saved" | "saving" | "error">("loading");
  const [modal, setModal] = useState<null | "folder" | "card" | "import" | "psych" | "attempt">(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [bulkTargetFolderId, setBulkTargetFolderId] = useState("");
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);
  const [selectedPsych, setSelectedPsych] = useState<string | null>(null);
  const [editingPsych, setEditingPsych] = useState<string | null>(null);
  const [editingPsychTest, setEditingPsychTest] = useState<string | null>(null);
  const [editingAttempt, setEditingAttempt] = useState<string | null>(null);
  const [psychDetail, setPsychDetail] = useState<string | null>(null);
  const [psychQuery, setPsychQuery] = useState("");
  const [psychCategory, setPsychCategory] = useState("all");
  const [psychSort, setPsychSort] = useState<PsychSort>("oldest");
  const [editingCard, setEditingCard] = useState<string | null>(null);
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [studyMode, setStudyMode] = useState<StudyMode>("recommended");
  const [revealed, setRevealed] = useState(false);
  const [viewingStudyImage, setViewingStudyImage] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [writtenAnswer, setWrittenAnswer] = useState("");
  const [writtenResult, setWrittenResult] = useState<WrittenAnswerResult | null>(null);
  const [sessionDone, setSessionDone] = useState(0);
  const [orthographySession, setOrthographySession] = useState<OrthographySessionState | null>(null);
  const [orthographySelected, setOrthographySelected] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardShownAtRef = useRef(Date.now());
  const reinforcementCountsRef = useRef<Map<string, number>>(new Map());
  const learnStatsRef = useRef<Map<string, { seen: number; again: number; hard: number; good: number; easy: number; cooldownUntil: number }>>(new Map());
  const studyScopeRef = useRef<string[]>([]);
  const orthographyStatsRef = useRef<Map<string, OrthographySessionStat>>(new Map());
  const orthographyLongTermSeenRef = useRef<Set<string>>(new Set());
  const orthographyScopeRef = useRef<string[]>([]);
  const orthographyPreviousGroupRef = useRef<string[]>([]);
  const orthographyGroupStartedAtRef = useRef(Date.now());

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);

    fetch("/api/state")
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo abrir tu progreso");
        return response.json() as Promise<{ state: AppState | null }>;
      })
      .then(({ state: remote }) => {
        const upgraded = normalizeAndSeed(remote ?? initialState());
        const loaded = upgraded.state;
        setState(loaded);
        setSync("saved");
        if (!remote || upgraded.changed) saveNow(loaded);
      })
      .catch(() => {
        setState(initialState());
        setSync("error");
      });

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  function saveNow(next: AppState) {
    setSync("saving");
    fetch("/api/state", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state: next }),
    })
      .then((response) => {
        if (!response.ok) throw new Error();
        setSync("saved");
      })
      .catch(() => setSync("error"));
  }

  function updateState(updater: (current: AppState) => AppState) {
    setState((current) => {
      if (!current) return current;
      const next = updater(current);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => saveNow(next), 350);
      return next;
    });
  }

  function notify(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  }

  const personalModel = useMemo(
    () => fitPersonalMemoryModel(state?.cards ?? [], state?.reviews ?? []),
    [state],
  );
  const dueCards = useMemo(() => {
    if (!state) return [];
    const now = new Date();
    return state.cards
      .filter((card) => !isOrthographyCard(card) && card.reviewCount > 0 && new Date(card.dueAt).getTime() <= now.getTime())
      .sort((a, b) =>
        predictPersonalRecall(a, state.reviews, personalModel, now).probability
        - predictPersonalRecall(b, state.reviews, personalModel, now).probability,
      );
  }, [personalModel, state]);
  const todayReviews = useMemo(
    () => state?.reviews.filter((review) => review.reviewedAt.startsWith(todayKey())) ?? [],
    [state],
  );
  const currentQueueItem = reviewQueue[reviewIndex] ?? null;
  const currentCard = state?.cards.find((card) => card.id === currentQueueItem?.cardId) ?? null;
  const activeFolder = state?.folders.find((folder) => folder.id === selectedFolder) ?? null;
  const activePsych = state?.psychTests.find((test) => test.id === selectedPsych) ?? null;
  const openPsych = state?.psychTests.find((test) => test.id === editingPsych) ?? null;
  const openPsychTest = state?.psychTests.find((test) => test.id === editingPsychTest) ?? null;
  const detailPsych = state?.psychTests.find((test) => test.id === psychDetail) ?? null;
  const openAttempt = activePsych?.attempts.find((attempt) => attempt.id === editingAttempt) ?? null;
  const openCard = state?.cards.find((card) => card.id === editingCard) ?? null;

  useEffect(() => {
    if (currentCard) cardShownAtRef.current = Date.now();
    setWrittenAnswer("");
    setWrittenResult(null);
  }, [currentCard?.id, reviewIndex]);

  useEffect(() => {
    setBulkSelectMode(false);
    setSelectedCardIds([]);
    setBulkTargetFolderId("");
  }, [selectedFolder]);

  function toggleCardSelection(cardId: string) {
    setSelectedCardIds((current) => current.includes(cardId)
      ? current.filter((id) => id !== cardId)
      : [...current, cardId]);
  }

  function moveSelectedCards(targetFolderId: string) {
    if (!state || !targetFolderId || !selectedCardIds.length) return;
    const selected = new Set(selectedCardIds);
    const target = state.folders.find((folder) => folder.id === targetFolderId);
    if (!target) return notify("No se ha encontrado el tema o subtema de destino");
    updateState((current) => ({
      ...current,
      cards: current.cards.map((card) => selected.has(card.id) ? { ...card, folderId: targetFolderId } : card),
    }));
    notify(`${selected.size} ${selected.size === 1 ? "tarjeta movida" : "tarjetas movidas"} a ${target.name}`);
    setSelectedCardIds([]);
    setBulkTargetFolderId("");
  }

  function deleteSelectedCards() {
    if (!selectedCardIds.length) return;
    const total = selectedCardIds.length;
    if (!confirm(`¿Eliminar ${total} ${total === 1 ? "tarjeta seleccionada" : "tarjetas seleccionadas"}? Esta acción no se puede deshacer.`)) return;
    const selected = new Set(selectedCardIds);
    updateState((current) => ({
      ...current,
      cards: current.cards.filter((card) => !selected.has(card.id)),
    }));
    setSelectedCardIds([]);
    notify(`${total} ${total === 1 ? "tarjeta eliminada" : "tarjetas eliminadas"}`);
  }

  function studySelectedCards(mode: StudyMode) {
    if (!state || !selectedCardIds.length) return;
    const ids = selectedCardIds.filter((id) => state.cards.some((card) => card.id === id));
    if (!ids.length) return notify("No hay tarjetas válidas en la selección");
    startReview(activeFolder?.id, mode, ids);
  }

  function startOrthographySession(folderId: string | undefined, mode: StudyMode, scope: Card[]) {
    if (!state) return;
    const words = scope.filter(isOrthographyCard);
    if (!words.length) return notify("No hay palabras de ortografía en este tema o subtema");
    if (mode === "weakest" && !words.some((card) => failureCount(card.id, state.reviews) > 0)) {
      return notify("Aún no hay palabras falladas en este tema o subtema");
    }
    const group = chooseOrthographyGroup(words, state.reviews, personalModel, new Map(), 1, [], mode);
    if (!group.length) return notify("No hay palabras disponibles para practicar");
    const folder = folderId ? state.folders.find((item) => item.id === folderId) : null;
    orthographyStatsRef.current = new Map();
    orthographyLongTermSeenRef.current = new Set();
    orthographyScopeRef.current = words.map((card) => card.id);
    orthographyPreviousGroupRef.current = group.map((card) => card.id);
    orthographyGroupStartedAtRef.current = Date.now();
    setReviewQueue([]);
    setOrthographySelected([]);
    setOrthographySession({
      folderId: folderId ?? null,
      mode,
      groupIds: group.map((card) => card.id),
      results: null,
      groupNumber: 1,
      responses: 0,
      correctResponses: 0,
      scopeLabel: folder?.name ?? "Ortografía",
    });
  }

  function toggleOrthographyWord(cardId: string) {
    if (orthographySession?.results) return;
    setOrthographySelected((current) => current.includes(cardId) ? current.filter((id) => id !== cardId) : [...current, cardId]);
  }

  function correctOrthographyGroup() {
    if (!state || !orthographySession || orthographySession.results) return;
    const groupCards = orthographySession.groupIds
      .map((id) => state.cards.find((card) => card.id === id))
      .filter((card): card is Card => Boolean(card && isOrthographyCard(card)));
    if (!groupCards.length) return;
    const selected = new Set(orthographySelected);
    const now = new Date();
    const responseMs = Math.max(0, Date.now() - orthographyGroupStartedAtRef.current);
    const results: OrthographyStudyResult[] = groupCards.map((card) => {
      const shouldBeMarked = card.orthographyIsCorrect === false;
      const userMarked = selected.has(card.id);
      return { cardId: card.id, userMarked, shouldBeMarked, correct: userMarked === shouldBeMarked };
    });
    const resultById = new Map(results.map((result) => [result.cardId, result]));
    const newReviews: Review[] = [];
    const updatedById = new Map<string, Card>();
    const currentTurn = orthographySession.groupNumber;

    for (const card of groupCards) {
      const result = resultById.get(card.id)!;
      const rating: Rating = result.correct ? "good" : "again";
      const firstLongTermEncounter = !orthographyLongTermSeenRef.current.has(card.id);
      let updated = firstLongTermEncounter ? scheduleCard(card, rating) : card;
      const previousStat = orthographyStatsRef.current.get(card.id) ?? { seen: 0, correct: 0, wrong: 0, cooldownUntil: 0 };
      const nextWrong = previousStat.wrong + (result.correct ? 0 : 1);
      if (!result.correct && (nextWrong >= 2 || updated.lapses >= 2)) updated = { ...updated, orthographyStage: Math.max(2, updated.orthographyStage || 1) };
      updatedById.set(card.id, updated);
      if (firstLongTermEncounter) orthographyLongTermSeenRef.current.add(card.id);

      const recall = predictPersonalRecall(card, state.reviews, personalModel, now);
      newReviews.push({
        id: uid(),
        cardId: card.id,
        rating,
        correct: result.correct,
        reviewedAt: now.toISOString(),
        responseMs,
        sessionMode: orthographySession.mode,
        reinforcement: !firstLongTermEncounter,
        predictedRecall: recall.probability,
        fsrsRetrievability: fsrsCurrentRetrievability(card, now),
      });

      orthographyStatsRef.current.set(card.id, {
        seen: previousStat.seen + 1,
        correct: previousStat.correct + (result.correct ? 1 : 0),
        wrong: nextWrong,
        cooldownUntil: currentTurn + (result.correct ? 3 : 1),
      });
    }

    updateState((current) => ({
      ...current,
      cards: current.cards.map((card) => updatedById.get(card.id) ?? card),
      reviews: [...current.reviews, ...newReviews],
    }));

    const correctCount = results.filter((result) => result.correct).length;
    setOrthographySession((current) => current ? {
      ...current,
      results,
      responses: current.responses + results.length,
      correctResponses: current.correctResponses + correctCount,
    } : current);
  }

  function continueOrthographySession() {
    if (!state || !orthographySession || !orthographySession.results) return;
    const scope = state.cards.filter((card) => orthographyScopeRef.current.includes(card.id) && isOrthographyCard(card));
    const nextTurn = orthographySession.groupNumber + 1;
    const group = chooseOrthographyGroup(
      scope,
      state.reviews,
      personalModel,
      orthographyStatsRef.current,
      nextTurn,
      orthographySession.groupIds,
      orthographySession.mode,
    );
    if (!group.length) return notify("No quedan palabras disponibles en este ámbito");
    orthographyPreviousGroupRef.current = group.map((card) => card.id);
    orthographyGroupStartedAtRef.current = Date.now();
    setOrthographySelected([]);
    setOrthographySession((current) => current ? {
      ...current,
      groupIds: group.map((card) => card.id),
      results: null,
      groupNumber: nextTurn,
    } : current);
  }

  function closeOrthographySession() {
    setOrthographySession(null);
    setOrthographySelected([]);
    orthographyScopeRef.current = [];
    orthographyPreviousGroupRef.current = [];
  }

  function startReview(folderId?: string, mode: StudyMode = "recommended", explicitCardIds?: string[]) {
    if (!state) return;
    const explicitIds = explicitCardIds?.length ? new Set(explicitCardIds) : null;
    const fullScope = explicitIds
      ? state.cards.filter((card) => explicitIds.has(card.id) && isStudyableCard(card))
      : cardsInFolderScope(state, folderId);

    if (!fullScope.length) {
      return notify(explicitIds ? "La selección no contiene tarjetas disponibles para estudiar" : "Aún no hay tarjetas para estudiar");
    }

    const orthographyScope = fullScope.filter(isOrthographyCard);
    if (orthographyScope.length && orthographyScope.length === fullScope.length) {
      startOrthographySession(folderId, mode, orthographyScope);
      return;
    }
    if (explicitIds && orthographyScope.length > 0) {
      return notify("No se puede mezclar Ortografía con otros tipos en una misma selección de estudio");
    }

    let scope = fullScope.filter((card) => !isOrthographyCard(card));
    const now = new Date();
    let selectedPool: Card[] = [];

    closeOrthographySession();
    learnStatsRef.current = new Map();

    if (mode === "weakest") {
      scope = weakestStudyCards(scope, state.reviews, personalModel);
      if (!scope.length) {
        return notify(folderId ? "Aún no hay elementos fallados en este tema o subtema" : "Aún no hay elementos fallados para repasar");
      }
    }

    studyScopeRef.current = scope.map((card) => card.id);

    if (isContinuousStudyMode(mode)) {
      const first = chooseLearnCard(scope, state.reviews, personalModel, learnStatsRef.current, 0);
      if (!first) return notify(folderId ? "Aún no hay tarjetas en este tema o subtema" : "Aún no hay tarjetas para estudiar");
      selectedPool = [first];
    } else if (mode === "random") {
      selectedPool = shuffled(scope);
    } else if (mode === "all") {
      selectedPool = scope;
    } else {
      const due = scope
        .filter((card) => card.reviewCount > 0 && new Date(card.dueAt).getTime() <= now.getTime())
        .sort((a, b) =>
          predictPersonalRecall(a, state.reviews, personalModel, now).probability
          - predictPersonalRecall(b, state.reviews, personalModel, now).probability,
        );
      const dueSelected = due.slice(0, state.settings.dailyReviewGoal);
      const remaining = Math.max(0, state.settings.dailyReviewGoal - dueSelected.length);
      const newCards = shuffled(scope.filter((card) => card.reviewCount === 0))
        .slice(0, Math.min(state.settings.dailyNewLimit, remaining));
      selectedPool = [...dueSelected, ...newCards];
    }

    if (!selectedPool.length) {
      return notify(mode === "recommended"
        ? "No hay tarjetas programadas ahora. Usa Aprender o Aleatorias si quieres seguir."
        : mode === "weakest"
          ? "Aún no hay elementos fallados para repasar"
          : folderId ? "Aún no hay tarjetas en este tema o subtema" : "Aún no hay tarjetas para estudiar");
    }

    setStudyMode(mode);
    reinforcementCountsRef.current = new Map();
    setReviewQueue(selectedPool.map((card) => ({ cardId: card.id, reinforcement: false, reason: "scheduled" })));
    setReviewIndex(0);
    setSessionDone(0);
    setRevealed(false);
    setViewingStudyImage(false);
    setSelectedOption(null);
    setSelectedOptions([]);
    setWrittenAnswer("");
    setWrittenResult(null);
    cardShownAtRef.current = Date.now();
  }

  function currentSelectionIsCorrect(card: Card) {
    if (!isMultipleChoiceCard(card)) return true;
    const correct = cardCorrectOptions(card);
    const selected = isMultipleAnswerTest(card) ? selectedOptions : selectedOption === null ? [] : [selectedOption];
    return selected.length > 0 && sameNumberSet(selected, correct);
  }

  function submitWrittenAnswer() {
    if (!currentCard || !isWrittenCard(currentCard) || !writtenAnswer.trim()) return;
    const result = evaluateWrittenAnswer(currentCard, writtenAnswer);
    if (!result) return notify("Esta respuesta escrita no tiene una rúbrica válida. Vuelve a importarla desde ChatGPT / JSON.");
    setWrittenResult(result);
    setRevealed(true);
  }

  function rateCurrent(rating: Rating, writtenEvaluation?: WrittenAnswerResult | null) {
    if (!state || !currentCard || !currentQueueItem) return;
    const now = new Date();
    const choiceWasWrong = isMultipleChoiceCard(currentCard) && !currentSelectionIsCorrect(currentCard);
    const effectiveRating: Rating = choiceWasWrong ? "again" : rating;
    const correct = effectiveRating !== "again";
    const responseMs = Math.max(0, Date.now() - cardShownAtRef.current);
    const recall = predictPersonalRecall(currentCard, state.reviews, personalModel, now);

    const learnStat = learnStatsRef.current.get(currentCard.id) ?? { seen: 0, again: 0, hard: 0, good: 0, easy: 0, cooldownUntil: 0 };
    const firstLearnEncounter = learnStat.seen === 0;
    const continuousMode = isContinuousStudyMode(studyMode);
    const shouldUpdateLongTerm = !continuousMode || firstLearnEncounter;
    const scheduled = shouldUpdateLongTerm ? scheduleCard(currentCard, effectiveRating) : currentCard;
    const updated = writtenEvaluation && isWrittenCard(currentCard) ? applyWrittenStats(scheduled, writtenEvaluation) : scheduled;

    const review: Review = {
      id: uid(),
      cardId: currentCard.id,
      rating: effectiveRating,
      correct,
      reviewedAt: now.toISOString(),
      responseMs,
      sessionMode: studyMode,
      reinforcement: continuousMode ? !firstLearnEncounter : currentQueueItem.reinforcement,
      predictedRecall: recall.probability,
      fsrsRetrievability: fsrsCurrentRetrievability(currentCard, now),
    };
    updateState((current) => ({
      ...current,
      cards: current.cards.map((card) => (card.id === updated.id ? updated : card)),
      reviews: [...current.reviews, review],
    }));

    const nextQueue = [...reviewQueue];

    if (continuousMode) {
      const nextTurn = sessionDone + 1;
      const gap = effectiveRating === "again" ? 2 : effectiveRating === "hard" ? 4 : effectiveRating === "good" ? 7 : 14;
      const nextStat: LearnStat = {
        ...learnStat,
        seen: learnStat.seen + 1,
        again: learnStat.again + (effectiveRating === "again" ? 1 : 0),
        hard: learnStat.hard + (effectiveRating === "hard" ? 1 : 0),
        good: learnStat.good + (effectiveRating === "good" ? 1 : 0),
        easy: learnStat.easy + (effectiveRating === "easy" ? 1 : 0),
        cooldownUntil: nextTurn + gap,
      };
      learnStatsRef.current.set(currentCard.id, nextStat);
      const scope = state.cards
        .map((card) => card.id === updated.id ? updated : card)
        .filter((card) => studyScopeRef.current.includes(card.id) && isStudyableCard(card));
      const next = chooseLearnCard(scope, [...state.reviews, review], personalModel, learnStatsRef.current, nextTurn, currentCard.id);
      if (next) {
        const nextSeen = learnStatsRef.current.get(next.id)?.seen ?? 0;
        nextQueue.push({ cardId: next.id, reinforcement: nextSeen > 0, reason: nextSeen > 0 ? "hard" : "scheduled" });
      }
    } else {
      const counts = reinforcementCountsRef.current;
      const previousCount = counts.get(currentCard.id) ?? 0;
      const shouldReinforceAgain = effectiveRating === "again" && previousCount < 3;
      const shouldReinforceHard = effectiveRating === "hard" && previousCount < 1;
      if (shouldReinforceAgain || shouldReinforceHard) {
        const gap = shouldReinforceAgain ? 2 : 4;
        const reason = shouldReinforceAgain ? "again" : "hard";
        const insertAt = Math.min(nextQueue.length, reviewIndex + 1 + gap);
        nextQueue.splice(insertAt, 0, { cardId: currentCard.id, reinforcement: true, reason });
        counts.set(currentCard.id, previousCount + 1);
      }
    }

    setReviewQueue(nextQueue);
    setSessionDone((value) => value + 1);
    setReviewIndex((value) => value + 1);
    setRevealed(false);
    setViewingStudyImage(false);
    setSelectedOption(null);
    setSelectedOptions([]);
    setWrittenAnswer("");
    setWrittenResult(null);
  }

  function importGeneratedCards(items: ParsedImportItem[]) {
    if (!state) return { imported: 0, skipped: items.length, foldersCreated: 0 };

    const folders = [...state.folders];
    const cards = [...state.cards];
    const topLevelByName = new Map(
      folders.filter((folder) => !folder.parentId).map((folder) => [folder.name.trim().toLocaleLowerCase("es"), folder]),
    );
    const childByParentAndName = new Map(
      folders.filter((folder) => folder.parentId).map((folder) => [`${folder.parentId}::${folder.name.trim().toLocaleLowerCase("es")}`, folder]),
    );
    const existingKeys = new Set(cards.map((card) => `${card.folderId}::${card.type}::${normalizedQuestion(plainRichText(card.front))}`));
    let imported = 0;
    let skipped = 0;
    let foldersCreated = 0;

    for (const item of items) {
      const tema = item.tema.trim() || "Importado";
      const temaKey = tema.toLocaleLowerCase("es");
      let theme = topLevelByName.get(temaKey);
      if (!theme) {
        theme = { id: uid(), name: tema, color: colors[folders.length % colors.length], parentId: null, createdAt: nowIso() };
        folders.push(theme);
        topLevelByName.set(temaKey, theme);
        foldersCreated += 1;
      }

      let folder = theme;
      const subtema = item.subtema.trim();
      if (subtema) {
        const childKey = `${theme.id}::${subtema.toLocaleLowerCase("es")}`;
        let child = childByParentAndName.get(childKey);
        if (!child) {
          child = { id: uid(), name: subtema, color: theme.color, parentId: theme.id, createdAt: nowIso() };
          folders.push(child);
          childByParentAndName.set(childKey, child);
          foldersCreated += 1;
        }
        folder = child;
      }

      const type: CardType = item.tipo === "ortografia" ? "orthography" : item.tipo === "respuesta_escrita" ? "written" : item.tipo === "test" ? "test" : item.tipo === "vocabulario" ? "choice" : "basic";
      const contentKey = item.tipo === "ortografia" ? item.palabra : item.pregunta;
      const key = `${folder.id}::${type}::${normalizedQuestion(contentKey)}`;
      if (existingKeys.has(key)) {
        skipped += 1;
        continue;
      }

      const correctOptions = isMultipleChoiceType(type)
        ? item.correctas.map((letter) => "ABCD".indexOf(letter)).filter((index) => index >= 0)
        : [];
      const correctOption = correctOptions[0] ?? 0;
      const isOrthography = item.tipo === "ortografia";
      const isWritten = item.tipo === "respuesta_escrita";
      const word = isOrthography ? item.palabra : item.pregunta;
      cards.push({
        id: uid(),
        folderId: folder.id,
        type,
        front: sanitizeRichHtml(`<p>${escapeHtml(word).replaceAll("\n", "<br>")}</p>`),
        back: isOrthography
          ? orthographyBackHtml(item.palabra, item.esCorrecta === true, item.formaCorrecta, item.explicacion, item.fuente)
          : importedBackHtml(item),
        options: isWritten && item.evaluacion ? [encodeWrittenRubric(item.evaluacion)] : isMultipleChoiceType(type) ? item.opciones.slice(0, 4) : [],
        correctOption,
        correctOptions: isMultipleChoiceType(type) ? correctOptions : [],
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
        orthographyIsCorrect: isOrthography ? item.esCorrecta === true : null,
        orthographyCorrectForm: isOrthography ? item.formaCorrecta : "",
        orthographyExplanation: isOrthography ? item.explicacion : "",
        orthographySource: isOrthography ? item.fuente : "",
        orthographyStage: 1,
      });
      existingKeys.add(key);
      imported += 1;
    }

    if (imported > 0) {
      updateState((current) => ({ ...current, folders, cards }));
      notify(`${imported} elementos importados${foldersCreated ? ` · ${foldersCreated} temas/subtemas nuevos` : ""}${skipped ? ` · ${skipped} duplicados omitidos` : ""}`);
    }
    return { imported, skipped, foldersCreated };
  }

  function openAttemptEditor(testId: string, attemptId: string | null = null) {
    setSelectedPsych(testId);
    setEditingAttempt(attemptId);
    setModal("attempt");
  }

  function deleteAttempt(testId: string, attemptId: string) {
    if (!confirm("¿Eliminar este intento? La puntuación dejará de contar en las estadísticas.")) return;
    updateState((current) => ({
      ...current,
      psychTests: current.psychTests.map((test) =>
        test.id === testId ? { ...test, attempts: test.attempts.filter((attempt) => attempt.id !== attemptId) } : test,
      ),
    }));
    notify("Intento eliminado");
  }

  function deletePsychTest(testId: string) {
    if (!confirm("¿Eliminar este psicotécnico y todo su historial de intentos? El PDF no se borrará automáticamente de R2 por seguridad.")) return;
    updateState((current) => ({ ...current, psychTests: current.psychTests.filter((test) => test.id !== testId) }));
    if (psychDetail === testId) setPsychDetail(null);
    notify("Psicotécnico eliminado");
  }

  function deleteFolder(folderId: string) {
    if (!state) return;
    const ids = descendantFolderIds(state.folders, folderId);
    const label = ids.size > 1 ? "este tema, sus subtemas y todas sus tarjetas" : "este subtema y todas sus tarjetas";
    if (!confirm(`¿Eliminar ${label}?`)) return;
    const parentId = state.folders.find((folder) => folder.id === folderId)?.parentId ?? null;
    updateState((current) => ({
      ...current,
      folders: current.folders.filter((folder) => !ids.has(folder.id)),
      cards: current.cards.filter((card) => !ids.has(card.folderId)),
    }));
    setSelectedFolder(parentId);
    notify("Carpeta eliminada");
  }

  if (!state) {
    return (
      <main className="loading-screen">
        <div className="brand-mark">OG</div>
        <p>Preparando tu sesión…</p>
      </main>
    );
  }

  const accuracy = state.reviews.length ? Math.round((state.reviews.filter((review) => review.correct).length / state.reviews.length) * 100) : 0;
  const mastered = state.cards.filter((card) => card.intervalDays >= 21 && card.streak >= 3).length;
  const orthographyCards = state.cards.filter(isOrthographyCard);
  const orthographyIds = new Set(orthographyCards.map((card) => card.id));
  const orthographyReviews = state.reviews.filter((review) => orthographyIds.has(review.cardId));
  const orthographyStudiedIds = new Set(orthographyReviews.map((review) => review.cardId));
  const orthographyStudied = orthographyStudiedIds.size;
  const orthographyMastered = orthographyCards.filter((card) => card.intervalDays >= 21 && card.streak >= 3).length;
  const orthographyLearning = Math.max(0, orthographyStudied - orthographyMastered);
  const orthographyAccuracy = orthographyReviews.length ? Math.round(orthographyReviews.filter((review) => review.correct).length / orthographyReviews.length * 100) : 0;
  const orthographyDue = orthographyCards.filter((card) => card.reviewCount > 0 && new Date(card.dueAt).getTime() <= Date.now()).length;
  const orthographyFailures = new Map<string, number>();
  for (const review of orthographyReviews) if (!review.correct) orthographyFailures.set(review.cardId, (orthographyFailures.get(review.cardId) ?? 0) + 1);
  const weakestOrthography = [...orthographyCards]
    .filter((card) => (orthographyFailures.get(card.id) ?? 0) > 0)
    .sort((a, b) => (orthographyFailures.get(b.id) ?? 0) - (orthographyFailures.get(a.id) ?? 0))
    .slice(0, 5);
  const nextOrthography = [...orthographyCards]
    .filter((card) => card.reviewCount > 0)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, 5);
  const psychCategories = Array.from(new Set(state.psychTests.map((test) => test.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, "es"));
  const filteredPsychTests = sortPsychTests(
    state.psychTests.filter((test) => {
      const query = psychQuery.trim().toLocaleLowerCase("es");
      const matchesQuery = !query || `${test.name} ${test.category}`.toLocaleLowerCase("es").includes(query);
      const matchesCategory = psychCategory === "all" || test.category === psychCategory;
      return matchesQuery && matchesCategory;
    }),
    psychSort,
  );
  const psychAttemptCount = state.psychTests.reduce((sum, test) => sum + test.attempts.length, 0);
  const psychAttemptedCount = state.psychTests.filter((test) => test.attempts.length > 0).length;
  const latestPsychScores = state.psychTests.map((test) => psychStats(test).last?.score).filter((score): score is number => score !== undefined);
  const latestPsychAverage = latestPsychScores.length ? latestPsychScores.reduce((sum, score) => sum + score, 0) / latestPsychScores.length : null;

  return (
    <div className="app-shell">
      {!online && <div className="offline-banner">Sin conexión · puedes consultar lo ya cargado</div>}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">OG</div>
          <div><strong>OpoGC</strong><span>Preparación inteligente</span></div>
        </div>
        <nav>{navItems.map((item) => <NavButton key={item.id} item={item} active={tab === item.id} onClick={() => setTab(item.id)} />)}</nav>
        <div className="sidebar-foot">
          <span className={`sync-dot ${sync}`} />
          {sync === "saving" ? "Guardando…" : sync === "error" ? "Pendiente de guardar" : "Progreso guardado"}
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">{new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</span>
            <h1>{tab === "today" ? "Tu sesión de hoy" : tab === "library" ? "Biblioteca" : tab === "psych" ? "Psicotécnicos" : "Tu progreso"}</h1>
          </div>
          <button className="avatar" aria-label="Perfil">M</button>
        </header>

        {tab === "today" && (
          <section className="page today-page">
            <div className="hero-card">
              <div className="hero-copy">
                <span className="pill">REPASO RECOMENDADO · FSRS-6 + MODELO PERSONAL</span>
                <h2>{dueCards.length ? `${dueCards.length} tarjetas esperan hoy` : "Tu memoria está al día"}</h2>
                <p>{dueCards.length ? "Priorizamos las tarjetas vencidas con menor probabilidad estimada de recuerdo y después introducimos nuevas." : "Puedes hacer una sesión mixta para reforzar lo aprendido o añadir nuevas tarjetas."}</p>
                <button className="primary-button light" onClick={() => startReview()}>{dueCards.length ? "Empezar repaso" : "Repaso libre"}<span>→</span></button>
              </div>
              <div className="memory-orbit" aria-hidden="true">
                <div className="orbit-ring"><span /><span /><span /></div>
                <div className="orbit-core">{dueCards.length}</div>
                <small>pendientes</small>
              </div>
            </div>

            <div className="stats-row">
              <StatCard label="Repasadas hoy" value={todayReviews.length.toString()} detail={`Meta ${state.settings.dailyReviewGoal}`} tone="green" />
              <StatCard label="Precisión global" value={`${accuracy}%`} detail={`${state.reviews.length} respuestas`} tone="amber" />
              <StatCard label="Dominadas" value={mastered.toString()} detail={`de ${state.cards.length} tarjetas`} tone="purple" />
            </div>

            <div className="content-grid">
              <section className="panel">
                <div className="panel-head"><div><span className="section-label">SIGUIENTE</span><h3>Cola de repaso</h3></div><button className="text-button" onClick={() => setTab("library")}>Ver biblioteca</button></div>
                <div className="review-list">
                  {(dueCards.length ? dueCards.slice(0, 4) : state.cards.slice(0, 4)).map((card) => {
                    const folder = state.folders.find((item) => item.id === card.folderId);
                    const success = card.reviewCount ? Math.round((card.successCount / card.reviewCount) * 100) : 0;
                    return <button className="review-row" key={card.id} onClick={() => startReview(card.folderId)}><span className="folder-swatch" style={{ background: folder?.color }} /><span className="review-row-copy"><strong>{plainRichText(card.front)}</strong><small>{folder?.name ?? "Sin carpeta"}</small></span><span className={`strength ${success >= 80 ? "high" : success >= 50 ? "mid" : "low"}`}>{card.reviewCount ? `${success}%` : "Nueva"}</span></button>;
                  })}
                </div>
              </section>

              <section className="panel mini-plan">
                <div className="panel-head"><div><span className="section-label">RITMO</span><h3>Esta semana</h3></div></div>
                <WeekStrip reviews={state.reviews} />
                <div className="plan-note"><span>◎</span><p><strong>Constancia antes que cantidad</strong><br />Repasar 20 minutos diarios protege mejor la memoria que una sesión larga aislada.</p></div>
              </section>
            </div>
          </section>
        )}

        {tab === "library" && (
          <section className="page">
            <div className="action-row">
              <div className="search-box"><span>⌕</span><input placeholder="Buscar temas o tarjetas" aria-label="Buscar" /></div>
              <button className="secondary-button ai-import-button" onClick={() => setModal("import")}>✨ ChatGPT / JSON</button>
              <button className="secondary-button" onClick={() => startReview(undefined, "learn")}>◎ Aprender todo</button>
              <button className="secondary-button" onClick={() => startReview(undefined, "random")}>🎲 Aleatorias</button>
              <button className="secondary-button" onClick={() => { setNewFolderParentId(null); setModal("folder"); }}>＋ Tema</button>
              <button className="primary-button" onClick={() => { setEditingCard(null); setModal("card"); }}>＋ Tarjeta</button>
            </div>
            {!activeFolder ? (
              <>
                <div className="section-heading"><div><span className="section-label">ORGANIZACIÓN</span><h2>Temas de estudio</h2><p>Cada tema puede contener subtemas. Puedes estudiar un tema completo o entrar en una parte concreta.</p></div><span>{state.folders.filter((folder) => !folder.parentId).length} temas · {state.folders.filter((folder) => folder.parentId).length} subtemas · {state.cards.length} tarjetas</span></div>
                <div className="folder-grid">
                  {state.folders.filter((folder) => !folder.parentId).map((folder) => {
                    const cards = cardsInFolderScope(state, folder.id);
                    const reviewed = cards.filter((card) => card.reviewCount > 0).length;
                    const pct = cards.length ? Math.round((reviewed / cards.length) * 100) : 0;
                    const children = state.folders.filter((item) => item.parentId === folder.id).length;
                    return <button className="folder-card" key={folder.id} onClick={() => setSelectedFolder(folder.id)}><span className="folder-icon" style={{ background: `${folder.color}18`, color: folder.color }}>▰</span><span className="folder-menu">•••</span><strong>{folder.name}</strong><small>{cards.length} tarjetas · {children} {children === 1 ? "subtema" : "subtemas"}</small><span className="progress-track"><span style={{ width: `${pct}%`, background: folder.color }} /></span><span className="folder-progress">{pct}% visto</span></button>;
                  })}
                </div>
              </>
            ) : (() => {
              const parent = activeFolder.parentId ? state.folders.find((folder) => folder.id === activeFolder.parentId) ?? null : null;
              const children = state.folders.filter((folder) => folder.parentId === activeFolder.id);
              const scopeCards = cardsInFolderScope(state, activeFolder.id);
              const writtenScopeCards = scopeCards.filter(isWrittenCard);
              const directCards = state.cards.filter((card) => card.folderId === activeFolder.id);
              const isTheme = !activeFolder.parentId;
              return (
                <div>
                  <div className="folder-breadcrumb">
                    <button className="back-button" onClick={() => setSelectedFolder(parent?.id ?? null)}>← {parent ? parent.name : "Todos los temas"}</button>
                    {parent && <span>{parent.name} / <strong>{activeFolder.name}</strong></span>}
                  </div>
                  <div className="folder-title">
                    <div><span className="folder-icon large" style={{ background: `${activeFolder.color}18`, color: activeFolder.color }}>▰</span><div><span className="section-label">{isTheme ? "TEMA" : "SUBTEMA"}</span><h2>{activeFolder.name}</h2><p>{scopeCards.length} tarjetas{isTheme ? ` · ${children.length} ${children.length === 1 ? "subtema" : "subtemas"}` : ""}</p></div></div>
                    <div className="folder-study-actions">
                      <button className="secondary-button danger" onClick={() => deleteFolder(activeFolder.id)}>Eliminar</button>
                      {isTheme && <button className="secondary-button" onClick={() => { setNewFolderParentId(activeFolder.id); setModal("folder"); }}>＋ Subtema</button>}
                      <button className="secondary-button" onClick={() => startReview(activeFolder.id, "recommended")}>Repaso programado</button>
                      <button className="secondary-button" onClick={() => startReview(activeFolder.id, "weakest")}>🔥 Más falladas</button>
                      <button className="secondary-button" onClick={() => startReview(activeFolder.id, "random")}>🎲 Aleatorias</button>
                      {writtenScopeCards.length > 0 && <button className="secondary-button" onClick={() => startReview(activeFolder.id, "learn", writtenScopeCards.map((card) => card.id))}>✍ Respuesta escrita</button>}
                      <button className="primary-button" onClick={() => startReview(activeFolder.id, "learn")}>◎ Aprender</button>
                    </div>
                  </div>

                  {children.length > 0 && <section className="subtopic-section"><div className="subtopic-heading"><span className="section-label">SUBTEMAS</span><p>Estudia solo una parte o usa «Aprender» arriba para mezclar todo el tema.</p></div><div className="subtopic-grid">{children.map((child) => { const childCards = cardsInFolderScope(state, child.id); const reviewed = childCards.filter((card) => card.reviewCount > 0).length; const pct = childCards.length ? Math.round(reviewed / childCards.length * 100) : 0; return <button key={child.id} className="subtopic-card" onClick={() => setSelectedFolder(child.id)}><span className="folder-icon" style={{ background: `${child.color}18`, color: child.color }}>▰</span><div><strong>{child.name}</strong><small>{childCards.length} tarjetas · {pct}% visto</small></div><span>→</span></button>; })}</div></section>}

                  <div className="card-section-head">
                    <div><span className="section-label">{isTheme ? "TARJETAS SIN SUBTEMA" : "TARJETAS DEL SUBTEMA"}</span><h3>{directCards.length ? `${directCards.length} tarjetas` : "Sin tarjetas directas"}</h3></div>
                    <div className="card-section-actions">
                      {directCards.length > 0 && <button className={`secondary-button ${bulkSelectMode ? "active-selection" : ""}`} onClick={() => { setBulkSelectMode((value) => !value); setSelectedCardIds([]); setBulkTargetFolderId(""); }}>{bulkSelectMode ? "Cancelar selección" : "Seleccionar"}</button>}
                      <button className="secondary-button" onClick={() => { setEditingCard(null); setModal("card"); }}>＋ Tarjeta aquí</button>
                    </div>
                  </div>

                  {bulkSelectMode && directCards.length > 0 && (
                    <div className="bulk-card-toolbar">
                      <div className="bulk-card-summary">
                        <strong>{selectedCardIds.length} seleccionada{selectedCardIds.length === 1 ? "" : "s"}</strong>
                        <button type="button" className="text-button" onClick={() => setSelectedCardIds(selectedCardIds.length === directCards.length ? [] : directCards.map((card) => card.id))}>
                          {selectedCardIds.length === directCards.length ? "Quitar todas" : "Seleccionar todas"}
                        </button>
                      </div>
                      <div className="bulk-card-actions">
                        <select value={bulkTargetFolderId} onChange={(event) => setBulkTargetFolderId(event.target.value)} aria-label="Tema o subtema de destino">
                          <option value="">Mover a tema / subtema…</option>
                          {state.folders.filter((folder) => !folder.parentId).flatMap((theme) => [
                            <option key={theme.id} value={theme.id}>{theme.name}</option>,
                            ...state.folders.filter((folder) => folder.parentId === theme.id).map((child) => <option key={child.id} value={child.id}>↳ {theme.name} · {child.name}</option>),
                          ])}
                        </select>
                        <button className="secondary-button" disabled={!selectedCardIds.length || !bulkTargetFolderId} onClick={() => moveSelectedCards(bulkTargetFolderId)}>Mover</button>
                        <button className="secondary-button danger" disabled={!selectedCardIds.length} onClick={deleteSelectedCards}>Eliminar</button>
                      </div>
                      <div className="bulk-study-actions">
                        <span>ESTUDIAR SELECCIÓN</span>
                        <button className="secondary-button" disabled={!selectedCardIds.length} onClick={() => studySelectedCards("recommended")}>Repaso programado</button>
                        <button className="secondary-button" disabled={!selectedCardIds.length} onClick={() => studySelectedCards("weakest")}>🔥 Más falladas</button>
                        <button className="secondary-button" disabled={!selectedCardIds.length} onClick={() => studySelectedCards("random")}>🎲 Aleatorias</button>
                        <button className="primary-button" disabled={!selectedCardIds.length} onClick={() => studySelectedCards("learn")}>◎ Aprender</button>
                      </div>
                    </div>
                  )}

                  {directCards.length > 0 ? <div className={`card-table ${bulkSelectMode ? "selecting" : ""}`}>
                    {directCards.map((card) => {
                      const selected = selectedCardIds.includes(card.id);
                      return <div
                        className={`card-row ${bulkSelectMode ? "bulk-selectable" : ""} ${selected ? "selected" : ""}`}
                        key={card.id}
                        onClick={() => { if (bulkSelectMode) toggleCardSelection(card.id); }}
                      >
                        {bulkSelectMode && <button type="button" className="card-select-check" aria-label={selected ? "Quitar de la selección" : "Seleccionar tarjeta"} onClick={(event) => { event.stopPropagation(); toggleCardSelection(card.id); }}>{selected ? "✓" : ""}</button>}
                        <span className="card-kind">{cardTypeLabel(card.type)}{isMultipleAnswerTest(card) ? " · MULTI" : ""}</span>
                        <div><strong>{plainRichText(card.front) || "Sin pregunta"}{card.attachment ? " · 🖼️" : ""}</strong><p>{plainRichText(card.back) || (isMultipleChoiceCard(card) ? "Sin explicación añadida" : "Sin respuesta añadida")}</p></div>
                        <span>{isWrittenCard(card) ? (writtenAverageAccuracy(card) === null ? "Sin estudiar" : `${Math.round(writtenAverageAccuracy(card) ?? 0)}% precisión`) : card.reviewCount ? `${Math.round((card.successCount / card.reviewCount) * 100)}% aciertos` : "Sin estudiar"}</span>
                        <div className="card-actions">
                          {!bulkSelectMode && <button aria-label="Editar tarjeta" title="Editar tarjeta" onClick={() => { setEditingCard(card.id); setModal("card"); }}>✎</button>}
                          {!bulkSelectMode && <button aria-label="Eliminar tarjeta" title="Eliminar tarjeta" onClick={() => updateState((current) => ({ ...current, cards: current.cards.filter((item) => item.id !== card.id) }))}>×</button>}
                        </div>
                      </div>;
                    })}
                  </div> : <div className="folder-empty-note">{children.length ? "Las tarjetas de este tema están organizadas dentro de sus subtemas." : "Añade tarjetas a este subtema para empezar a estudiarlo."}</div>}
                </div>
              );
            })()}
          </section>
        )}

        {tab === "psych" && (
          <section className="page psych-page">
            {detailPsych ? (() => {
              const stats = psychStats(detailPsych);
              return (
                <div className="psych-detail">
                  <button className="back-button" onClick={() => setPsychDetail(null)}>← Volver a psicotécnicos</button>
                  <div className="psych-detail-head">
                    <div>
                      <span className="category-chip">{detailPsych.category || "Sin categoría"}</span>
                      <h2>{detailPsych.name || "Psicotécnico sin nombre"}</h2>
                      <p>{detailPsych.totalQuestions || 0} preguntas · añadido el {dateLabel(detailPsych.createdAt)}</p>
                    </div>
                    <div className="psych-detail-actions">
                      <button className="secondary-button" onClick={() => { setEditingPsychTest(detailPsych.id); setModal("psych"); }}>Editar ficha</button>
                      {detailPsych.attachment?.type === "application/pdf" ? <button className="secondary-button" onClick={() => setEditingPsych(detailPsych.id)}>✎ Abrir PDF</button> : detailPsych.attachment ? <a className="secondary-button" href={detailPsych.attachment.url} target="_blank" rel="noreferrer">Abrir documento</a> : null}
                      <button className="primary-button" onClick={() => openAttemptEditor(detailPsych.id)}>＋ Registrar intento</button>
                    </div>
                  </div>

                  <div className="psych-summary-grid">
                    <div><span>Última nota</span><strong>{stats.last ? scoreLabel(stats.last.score) : "—"}</strong><small>{stats.last ? dateLabel(stats.last.date) : "Sin intentos"}</small></div>
                    <div><span>Mejor nota</span><strong>{stats.best === null ? "—" : scoreLabel(stats.best)}</strong><small>{stats.attempts.length ? `${stats.attempts.length} intentos` : "Sin intentos"}</small></div>
                    <div><span>Nota media</span><strong>{stats.average === null ? "—" : scoreLabel(stats.average)}</strong><small>histórico completo</small></div>
                    <div><span>Último tiempo</span><strong>{stats.last ? `${scoreLabel(stats.last.minutes)} min` : "—"}</strong><small>{stats.last ? `${stats.last.correct} ✓ · ${stats.last.wrong} ✕ · ${stats.last.blank} —` : "Sin datos"}</small></div>
                  </div>

                  <section className="panel psych-history-panel">
                    <div className="panel-head">
                      <div><span className="section-label">HISTORIAL</span><h3>Todos los intentos</h3></div>
                      <span className="psych-history-count">{stats.attempts.length} {stats.attempts.length === 1 ? "registro" : "registros"}</span>
                    </div>
                    {stats.attempts.length ? (
                      <div className="attempt-history">
                        {stats.attempts.map((attempt, index) => (
                          <div className="attempt-history-row" key={attempt.id}>
                            <div className="attempt-rank"><span>{stats.attempts.length - index}</span></div>
                            <div className="attempt-main"><strong>{dateLabel(attempt.date)}</strong><small>{attempt.notes || "Sin notas"}</small></div>
                            <div className="attempt-score"><small>Nota</small><strong>{scoreLabel(attempt.score)}</strong></div>
                            <div className="attempt-answers"><span>{attempt.correct} ✓</span><span>{attempt.wrong} ✕</span><span>{attempt.blank} —</span></div>
                            <div className="attempt-time"><small>Tiempo</small><strong>{scoreLabel(attempt.minutes)} min</strong></div>
                            <div className="attempt-actions">
                              <button title="Editar intento" aria-label="Editar intento" onClick={() => openAttemptEditor(detailPsych.id, attempt.id)}>✎</button>
                              <button title="Eliminar intento" aria-label="Eliminar intento" className="danger" onClick={() => deleteAttempt(detailPsych.id, attempt.id)}>×</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <Empty icon="◎" title="Todavía no hay intentos" copy="Cuando hagas este psicotécnico, registra la nota y la fecha para empezar a ver tu evolución." action="Registrar primer intento" onAction={() => openAttemptEditor(detailPsych.id)} />}
                  </section>

                  <div className="psych-danger-zone">
                    <button className="text-button danger-text" onClick={() => deletePsychTest(detailPsych.id)}>Eliminar psicotécnico e historial</button>
                  </div>
                </div>
              );
            })() : (
              <>
                <div className="section-heading psych-heading"><div><span className="section-label">PRÁCTICA Y EVOLUCIÓN</span><h2>Mis psicotécnicos</h2><p>Guarda los PDF una sola vez y utiliza el historial para decidir cuáles conviene repetir.</p></div><button className="primary-button" onClick={() => { setEditingPsychTest(null); setModal("psych"); }}>＋ Añadir psicotécnico</button></div>

                <div className="psych-overview">
                  <div><span>Psicotécnicos</span><strong>{state.psychTests.length}</strong><small>{state.psychTests.filter((test) => test.attachment?.type === "application/pdf").length} con PDF</small></div>
                  <div><span>Ya practicados</span><strong>{psychAttemptedCount}</strong><small>{state.psychTests.length - psychAttemptedCount} pendientes</small></div>
                  <div><span>Intentos guardados</span><strong>{psychAttemptCount}</strong><small>histórico total</small></div>
                  <div><span>Media última nota</span><strong>{latestPsychAverage === null ? "—" : scoreLabel(latestPsychAverage)}</strong><small>solo tests realizados</small></div>
                </div>

                <div className="psych-toolbar">
                  <div className="search-box psych-search"><span>⌕</span><input value={psychQuery} onChange={(event) => setPsychQuery(event.target.value)} placeholder="Buscar por nombre o categoría" aria-label="Buscar psicotécnicos" /></div>
                  <select value={psychCategory} onChange={(event) => setPsychCategory(event.target.value)} aria-label="Filtrar categoría"><option value="all">Todas las categorías</option>{psychCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select>
                  <select value={psychSort} onChange={(event) => setPsychSort(event.target.value as PsychSort)} aria-label="Ordenar psicotécnicos">
                    <option value="oldest">Pendientes / más antiguos</option>
                    <option value="last-low">Peor última nota</option>
                    <option value="last-high">Mejor última nota</option>
                    <option value="avg-low">Peor nota media</option>
                    <option value="avg-high">Mejor nota media</option>
                    <option value="recent">Último intento más reciente</option>
                    <option value="attempts-low">Menos intentos</option>
                    <option value="attempts-high">Más intentos</option>
                    <option value="name">Nombre A–Z</option>
                  </select>
                </div>

                {state.psychTests.length ? filteredPsychTests.length ? (
                  <div className="psych-grid">
                    {filteredPsychTests.map((test) => {
                      const stats = psychStats(test);
                      return <article className="psych-card" key={test.id}>
                        <div className="psych-doc"><span>{test.attachment?.type === "application/pdf" ? "PDF" : test.attachment ? "IMG" : "TEST"}</span></div>
                        <div className="psych-body">
                          <div className="psych-card-top"><span className="category-chip">{test.category || "Sin categoría"}</span><button className="psych-edit-button" title="Editar ficha" onClick={() => { setEditingPsychTest(test.id); setModal("psych"); }}>✎</button></div>
                          <h3>{test.name || "Psicotécnico sin nombre"}</h3>
                          <p>{test.totalQuestions || 0} preguntas · {stats.attempts.length} {stats.attempts.length === 1 ? "intento" : "intentos"}</p>
                          <div className="psych-metrics four">
                            <div><small>Última</small><strong>{stats.last ? scoreLabel(stats.last.score) : "—"}</strong></div>
                            <div><small>Mejor</small><strong>{stats.best === null ? "—" : scoreLabel(stats.best)}</strong></div>
                            <div><small>Media</small><strong>{stats.average === null ? "—" : scoreLabel(stats.average)}</strong></div>
                            <div><small>Último día</small><strong className="metric-date">{stats.last ? dateLabel(stats.last.date) : "Pendiente"}</strong></div>
                          </div>
                          <div className="psych-actions psych-actions-wrap">
                            <button onClick={() => setPsychDetail(test.id)}>Ver ficha</button>
                            {test.attachment?.type === "application/pdf" ? <button onClick={() => setEditingPsych(test.id)}>✎ Abrir PDF</button> : test.attachment ? <a href={test.attachment.url} target="_blank" rel="noreferrer">Abrir documento</a> : null}
                            <button className="psych-register" onClick={() => openAttemptEditor(test.id)}>＋ Intento</button>
                          </div>
                        </div>
                      </article>;
                    })}
                  </div>
                ) : <div className="psych-no-results"><span>⌕</span><h3>No hay coincidencias</h3><p>Cambia la búsqueda, la categoría o el criterio de ordenación.</p></div> : <Empty icon="▧" title="Añade tu primer psicotécnico" copy="Sube un PDF o una fotografía y empieza a registrar puntuaciones, tiempos y errores." action="Añadir psicotécnico" onAction={() => { setEditingPsychTest(null); setModal("psych"); }} />}
              </>
            )}
          </section>
        )}

        {tab === "progress" && (
          <section className="page progress-page">
            <div className="stats-row four">
              <StatCard label="Elementos" value={state.cards.length.toString()} detail={`${dueCards.length + orthographyDue} pendientes`} tone="green" />
              <StatCard label="Repasos" value={state.reviews.length.toString()} detail={`${todayReviews.length} hoy`} tone="amber" />
              <StatCard label="Precisión" value={`${accuracy}%`} detail="histórico global" tone="purple" />
              <StatCard label="Racha" value={`${streakDays(state.reviews)} d`} detail="días seguidos" tone="blue" />
            </div>
            <div className="content-grid">
              <section className="panel"><div className="panel-head"><div><span className="section-label">ACTIVIDAD</span><h3>Últimos 7 días</h3></div></div><ActivityChart reviews={state.reviews} /></section>
              <section className="panel"><div className="panel-head"><div><span className="section-label">MEMORIA</span><h3>Estado de tarjetas</h3></div></div><MemoryBreakdown cards={state.cards.filter((card) => !isOrthographyCard(card))} /></section>
            </div>
            <section className="panel weak-panel"><div className="panel-head"><div><span className="section-label">ATENCIÓN PRIORITARIA</span><h3>Conceptos más débiles</h3></div><button className="secondary-button" onClick={() => startReview(undefined, "weakest")}>🔥 Repasar más falladas</button></div><div className="weak-list">{[...state.cards].filter((card) => !isOrthographyCard(card) && card.reviewCount > 0).sort((a, b) => (a.successCount / a.reviewCount) - (b.successCount / b.reviewCount)).slice(0, 5).map((card) => <div key={card.id}><span>{plainRichText(card.front)}</span><strong>{Math.round((card.successCount / card.reviewCount) * 100)}%</strong></div>)}{!state.cards.some((card) => !isOrthographyCard(card) && card.reviewCount > 0) && <p className="muted">Completa algunos repasos para detectar tus puntos débiles.</p>}</div></section>

            {orthographyCards.length > 0 && <section className="panel orthography-stats-panel">
              <div className="panel-head"><div><span className="section-label">ORTOGRAFÍA</span><h3>Progreso por palabra</h3></div><div className="folder-study-actions"><span className="orthography-history-count">{orthographyDue} para repasar</span><button className="secondary-button" onClick={() => startOrthographySession(undefined, "weakest", orthographyCards)}>🔥 Más falladas</button></div></div>
              <div className="orthography-stat-grid">
                <div><span>Palabras</span><strong>{orthographyCards.length}</strong><small>almacenadas individualmente</small></div>
                <div><span>Estudiadas</span><strong>{orthographyStudied}</strong><small>{orthographyLearning} en aprendizaje</small></div>
                <div><span>Dominadas</span><strong>{orthographyMastered}</strong><small>intervalo consolidado</small></div>
                <div><span>Acierto</span><strong>{orthographyAccuracy}%</strong><small>{orthographyReviews.length} respuestas individuales</small></div>
              </div>
              <div className="orthography-stats-columns">
                <div><span className="section-label">MÁS FALLADAS</span><div className="orthography-mini-list">{weakestOrthography.map((card) => <div key={card.id}><span>{plainRichText(card.front)}</span><strong>{orthographyFailures.get(card.id) ?? 0} fallos</strong></div>)}{!weakestOrthography.length && <p className="muted">Aún no hay fallos registrados.</p>}</div></div>
                <div><span className="section-label">PRÓXIMOS REPASOS</span><div className="orthography-mini-list">{nextOrthography.map((card) => <div key={card.id}><span>{plainRichText(card.front)}</span><strong>{new Date(card.dueAt).getTime() <= Date.now() ? "Ahora" : dateLabel(card.dueAt)}</strong></div>)}{!nextOrthography.length && <p className="muted">Empieza a practicar para generar la programación.</p>}</div></div>
              </div>
            </section>}
          </section>
        )}
      </main>

      <nav className="bottom-nav">{navItems.map((item) => <NavButton key={item.id} item={item} active={tab === item.id} onClick={() => setTab(item.id)} />)}</nav>

      {orthographySession && (
        <OrthographyStudy
          cards={orthographySession.groupIds
            .map((id) => state.cards.find((card) => card.id === id))
            .filter((card): card is Card => Boolean(card && isOrthographyCard(card)))
            .map(orthographyStudyCard)}
          selectedIds={orthographySelected}
          results={orthographySession.results}
          groupNumber={orthographySession.groupNumber}
          responses={orthographySession.responses}
          correctResponses={orthographySession.correctResponses}
          scopeLabel={orthographySession.scopeLabel}
          onToggle={toggleOrthographyWord}
          onCorrect={correctOrthographyGroup}
          onContinue={continueOrthographySession}
          onClose={closeOrthographySession}
        />
      )}

      {reviewQueue.length > 0 && reviewIndex < reviewQueue.length && currentCard && currentQueueItem && (
        <div className="review-overlay">
          <div className={`review-top ${isContinuousStudyMode(studyMode) ? "continuous" : ""}`}>
            <button onClick={() => setReviewQueue([])}>×</button>
            {isContinuousStudyMode(studyMode)
              ? <div className="learn-session-title"><strong>{studyMode === "weakest" ? "Más falladas" : "Modo Aprender"}</strong><small>{studyMode === "weakest" ? "Priorizamos tus errores históricos y recientes; tú decides cuándo parar." : "Las difíciles vuelven más; tú decides cuándo parar."}</small></div>
              : <div className="session-progress"><span style={{ width: `${Math.round((reviewIndex / reviewQueue.length) * 100)}%` }} /> </div>}
            <span>{isContinuousStudyMode(studyMode) ? `${sessionDone} repasos` : `${reviewIndex + 1}/${reviewQueue.length}`}</span>
            {isContinuousStudyMode(studyMode) && <button className="finish-learn-button" onClick={() => setReviewQueue([])}>Terminar</button>}
          </div>
          <div className="review-stage">
            <span className="deck-label">{state.folders.find((folder) => folder.id === currentCard.folderId)?.name ?? "Sin carpeta"}</span>
            <div className={`study-card ${revealed ? "revealed answer-side" : "question-side"}`}>
              <span className="study-card-type">{currentQueueItem.reinforcement ? "REFUERZO · " : ""}{revealed ? (isWrittenCard(currentCard) ? "CORRECCIÓN" : "RESPUESTA") : isWrittenCard(currentCard) ? "RESPUESTA ESCRITA" : currentCard.type === "test" ? isMultipleAnswerTest(currentCard) ? "TEST · RESPUESTA MÚLTIPLE" : "PREGUNTA TIPO TEST" : currentCard.type === "choice" ? "VOCABULARIO" : "RECUERDA EL CONCEPTO"}</span>
              {!revealed ? (
                <>
                  <RichContent html={currentCard.front} className="study-front" />
                  {isWrittenCard(currentCard) ? (
                    <div className="written-answer-input">
                      <textarea autoFocus value={writtenAnswer} onChange={(event) => setWrittenAnswer(event.target.value)} placeholder="Escribe la respuesta con tus propias palabras o con la literalidad que exija la rúbrica…" />
                      <button className="check-button written-check-button" disabled={!writtenAnswer.trim()} onClick={submitWrittenAnswer}>Corregir respuesta</button>
                    </div>
                  ) : isMultipleChoiceCard(currentCard) ? (
                    <div className={`options-list ${isMultipleAnswerTest(currentCard) ? "multiple" : ""}`}>{currentCard.options.map((option, index) => {
                      const selected = isMultipleAnswerTest(currentCard) ? selectedOptions.includes(index) : selectedOption === index;
                      return <button key={`${index}-${option}`} className={selected ? "selected" : ""} onClick={() => {
                        if (isMultipleAnswerTest(currentCard)) setSelectedOptions((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index]);
                        else setSelectedOption(index);
                      }}><span>{isMultipleAnswerTest(currentCard) ? (selected ? "☑" : "☐") : String.fromCharCode(65 + index)}</span>{option}</button>;
                    })}</div>
                  ) : (
                    <button className="reveal-button" onClick={() => setRevealed(true)}>Mostrar respuesta</button>
                  )}
                </>
              ) : (
                <div className="answer-side-content">
                  {isWrittenCard(currentCard) && writtenResult ? (
                    <>
                      <div className={`written-score ${writtenResult.rating}`}><span>PRECISIÓN</span><strong>{writtenResult.accuracy}%</strong><small>{writtenResult.rating === "again" ? "Otra vez" : writtenResult.rating === "hard" ? "Difícil" : writtenResult.rating === "good" ? "Bien" : "Fácil"}</small></div>
                      <div className="written-user-answer"><span>TU RESPUESTA</span><p>{writtenAnswer}</p></div>
                      <div className="written-criteria-list">{writtenResult.criteria.map((criterion) => <div key={criterion.id} className={criterion.cumplido ? "ok" : "miss"}><span>{criterion.cumplido ? "✓" : "×"}</span><div><strong>{criterion.esperado}</strong><small>{`${Math.round(criterion.conseguido * 10) / 10}/${criterion.puntos} puntos${criterion.critico ? " · concepto crítico" : ""}${!criterion.cumplido && criterion.similitud > 0 ? ` · ${Math.round(criterion.similitud * 100)}% coincidencia` : ""}`}</small></div></div>)}</div>
                      {plainRichText(currentCard.back) && <div className="answer-box written-model-answer"><small>RESPUESTA MODELO</small><RichContent html={currentCard.back} /></div>}
                      <button className="primary-button written-continue-button" onClick={() => rateCurrent(writtenResult.rating, writtenResult)}>Continuar</button>
                    </>
                  ) : (
                    <>
                      {!isMultipleChoiceCard(currentCard) && plainRichText(currentCard.back) && <div className="answer-box"><RichContent html={currentCard.back} /></div>}
                      {isMultipleChoiceCard(currentCard) && <div className="answer-box choice-answer"><strong>{cardCorrectOptions(currentCard).map((index) => `${String.fromCharCode(65 + index)} · ${currentCard.options[index]}`).join("  ·  ")}</strong>{plainRichText(currentCard.back) && <RichContent html={currentCard.back} />}</div>}
                      {currentCard.attachment && (
                        <div className="answer-visual-block"><span>RESPUESTA VISUAL</span><AnnotatedCardImage attachment={currentCard.attachment} onOpen={() => setViewingStudyImage(true)} /><small>Toca la imagen para abrirla a pantalla completa.</small></div>
                      )}
                      {!plainRichText(currentCard.back) && !currentCard.attachment && !isMultipleChoiceCard(currentCard) && <p className="empty-answer">Esta tarjeta no tiene respuesta escrita ni visual.</p>}
                      <button className="flip-back-button" onClick={() => { setRevealed(false); setViewingStudyImage(false); }}>↶ Volver a la pregunta</button>
                    </>
                  )}
                </div>
              )}
            </div>
            {isMultipleChoiceCard(currentCard) && !revealed && <button className="check-button" disabled={isMultipleAnswerTest(currentCard) ? selectedOptions.length === 0 : selectedOption === null} onClick={() => setRevealed(true)}>Comprobar</button>}
            {revealed && !isWrittenCard(currentCard) && <div className="rating-bar"><p>{isMultipleChoiceCard(currentCard) ? currentSelectionIsCorrect(currentCard) ? "¡Correcto! ¿Cómo te ha resultado?" : "No es correcto. La tarjeta ganará prioridad en esta sesión." : "¿Qué tal la recordabas?"} <span className="fsrs-badge">{isContinuousStudyMode(studyMode) ? (studyMode === "weakest" ? "Refuerzo de errores · FSRS solo consolida el primer intento" : "Aprendizaje activo · FSRS solo consolida el primer intento") : personalModelLabel(personalModel)}</span></p><div>
              <button className="again" onClick={() => rateCurrent("again")}><strong>Otra vez</strong><small>{isContinuousStudyMode(studyMode) ? "prioridad máxima" : "↻ tras 2 tarjetas"}</small></button>
              <button className="hard" onClick={() => rateCurrent("hard")}><strong>Difícil</strong><small>{isContinuousStudyMode(studyMode) ? "saldrá más" : "↻ tras 4 tarjetas"}</small></button>
              <button className="good" onClick={() => rateCurrent("good")}><strong>Bien</strong><small>{isContinuousStudyMode(studyMode) ? "baja prioridad" : fsrsDueLabel(currentCard, "good")}</small></button>
              <button className="easy" onClick={() => rateCurrent("easy")}><strong>Fácil</strong><small>{isContinuousStudyMode(studyMode) ? "prioridad mínima" : fsrsDueLabel(currentCard, "easy")}</small></button>
            </div></div>}
          </div>
        </div>
      )}

      {viewingStudyImage && currentCard?.attachment && (
        <ImageLightbox attachment={currentCard.attachment} title={plainRichText(currentCard.back) || plainRichText(currentCard.front) || "Respuesta visual"} onClose={() => setViewingStudyImage(false)} />
      )}

      {!isContinuousStudyMode(studyMode) && reviewQueue.length > 0 && reviewIndex >= reviewQueue.length && (
        <div className="review-overlay complete"><div className="complete-card"><span className="complete-icon">✓</span><span className="section-label">SESIÓN COMPLETADA</span><h2>Buen trabajo, Marc</h2><p>Has repasado {sessionDone} tarjetas. El motor ya ha recalculado cuándo debes volver a ver cada una.</p><button className="primary-button" onClick={() => setReviewQueue([])}>Volver a Hoy</button></div></div>
      )}

      {modal === "folder" && <FolderModal parentId={newFolderParentId} parentName={newFolderParentId ? state.folders.find((folder) => folder.id === newFolderParentId)?.name ?? "" : ""} onClose={() => { setModal(null); setNewFolderParentId(null); }} onCreate={(folder) => { updateState((current) => ({ ...current, folders: [...current.folders, folder] })); setModal(null); setNewFolderParentId(null); notify(folder.parentId ? "Subtema creado" : "Tema creado"); }} />}
      {modal === "card" && <CardModal folders={state.folders} defaultFolder={selectedFolder} initialCard={openCard} onClose={() => { setModal(null); setEditingCard(null); }} onSave={(card) => { updateState((current) => ({ ...current, cards: openCard ? current.cards.map((item) => item.id === card.id ? card : item) : [...current.cards, card] })); setModal(null); setEditingCard(null); notify(openCard ? "Tarjeta actualizada" : "Tarjeta guardada"); }} />}
      {modal === "import" && <CardImportModal onClose={() => setModal(null)} onImport={importGeneratedCards} />}
      {modal === "psych" && <PsychModal initialTest={openPsychTest} onClose={() => { setModal(null); setEditingPsychTest(null); }} onSave={(test) => { updateState((current) => ({ ...current, psychTests: openPsychTest ? current.psychTests.map((item) => item.id === test.id ? test : item) : [...current.psychTests, test] })); setModal(null); setEditingPsychTest(null); setPsychDetail(test.id); notify(openPsychTest ? "Psicotécnico actualizado" : "Psicotécnico guardado"); }} />}
      {modal === "attempt" && activePsych && <AttemptModal test={activePsych} initialAttempt={openAttempt} onClose={() => { setModal(null); setSelectedPsych(null); setEditingAttempt(null); }} onSave={(attempt) => { updateState((current) => ({ ...current, psychTests: current.psychTests.map((test) => test.id === activePsych.id ? { ...test, attempts: openAttempt ? test.attempts.map((item) => item.id === attempt.id ? attempt : item) : [...test.attempts, attempt] } : test) })); setModal(null); setSelectedPsych(null); setEditingAttempt(null); setPsychDetail(activePsych.id); notify(openAttempt ? "Intento actualizado" : "Intento registrado"); }} />}
      {openPsych?.attachment?.type === "application/pdf" && <PdfAnnotator attachment={openPsych.attachment} title={openPsych.name} onClose={() => setEditingPsych(null)} />}
      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  );
}

const navItems: { id: Tab; label: string; icon: string }[] = [
  { id: "today", label: "Hoy", icon: "⌂" },
  { id: "library", label: "Biblioteca", icon: "▰" },
  { id: "psych", label: "Psicotécnicos", icon: "◇" },
  { id: "progress", label: "Progreso", icon: "↗" },
];

function NavButton({ item, active, onClick }: { item: (typeof navItems)[number]; active: boolean; onClick: () => void }) {
  return <button className={active ? "active" : ""} onClick={onClick}><span>{item.icon}</span>{item.label}</button>;
}

function StatCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
  return <article className={`stat-card ${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function WeekStrip({ reviews }: { reviews: Review[] }) {
  const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - 6 + index); return date; });
  return <div className="week-strip">{days.map((day) => { const key = day.toISOString().slice(0, 10); const count = reviews.filter((review) => review.reviewedAt.startsWith(key)).length; return <div key={key} className={count ? "done" : key === todayKey() ? "today" : ""}><span>{new Intl.DateTimeFormat("es-ES", { weekday: "narrow" }).format(day)}</span><strong>{day.getDate()}</strong><small>{count || "·"}</small></div>; })}</div>;
}

function Empty({ icon, title, copy, action, onAction }: { icon: string; title: string; copy: string; action: string; onAction: () => void }) {
  return <div className="empty-state"><span>{icon}</span><h3>{title}</h3><p>{copy}</p><button className="primary-button" onClick={onAction}>{action}</button></div>;
}

function ModalShell({ title, subtitle, label = "NUEVO", onClose, children }: { title: string; subtitle: string; label?: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="modal"><button className="modal-close" onClick={onClose}>×</button><span className="section-label">{label}</span><h2>{title}</h2><p className="modal-subtitle">{subtitle}</p>{children}</section></div>;
}

function FolderModal({ parentId, parentName, onClose, onCreate }: { parentId: string | null; parentName: string; onClose: () => void; onCreate: (folder: Folder) => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(colors[0]);
  const isSubtopic = Boolean(parentId);
  return <ModalShell title={isSubtopic ? "Crear subtema" : "Crear tema"} subtitle={isSubtopic ? `Se añadirá dentro de ${parentName}.` : "Crea un tema principal. Dentro podrás añadir subtemas."} onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); if (name.trim()) onCreate({ id: uid(), name: name.trim(), color, parentId, createdAt: nowIso() }); }}><label>Nombre<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder={isSubtopic ? "Ej. Título Preliminar" : "Ej. Tema 4 · Derecho Penal"} /></label><label>Color<div className="color-picker">{colors.map((item) => <button type="button" key={item} className={color === item ? "selected" : ""} style={{ background: item }} onClick={() => setColor(item)} aria-label={`Color ${item}`} />)}</div></label><button className="primary-button full" disabled={!name.trim()}>Crear {isSubtopic ? "subtema" : "tema"}</button></form></ModalShell>;
}

function CardModal({ folders, defaultFolder, initialCard, onClose, onSave }: { folders: Folder[]; defaultFolder: string | null; initialCard: Card | null; onClose: () => void; onSave: (card: Card) => void }) {
  const [type, setType] = useState<CardType>(initialCard?.type ?? "basic");
  const [folderId, setFolderId] = useState(initialCard?.folderId ?? defaultFolder ?? folders[0]?.id ?? "");
  const [front, setFront] = useState(initialCard?.front ?? "");
  const [back, setBack] = useState(initialCard?.back ?? "");
  const [options, setOptions] = useState(() => {
    const existing = initialCard?.options ?? [];
    return Array.from({ length: 4 }, (_, index) => existing[index] ?? "");
  });
  const initialCorrectOptions = initialCard ? cardCorrectOptions(initialCard) : [0];
  const [correctOption, setCorrectOption] = useState(initialCorrectOptions[0] ?? 0);
  const [correctOptions, setCorrectOptions] = useState<number[]>(initialCorrectOptions);
  const [multipleAnswers, setMultipleAnswers] = useState(Boolean(initialCard?.type === "test" && initialCorrectOptions.length > 1));
  const [attachment, setAttachment] = useState<Attachment | null>(initialCard?.attachment ?? null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState("");
  const [editingImage, setEditingImage] = useState(false);
  const [orthographyWord, setOrthographyWord] = useState(initialCard?.type === "orthography" ? plainRichText(initialCard.front) : "");
  const [orthographyIsCorrect, setOrthographyIsCorrect] = useState(initialCard?.type === "orthography" ? initialCard.orthographyIsCorrect !== false : true);
  const [orthographyCorrectForm, setOrthographyCorrectForm] = useState(initialCard?.type === "orthography" ? initialCard.orthographyCorrectForm : "");
  const [orthographyExplanation, setOrthographyExplanation] = useState(initialCard?.type === "orthography" ? initialCard.orthographyExplanation : "");
  const [orthographySource, setOrthographySource] = useState(initialCard?.type === "orthography" ? initialCard.orthographySource : "");
  const [writtenEvaluation, setWrittenEvaluation] = useState<WrittenEvaluation | null>(() => initialCard?.type === "written" ? writtenRubric(initialCard) : null);
  const [writtenEditorError, setWrittenEditorError] = useState("");

  function updateWrittenCriterion(index: number, updater: (criterion: WrittenCriterion) => WrittenCriterion) {
    setWrittenEvaluation((current) => current ? { ...current, criterios: current.criterios.map((criterion, criterionIndex) => criterionIndex === index ? updater(criterion) : criterion) } : current);
    setWrittenEditorError("");
  }

  function addWrittenCriterion() {
    setWrittenEvaluation((current) => {
      if (!current) return current;
      const number = current.criterios.length + 1;
      return { ...current, criterios: [...current.criterios, { id: `criterio_${number}`, esperado: "", alternativas: [], puntos: 10, literal: false, critico: false, maximoSiFalla: null, minimoSimilitud: 0.8 }] };
    });
  }

  function removeWrittenCriterion(index: number) {
    setWrittenEvaluation((current) => current ? { ...current, criterios: current.criterios.filter((_, criterionIndex) => criterionIndex !== index) } : current);
  }

  async function compressIfNeeded(file: File) {
    if (file.size <= 5.5 * 1024 * 1024) return file;
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error("No se pudo preparar la imagen"));
        element.src = url;
      });
      const maxSide = 2200;
      const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("No se pudo preparar la imagen");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
      if (!blob) throw new Error("No se pudo comprimir la imagen");
      return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
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
      const response = await fetch("/api/files", { method: "POST", body: form });
      const payload = await response.json() as { attachment?: Attachment; error?: string };
      if (!response.ok || !payload.attachment) throw new Error(payload.error ?? "No se pudo subir la imagen");
      setAttachment(payload.attachment);
      return payload.attachment;
    } catch (reason) {
      setImageError(reason instanceof Error ? reason.message : "No se pudo subir la imagen");
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
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("No se pudo crear el lienzo");
      const file = new File([blob], `respuesta-manuscrita-${Date.now()}.png`, { type: "image/png" });
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/files", { method: "POST", body: form });
      const payload = await response.json() as { attachment?: Attachment; error?: string };
      if (!response.ok || !payload.attachment) throw new Error(payload.error ?? "No se pudo crear la respuesta manuscrita");
      setAttachment(payload.attachment);
      setEditingImage(true);
    } catch (reason) {
      setImageError(reason instanceof Error ? reason.message : "No se pudo crear la respuesta manuscrita");
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
    if (type === "orthography" && !orthographyIsCorrect && !orthographyCorrectForm.trim()) return;
    if (type === "written") {
      if (!writtenEvaluation || !writtenEvaluation.criterios.length) { setWrittenEditorError("La respuesta escrita necesita al menos un criterio de corrección."); return; }
      const ids = new Set<string>();
      for (const criterion of writtenEvaluation.criterios) {
        if (!criterion.id.trim() || ids.has(criterion.id.trim())) { setWrittenEditorError("Cada criterio necesita un ID único."); return; }
        ids.add(criterion.id.trim());
        if (!criterion.esperado.trim()) { setWrittenEditorError("Todos los criterios necesitan un texto esperado."); return; }
        if (!(criterion.puntos > 0)) { setWrittenEditorError("Los puntos de cada criterio deben ser mayores que 0."); return; }
        if (criterion.minimoSimilitud < 0 || criterion.minimoSimilitud > 1) { setWrittenEditorError("La similitud mínima debe estar entre 0 y 1."); return; }
      }
      const { otraVezHasta, dificilHasta, bienHasta } = writtenEvaluation.umbrales;
      if (!(otraVezHasta >= 0 && otraVezHasta < dificilHasta && dificilHasta < bienHasta && bienHasta < 100)) {
        setWrittenEditorError("Los umbrales deben cumplir: Otra vez < Difícil < Bien < 100.");
        return;
      }
    }
    setWrittenEditorError("");
    const finalOrthographyForm = orthographyIsCorrect ? (orthographyCorrectForm.trim() || orthographyWord.trim()) : orthographyCorrectForm.trim();
    const writtenOptions = type === "written" && writtenEvaluation
      ? [...(initialCard?.options ?? []).filter((item) => !item.startsWith(WRITTEN_RUBRIC_PREFIX)), encodeWrittenRubric(writtenEvaluation)]
      : (initialCard?.options ?? []);
    onSave({
      ...base,
      folderId,
      type,
      front: type === "orthography" ? sanitizeRichHtml(`<p>${escapeHtml(orthographyWord.trim())}</p>`) : sanitizeRichHtml(front),
      back: type === "orthography"
        ? orthographyBackHtml(orthographyWord.trim(), orthographyIsCorrect, finalOrthographyForm, orthographyExplanation.trim(), orthographySource.trim())
        : sanitizeRichHtml(back),
      options: type === "written" ? writtenOptions : isMultipleChoiceType(type) ? options.slice(0, 4).map((option) => option.trim()) : [],
      correctOption: isMultipleChoiceType(type) ? ((type === "test" && multipleAnswers ? [...new Set(correctOptions)].sort((a, b) => a - b)[0] : correctOption) ?? 0) : 0,
      correctOptions: isMultipleChoiceType(type) ? (type === "test" && multipleAnswers ? ([...new Set(correctOptions)].sort((a, b) => a - b).length ? [...new Set(correctOptions)].sort((a, b) => a - b) : [0]) : [Math.min(correctOption, 3)]) : [],
      attachment: type === "orthography" ? null : attachment,
      orthographyIsCorrect: type === "orthography" ? orthographyIsCorrect : null,
      orthographyCorrectForm: type === "orthography" ? finalOrthographyForm : "",
      orthographyExplanation: type === "orthography" ? orthographyExplanation.trim() : "",
      orthographySource: type === "orthography" ? orthographySource.trim() : "",
      orthographyStage: type === "orthography" ? Math.max(1, base.orthographyStage || 1) : 1,
    });
  }

  return <ModalShell title={initialCard ? "Editar tarjeta" : "Crear tarjeta"} subtitle="Crea flashcards, vocabulario, tests u ortografía. Las respuestas escritas con rúbrica se crean desde ChatGPT / JSON y después pueden editarse aquí." label={initialCard ? "EDITAR" : "NUEVO"} onClose={onClose}>
    <form onSubmit={submit}>
      <div className="segmented five-types">
        <button type="button" className={type === "basic" ? "active" : ""} onClick={() => setType("basic")}>Flashcard</button>
        <button type="button" className={type === "choice" ? "active" : ""} onClick={() => setType("choice")}>Vocabulario</button>
        <button type="button" className={type === "test" ? "active" : ""} onClick={() => setType("test")}>Tipo test</button>
        <button type="button" className={type === "orthography" ? "active" : ""} onClick={() => setType("orthography")}>Ortografía</button>
        <button type="button" className={type === "written" ? "active" : ""} disabled={!initialCard || initialCard.type !== "written"} title={!initialCard ? "Las respuestas escritas se crean desde ChatGPT / JSON" : initialCard.type !== "written" ? "No se convierte una tarjeta existente a respuesta escrita" : "Editar respuesta escrita"} onClick={() => initialCard?.type === "written" && setType("written")}>Respuesta escrita</button>
      </div>
      {type === "written" && <div className="written-import-note"><strong>Respuesta escrita</strong><span>Edita aquí la rúbrica importada. OpoGC seguirá usando estos criterios para calcular la precisión.</span></div>}
      <label>Tema / subtema<select value={folderId} onChange={(event) => setFolderId(event.target.value)}><option value="">Sin carpeta</option>{folders.filter((folder) => !folder.parentId).flatMap((theme) => [<option key={theme.id} value={theme.id}>{theme.name}</option>, ...folders.filter((folder) => folder.parentId === theme.id).map((child) => <option key={child.id} value={child.id}>↳ {child.name}</option>)])}</select></label>
      {type === "orthography" ? (
        <div className="orthography-manual-editor">
          <span className="flashcard-side-label">PALABRA · UNIDAD INDIVIDUAL DE ESTUDIO</span>
          <label>Palabra<input value={orthographyWord} onChange={(event) => setOrthographyWord(event.target.value)} placeholder="Ej. haciago" /></label>
          <div className="answer-mode-toggle orthography-correctness-toggle">
            <button type="button" className={orthographyIsCorrect ? "active" : ""} onClick={() => { setOrthographyIsCorrect(true); if (!orthographyCorrectForm.trim()) setOrthographyCorrectForm(orthographyWord); }}>Está bien escrita</button>
            <button type="button" className={!orthographyIsCorrect ? "active" : ""} onClick={() => setOrthographyIsCorrect(false)}>Está mal escrita</button>
          </div>
          <label>Forma correcta{!orthographyIsCorrect ? " · obligatoria" : " · puede coincidir con la palabra"}<input value={orthographyCorrectForm} onChange={(event) => setOrthographyCorrectForm(event.target.value)} placeholder={orthographyIsCorrect ? orthographyWord || "Forma correcta" : "Ej. aciago"} /></label>
          <label>Explicación <small>(opcional)</small><textarea value={orthographyExplanation} onChange={(event) => setOrthographyExplanation(event.target.value)} placeholder="La forma correcta es…" /></label>
          <label>Fuente <small>(opcional)</small><input value={orthographySource} onChange={(event) => setOrthographySource(event.target.value)} placeholder="Ejercicio 1, p. 13" /></label>
          <p className="field-help">OpoGC no guardará esta palabra como un test fijo. La mezclará dinámicamente con otras tres y mantendrá su progreso SRS por separado.</p>
        </div>
      ) : (
        <>
          <div className="flashcard-side-editor question-editor">
            <span className="flashcard-side-label">ANVERSO · PREGUNTA</span>
            <label>Pregunta</label><RichTextEditor value={front} onChange={setFront} placeholder="Escribe la pregunta" />
            {isMultipleChoiceType(type) && <fieldset><legend>{type === "test" ? "Opciones del test" : "Opciones de vocabulario"}</legend>{type === "test" && <div className="answer-mode-toggle"><button type="button" className={!multipleAnswers ? "active" : ""} onClick={() => { setMultipleAnswers(false); setCorrectOption(correctOptions[0] ?? correctOption); }}>Respuesta única</button><button type="button" className={multipleAnswers ? "active" : ""} onClick={() => { setMultipleAnswers(true); setCorrectOptions((current) => current.length ? current : [correctOption]); }}>Respuesta múltiple</button></div>}{type === "test" && multipleAnswers && <p className="field-help">Marca todas las opciones correctas. Al estudiar, habrá que seleccionar exactamente ese conjunto.</p>}{options.map((option, index) => { const checked = type === "test" && multipleAnswers ? correctOptions.includes(index) : correctOption === index; return <label className="option-input" key={index}><input type={type === "test" && multipleAnswers ? "checkbox" : "radio"} name={type === "test" && multipleAnswers ? undefined : "correct"} checked={checked} onChange={() => { if (type === "test" && multipleAnswers) setCorrectOptions((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index]); else { setCorrectOption(index); setCorrectOptions([index]); } }} /><span>{String.fromCharCode(65 + index)}</span><input value={option} onChange={(event) => setOptions((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`Opción ${index + 1}`} /></label>; })}</fieldset>}
          </div>
          <div className="flashcard-side-editor answer-editor">
            <span className="flashcard-side-label">REVERSO · RESPUESTA</span>
            <label>Texto de la respuesta <small>(opcional)</small></label><RichTextEditor value={back} onChange={setBack} placeholder="Puedes escribir una respuesta, añadir una imagen, escribir a mano o combinarlo" />
            <div className="card-media-field answer-media-field">
              <span className="card-media-label">Respuesta visual <small>(opcional)</small></span>
              {!attachment ? (
                <div className="answer-media-actions">
                  <label className="file-drop compact answer-upload"><input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file); }} /><span>🖼</span><strong>{uploadingImage ? "Subiendo…" : "Usar una imagen como respuesta"}</strong><small>Página de libro, esquema, captura, fotografía…</small></label>
                  <button type="button" className="blank-answer-button" disabled={uploadingImage} onClick={() => void createHandwrittenAnswer()}><span>✎</span><strong>Crear respuesta manuscrita</strong><small>Abre un lienzo en blanco para Apple Pencil o dedo.</small></button>
                </div>
              ) : (
                <div className="card-media-preview answer-media-preview">
                  <AnnotatedCardImage attachment={attachment} onOpen={() => setEditingImage(true)} />
                  <div><button type="button" className="secondary-button" onClick={() => setEditingImage(true)}>✎ Abrir / escribir</button><button type="button" className="secondary-button danger" onClick={() => setAttachment(null)}>Quitar respuesta visual</button></div>
                  <small>Esta imagen no se mostrará con la pregunta. Aparecerá únicamente al mostrar la respuesta.</small>
                </div>
              )}
              {imageError && <p className="form-error">{imageError}</p>}
            </div>
          </div>

          {type === "written" && writtenEvaluation && (
            <div className="written-rubric-editor">
              <div className="written-rubric-head"><div><span className="flashcard-side-label">RÚBRICA DE CORRECCIÓN</span><strong>{writtenEvaluation.criterios.length} criterios</strong></div><button type="button" className="secondary-button" onClick={addWrittenCriterion}>＋ Criterio</button></div>
              <p className="field-help">Puedes aflojar o endurecer cada criterio. Si el orden exacto no importa, desactiva «Literal» y ajusta la similitud mínima.</p>
              <div className="written-normalization-grid">
                <label><input type="checkbox" checked={writtenEvaluation.normalizacion.ignorarMayusculas} onChange={(event) => setWrittenEvaluation({ ...writtenEvaluation, normalizacion: { ...writtenEvaluation.normalizacion, ignorarMayusculas: event.target.checked } })} /> Ignorar mayúsculas</label>
                <label><input type="checkbox" checked={writtenEvaluation.normalizacion.ignorarPuntuacion} onChange={(event) => setWrittenEvaluation({ ...writtenEvaluation, normalizacion: { ...writtenEvaluation.normalizacion, ignorarPuntuacion: event.target.checked } })} /> Ignorar puntuación</label>
                <label><input type="checkbox" checked={writtenEvaluation.normalizacion.ignorarAcentos} onChange={(event) => setWrittenEvaluation({ ...writtenEvaluation, normalizacion: { ...writtenEvaluation.normalizacion, ignorarAcentos: event.target.checked } })} /> Ignorar acentos</label>
                <label><input type="checkbox" checked={writtenEvaluation.normalizacion.ignorarEspaciosExtra} onChange={(event) => setWrittenEvaluation({ ...writtenEvaluation, normalizacion: { ...writtenEvaluation.normalizacion, ignorarEspaciosExtra: event.target.checked } })} /> Ignorar espacios extra</label>
              </div>

              <div className="written-rubric-criteria">
                {writtenEvaluation.criterios.map((criterion, index) => (
                  <section className="written-rubric-criterion" key={`${criterion.id}-${index}`}>
                    <div className="written-rubric-criterion-head"><strong>Criterio {index + 1}</strong><button type="button" className="text-button danger-text" disabled={writtenEvaluation.criterios.length <= 1} onClick={() => removeWrittenCriterion(index)}>Eliminar</button></div>
                    <div className="form-grid">
                      <label>ID<input value={criterion.id} onChange={(event) => updateWrittenCriterion(index, (current) => ({ ...current, id: event.target.value }))} /></label>
                      <label>Puntos<input type="number" min="0.1" step="0.1" value={criterion.puntos} onChange={(event) => updateWrittenCriterion(index, (current) => ({ ...current, puntos: Number(event.target.value) }))} /></label>
                    </div>
                    <label>Texto esperado<textarea value={criterion.esperado} onChange={(event) => updateWrittenCriterion(index, (current) => ({ ...current, esperado: event.target.value }))} /></label>
                    <label>Alternativas aceptadas <small>(una por línea)</small><textarea value={criterion.alternativas.join("\n")} onChange={(event) => updateWrittenCriterion(index, (current) => ({ ...current, alternativas: event.target.value.split(/\n/).map((value) => value.trim()).filter(Boolean) }))} /></label>
                    <div className="written-rubric-flags">
                      <label><input type="checkbox" checked={criterion.literal} onChange={(event) => updateWrittenCriterion(index, (current) => ({ ...current, literal: event.target.checked }))} /> Literal</label>
                      <label><input type="checkbox" checked={criterion.critico} onChange={(event) => updateWrittenCriterion(index, (current) => ({ ...current, critico: event.target.checked }))} /> Crítico</label>
                    </div>
                    <div className="form-grid">
                      <label>Similitud mínima<input type="number" min="0" max="1" step="0.05" value={criterion.minimoSimilitud} onChange={(event) => updateWrittenCriterion(index, (current) => ({ ...current, minimoSimilitud: Number(event.target.value) }))} /></label>
                      <label>Máximo si falla <small>(vacío = sin límite)</small><input type="number" min="0" max="100" step="1" value={criterion.maximoSiFalla ?? ""} onChange={(event) => updateWrittenCriterion(index, (current) => ({ ...current, maximoSiFalla: event.target.value === "" ? null : Number(event.target.value) }))} /></label>
                    </div>
                  </section>
                ))}
              </div>

              <div className="written-thresholds">
                <span className="flashcard-side-label">UMBRALES AUTOMÁTICOS</span>
                <div className="form-grid three">
                  <label>Otra vez hasta<input type="number" min="0" max="99" value={writtenEvaluation.umbrales.otraVezHasta} onChange={(event) => setWrittenEvaluation({ ...writtenEvaluation, umbrales: { ...writtenEvaluation.umbrales, otraVezHasta: Number(event.target.value) } })} /></label>
                  <label>Difícil hasta<input type="number" min="1" max="99" value={writtenEvaluation.umbrales.dificilHasta} onChange={(event) => setWrittenEvaluation({ ...writtenEvaluation, umbrales: { ...writtenEvaluation.umbrales, dificilHasta: Number(event.target.value) } })} /></label>
                  <label>Bien hasta<input type="number" min="2" max="99" value={writtenEvaluation.umbrales.bienHasta} onChange={(event) => setWrittenEvaluation({ ...writtenEvaluation, umbrales: { ...writtenEvaluation.umbrales, bienHasta: Number(event.target.value) } })} /></label>
                </div>
              </div>
              {writtenEditorError && <p className="form-error">{writtenEditorError}</p>}
            </div>
          )}
        </>
      )}
      <button className="primary-button full" disabled={uploadingImage || (type === "orthography" && (!orthographyWord.trim() || (!orthographyIsCorrect && !orthographyCorrectForm.trim()))) || (type === "written" && !writtenEvaluation)}>{initialCard ? "Guardar cambios" : type === "orthography" ? "Guardar palabra" : "Guardar tarjeta"}</button>
    </form>
    {editingImage && attachment && <ImageAnnotator attachment={attachment} title={plainRichText(back) || plainRichText(front) || "Respuesta visual"} onClose={() => setEditingImage(false)} />}
  </ModalShell>;
}

function PsychModal({ initialTest, onClose, onSave }: { initialTest: PsychTest | null; onClose: () => void; onSave: (test: PsychTest) => void }) {
  const [name, setName] = useState(initialTest?.name ?? "");
  const [category, setCategory] = useState(initialTest?.category ?? "Razonamiento verbal");
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
      if (response.status === 413) throw new Error("El documento es demasiado grande para enviarlo de una sola vez");
      throw new Error(`No se pudo subir el documento (${response.status})`);
    }
  }

  async function uploadDirect(selectedFile: File) {
    const form = new FormData();
    form.append("file", selectedFile);
    const response = await fetch("/api/files", { method: "POST", body: form });
    const result = await readJson(response) as { attachment?: Attachment; error?: string };
    if (!response.ok || !result.attachment) throw new Error(result.error ?? "No se pudo subir el documento");
    setUploadProgress(100);
    return result.attachment;
  }

  async function uploadInParts(selectedFile: File) {
    const initResponse = await fetch("/api/files/multipart?action=init", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: selectedFile.name, type: selectedFile.type || "application/pdf", size: selectedFile.size }),
    });
    const init = await readJson(initResponse) as { id?: string; key?: string; uploadId?: string; error?: string };
    if (!initResponse.ok || !init.id || !init.key || !init.uploadId) throw new Error(init.error ?? "No se pudo iniciar la subida");

    const chunkSize = 5 * 1024 * 1024;
    const totalParts = Math.ceil(selectedFile.size / chunkSize);
    const parts: Array<{ partNumber: number; etag: string }> = [];

    try {
      for (let index = 0; index < totalParts; index += 1) {
        const partNumber = index + 1;
        const chunk = selectedFile.slice(index * chunkSize, Math.min(selectedFile.size, (index + 1) * chunkSize));
        const query = new URLSearchParams({ key: init.key, uploadId: init.uploadId, partNumber: String(partNumber) });
        const partResponse = await fetch(`/api/files/multipart?${query.toString()}`, {
          method: "PUT",
          headers: { "content-type": "application/octet-stream" },
          body: chunk,
        });
        const part = await readJson(partResponse) as { partNumber?: number; etag?: string; error?: string };
        if (!partResponse.ok || !part.partNumber || !part.etag) throw new Error(part.error ?? `No se pudo subir la parte ${partNumber}`);
        parts.push({ partNumber: part.partNumber, etag: part.etag });
        setUploadProgress(Math.round((partNumber / (totalParts + 1)) * 100));
      }

      const completeResponse = await fetch("/api/files/multipart?action=complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: init.id, key: init.key, uploadId: init.uploadId, name: selectedFile.name, type: selectedFile.type || "application/pdf", size: selectedFile.size, parts }),
      });
      const completed = await readJson(completeResponse) as { attachment?: Attachment; error?: string };
      if (!completeResponse.ok || !completed.attachment) throw new Error(completed.error ?? "No se pudo completar la subida");
      setUploadProgress(100);
      return completed.attachment;
    } catch (reason) {
      const query = new URLSearchParams({ key: init.key, uploadId: init.uploadId });
      fetch(`/api/files/multipart?${query.toString()}`, { method: "DELETE" }).catch(() => undefined);
      throw reason;
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setUploading(true);
    setUploadProgress(0);
    setError("");
    try {
      let attachment = initialTest?.attachment ?? null;
      if (file) {
        if (file.size > 100 * 1024 * 1024) throw new Error("El archivo no puede superar 100 MB");
        attachment = file.size <= 6 * 1024 * 1024 ? await uploadDirect(file) : await uploadInParts(file);
      }
      const base = initialTest ?? { id: uid(), attempts: [], createdAt: nowIso(), attachment: null, name: "", category: "", totalQuestions: 0 };
      onSave({ ...base, name: name.trim(), category: category.trim(), totalQuestions: Math.max(0, total), attachment });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar");
      setUploading(false);
    }
  }

  return <ModalShell title={initialTest ? "Editar psicotécnico" : "Añadir psicotécnico"} subtitle={initialTest ? "Cambia los datos de la ficha sin perder el historial de intentos." : "Guarda el documento y registra todos tus intentos. Ningún campo es obligatorio."} label={initialTest ? "EDITAR" : "NUEVO"} onClose={onClose}><form onSubmit={submit}><label>Nombre <small>(opcional)</small><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Cuadernillo verbal 01" /></label><div className="form-grid"><label>Categoría<select value={category} onChange={(event) => setCategory(event.target.value)}><option>Razonamiento verbal</option><option>Razonamiento numérico</option><option>Razonamiento abstracto</option><option>Atención y percepción</option><option>Memoria</option><option>Mixto</option><option>Otro</option></select></label><label>Preguntas<input type="number" min="0" value={total} onChange={(event) => setTotal(Number(event.target.value))} /></label></div><label className="file-drop"><input type="file" accept="application/pdf,image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><span>⇧</span><strong>{file ? file.name : initialTest?.attachment?.name ? `Actual: ${initialTest.attachment.name}` : "Seleccionar PDF o imagen"}</strong><small>{initialTest?.attachment && !file ? "Selecciona otro archivo solo si quieres sustituirlo · " : ""}Máximo 100 MB</small></label>{uploading && <div className="upload-progress"><span style={{ width: `${uploadProgress}%` }} /><small>{uploadProgress}%</small></div>}{error && <p className="form-error">{error}</p>}<button className="primary-button full" disabled={uploading}>{uploading ? `Subiendo… ${uploadProgress}%` : initialTest ? "Guardar cambios" : "Guardar psicotécnico"}</button></form></ModalShell>;
}

function AttemptModal({ test, initialAttempt, onClose, onSave }: { test: PsychTest; initialAttempt: Attempt | null; onClose: () => void; onSave: (attempt: Attempt) => void }) {
  const [date, setDate] = useState(initialAttempt?.date.slice(0, 10) ?? todayKey());
  const [correct, setCorrect] = useState(initialAttempt?.correct ?? 0);
  const [wrong, setWrong] = useState(initialAttempt?.wrong ?? 0);
  const [blank, setBlank] = useState(initialAttempt?.blank ?? 0);
  const [minutes, setMinutes] = useState(initialAttempt?.minutes ?? 0);
  const [score, setScore] = useState(initialAttempt?.score ?? 0);
  const [notes, setNotes] = useState(initialAttempt?.notes ?? "");
  const registered = correct + wrong + blank;
  const expected = test.totalQuestions || 0;
  return <ModalShell title={initialAttempt ? "Editar intento" : "Registrar intento"} subtitle={test.name || "Psicotécnico sin nombre"} label={initialAttempt ? "EDITAR" : "NUEVO"} onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); const attemptDate = date ? new Date(`${date}T12:00:00`).toISOString() : nowIso(); onSave({ id: initialAttempt?.id ?? uid(), date: attemptDate, correct, wrong, blank, score, minutes, notes: notes.trim() }); }}><label>Fecha<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><div className="form-grid three"><label>Aciertos<input type="number" min="0" value={correct} onChange={(event) => setCorrect(Number(event.target.value))} /></label><label>Fallos<input type="number" min="0" value={wrong} onChange={(event) => setWrong(Number(event.target.value))} /></label><label>Blancas<input type="number" min="0" value={blank} onChange={(event) => setBlank(Number(event.target.value))} /></label></div><div className="form-grid"><label>Puntuación<input type="number" step="0.01" value={score} onChange={(event) => setScore(Number(event.target.value))} /></label><label>Tiempo (min)<input type="number" min="0" step="0.1" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} /></label></div><label>Notas<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Qué te ha costado, errores repetidos…" /></label><p className={`attempt-total ${expected && registered !== expected ? "warning" : ""}`}>Registradas: <strong>{registered}</strong>{expected ? ` de ${expected} preguntas` : " preguntas"}{expected && registered !== expected ? " · comprueba el total si procede" : ""}</p><button className="primary-button full">{initialAttempt ? "Guardar cambios" : "Guardar intento"}</button></form></ModalShell>;
}

function ActivityChart({ reviews }: { reviews: Review[] }) {
  const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - 6 + index); return date; });
  const values = days.map((day) => reviews.filter((review) => review.reviewedAt.startsWith(day.toISOString().slice(0, 10))).length);
  const max = Math.max(1, ...values);
  return <div className="activity-chart">{days.map((day, index) => <div key={day.toISOString()}><span className="bar-value">{values[index] || ""}</span><span className="bar" style={{ height: `${Math.max(7, (values[index] / max) * 150)}px` }} /><small>{new Intl.DateTimeFormat("es-ES", { weekday: "short" }).format(day).slice(0, 2)}</small></div>)}</div>;
}

function MemoryBreakdown({ cards }: { cards: Card[] }) {
  const fresh = cards.filter((card) => card.reviewCount === 0).length;
  const learning = cards.filter((card) => card.reviewCount > 0 && card.intervalDays < 7).length;
  const solid = cards.filter((card) => card.intervalDays >= 7 && card.intervalDays < 21).length;
  const mastered = cards.filter((card) => card.intervalDays >= 21).length;
  const total = Math.max(1, cards.length);
  const items = [{ label: "Nuevas", value: fresh, color: "#B8B7AE" }, { label: "Aprendiendo", value: learning, color: "#D89B55" }, { label: "Consolidadas", value: solid, color: "#6C8FA6" }, { label: "Dominadas", value: mastered, color: "#285943" }];
  return <div className="memory-breakdown"><div className="memory-donut" style={{ background: `conic-gradient(${items.map((item, index) => `${item.color} ${items.slice(0, index).reduce((sum, part) => sum + part.value, 0) / total * 100}% ${(items.slice(0, index + 1).reduce((sum, part) => sum + part.value, 0) / total) * 100}%`).join(",")})` }}><span><strong>{cards.length}</strong><small>tarjetas</small></span></div><div>{items.map((item) => <p key={item.label}><i style={{ background: item.color }} />{item.label}<strong>{item.value}</strong></p>)}</div></div>;
}

function streakDays(reviews: Review[]) {
  const days = new Set(reviews.map((review) => review.reviewedAt.slice(0, 10)));
  let streak = 0;
  const date = new Date();
  while (days.has(date.toISOString().slice(0, 10))) { streak += 1; date.setDate(date.getDate() - 1); }
  return streak;
}
