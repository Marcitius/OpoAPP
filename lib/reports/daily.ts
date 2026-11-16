import type { AppState, Card, Review } from "../study/legacy";
import { plainRichText } from "../../app/RichTextEditor";
import {
  gradeIndex,
  uniqueReviews,
  validScore,
  scoreGroup,
} from "../memory/grades";
import { savedCardSessions } from "../memory/checkpoint";
import { sessionSummary } from "../memory/session";

const dateFormatters = new Map<string, Intl.DateTimeFormat>();
export function dayInZone(
  value: string | number | Date,
  timeZone: string,
): string {
  let formatter = dateFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dateFormatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(new Date(value));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function path(
  nodes: { id: string; parentId: string | null; name: string }[],
  id: string,
) {
  const byId = new Map(nodes.map((n) => [n.id, n])),
    seen = new Set<string>(),
    names: string[] = [];
  let node = byId.get(id);
  while (node && !seen.has(node.id)) {
    seen.add(node.id);
    names.unshift(node.name);
    node = node.parentId ? byId.get(node.parentId) : undefined;
  }
  return names;
}
export function snapshotCard(state: AppState, card: Card) {
  return {
    type: card.type,
    folderPath: path(state.folders, card.folderId),
    question: plainRichText(card.front),
    answer: plainRichText(card.back),
    options:
      card.type === "test" || card.type === "choice"
        ? card.options.map(plainRichText)
        : [],
    correctOptions: card.correctOptions?.length
      ? card.correctOptions
      : [card.correctOption],
  };
}
export const chatgptStudyInstructions = `Analiza este informe de OpoGC usando sus datos. Distingue el recuerdo inicial del refuerzo inmediato: aprobar después de repetir no demuestra retención entre días. No promedies todos los intentos ni confundas intentos con tarjetas distintas. La media toma la primera valoración de cada sesión nueva, aunque empiece poco después de otra; comprueba el tiempo entre sesiones para distinguir familiaridad reciente y retención. Las categorías aportan sus valores centrales y las notas numéricas antiguas conservan su valor exacto. Usa la nota media de recuerdo, la última nota inicial y el historial disponible para detectar debilidades y errores recurrentes. Distingue las notas de autoevaluación de la corrección objetiva de tests y respuestas escritas. No interpretes el tiempo con una tarjeta abierta como tiempo activo. Si contiene contexto de planificación, propón prioridades según los pendientes y las sesiones abiertas. Antes de asignar tiempos pregunta mi disponibilidad. Señala datos que faltan; no inventes actividad ni resultados.`;
export function dailyReport(
  state: AppState,
  date: string,
  timeZone: string,
  planning = false,
  now = new Date(),
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    dayInZone(date + "T12:00:00Z", "UTC") !== date
  )
    throw new Error("Selecciona una fecha válida.");
  const all = uniqueReviews(state.reviews);
  const history = all.filter((r) => dayInZone(r.reviewedAt, timeZone) <= date);
  const index = gradeIndex(history);
  const reviews = history.filter(
    (r) => dayInZone(r.reviewedAt, timeZone) === date,
  );
  const byCard = new Map(state.cards.map((c) => [c.id, c]));
  const attempts = reviews.map((r) => {
    const card = byCard.get(r.cardId),
      stats = index.get(r.cardId);
    const recall = stats?.recallIds.has(r.id) ?? false;
    return {
      id: r.id,
      cardId: r.cardId,
      sessionId: r.cardSessionId ?? null,
      at: r.reviewedAt,
      score: validScore(r.score) ? r.score : null,
      scoreGroup: validScore(r.score) ? scoreGroup(r.score) : null,
      scoreSource:
        r.scoreSource ?? (validScore(r.score) ? "numeric" : "unscored"),
      scoreKind: validScore(r.score)
        ? recall
          ? "recall"
          : "reinforcement"
        : "legacy-unscored",
      rating: r.rating,
      correct: r.correct,
      objectiveCorrect: r.answerEvidence?.objectiveCorrect ?? null,
      accuracy: r.accuracy ?? null,
      reinforcement: validScore(r.score) ? !recall : (r.reinforcement ?? false),
      responseMs: r.responseMs ?? null,
      answerGiven: r.answerEvidence ?? null,
      content: r.cardSnapshot ?? (card ? snapshotCard(state, card) : null),
      contentSource: r.cardSnapshot
        ? "at-attempt"
        : card
          ? "current-card"
          : "unavailable",
      nextReviewAt: r.fsrsAfter?.dueAt ?? null,
    };
  });
  const cards = [...new Set(reviews.map((r) => r.cardId))].map((id) => {
    const rows = attempts.filter((r) => r.cardId === id),
      stats = index.get(id),
      numeric = rows.filter((r) => r.score !== null),
      first = numeric[0],
      last = numeric.at(-1);
    return {
      cardId: id,
      attempts: rows.length,
      firstScore: first?.score ?? null,
      finalScore: last?.score ?? null,
      firstAttemptKind: first?.scoreKind ?? null,
      passedOnFirstAttempt:
        first?.scoreKind === "recall" ? first.score! >= 5 : null,
      passedAfterReinforcement:
        first && last
          ? first.score! < 5 &&
            last.score! >= 5 &&
            last.scoreKind === "reinforcement"
          : null,
      averageRecall: stats?.average ?? null,
      lastRecall: stats?.latestRecall ?? null,
      recallCount: stats?.recallCount ?? 0,
      recentRecallScores: stats?.recallScores.slice(-10) ?? [],
      reinforcementAttempts: numeric.filter(
        (r) => r.scoreKind === "reinforcement",
      ).length,
    };
  });
  const study = state.studyTasks
    .filter(
      (t) =>
        t.status === "done" &&
        t.completedAt &&
        Number.isFinite(Date.parse(t.completedAt)) &&
        dayInZone(t.completedAt, timeZone) === date,
    )
    .map((t) => ({
      id: (t as any)._sessionId ?? t.id,
      nodeId: t.nodeId,
      path: path(state.studyNodes, t.nodeId),
      at: t.completedAt,
      assessment: t.assessment,
      note: t.completionNote,
      reason: t.reason,
    }));
  const psych = state.psychTests.flatMap((t) =>
    (t.attempts ?? [])
      .filter(
        (a) =>
          Number.isFinite(Date.parse(a.date)) &&
          dayInZone(a.date, timeZone) === date,
      )
      .map((a) => ({ testId: t.id, testName: t.name, ...a })),
  );
  const finished = Object.entries(state.settings)
    .filter(
      ([key, value]) =>
        key.startsWith("finishedCardSession:") &&
        value?.finishedAt &&
        Number.isFinite(Date.parse(value.finishedAt)) &&
        dayInZone(value.finishedAt, timeZone) === date,
    )
    .map(([, value]) => value);
  const currentIndex = planning ? gradeIndex(state.reviews) : null;
  const latestStudy = new Map<string, AppState["studyTasks"][number]>();
  [...state.studyTasks]
    .filter((t) => t.status === "done")
    .sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)))
    .forEach((t) => {
      if (!latestStudy.has(t.nodeId)) latestStudy.set(t.nodeId, t);
    });
  return {
    format: "opogc-daily-study",
    version: 1,
    gradingPolicy: "first-per-card-session-v2",
    appVersion: "15.1.0",
    date,
    timeZone,
    dayBoundary: "00:00 inclusive to next local 00:00 exclusive",
    generatedAt: now.toISOString(),
    summary: {
      distinctCards: cards.length,
      attempts: attempts.length,
      recallEvaluations: attempts.filter((r) => r.scoreKind === "recall")
        .length,
      reinforcementAttempts: attempts.filter(
        (r) => r.scoreKind === "reinforcement",
      ).length,
      legacyUnscoredAttempts: attempts.filter((r) => r.score === null).length,
      passedOnFirstAttempt: cards.filter((c) => c.passedOnFirstAttempt === true)
        .length,
      passedAfterReinforcement: cards.filter(
        (c) => c.passedAfterReinforcement === true,
      ).length,
      pendingScoredCards: cards.filter(
        (c) => c.finalScore !== null && c.finalScore < 5,
      ).length,
      studyCompletions: study.length,
      psychAttempts: psych.length,
      activeStudyTimeMs: null,
    },
    cards,
    attempts,
    study,
    psych,
    finishedSessions: finished,
    ...(planning
      ? {
          planningContext: {
            asOf: now.toISOString(),
            scope: "current-state-at-export",
            dueCards: state.cards
              .filter((c) => Date.parse(c.dueAt) <= +now)
              .map((c) => ({
                cardId: c.id,
                folderPath: path(state.folders, c.folderId),
                question: plainRichText(c.front),
                dueAt: c.dueAt,
                averageRecall: currentIndex!.get(c.id)?.average ?? null,
              })),
            weakCards: state.cards
              .filter((c) => (currentIndex!.get(c.id)?.average ?? 10) < 5)
              .map((c) => ({
                cardId: c.id,
                question: plainRichText(c.front),
                folderPath: path(state.folders, c.folderId),
                averageRecall: currentIndex!.get(c.id)!.average,
                lastRecall: currentIndex!.get(c.id)!.latestRecall,
              })),
            openSessions: savedCardSessions(state.settings).map((s) => ({
              id: s.id,
              label: s.label,
              createdAt: s.createdAt,
              updatedAt: s.updatedAt,
              mode: s.mode,
              summary: sessionSummary(s),
            })),
            plannedStudy: state.studyTasks
              .filter((t) => t.status === "pending")
              .map((t) => ({
                id: t.id,
                path: path(state.studyNodes, t.nodeId),
                date: t.plannedFor,
                note: t.note,
                reason: t.reason,
              })),
            weakStudy: [...latestStudy.values()]
              .filter(
                (t) => t.assessment === "mal" || t.assessment === "regular",
              )
              .slice(0, 100)
              .map((t) => ({
                nodeId: t.nodeId,
                path: path(state.studyNodes, t.nodeId),
                at: t.completedAt,
                assessment: t.assessment,
                note: t.completionNote,
              })),
          },
        }
      : {}),
    methodology: {
      scoreScale: "1–10; pass >=5",
      average:
        "Arithmetic mean of the first numeric evaluation of each card in each saved session. Same-session reinforcements are excluded. Historical numeric grades keep their exact values; categories contribute their midpoint (2.5, 5.5, 7.5, 9.5). No rounding in the calculation.",
      independentRecall:
        "One first numeric evaluation per cardSessionId, with no elapsed-time restriction. Resuming the same session on another day/device remains reinforcement. A new session counts even a few minutes later. Duplicate submissions in the same session count once. Old numeric records without a session ID retain their original explicit recall classification.",
      time: "responseMs measures elapsed time and can include idle time. Active study time is not measured.",
      historicalContent:
        "New scored attempts snapshot question, answer and folder path. Legacy attempts use current content if available; deleted content and unrecorded answers cannot be reconstructed.",
      material:
        "Opening or editing a Material document alone is not counted as completed study.",
    },
    instructionsForChatGPT: chatgptStudyInstructions,
  };
}
