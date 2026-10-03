import { useEffect } from "react";
import type {
  ParsedImportItem,
  WrittenEvaluation,
} from "../../app/CardImportModal";
import type {
  OrthographyStudyCard,
  OrthographyStudyResult,
} from "../../app/OrthographyStudy";
import { plainRichText, sanitizeRichHtml } from "../../app/RichTextEditor";
import { applyFsrsReview } from "../../app/fsrs";
import {
  fitPersonalMemoryModel,
  predictPersonalRecall,
} from "../../app/memoryModel";

export type Tab = "today" | "library" | "study" | "psych" | "progress";

export type CardType = "basic" | "choice" | "test" | "orthography" | "written";

export type Rating = "again" | "hard" | "good" | "easy";

export type StudyMode = "recommended" | "random" | "all" | "learn" | "weakest";

export type ReviewQueueOutcome = "rated" | "unknown";

export type ReviewQueueItem = {
  cardId: string;
  reinforcement: boolean;
  reason: "scheduled" | "again" | "hard";
  completed?: boolean;
  outcome?: ReviewQueueOutcome;
};

export type PsychSort =
  | "oldest"
  | "recent"
  | "last-low"
  | "last-high"
  | "avg-low"
  | "avg-high"
  | "attempts-low"
  | "attempts-high"
  | "name";

export type StudyView = "today" | "tree" | "history";

export type StudyQueueMode = "grouped" | "list";

export type StudyTaskStatus = "pending" | "done";

export type StudyAssessment = "bien" | "regular" | "mal" | null;

export type StudyNode = {
  sortOrder?: number;
  sourceKey?: string;
  sourceFolderId?: string;
  sourceCardIds?: string[];
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
};

export type StudyTask = {
  planBucket?: "today" | "next";
  id: string;
  nodeId: string;
  plannedFor: string;
  note: string;
  reason: string;
  status: StudyTaskStatus;
  createdAt: string;
  completedAt: string | null;
  assessment: StudyAssessment;
  completionNote: string;
  sourceCardId?: string | null;
  queueOrder: number;
};

export type StudyImportNode = {
  id?: string;
  name: string;
  children: StudyImportNode[];
};

export type Folder = {
  sortOrder?: number;
  id: string;
  name: string;
  color: string;
  parentId: string | null;
  createdAt: string;
};

export type Card = {
  sortOrder?: number;
  fsrsState?: import("ts-fsrs").State;
  fsrsLearningSteps?: number;
  fsrsReps?: number;
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

export type Review = {
  schedulerVersion?: string;
  fsrsBefore?: ReturnType<typeof import("../../app/fsrs").fsrsSnapshot>;
  fsrsAfter?: ReturnType<typeof import("../../app/fsrs").fsrsSnapshot>;
  id: string;
  cardId: string;
  rating: Rating;
  correct: boolean;
  accuracy?: number;
  reviewedAt: string;
  responseMs?: number;
  sessionMode?: StudyMode;
  reinforcement?: boolean;
  predictedRecall?: number;
  fsrsRetrievability?: number;
};

export type Attachment = {
  id: string;
  key: string;
  name: string;
  type: string;
  size: number;
  url: string;
};

export type Attempt = {
  id: string;
  date: string;
  correct: number;
  wrong: number;
  blank: number;
  score: number;
  minutes: number;
  notes: string;
};

export type PsychTest = {
  id: string;
  name: string;
  category: string;
  totalQuestions: number;
  attachment: Attachment | null;
  attempts: Attempt[];
  createdAt: string;
};

export type AppState = {
  version: 1;
  folders: Folder[];
  cards: Card[];
  reviews: Review[];
  psychTests: PsychTest[];
  studyNodes: StudyNode[];
  studyTasks: StudyTask[];
  settings: {
    activeCardSession?: import("../memory/session").CardSession | null;
    dailyReviewGoal: number;
    dailyNewLimit: number;
    seedVersion?: number;
  };
};

export const colors = ["#285943", "#B66A3C", "#6F5B8C", "#2C6E8F", "#8A784D"];

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

export const nowIso = () => new Date().toISOString();

export const todayKey = () => localDateKey();

export const localDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const addDaysKey = (days: number) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
};

export const normalizeStudyLabel = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ");

export function studyNodePath(nodes: StudyNode[], nodeId: string) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const names: string[] = [];
  let current = byId.get(nodeId) ?? null;
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    names.unshift(current.name);
    current = current.parentId ? (byId.get(current.parentId) ?? null) : null;
  }
  return names;
}

export function studyNodeDepth(nodes: StudyNode[], nodeId: string) {
  return Math.max(0, studyNodePath(nodes, nodeId).length - 1);
}

export function studyDescendantIds(nodes: StudyNode[], rootId: string) {
  const ids = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
        ids.add(node.id);
        changed = true;
      }
    }
  }
  return ids;
}

export function flattenStudyTree(nodes: StudyNode[]) {
  const result: StudyNode[] = [];
  const walk = (parentId: string | null) => {
    nodes
      .filter((node) => node.parentId === parentId)
      .sort(
        (a, b) =>
          (a.sortOrder ?? nodes.indexOf(a)) - (b.sortOrder ?? nodes.indexOf(b)),
      )
      .forEach((node) => {
        result.push(node);
        walk(node.id);
      });
  };
  walk(null);
  return result;
}

export function studyImportRoots(value: unknown): StudyImportNode[] {
  const normalizeNode = (raw: any): StudyImportNode | null => {
    if (!raw || typeof raw !== "object") return null;
    const name = String(
      raw.name ?? raw.nombre ?? raw.title ?? raw.titulo ?? "",
    ).trim();
    if (!name) return null;
    const childrenRaw =
      raw.children ??
      raw.hijos ??
      raw.apartados ??
      raw.subapartados ??
      raw.items ??
      [];
    const children = Array.isArray(childrenRaw)
      ? (childrenRaw.map(normalizeNode).filter(Boolean) as StudyImportNode[])
      : [];
    return { id: raw.id ? String(raw.id) : undefined, name, children };
  };
  if (Array.isArray(value))
    return value.map(normalizeNode).filter(Boolean) as StudyImportNode[];
  if (!value || typeof value !== "object") return [];
  const raw: any = value;
  const collection =
    raw.topics ?? raw.temas ?? raw.tree ?? raw.arbol ?? raw.items;
  if (Array.isArray(collection))
    return collection.map(normalizeNode).filter(Boolean) as StudyImportNode[];
  const single = normalizeNode(raw);
  return single ? [single] : [];
}

export function parseStudyTextTree(raw: string): StudyImportNode[] {
  const source = raw.replace(/\r/g, "").trim();
  if (!source) return [];
  if (source.startsWith("{") || source.startsWith("[")) {
    try {
      return studyImportRoots(JSON.parse(source));
    } catch {
      /* fall through to text parser */
    }
  }
  const lines = source
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .filter((line) => line.trim());
  const roots: StudyImportNode[] = [];
  const stack: { rank: number; node: StudyImportNode }[] = [];
  const semanticRank = (text: string, bullet: boolean) => {
    const clean = normalizeStudyLabel(text);
    if (/^(tema|bloque)\b/.test(clean)) return 0;
    if (/^titulo\b/.test(clean)) return 10;
    if (/^capitulo\b/.test(clean)) return 20;
    if (/^seccion\b/.test(clean)) return 30;
    if (/^articulo\b/.test(clean)) return 40;
    if (bullet) return 50;
    return stack.length ? stack[stack.length - 1].rank + 1 : 0;
  };
  for (const rawLine of lines) {
    const expanded = rawLine.replace(/\t/g, "  ");
    const trimmed = expanded.trim();
    const bullet = /^[-*•–—]\s+/.test(trimmed);
    const text = trimmed
      .replace(/^[-*•–—]\s+/, "")
      .replace(/^\d+[.)]\s+/, "")
      .trim();
    if (!text) continue;
    const rank = semanticRank(text, bullet);
    const node: StudyImportNode = { name: text, children: [] };
    while (stack.length && stack[stack.length - 1].rank >= rank) stack.pop();
    if (stack.length) stack[stack.length - 1].node.children.push(node);
    else roots.push(node);
    stack.push({ rank, node });
  }
  return roots;
}

export function countStudyImportNodes(roots: StudyImportNode[]) {
  let total = 0;
  const walk = (nodes: StudyImportNode[]) =>
    nodes.forEach((node) => {
      total += 1;
      walk(node.children);
    });
  walk(roots);
  return total;
}

export function mergeStudyImport(
  existing: StudyNode[],
  roots: StudyImportNode[],
  rootParentId: string | null = null,
) {
  const nodes = [...existing];
  let created = 0;
  const mergeLevel = (items: StudyImportNode[], parentId: string | null) => {
    for (const item of items) {
      const key = normalizeStudyLabel(item.name);
      let node = item.id
        ? nodes.find((candidate) => candidate.id === item.id)
        : undefined;
      if (!node)
        node = nodes.find(
          (candidate) =>
            candidate.parentId === parentId &&
            normalizeStudyLabel(candidate.name) === key,
        );
      if (!node) {
        node = {
          id:
            item.id && !nodes.some((candidate) => candidate.id === item.id)
              ? item.id
              : uid(),
          name: item.name,
          parentId,
          createdAt: nowIso(),
        };
        nodes.push(node);
        created += 1;
      } else if (node.name !== item.name || node.parentId !== parentId) {
        const index = nodes.findIndex((candidate) => candidate.id === node!.id);
        nodes[index] = { ...node, name: item.name, parentId };
        node = nodes[index];
      }
      mergeLevel(item.children, node.id);
    }
  };
  const safeRootParentId =
    rootParentId && nodes.some((node) => node.id === rootParentId)
      ? rootParentId
      : null;
  mergeLevel(roots, safeRootParentId);
  return { nodes, created };
}

export function inferStudyNodeForCard(
  card: Card,
  nodes: StudyNode[],
  folders: Folder[],
) {
  if (!nodes.length) return null;
  const front = plainRichText(card.front);
  const article = front.match(/art(?:í|i)culo\s+(\d+(?:\.\d+)?)/i)?.[1];
  if (article) {
    const articleRe = new RegExp(
      `^art(?:í|i)culo\\s+${article.replace(".", "\\.")}(?:\\b|\\s|\\.)`,
      "i",
    );
    const articleNode = nodes.find((node) => articleRe.test(node.name));
    if (articleNode) return articleNode.id;
  }
  const folder = folders.find((item) => item.id === card.folderId);
  if (folder) {
    const folderKey = normalizeStudyLabel(folder.name);
    const candidates = nodes.filter(
      (node) => normalizeStudyLabel(node.name) === folderKey,
    );
    if (candidates.length)
      return candidates.sort(
        (a, b) => studyNodeDepth(nodes, b.id) - studyNodeDepth(nodes, a.id),
      )[0].id;
  }
  return null;
}

export function studyTreeForExport(nodes: StudyNode[], rootIds?: Set<string>) {
  nodes = flattenStudyTree(nodes);
  const allowed = rootIds ?? new Set(nodes.map((node) => node.id));
  const build = (parentId: string | null): any[] =>
    nodes
      .filter((node) => node.parentId === parentId && allowed.has(node.id))
      .map((node) => ({
        id: node.id,
        name: node.name,
        children: build(node.id),
      }));
  if (!rootIds) return build(null);
  const roots = nodes.filter(
    (node) =>
      allowed.has(node.id) && (!node.parentId || !allowed.has(node.parentId)),
  );
  const buildScoped = (node: StudyNode): any => ({
    id: node.id,
    name: node.name,
    children: nodes
      .filter((child) => child.parentId === node.id && allowed.has(child.id))
      .map(buildScoped),
  });
  return roots.map(buildScoped);
}

export const isMultipleChoiceType = (type: CardType) =>
  type === "choice" || type === "test";

export const isMultipleChoiceCard = (card: Card) =>
  isMultipleChoiceType(card.type);

export const isOrthographyCard = (card: Card) => card.type === "orthography";

export const isWrittenCard = (card: Card) => card.type === "written";

export const cardCorrectOptions = (card: Card) => {
  const values =
    Array.isArray(card.correctOptions) && card.correctOptions.length
      ? card.correctOptions
      : [card.correctOption];
  return [
    ...new Set(
      values.filter(
        (value) => Number.isInteger(value) && value >= 0 && value < 4,
      ),
    ),
  ].sort((a, b) => a - b);
};

export const isMultipleAnswerTest = (card: Card) =>
  card.type === "test" && cardCorrectOptions(card).length > 1;

export const sameNumberSet = (a: number[], b: number[]) =>
  a.length === b.length &&
  [...a]
    .sort((x, y) => x - y)
    .every((value, index) => value === [...b].sort((x, y) => x - y)[index]);

export const cardTypeLabel = (type: CardType) =>
  type === "orthography"
    ? "ORTO"
    : type === "written"
      ? "ESCRITA"
      : type === "test"
        ? "TEST"
        : type === "choice"
          ? "VOCAB"
          : "FLASHCARD";

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function importedBackHtml(item: ParsedImportItem) {
  const parts: string[] = [];
  if (
    (item.tipo === "flashcard" || item.tipo === "respuesta_escrita") &&
    item.respuesta
  )
    parts.push(`<p>${escapeHtml(item.respuesta).replaceAll("\n", "<br>")}</p>`);
  if (item.explicacion)
    parts.push(
      `<p><strong>Explicación:</strong> ${escapeHtml(item.explicacion).replaceAll("\n", "<br>")}</p>`,
    );
  const meta = [
    item.fuente
      ? `<span><strong>Fuente:</strong> ${escapeHtml(item.fuente)}</span>`
      : "",
  ].filter(Boolean);
  if (meta.length)
    parts.push(`<div class="imported-card-meta">${meta.join(" · ")}</div>`);
  return sanitizeRichHtml(parts.join(""));
}

export function orthographyBackHtml(
  word: string,
  isCorrect: boolean,
  correctForm: string,
  explanation: string,
  source: string,
) {
  const parts: string[] = [];
  if (isCorrect)
    parts.push(
      `<p><strong>${escapeHtml(correctForm || word)}</strong> está correctamente escrita.</p>`,
    );
  else
    parts.push(
      `<p><strong>${escapeHtml(word)}</strong> → <strong>${escapeHtml(correctForm)}</strong></p>`,
    );
  if (explanation)
    parts.push(`<p>${escapeHtml(explanation).replaceAll("\n", "<br>")}</p>`);
  if (source)
    parts.push(
      `<div class="imported-card-meta"><span><strong>Fuente:</strong> ${escapeHtml(source)}</span></div>`,
    );
  return sanitizeRichHtml(parts.join(""));
}

export const WRITTEN_RUBRIC_PREFIX = "__OPOGC_WRITTEN_RUBRIC__:";

export const WRITTEN_STATS_PREFIX = "__OPOGC_WRITTEN_STATS__:";

export type WrittenCriterionResult = {
  id: string;
  esperado: string;
  puntos: number;
  conseguido: number;
  cumplido: boolean;
  critico: boolean;
  similitud: number;
};

export type WrittenAnswerResult = {
  accuracy: number;
  rating: Rating;
  criteria: WrittenCriterionResult[];
  criticalMisses: string[];
};

export type WrittenStats = {
  attempts: number;
  totalAccuracy: number;
  recent: number[];
  criteria: Record<string, { attempts: number; hits: number }>;
};

export function encodeWrittenRubric(evaluation: WrittenEvaluation) {
  return `${WRITTEN_RUBRIC_PREFIX}${JSON.stringify(evaluation)}`;
}

export function writtenRubric(card: Card): WrittenEvaluation | null {
  if (!isWrittenCard(card)) return null;
  const raw = card.options.find((item) =>
    item.startsWith(WRITTEN_RUBRIC_PREFIX),
  );
  if (!raw) return null;
  try {
    return JSON.parse(
      raw.slice(WRITTEN_RUBRIC_PREFIX.length),
    ) as WrittenEvaluation;
  } catch {
    return null;
  }
}

export function zeroWrittenAnswerResult(
  card: Card,
): WrittenAnswerResult | null {
  const evaluation = writtenRubric(card);
  if (!evaluation) return null;
  return {
    accuracy: 0,
    rating: "again",
    criteria: evaluation.criterios.map((criterion) => ({
      id: criterion.id,
      esperado: criterion.esperado,
      puntos: criterion.puntos,
      conseguido: 0,
      cumplido: false,
      critico: criterion.critico,
      similitud: 0,
    })),
    criticalMisses: evaluation.criterios
      .filter((criterion) => criterion.critico)
      .map((criterion) => criterion.id),
  };
}

export function writtenStats(card: Card): WrittenStats {
  const empty: WrittenStats = {
    attempts: 0,
    totalAccuracy: 0,
    recent: [],
    criteria: {},
  };
  if (!isWrittenCard(card)) return empty;
  const raw = card.options.find((item) =>
    item.startsWith(WRITTEN_STATS_PREFIX),
  );
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(
      raw.slice(WRITTEN_STATS_PREFIX.length),
    ) as Partial<WrittenStats>;
    return {
      attempts: Math.max(0, Number(parsed.attempts ?? 0)),
      totalAccuracy: Math.max(0, Number(parsed.totalAccuracy ?? 0)),
      recent: Array.isArray(parsed.recent)
        ? parsed.recent.map(Number).filter(Number.isFinite).slice(-8)
        : [],
      criteria:
        parsed.criteria && typeof parsed.criteria === "object"
          ? parsed.criteria
          : {},
    };
  } catch {
    return empty;
  }
}

export function writtenAverageAccuracy(card: Card) {
  const stats = writtenStats(card);
  return stats.attempts ? stats.totalAccuracy / stats.attempts : null;
}

export function writtenRecentAccuracy(card: Card) {
  const stats = writtenStats(card);
  if (!stats.recent.length) return writtenAverageAccuracy(card);
  return (
    stats.recent.reduce((sum, value) => sum + value, 0) / stats.recent.length
  );
}

export function writtenAccuracyRisk(card: Card) {
  if (!isWrittenCard(card)) return 0;
  const accuracy = writtenRecentAccuracy(card);
  return accuracy === null ? 0.5 : Math.max(0, Math.min(1, 1 - accuracy / 100));
}

export function normalizeWrittenText(
  value: string,
  evaluation: WrittenEvaluation,
) {
  let result = value.trim();
  if (evaluation.normalizacion.ignorarMayusculas)
    result = result.toLocaleLowerCase("es");
  if (evaluation.normalizacion.ignorarAcentos)
    result = result.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (evaluation.normalizacion.ignorarPuntuacion)
    result = result.replace(/[^\p{L}\p{N}\s]/gu, " ");
  if (evaluation.normalizacion.ignorarEspaciosExtra)
    result = result.replace(/\s+/g, " ").trim();
  return result;
}

export function tokenCoverage(answer: string, candidate: string) {
  const expected = [...new Set(candidate.split(/\s+/).filter(Boolean))];
  if (!expected.length) return 0;
  const answerTokens = new Set(answer.split(/\s+/).filter(Boolean));
  return (
    expected.filter((token) => answerTokens.has(token)).length / expected.length
  );
}

export function evaluateWrittenAnswer(
  card: Card,
  answer: string,
): WrittenAnswerResult | null {
  const evaluation = writtenRubric(card);
  if (!evaluation) return null;
  const normalizedAnswer = normalizeWrittenText(answer, evaluation);
  const totalPoints = evaluation.criterios.reduce(
    (sum, criterion) => sum + Math.max(0, criterion.puntos),
    0,
  );
  if (!totalPoints) return null;

  const criteria: WrittenCriterionResult[] = evaluation.criterios.map(
    (criterion) => {
      const candidates = [criterion.esperado, ...criterion.alternativas]
        .map((candidate) => normalizeWrittenText(candidate, evaluation))
        .filter(Boolean);
      let bestSimilarity = 0;
      let passed = false;
      for (const candidate of candidates) {
        const exact = normalizedAnswer.includes(candidate);
        const similarity = exact
          ? 1
          : tokenCoverage(normalizedAnswer, candidate);
        bestSimilarity = Math.max(bestSimilarity, similarity);
        if (criterion.literal ? exact : similarity >= criterion.minimoSimilitud)
          passed = true;
      }
      return {
        id: criterion.id,
        esperado: criterion.esperado,
        puntos: criterion.puntos,
        // La nota usa precisión gradual aunque el criterio no llegue al umbral.
        // "cumplido" sigue siendo binario para aplicar criticidad y límites máximos.
        conseguido: passed
          ? criterion.puntos
          : criterion.puntos * bestSimilarity,
        cumplido: passed,
        critico: criterion.critico,
        similitud: bestSimilarity,
      };
    },
  );

  let accuracy = Math.round(
    (criteria.reduce((sum, criterion) => sum + criterion.conseguido, 0) /
      totalPoints) *
      100,
  );
  for (const [index, criterion] of evaluation.criterios.entries()) {
    if (criteria[index]?.cumplido) continue;
    if (criterion.maximoSiFalla !== null)
      accuracy = Math.min(accuracy, Math.round(criterion.maximoSiFalla));
  }
  accuracy = Math.max(0, Math.min(100, accuracy));

  const { otraVezHasta, dificilHasta, bienHasta } = evaluation.umbrales;
  const rating: Rating =
    accuracy <= otraVezHasta
      ? "again"
      : accuracy <= dificilHasta
        ? "hard"
        : accuracy <= bienHasta
          ? "good"
          : "easy";
  return {
    accuracy,
    rating,
    criteria,
    criticalMisses: criteria
      .filter((criterion) => criterion.critico && !criterion.cumplido)
      .map((criterion) => criterion.esperado),
  };
}

export function applyWrittenStats(card: Card, result: WrittenAnswerResult) {
  if (!isWrittenCard(card)) return card;
  const current = writtenStats(card);
  const criteria = { ...current.criteria };
  for (const item of result.criteria) {
    const previous = criteria[item.id] ?? { attempts: 0, hits: 0 };
    criteria[item.id] = {
      attempts: previous.attempts + 1,
      hits: previous.hits + (item.cumplido ? 1 : 0),
    };
  }
  const next: WrittenStats = {
    attempts: current.attempts + 1,
    totalAccuracy: current.totalAccuracy + result.accuracy,
    recent: [...current.recent, result.accuracy].slice(-8),
    criteria,
  };
  const options = card.options.filter(
    (item) => !item.startsWith(WRITTEN_STATS_PREFIX),
  );
  return {
    ...card,
    options: [...options, `${WRITTEN_STATS_PREFIX}${JSON.stringify(next)}`],
  };
}

export function initialState(): AppState {
  const vocabularyId = uid();
  const psychId = uid();
  const makeCard = (
    front: string,
    back: string,
    options: string[],
    correctOption: number,
  ): Card => ({
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
      {
        id: vocabularyId,
        name: "Vocabulario psicotécnico",
        color: colors[0],
        parentId: null,
        createdAt: nowIso(),
      },
      {
        id: psychId,
        name: "Conceptos del temario",
        color: colors[2],
        parentId: null,
        createdAt: nowIso(),
      },
    ],
    cards: [
      makeCard(
        "¿Qué significa LOCUAZ?",
        "Que habla mucho o con facilidad.",
        ["Reservado", "Hablador", "Inconstante", "Prudente"],
        1,
      ),
      makeCard(
        "¿Cuál es el sinónimo de EFÍMERO?",
        "Breve o de corta duración.",
        ["Duradero", "Breve", "Complejo", "Inmóvil"],
        1,
      ),
      makeCard(
        "¿Cuál es el antónimo de PARSIMONIA?",
        "Prisa o celeridad.",
        ["Calma", "Mesura", "Prisa", "Lentitud"],
        2,
      ),
    ],
    reviews: [],
    psychTests: [],
    studyNodes: [],
    studyTasks: [],
    settings: { dailyReviewGoal: 30, dailyNewLimit: 12, seedVersion: 0 },
  };
}

export function scheduleCard(card: Card, rating: Rating): Card {
  return applyFsrsReview(card, rating);
}

export const CONSTITUTION_FOLDER_NAME = "Tema 1: derecho constitucional";

export const CONSTITUTION_FOLDER_ID = "seed-tema-1-derecho-constitucional";

export type SeedCard = {
  id: string;
  front: string;
  back: string;
  type?: CardType;
  options?: string[];
  correctOption?: number;
};

export const constitutionSeedCards: SeedCard[] = [
  {
    id: "ce-pre-01",
    front:
      "<strong>Preámbulo:</strong> ¿cuáles son los seis verbos que ordenan la voluntad de la Nación española?",
    back: "<ol><li><strong>Garantizar</strong></li><li><strong>Consolidar</strong></li><li><strong>Proteger</strong></li><li><strong>Promover</strong></li><li><strong>Establecer</strong></li><li><strong>Colaborar</strong></li></ol>",
  },
  {
    id: "ce-pre-02",
    front: "Preámbulo · <strong>Garantizar</strong>: completa la idea.",
    back: "Garantizar la <strong>convivencia democrática</strong> dentro de la Constitución y de las leyes conforme a un <strong>orden económico y social justo</strong>.",
  },
  {
    id: "ce-pre-03",
    front:
      "Preámbulo · <strong>Consolidar</strong>: ¿qué se consolida y qué debe asegurar?",
    back: "Un <strong>Estado de Derecho</strong> que asegure el <strong>imperio de la ley</strong> como expresión de la voluntad popular.",
  },
  {
    id: "ce-pre-04",
    front: "Preámbulo · <strong>Proteger</strong>: ¿a quién y en qué ámbitos?",
    back: "A todos los españoles y pueblos de España en el ejercicio de los <strong>derechos humanos</strong>, sus <strong>culturas y tradiciones</strong>, <strong>lenguas</strong> e <strong>instituciones</strong>.",
  },
  {
    id: "ce-pre-05",
    front:
      "Preámbulo · <strong>Promover</strong>: ¿qué progreso y con qué finalidad?",
    back: "El progreso de la <strong>cultura y de la economía</strong> para asegurar a todos una <strong>digna calidad de vida</strong>.",
  },
  {
    id: "ce-pre-06",
    front:
      "Preámbulo · <strong>Establecer</strong> y <strong>Colaborar</strong>: ¿qué dos objetivos finales se proclaman?",
    back: "<ul><li>Establecer una <strong>sociedad democrática avanzada</strong>.</li><li>Colaborar en el fortalecimiento de unas <strong>relaciones pacíficas</strong> y de <strong>eficaz cooperación</strong> entre todos los pueblos de la Tierra.</li></ul>",
  },
  {
    id: "ce-a1-01",
    front:
      "<strong>Artículo 1.1 CE:</strong> ¿cómo se constituye España y cuáles son los valores superiores?",
    back: "España se constituye en un <strong>Estado social y democrático de Derecho</strong>.<br><br>Valores superiores: <strong>libertad, justicia, igualdad y pluralismo político</strong>.",
  },
  {
    id: "ce-a1-02",
    front:
      "<strong>Artículo 1.2 CE:</strong> ¿dónde reside la soberanía nacional?",
    back: "En el <strong>pueblo español</strong>, del que emanan los poderes del Estado.",
  },
  {
    id: "ce-a1-03",
    front:
      "<strong>Artículo 1.3 CE:</strong> ¿cuál es la forma política del Estado español?",
    back: "La <strong>Monarquía parlamentaria</strong>.",
  },
  {
    id: "ce-a2-01",
    front:
      "<strong>Artículo 2 CE:</strong> ¿en qué tres ideas se apoya el precepto?",
    back: "<ul><li><strong>Indisoluble unidad</strong> de la Nación española.</li><li>Derecho a la <strong>autonomía</strong> de nacionalidades y regiones.</li><li><strong>Solidaridad</strong> entre todas ellas.</li></ul>",
  },
  {
    id: "ce-a2-02",
    front:
      "Artículo 2 CE: completa: «Nación española, patria común e ____ de todos los españoles». ",
    back: "<strong>Indivisible</strong>.",
  },
  {
    id: "ce-a3-01",
    front:
      "<strong>Artículo 3.1 CE:</strong> castellano: ¿qué deber y qué derecho tienen todos los españoles?",
    back: "<ul><li><strong>Deber de conocerla</strong>.</li><li><strong>Derecho a usarla</strong>.</li></ul>",
  },
  {
    id: "ce-a3-02",
    front:
      "<strong>Artículo 3.2 CE:</strong> ¿cuándo serán oficiales las demás lenguas españolas?",
    back: "En las respectivas <strong>Comunidades Autónomas</strong>, de acuerdo con sus <strong>Estatutos</strong>.",
  },
  {
    id: "ce-a3-03",
    front:
      "<strong>Artículo 3.3 CE:</strong> ¿cómo califica la Constitución la riqueza de las modalidades lingüísticas?",
    back: "Como un <strong>patrimonio cultural</strong> que será objeto de especial <strong>respeto y protección</strong>.",
  },
  {
    id: "ce-a4-01",
    front: "<strong>Artículo 4.1 CE:</strong> describe la bandera de España.",
    back: "Tres franjas horizontales: <strong>roja, amarilla y roja</strong>; la amarilla tiene <strong>doble anchura</strong> que cada una de las rojas.",
  },
  {
    id: "ce-a4-02",
    front:
      "<strong>Artículo 4.2 CE:</strong> ¿qué pueden reconocer los Estatutos y cómo se utilizan?",
    back: "Pueden reconocer <strong>banderas y enseñas propias</strong> de las CCAA. Se utilizarán <strong>junto a la bandera de España</strong> en sus edificios públicos y actos oficiales.",
  },
  {
    id: "ce-a5-01",
    front: "<strong>Artículo 5 CE:</strong> ¿cuál es la capital del Estado?",
    back: "La <strong>villa de Madrid</strong>.",
  },
  {
    id: "ce-a6-01",
    front:
      "<strong>Artículo 6 CE:</strong> ¿qué tres funciones cumplen los partidos políticos?",
    back: "<ul><li>Expresan el <strong>pluralismo político</strong>.</li><li>Concurren a la <strong>formación y manifestación de la voluntad popular</strong>.</li><li>Son instrumento fundamental para la <strong>participación política</strong>.</li></ul>",
  },
  {
    id: "ce-a6-02",
    front:
      "Artículo 6 CE: creación, actividad, estructura y funcionamiento de los partidos.",
    back: "Creación y actividad: <strong>libres</strong> dentro del respeto a la Constitución y a la ley.<br>Estructura interna y funcionamiento: deberán ser <strong>democráticos</strong>.",
  },
  {
    id: "ce-a7-01",
    front:
      "<strong>Artículo 7 CE:</strong> ¿a qué contribuyen sindicatos y asociaciones empresariales?",
    back: "A la <strong>defensa y promoción de los intereses económicos y sociales</strong> que les son propios.",
  },
  {
    id: "ce-a7-02",
    front:
      "Artículo 7 CE: ¿qué exige sobre su creación, actividad y organización interna?",
    back: "Creación y actividad <strong>libres</strong> dentro del respeto a la Constitución y a la ley; estructura interna y funcionamiento <strong>democráticos</strong>.",
  },
  {
    id: "ce-a8-01",
    front:
      "<strong>Artículo 8.1 CE:</strong> ¿qué cuerpos constituyen las Fuerzas Armadas?",
    back: "<ul><li>Ejército de Tierra.</li><li>Armada.</li><li>Ejército del Aire.</li></ul>",
  },
  {
    id: "ce-a8-02",
    front:
      "<strong>Artículo 8.1 CE:</strong> ¿cuáles son las tres misiones de las Fuerzas Armadas?",
    back: "<ul><li>Garantizar la <strong>soberanía e independencia</strong> de España.</li><li>Defender su <strong>integridad territorial</strong>.</li><li>Defender el <strong>ordenamiento constitucional</strong>.</li></ul>",
  },
  {
    id: "ce-a8-03",
    front:
      "<strong>Artículo 8.2 CE:</strong> ¿qué norma regula las bases de la organización militar?",
    back: "Una <strong>ley orgánica</strong>, conforme a los principios de la Constitución.",
  },
  {
    id: "ce-a9-01",
    front:
      "<strong>Artículo 9.1 CE:</strong> ¿quiénes están sujetos a la Constitución y al resto del ordenamiento jurídico?",
    back: "Los <strong>ciudadanos</strong> y los <strong>poderes públicos</strong>.",
  },
  {
    id: "ce-a9-02",
    front:
      "<strong>Artículo 9.2 CE:</strong> ¿qué corresponde promover a los poderes públicos?",
    back: "Las condiciones para que la <strong>libertad y la igualdad</strong> del individuo y de los grupos en que se integra sean <strong>reales y efectivas</strong>.",
  },
  {
    id: "ce-a9-03",
    front:
      "Artículo 9.2 CE: además de promover condiciones, ¿qué dos actuaciones deben realizar los poderes públicos?",
    back: "<ul><li><strong>Remover los obstáculos</strong> que impidan o dificulten la plenitud de libertad e igualdad.</li><li><strong>Facilitar la participación</strong> de todos los ciudadanos en la vida política, económica, cultural y social.</li></ul>",
  },
  {
    id: "ce-a9-04",
    front:
      "<strong>Artículo 9.3 CE:</strong> enumera los principios y garantías constitucionales.",
    back: "<ul><li>Legalidad.</li><li>Jerarquía normativa.</li><li>Publicidad de las normas.</li><li>Irretroactividad de disposiciones sancionadoras no favorables o restrictivas de derechos individuales.</li><li>Seguridad jurídica.</li><li>Responsabilidad.</li><li>Interdicción de la arbitrariedad de los poderes públicos.</li></ul>",
  },
  {
    id: "ce-a9-05",
    front:
      "Artículo 9.3 CE: ¿qué tipo de disposiciones tienen garantizada la <strong>irretroactividad</strong>?",
    back: "Las disposiciones <strong>sancionadoras no favorables</strong> o <strong>restrictivas de derechos individuales</strong>.",
  },
];

export function normalizeAndSeed(state: AppState) {
  let changed = false;
  const seedVersion = Number(state.settings.seedVersion ?? 0);
  let folders = [...state.folders];
  const studyNodes: StudyNode[] = Array.isArray((state as any).studyNodes)
    ? (state as any).studyNodes
        .map((node: any) => ({
          ...node,
          id: String(node.id),
          name: String(node.name ?? ""),
          parentId: node.parentId ? String(node.parentId) : null,
          createdAt: String(node.createdAt ?? nowIso()),
        }))
        .filter((node: StudyNode) => node.id && node.name.trim())
    : [];
  if (
    Array.isArray((state as any).studyTasks) &&
    (state as any).studyTasks.some(
      (task: any) =>
        !Number.isFinite(Number(task?.queueOrder)) ||
        typeof task?.completionNote !== "string",
    )
  )
    changed = true;
  const studyTasks: StudyTask[] = Array.isArray((state as any).studyTasks)
    ? (state as any).studyTasks
        .map((task: any, index: number) => ({
          ...task,
          id: String(task.id),
          nodeId: String(task.nodeId),
          plannedFor: String(task.plannedFor ?? localDateKey()),
          note: String(task.note ?? ""),
          reason: String(task.reason ?? ""),
          status: task.status === "done" ? "done" : "pending",
          createdAt: String(task.createdAt ?? nowIso()),
          completedAt: task.completedAt ? String(task.completedAt) : null,
          assessment:
            task.assessment === "bien" ||
            task.assessment === "regular" ||
            task.assessment === "mal"
              ? task.assessment
              : null,
          completionNote: String(task.completionNote ?? ""),
          sourceCardId: task.sourceCardId ? String(task.sourceCardId) : null,
          queueOrder: Number.isFinite(Number(task.queueOrder))
            ? Number(task.queueOrder)
            : index,
        }))
        .filter((task: StudyTask) => task.id && task.nodeId)
    : [];
  if (
    !Array.isArray((state as any).studyNodes) ||
    !Array.isArray((state as any).studyTasks)
  )
    changed = true;
  let cards = state.cards.map((card) => {
    const normalized = {
      ...card,
      attachment: card.attachment ?? null,
      correctOptions:
        Array.isArray(card.correctOptions) && card.correctOptions.length
          ? card.correctOptions
          : isMultipleChoiceType(card.type)
            ? [Number(card.correctOption ?? 0)]
            : [],
      fsrsStability: Number(
        card.fsrsStability ??
          (card.reviewCount > 0 ? Math.max(1, card.intervalDays || 1) : 0),
      ),
      fsrsDifficulty: Number(
        card.fsrsDifficulty ?? (card.reviewCount > 0 ? 5 : 0),
      ),
      orthographyIsCorrect:
        typeof card.orthographyIsCorrect === "boolean"
          ? card.orthographyIsCorrect
          : null,
      orthographyCorrectForm: String(card.orthographyCorrectForm ?? ""),
      orthographyExplanation: String(card.orthographyExplanation ?? ""),
      orthographySource: String(card.orthographySource ?? ""),
      orthographyStage: Math.max(1, Number(card.orthographyStage ?? 1)),
    };
    if (
      card.attachment === undefined ||
      card.correctOptions === undefined ||
      card.fsrsStability === undefined ||
      card.fsrsDifficulty === undefined ||
      card.orthographyIsCorrect === undefined ||
      card.orthographyCorrectForm === undefined ||
      card.orthographyStage === undefined
    )
      changed = true;
    return normalized;
  });

  let theme = folders.find(
    (item) =>
      !item.parentId &&
      item.name.trim().toLocaleLowerCase("es") ===
        CONSTITUTION_FOLDER_NAME.toLocaleLowerCase("es"),
  );

  if (seedVersion < 1) {
    if (!theme) {
      theme = {
        id: CONSTITUTION_FOLDER_ID,
        name: CONSTITUTION_FOLDER_NAME,
        color: "#2C6E8F",
        parentId: null,
        createdAt: nowIso(),
      };
      folders.push(theme);
      changed = true;
    }
    const existing = new Set(cards.map((card) => card.id));
    for (const seed of constitutionSeedCards) {
      if (existing.has(seed.id)) continue;
      cards.push({
        id: seed.id,
        folderId: theme.id,
        type: seed.type ?? "basic",
        front: seed.front,
        back: seed.back,
        options: seed.options ?? [],
        correctOption: seed.correctOption ?? 0,
        correctOptions:
          seed.type && seed.type !== "basic" ? [seed.correctOption ?? 0] : [],
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
      });
      changed = true;
    }
  }

  // V8: reorganiza únicamente las tarjetas semilla que ya existan; no resucita tarjetas borradas.
  if (seedVersion < 2) {
    theme =
      theme ??
      folders.find(
        (item) =>
          !item.parentId &&
          item.name.trim().toLocaleLowerCase("es") ===
            CONSTITUTION_FOLDER_NAME.toLocaleLowerCase("es"),
      );
    const hasSeedCards = cards.some(
      (card) => card.id.startsWith("ce-pre-") || /^ce-a[1-9]-/.test(card.id),
    );
    if (theme && hasSeedCards) {
      let preamble = folders.find(
        (folder) =>
          folder.parentId === theme!.id &&
          folder.name.toLocaleLowerCase("es") === "preámbulo",
      );
      let preliminary = folders.find(
        (folder) =>
          folder.parentId === theme!.id &&
          folder.name.toLocaleLowerCase("es") === "título preliminar",
      );
      if (!preamble) {
        preamble = {
          id: "seed-subtema-preambulo",
          name: "Preámbulo",
          color: theme.color,
          parentId: theme.id,
          createdAt: nowIso(),
        };
        folders.push(preamble);
      }
      if (!preliminary) {
        preliminary = {
          id: "seed-subtema-titulo-preliminar",
          name: "Título Preliminar",
          color: theme.color,
          parentId: theme.id,
          createdAt: nowIso(),
        };
        folders.push(preliminary);
      }
      cards = cards.map((card) =>
        card.id.startsWith("ce-pre-")
          ? { ...card, folderId: preamble!.id }
          : /^ce-a[1-9]-/.test(card.id)
            ? { ...card, folderId: preliminary!.id }
            : card,
      );
      changed = true;
    }
  }

  const nextSeedVersion = Math.max(seedVersion, 2);
  if (nextSeedVersion !== seedVersion) changed = true;
  return {
    state: {
      ...state,
      folders,
      cards,
      studyNodes,
      studyTasks,
      settings: { ...state.settings, seedVersion: nextSeedVersion },
    },
    changed,
  };
}

export function isStudyableCard(card: Card) {
  return Boolean(
    card.front.trim() ||
    card.back.trim() ||
    card.options.some((option) => option.trim()),
  );
}

export function scoreLabel(value: number) {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(
    value,
  );
}

export function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function psychStats(test: PsychTest) {
  const attempts = [...test.attempts].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const last = attempts[0] ?? null;
  const best = attempts.length
    ? Math.max(...attempts.map((attempt) => attempt.score))
    : null;
  const average = attempts.length
    ? attempts.reduce((sum, attempt) => sum + attempt.score, 0) /
      attempts.length
    : null;
  return { attempts, last, best, average };
}

export function sortPsychTests(tests: PsychTest[], sort: PsychSort) {
  const result = [...tests];
  const stats = (test: PsychTest) => psychStats(test);
  result.sort((a, b) => {
    const aStats = stats(a);
    const bStats = stats(b);
    if (sort === "name")
      return (a.name || "Sin nombre").localeCompare(
        b.name || "Sin nombre",
        "es",
        { sensitivity: "base" },
      );
    if (sort === "attempts-low")
      return (
        a.attempts.length - b.attempts.length ||
        a.createdAt.localeCompare(b.createdAt)
      );
    if (sort === "attempts-high")
      return (
        b.attempts.length - a.attempts.length ||
        a.createdAt.localeCompare(b.createdAt)
      );
    if (sort === "oldest") {
      if (!aStats.last && bStats.last) return -1;
      if (aStats.last && !bStats.last) return 1;
      return (aStats.last?.date ?? a.createdAt).localeCompare(
        bStats.last?.date ?? b.createdAt,
      );
    }
    if (sort === "recent") {
      if (!aStats.last && bStats.last) return 1;
      if (aStats.last && !bStats.last) return -1;
      return (bStats.last?.date ?? b.createdAt).localeCompare(
        aStats.last?.date ?? a.createdAt,
      );
    }
    const aValue = sort.startsWith("avg")
      ? aStats.average
      : (aStats.last?.score ?? null);
    const bValue = sort.startsWith("avg")
      ? bStats.average
      : (bStats.last?.score ?? null);
    if (aValue === null && bValue !== null) return 1;
    if (aValue !== null && bValue === null) return -1;
    if (aValue === null || bValue === null) return 0;
    return sort.endsWith("low") ? aValue - bValue : bValue - aValue;
  });
  return result;
}

export function shuffled<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

export type LearnStat = {
  seen: number;
  again: number;
  hard: number;
  good: number;
  easy: number;
  cooldownUntil: number;
};

export function descendantFolderIds(folders: Folder[], folderId: string) {
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

export function flattenFolderTree(folders: Folder[]) {
  const result: { folder: Folder; depth: number }[] = [];
  const seen = new Set<string>();
  const walk = (parentId: string | null, depth: number) => {
    for (const folder of folders
      .filter((item) => (item.parentId ?? null) === parentId)
      .sort(
        (a, b) =>
          (a.sortOrder ?? folders.indexOf(a)) -
          (b.sortOrder ?? folders.indexOf(b)),
      )) {
      if (seen.has(folder.id)) continue;
      seen.add(folder.id);
      result.push({ folder, depth });
      walk(folder.id, depth + 1);
    }
  };
  walk(null, 0);
  // Keep any legacy/orphan folders reachable in selectors instead of hiding them.
  for (const folder of folders) {
    if (seen.has(folder.id)) continue;
    seen.add(folder.id);
    result.push({ folder, depth: 0 });
    walk(folder.id, 1);
  }
  return result;
}

export function folderPathLabel(folders: Folder[], folderId: string) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const names: string[] = [];
  const seen = new Set<string>();
  let current = byId.get(folderId) ?? null;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    names.unshift(current.name);
    current = current.parentId ? (byId.get(current.parentId) ?? null) : null;
  }
  return names.join(" › ");
}

export function cardsInFolderScope(state: AppState, folderId?: string) {
  if (!folderId) return state.cards.filter(isStudyableCard);
  const ids = descendantFolderIds(state.folders, folderId);
  return state.cards.filter(
    (card) => ids.has(card.folderId) && isStudyableCard(card),
  );
}

export const isContinuousStudyMode = (mode: StudyMode) =>
  mode === "learn" || mode === "weakest";

export function failureCount(cardId: string, reviews: Review[]) {
  return reviews.reduce(
    (count, review) =>
      count + (review.cardId === cardId && !review.correct ? 1 : 0),
    0,
  );
}

export function recentFailureCount(
  cardId: string,
  reviews: Review[],
  take = 8,
) {
  return reviews
    .filter((review) => review.cardId === cardId)
    .slice(-take)
    .reduce((count, review) => count + (!review.correct ? 1 : 0), 0);
}

export function weaknessScore(
  card: Card,
  reviews: Review[],
  model: ReturnType<typeof fitPersonalMemoryModel>,
  now = new Date(),
) {
  const failures = failureCount(card.id, reviews);
  const writtenRisk = writtenAccuracyRisk(card);
  const hasWrittenEvidence = writtenAverageAccuracy(card) !== null;
  if (!failures && (!hasWrittenEvidence || writtenRisk <= 0.05)) return 0;
  const cardReviews = reviews.filter((review) => review.cardId === card.id);
  const failRate = cardReviews.length ? failures / cardReviews.length : 0;
  const recentFailures = recentFailureCount(card.id, reviews);
  const recall = predictPersonalRecall(card, reviews, model, now).probability;
  return (
    failRate * 5 +
    recentFailures * 1.45 +
    Math.min(failures, 8) * 0.7 +
    Math.min(card.lapses, 6) * 0.75 +
    (1 - recall) * 2.2 +
    writtenRisk * 4.2
  );
}

export function weakestStudyCards(
  cards: Card[],
  reviews: Review[],
  model: ReturnType<typeof fitPersonalMemoryModel>,
) {
  const now = new Date();
  const failed = cards
    .filter(
      (card) =>
        failureCount(card.id, reviews) > 0 ||
        (writtenAverageAccuracy(card) !== null &&
          writtenAccuracyRisk(card) > 0.05),
    )
    .sort(
      (a, b) =>
        weaknessScore(b, reviews, model, now) -
        weaknessScore(a, reviews, model, now),
    )
    .slice(0, 30);
  if (!failed.length) return [];

  // Si aún hay muy pocas falladas, añadimos hasta 4 tarjetas de apoyo para evitar
  // repetir la misma de forma inmediata y confundir memoria de trabajo con aprendizaje.
  if (failed.length < 4) {
    const failedIds = new Set(failed.map((card) => card.id));
    const support = cards
      .filter((card) => card.reviewCount > 0 && !failedIds.has(card.id))
      .sort(
        (a, b) =>
          predictPersonalRecall(a, reviews, model, now).probability -
          predictPersonalRecall(b, reviews, model, now).probability,
      )
      .slice(0, 4 - failed.length);
    return [...failed, ...support];
  }
  return failed;
}

export function chooseLearnCard(
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
    return (
      (!stat || stat.cooldownUntil <= turn) &&
      (cards.length <= 1 || card.id !== excludeId)
    );
  });
  const pool = allowed.length
    ? allowed
    : cards.filter((card) => cards.length <= 1 || card.id !== excludeId);
  const finalPool = pool.length ? pool : cards;
  return (
    [...finalPool].sort((a, b) => {
      const score = (card: Card) => {
        const stat = stats.get(card.id);
        const recall = predictPersonalRecall(
          card,
          reviews,
          model,
          now,
        ).probability;
        const failRate =
          card.reviewCount > 0
            ? 1 - card.successCount / Math.max(1, card.reviewCount)
            : 0.45;
        const writtenRisk = writtenAccuracyRisk(card);
        const unseenBoost = !stat || stat.seen === 0 ? 0.9 : 0;
        const sessionBoost = stat
          ? stat.again * 2.7 +
            stat.hard * 1.35 -
            stat.good * 0.28 -
            stat.easy * 1.55
          : 0;
        return (
          0.35 +
          (1 - recall) * 2.4 +
          failRate * 1.25 +
          writtenRisk * 2.6 +
          unseenBoost +
          sessionBoost +
          Math.random() * 0.18
        );
      };
      return score(b) - score(a);
    })[0] ?? null
  );
}

export type OrthographySessionStat = {
  seen: number;
  correct: number;
  wrong: number;
  cooldownUntil: number;
};

export type OrthographySessionState = {
  folderId: string | null;
  mode: StudyMode;
  groupIds: string[];
  results: OrthographyStudyResult[] | null;
  groupNumber: number;
  responses: number;
  correctResponses: number;
  scopeLabel: string;
};

export function orthographyCardWeight(
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
  const due =
    card.reviewCount > 0 && new Date(card.dueAt).getTime() <= now.getTime();
  const recall = predictPersonalRecall(card, reviews, model, now).probability;
  const failRate =
    card.reviewCount > 0
      ? 1 - card.successCount / Math.max(1, card.reviewCount)
      : 0.45;
  const failures = failureCount(card.id, reviews);
  const recentFailures = recentFailureCount(card.id, reviews);
  const sessionWrong = stat?.wrong ?? 0;
  const sessionCorrect = stat?.correct ?? 0;
  const newBoost = card.reviewCount === 0 ? 4.2 : 0;
  const dueBoost = due ? 6.2 : 0;
  const difficultyBoost =
    failRate * 3 + Math.min(5, card.lapses) * 0.55 + (1 - recall) * 2.4;
  const sessionBoost = sessionWrong * 3.2 - sessionCorrect * 0.45;
  const unseenBoost = !stat || stat.seen === 0 ? 1.3 : 0;
  const weakestBoost =
    mode === "weakest"
      ? failures > 0
        ? 8 +
          failRate * 7 +
          recentFailures * 2.2 +
          Math.min(failures, 8) * 0.9 +
          Math.min(card.lapses, 6)
        : -0.55
      : 0;
  let weight =
    0.8 +
    dueBoost +
    newBoost +
    difficultyBoost +
    sessionBoost +
    unseenBoost +
    weakestBoost;
  if (stat && stat.cooldownUntil > turn) weight *= 0.14;
  if (previousIds.has(card.id) && sessionWrong <= sessionCorrect)
    weight *= 0.28;
  if (mode === "all" && (!stat || stat.seen === 0)) weight += 2.2;
  return Math.max(0.08, weight);
}

export function chooseOrthographyGroup(
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
  const ready = orthographyCards.filter(
    (card) => (stats.get(card.id)?.cooldownUntil ?? 0) <= turn,
  );
  let available = [...(ready.length >= targetSize ? ready : orthographyCards)];
  const selected: Card[] = [];

  while (selected.length < targetSize && available.length) {
    const weights = available.map((card) =>
      orthographyCardWeight(
        card,
        reviews,
        model,
        stats.get(card.id),
        turn,
        previousIds,
        mode,
      ),
    );
    const total = weights.reduce((sum, value) => sum + value, 0);
    let pick = Math.random() * total;
    let index = available.length - 1;
    for (
      let candidateIndex = 0;
      candidateIndex < available.length;
      candidateIndex += 1
    ) {
      pick -= weights[candidateIndex];
      if (pick <= 0) {
        index = candidateIndex;
        break;
      }
    }
    selected.push(available[index]);
    available.splice(index, 1);
  }

  if (
    selected.length === targetSize &&
    targetSize >= 3 &&
    Math.random() < 0.68
  ) {
    const allCorrect = selected.every(
      (card) => card.orthographyIsCorrect === true,
    );
    const allIncorrect = selected.every(
      (card) => card.orthographyIsCorrect === false,
    );
    if (allCorrect || allIncorrect) {
      const desired = allCorrect ? false : true;
      const alternatives = orthographyCards.filter(
        (card) =>
          card.orthographyIsCorrect === desired &&
          !selected.some((item) => item.id === card.id),
      );
      if (alternatives.length) {
        const replacement =
          alternatives[Math.floor(Math.random() * alternatives.length)];
        selected[selected.length - 1] = replacement;
      }
    }
  }

  return shuffled(selected);
}

export function useStableOverlaySurfaces() {
  useEffect(() => {
    const doc = document.documentElement;
    const body = document.body;
    const blockingSelector =
      ".review-overlay, .modal-backdrop, .pdf-editor, .image-annotator, .answer-image-lightbox, .sheet-backdrop, .study-session, .settings-screen";
    let locked = false;
    let savedScrollX = 0;
    let savedScrollY = 0;
    let savedReviewScroll = 0;
    let savedBodyStyles: Partial<
      Record<
        | "position"
        | "top"
        | "left"
        | "right"
        | "width"
        | "overflow"
        | "paddingRight",
        string
      >
    > = {};

    const readReviewScroll = () => {
      const stage = document.querySelector<HTMLElement>(".review-stage");
      if (stage) savedReviewScroll = stage.scrollTop;
    };

    const restoreReviewScroll = () => {
      const stage = document.querySelector<HTMLElement>(".review-stage");
      if (!stage) return;
      requestAnimationFrame(() => {
        stage.scrollTop = savedReviewScroll;
        requestAnimationFrame(() => {
          stage.scrollTop = savedReviewScroll;
        });
      });
    };

    const lock = () => {
      if (locked) return;
      locked = true;
      savedScrollX = 0; // OpoGC has no horizontal document scrolling; keep mobile focus from shifting the page.
      savedScrollY = window.scrollY;
      readReviewScroll();
      savedBodyStyles = {
        position: body.style.position,
        top: body.style.top,
        left: body.style.left,
        right: body.style.right,
        width: body.style.width,
        overflow: body.style.overflow,
        paddingRight: body.style.paddingRight,
      };
      const scrollbar = Math.max(0, window.innerWidth - doc.clientWidth);
      doc.classList.add("opogc-surface-locked");
      body.classList.add("opogc-surface-locked");
      body.style.position = "fixed";
      body.style.top = `-${savedScrollY}px`;
      body.style.left = `-${savedScrollX}px`;
      body.style.right = "0";
      body.style.width = "100%";
      body.style.overflow = "hidden";
      if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    };

    const unlock = () => {
      if (!locked) return;
      locked = false;
      doc.classList.remove("opogc-surface-locked");
      body.classList.remove("opogc-surface-locked");
      body.style.position = savedBodyStyles.position ?? "";
      body.style.top = savedBodyStyles.top ?? "";
      body.style.left = savedBodyStyles.left ?? "";
      body.style.right = savedBodyStyles.right ?? "";
      body.style.width = savedBodyStyles.width ?? "";
      body.style.overflow = savedBodyStyles.overflow ?? "";
      body.style.paddingRight = savedBodyStyles.paddingRight ?? "";
      window.scrollTo(savedScrollX, savedScrollY);
    };

    const syncLock = () => {
      const shouldLock = Boolean(document.querySelector(blockingSelector));
      if (shouldLock) lock();
      else unlock();
    };

    const onSuspend = () => {
      if (document.querySelector(".review-overlay")) readReviewScroll();
    };
    const onResume = () => {
      if (document.querySelector(".review-overlay")) restoreReviewScroll();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onSuspend();
      else onResume();
    };

    const observer = new MutationObserver(syncLock);
    observer.observe(body, { childList: true, subtree: true });
    window.addEventListener("blur", onSuspend);
    window.addEventListener("focus", onResume);
    window.addEventListener("pagehide", onSuspend);
    window.addEventListener("pageshow", onResume);
    document.addEventListener("visibilitychange", onVisibility);
    syncLock();

    return () => {
      observer.disconnect();
      window.removeEventListener("blur", onSuspend);
      window.removeEventListener("focus", onResume);
      window.removeEventListener("pagehide", onSuspend);
      window.removeEventListener("pageshow", onResume);
      document.removeEventListener("visibilitychange", onVisibility);
      unlock();
    };
  }, []);
}

export function orthographyStudyCard(card: Card): OrthographyStudyCard {
  return {
    id: card.id,
    word: plainRichText(card.front),
    isCorrect: card.orthographyIsCorrect === true,
    correctForm: card.orthographyCorrectForm || plainRichText(card.front),
    explanation: card.orthographyExplanation || "",
    source: card.orthographySource || "",
  };
}
