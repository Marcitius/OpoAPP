"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEngine } from "../components/SyncContext";
import {
  CardModal,
  FolderModal,
  MoveFolderModal,
} from "../components/library/LibraryEditors";
import { AttemptModal, PsychModal } from "../components/psych/PsychEditors";
import { Empty } from "../components/shared/LegacyWidgets";
import {
  StudyCompletionNoteModal,
  StudyImportModal,
  StudyNodeEditorModal,
  StudyQuickModal,
  StudyTaskCard,
  StudyTaskEditModal,
  StudyTaskGroupedList,
  StudyUpcomingRow,
} from "../components/study/StudyManagement";
import {
  AppState,
  Card,
  CardType,
  LearnStat,
  OrthographySessionStat,
  OrthographySessionState,
  PsychSort,
  Rating,
  Review,
  ReviewQueueItem,
  ReviewQueueOutcome,
  StudyAssessment,
  StudyImportNode,
  StudyMode,
  StudyQueueMode,
  StudyTask,
  StudyView,
  WrittenAnswerResult,
  addDaysKey,
  applyWrittenStats,
  cardCorrectOptions,
  cardTypeLabel,
  cardsInFolderScope,
  chooseLearnCard,
  chooseOrthographyGroup,
  colors,
  dateLabel,
  descendantFolderIds,
  encodeWrittenRubric,
  escapeHtml,
  evaluateWrittenAnswer,
  failureCount,
  flattenFolderTree,
  flattenStudyTree,
  folderPathLabel,
  importedBackHtml,
  inferStudyNodeForCard,
  isContinuousStudyMode,
  isMultipleAnswerTest,
  isMultipleChoiceCard,
  isMultipleChoiceType,
  isOrthographyCard,
  isStudyableCard,
  isWrittenCard,
  localDateKey,
  mergeStudyImport,
  normalizeAndSeed,
  normalizeStudyLabel,
  nowIso,
  orthographyBackHtml,
  psychStats,
  sameNumberSet,
  scheduleCard,
  scoreLabel,
  shuffled,
  sortPsychTests,
  studyDescendantIds,
  studyNodePath,
  studyTreeForExport,
  todayKey,
  uid,
  useStableOverlaySurfaces,
  weakestStudyCards,
  writtenAverageAccuracy,
  zeroWrittenAnswerResult,
} from "../lib/study/legacy";
import { ImageAnnotator, ImageLightbox } from "./CardImage";
import CardImportModal, { type ParsedImportItem } from "./CardImportModal";
import OrthographyStudy, {
  type OrthographyStudyResult,
} from "./OrthographyStudy";
import PdfAnnotator from "./PdfAnnotator";
import { plainRichText, sanitizeRichHtml } from "./RichTextEditor";
import {
  applyFsrsReview,
  fsrsSnapshot,
  isLearning,
  fsrsCurrentRetrievability,
} from "./fsrs";
import {
  createCardSession,
  nextSessionCard,
  answerSession,
  sessionSummary,
  skipSessionCard,
  validSession,
  type CardSession,
} from "../lib/memory/session";
import {
  orderedChildren,
  appendRank,
  reorderItems,
  moveBranch,
  moveOut,
} from "../lib/study/hierarchy";
import {
  planNode,
  dueStudyTasks,
  cardsForStudyNode,
  type PlanAction,
} from "../lib/study/planning";
import {
  materializeLibraryDraft,
  type LibraryDraftNode,
} from "../lib/study/libraryBridge";
import StudyPlanPage from "../components/study/StudyPlanPage";
import LibraryToStudySheet from "../components/library/LibraryToStudySheet";
import SessionStatus from "../components/review/SessionStatus";
import CardActionsSheet from "../components/library/CardActionsSheet";
import { fitPersonalMemoryModel, predictPersonalRecall } from "./memoryModel";

import StudyPreferences from "../components/account/StudyPreferences";
import LibraryActions from "../components/library/LibraryActions";
import AppNavigation, {
  type AppTab,
} from "../components/navigation/AppNavigation";
import MorePage from "../components/navigation/MorePage";
import ProgressPage from "../components/progress/ProgressPage";
import ReviewSession from "../components/review/ReviewSession";
import ReviewStartPage from "../components/review/ReviewStartPage";
import Icon from "../components/shared/Icon";
import useAppViewport from "../components/shared/useAppViewport";
import StudySession, {
  type StudyEntry,
} from "../components/study/StudySession";
import StudyStartPage from "../components/study/StudyStartPage";
import TemarioBrowser from "../components/study/TemarioBrowser";
import TodayPage, { type PriorityItem } from "../components/today/TodayPage";
import { orthographyStudyCard } from "../lib/study/legacy";

export default function OpoApp() {
  useAppViewport();
  const engine = useEngine();
  const stateRef = useRef<AppState | null>(null);
  useStableOverlaySurfaces();
  const [tab, setTab] = useState<AppTab>("today");
  const [studyView, setStudyView] = useState<StudyView>("today");
  const [studyQueueMode, setStudyQueueMode] =
    useState<StudyQueueMode>("grouped");
  const [studyTaskEditId, setStudyTaskEditId] = useState<string | null>(null);
  const [studyCompletionPrompt, setStudyCompletionPrompt] = useState<{
    taskId: string;
    sessionId: string;
    assessment: Exclude<StudyAssessment, null>;
  } | null>(null);
  const [studyQuickOpen, setStudyQuickOpen] = useState(false);
  const [studyQuickDefaultNodeId, setStudyQuickDefaultNodeId] = useState<
    string | null
  >(null);
  const [studyQuickSourceCardId, setStudyQuickSourceCardId] = useState<
    string | null
  >(null);
  const [studyImportOpen, setStudyImportOpen] = useState(false);
  const [studyImportParentId, setStudyImportParentId] = useState<string | null>(
    null,
  );
  const [studyNodeEditorOpen, setStudyNodeEditorOpen] = useState(false);
  const [studyNodeEditorParentId, setStudyNodeEditorParentId] = useState<
    string | null
  >(null);
  const [studyEditingNodeId, setStudyEditingNodeId] = useState<string | null>(
    null,
  );
  const [studySelectMode, setStudySelectMode] = useState(false);
  const [selectedStudyNodeIds, setSelectedStudyNodeIds] = useState<string[]>(
    [],
  );
  const [studyHistoryRoot, setStudyHistoryRoot] = useState("all");
  const [state, setState] = useState<AppState | null>(null);
  const [sync, setSync] = useState<"loading" | "saved" | "saving" | "error">(
    "loading",
  );
  const [modal, setModal] = useState<
    null | "folder" | "card" | "import" | "psych" | "attempt"
  >(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [bulkTargetFolderId, setBulkTargetFolderId] = useState("");
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(
    null,
  );
  const [movingFolderId, setMovingFolderId] = useState<string | null>(null);
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
  const [writtenResult, setWrittenResult] =
    useState<WrittenAnswerResult | null>(null);
  const [sessionDone, setSessionDone] = useState(0);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionClock, setSessionClock] = useState(Date.now());
  const [reviewSaving, setReviewSaving] = useState(false);
  const reviewBusyRef = useRef(false);
  const presentationKeyRef = useRef("");
  const [libraryBridgeOpen, setLibraryBridgeOpen] = useState(false);
  const [cardActionsId, setCardActionsId] = useState<string | null>(null);
  const [orthographySession, setOrthographySession] =
    useState<OrthographySessionState | null>(null);
  const [orthographySelected, setOrthographySelected] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryType, setLibraryType] = useState("all");
  const [libraryActionsOpen, setLibraryActionsOpen] = useState(false);
  const [studyFlow, setStudyFlow] = useState<{
    entries: StudyEntry[];
    index: number;
    completed: number;
  } | null>(null);
  const cardShownAtRef = useRef(Date.now());
  const orthographyGroupStartedAtRef = useRef(Date.now());

  useEffect(() => {
    const update = () => {
      const loaded = normalizeAndSeed({
        ...engine.state,
        settings: { ...engine.state.settings, seedVersion: 2 },
      } as AppState).state;
      stateRef.current = loaded;
      setState(loaded);
      setOnline(navigator.onLine);
      setSync(
        engine.status.phase === "saved"
          ? "saved"
          : engine.status.phase === "error"
            ? "error"
            : "saving",
      );
    };
    update();
    return engine.subscribe(update);
  }, [engine]);

  function updateState(updater: (current: AppState) => AppState) {
    const current = stateRef.current;
    if (!current) return Promise.resolve(false);
    const next = updater(current);
    stateRef.current = next;
    setState(next);
    setSync("saving");
    return engine
      .update(current, next)
      .then(() => true)
      .catch((error) => {
        stateRef.current = engine.state as AppState;
        setState(engine.state as AppState);
        setSync("error");
        notify(`No se pudo guardar la acción: ${error.message}`);
        return false;
      });
  }

  function navigate(next: AppTab) {
    setTab(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function startStudySession(nodeId?: string, tasks?: StudyTask[]) {
    const current = stateRef.current;
    if (!current) return;
    let entries: StudyEntry[] = [];
    if (tasks?.length)
      entries = tasks.map((task) => ({ nodeId: task.nodeId, taskId: task.id }));
    else if (nodeId) {
      const ids = studyDescendantIds(current.studyNodes, nodeId);
      const leafNodes = flattenStudyTree(current.studyNodes).filter(
        (n) =>
          ids.has(n.id) &&
          !current.studyNodes.some((child) => child.parentId === n.id),
      );
      entries = (
        leafNodes.length
          ? leafNodes
          : current.studyNodes.filter((n) => n.id === nodeId)
      ).map((n) => ({ nodeId: n.id }));
      if (entries.length === 1) {
        const chosen = current.studyNodes.find((n) => n.id === nodeId);
        const peers = flattenStudyTree(current.studyNodes).filter(
          (n) =>
            n.parentId === chosen?.parentId &&
            !current.studyNodes.some((c) => c.parentId === n.id),
        );
        const index = peers.findIndex((n) => n.id === nodeId);
        if (index >= 0)
          entries = peers.slice(index).map((n) => ({ nodeId: n.id }));
      }
    }
    if (!entries.length) {
      navigate("study");
      return;
    }
    setStudyFlow({ entries, index: 0, completed: 0 });
  }

  async function finishStudyEntry(
    assessment: Exclude<StudyAssessment, null>,
    completionNote: string,
  ) {
    if (!studyFlow) return false;
    const entry = studyFlow.entries[studyFlow.index];
    const current = stateRef.current;
    if (!entry || !current?.studyNodes.some((n) => n.id === entry.nodeId))
      return false;
    const existing = entry.taskId
      ? current.studyTasks.find((t) => t.id === entry.taskId)
      : null;
    if (entry.taskId && (!existing || existing.status !== "pending"))
      return false;
    const stamp = nowIso(),
      sessionId = `session-${uid()}`;
    const saved = await updateState((value) => ({
      ...value,
      studyTasks: existing
        ? value.studyTasks.map((t) =>
            t.id === existing.id
              ? {
                  ...t,
                  status: "done",
                  assessment,
                  completionNote: completionNote.trim(),
                  completedAt: stamp,
                  _completionEventId: sessionId,
                }
              : t,
          )
        : [
            ...value.studyTasks,
            {
              id: uid(),
              nodeId: entry.nodeId,
              plannedFor: localDateKey(),
              note: "",
              reason: "estudio",
              status: "done",
              createdAt: stamp,
              completedAt: stamp,
              assessment,
              completionNote: completionNote.trim(),
              sourceCardId: null,
              queueOrder: 0,
              _completionEventId: sessionId,
            },
          ],
    }));
    if (saved)
      setStudyFlow((flow) =>
        flow
          ? { ...flow, index: flow.index + 1, completed: flow.completed + 1 }
          : null,
      );
    return saved;
  }

  function reorderStudyNode(id: string, direction: -1 | 1) {
    void updateState((c) => ({
      ...c,
      studyNodes: reorderItems(c.studyNodes, id, direction),
    }));
  }
  function planStudyNode(id: string, action: PlanAction) {
    void updateState((c) => ({
      ...c,
      studyTasks: planNode(c.studyTasks, id, action, uid(), nowIso()),
    }));
  }
  function moveStudyOut(id: string) {
    void updateState((c) => ({ ...c, studyNodes: moveOut(c.studyNodes, id) }));
  }
  function startStudyWithContent(nodeId?: string, tasks?: StudyTask[]) {
    const current = stateRef.current;
    if (!current) return;
    const task = tasks?.[0],
      id = nodeId ?? task?.nodeId;
    if (id) {
      const linked = cardsForStudyNode(
        current.studyNodes,
        current.folders,
        current.cards,
        id,
      ).filter(isStudyableCard);
      if (linked.length) {
        void startReview(
          undefined,
          "learn",
          linked.map((c) => c.id),
          task?.id,
          id,
        );
        return;
      }
    }
    startStudySession(nodeId, tasks);
  }
  async function importLibraryToStudy(
    draft: LibraryDraftNode[],
    destination: string | null,
  ) {
    const current = stateRef.current;
    if (!current) return false;
    const result = materializeLibraryDraft(
      current.studyNodes,
      draft,
      destination,
      uid,
      nowIso(),
    );
    const ok = await updateState((c) => ({ ...c, studyNodes: result.nodes }));
    if (ok) notify(result.created + " elementos añadidos · tarjetas enlazadas");
    return ok;
  }
  function reorderFolder(id: string, direction: -1 | 1) {
    void updateState((c) => ({
      ...c,
      folders: reorderItems(c.folders, id, direction),
    }));
  }
  function moveFolderOut(id: string) {
    void updateState((c) => ({ ...c, folders: moveOut(c.folders, id) }));
  }
  function moveCard(id: string, folderId: string) {
    if (!stateRef.current?.folders.some((f) => f.id === folderId)) return;
    void updateState((c) => ({
      ...c,
      cards: c.cards.map((card) =>
        card.id === id
          ? {
              ...card,
              folderId,
              sortOrder: appendRank(c.cards, folderId, "folderId"),
            }
          : card,
      ),
    }));
  }
  function reorderCard(id: string, direction: -1 | 1) {
    void updateState((c) => ({
      ...c,
      cards: reorderItems(c.cards, id, direction, "folderId"),
    }));
  }

  function notify(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  }

  function openStudyImport(parentId: string | null = null) {
    setStudySelectMode(false);
    setSelectedStudyNodeIds([]);
    setStudyImportParentId(parentId);
    setStudyImportOpen(true);
    setStudyView("tree");
  }

  function openStudyNodeEditor(
    parentId: string | null = null,
    nodeId: string | null = null,
  ) {
    setStudySelectMode(false);
    setSelectedStudyNodeIds([]);
    setStudyNodeEditorParentId(parentId);
    setStudyEditingNodeId(nodeId);
    setStudyNodeEditorOpen(true);
    setStudyView("tree");
  }

  function saveStudyNode(input: {
    id: string | null;
    name: string;
    parentId: string | null;
  }) {
    if (!state) return;
    const name = input.name.trim();
    if (!name) return;
    let parentId =
      input.parentId &&
      state.studyNodes.some((node) => node.id === input.parentId)
        ? input.parentId
        : null;
    if (input.id) {
      const protectedIds = studyDescendantIds(state.studyNodes, input.id);
      if (parentId && protectedIds.has(parentId))
        parentId =
          state.studyNodes.find((node) => node.id === input.id)?.parentId ??
          null;
    }
    const duplicate = state.studyNodes.some(
      (node) =>
        node.id !== input.id &&
        node.parentId === parentId &&
        normalizeStudyLabel(node.name) === normalizeStudyLabel(name),
    );
    if (duplicate)
      return notify("Ya existe un elemento con ese nombre dentro de esa rama");
    const finalParentId = parentId;
    updateState((current) =>
      input.id
        ? {
            ...current,
            studyNodes: moveBranch(
              current.studyNodes,
              input.id!,
              finalParentId,
            ).map((node) => (node.id === input.id ? { ...node, name } : node)),
          }
        : {
            ...current,
            studyNodes: [
              ...current.studyNodes,
              {
                id: uid(),
                name,
                parentId: finalParentId,
                createdAt: nowIso(),
                sortOrder: appendRank(current.studyNodes, finalParentId),
              },
            ],
          },
    );
    setStudyNodeEditorOpen(false);
    setStudyEditingNodeId(null);
    setStudyNodeEditorParentId(null);
    notify(input.id ? "Elemento actualizado" : "Elemento añadido al temario");
  }

  function toggleStudyNodeSelection(nodeId: string) {
    setSelectedStudyNodeIds((current) =>
      current.includes(nodeId)
        ? current.filter((id) => id !== nodeId)
        : [...current, nodeId],
    );
  }

  function clearStudySelection() {
    setSelectedStudyNodeIds([]);
    setStudySelectMode(false);
  }

  function deleteStudyNodes(nodeIds: string[]) {
    if (!state || !nodeIds.length) return;
    const deleteIds = new Set<string>();
    nodeIds.forEach((nodeId) =>
      studyDescendantIds(state.studyNodes, nodeId).forEach((id) =>
        deleteIds.add(id),
      ),
    );
    const taskCount = state.studyTasks.filter((task) =>
      deleteIds.has(task.nodeId),
    ).length;
    const message = `Se eliminarán ${deleteIds.size} elemento${deleteIds.size === 1 ? "" : "s"}${taskCount ? ` y ${taskCount} registro${taskCount === 1 ? "" : "s"} de repaso asociados` : ""}. Esta acción no se puede deshacer. ¿Continuar?`;
    if (typeof window !== "undefined" && !window.confirm(message)) return;
    updateState((current) => ({
      ...current,
      studyNodes: current.studyNodes.filter((node) => !deleteIds.has(node.id)),
      studyTasks: current.studyTasks.filter(
        (task) => !deleteIds.has(task.nodeId),
      ),
    }));
    if (studyHistoryRoot !== "all" && deleteIds.has(studyHistoryRoot))
      setStudyHistoryRoot("all");
    setSelectedStudyNodeIds([]);
    setStudySelectMode(false);
    notify(
      `${deleteIds.size} elemento${deleteIds.size === 1 ? "" : "s"} eliminado${deleteIds.size === 1 ? "" : "s"}`,
    );
  }

  function openStudyQuick(
    nodeId?: string | null,
    sourceCardId?: string | null,
  ) {
    if (!state) return;
    if (!state.studyNodes.length) {
      setTab("organize");
      setStudyView("tree");
      setStudyImportParentId(null);
      setStudyImportOpen(true);
      notify("Añade o importa primero el temario para poder vincular repasos");
      return;
    }
    let resolved = nodeId ?? null;
    if (!resolved && sourceCardId) {
      const card = state.cards.find((item) => item.id === sourceCardId);
      if (card)
        resolved = inferStudyNodeForCard(card, state.studyNodes, state.folders);
    }
    setStudyQuickDefaultNodeId(resolved);
    setStudyQuickSourceCardId(sourceCardId ?? null);
    setStudyQuickOpen(true);
  }

  function saveStudyTask(input: {
    nodeId: string;
    plannedFor: string;
    note: string;
    reason: string;
  }) {
    const task: StudyTask = {
      id: uid(),
      nodeId: input.nodeId,
      plannedFor: input.plannedFor,
      note: input.note.trim(),
      reason: input.reason,
      status: "pending",
      createdAt: nowIso(),
      completedAt: null,
      assessment: null,
      completionNote: "",
      sourceCardId: studyQuickSourceCardId,
      queueOrder:
        Math.max(
          -1,
          ...(state?.studyTasks
            .filter((item) => item.status === "pending")
            .map((item) => item.queueOrder) ?? []),
        ) + 1,
    };
    updateState((current) => ({
      ...current,
      studyTasks: [...current.studyTasks, task],
    }));
    setStudyQuickOpen(false);
    setStudyQuickDefaultNodeId(null);
    setStudyQuickSourceCardId(null);
    notify(
      `${input.reason === "estudio" ? "Estudio" : "Repaso"} guardado para ${task.plannedFor === localDateKey() ? "hoy" : task.plannedFor === addDaysKey(1) ? "mañana" : dateLabel(task.plannedFor)}`,
    );
  }

  function editStudyTask(taskId: string) {
    setStudyTaskEditId(taskId);
  }

  function saveStudyTaskEdits(input: {
    id: string;
    nodeId: string;
    plannedFor: string;
    note: string;
    reason: string;
  }) {
    updateState((current) => ({
      ...current,
      studyTasks: current.studyTasks.map((task) =>
        task.id === input.id
          ? {
              ...task,
              nodeId: input.nodeId,
              plannedFor: input.plannedFor,
              planBucket: input.plannedFor ? "today" : "next",
              note: input.note.trim(),
              reason: input.reason,
            }
          : task,
      ),
    }));
    setStudyTaskEditId(null);
    notify("Repaso actualizado");
  }

  function reorderStudyTask(id: string, direction: -1 | 1) {
    void updateState((c) => {
      const target = c.studyTasks.find((t) => t.id === id);
      if (!target) return c;
      const category = (t: StudyTask) =>
        t.reason !== "estudio"
          ? "review"
          : t.planBucket === "next" ||
              !t.plannedFor ||
              t.plannedFor > localDateKey()
            ? "next"
            : "today";
      const siblings = c.studyTasks
        .filter(
          (t) => t.status === "pending" && category(t) === category(target),
        )
        .sort((a, b) => a.queueOrder - b.queueOrder);
      const from = siblings.findIndex((t) => t.id === id),
        to = from + direction;
      if (to < 0 || to >= siblings.length) return c;
      [siblings[from], siblings[to]] = [siblings[to], siblings[from]];
      const ranks = new Map(siblings.map((t, i) => [t.id, i]));
      return {
        ...c,
        studyTasks: c.studyTasks.map((t) =>
          ranks.has(t.id) ? { ...t, queueOrder: ranks.get(t.id)! } : t,
        ),
      };
    });
  }

  function completeStudyTask(
    taskId: string,
    assessment: Exclude<StudyAssessment, null>,
  ) {
    const sessionId = `session-${uid()}`;
    updateState((current) => ({
      ...current,
      studyTasks: current.studyTasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: "done",
              completedAt: nowIso(),
              assessment,
              _completionEventId: sessionId,
            }
          : task,
      ),
    }));
    setStudyCompletionPrompt({ taskId, sessionId, assessment });
    notify(
      assessment === "bien"
        ? "Repaso completado"
        : assessment === "regular"
          ? "Repaso completado · conviene volver"
          : "Repaso completado · prioridad alta",
    );
  }

  function saveStudyCompletionNote(
    taskId: string,
    completionNote: string,
    sessionId?: string,
  ) {
    updateState((current) => ({
      ...current,
      studyTasks: current.studyTasks.map((task) =>
        (
          sessionId
            ? (task as any)._sessionId === sessionId ||
              (task as any)._completionEventId === sessionId
            : task.id === taskId
        )
          ? { ...task, completionNote: completionNote.trim() }
          : task,
      ),
    }));
    setStudyCompletionPrompt(null);
    if (completionNote.trim()) notify("Comentario del repaso guardado");
  }

  function postponeStudyTask(taskId: string, days = 1) {
    updateState((current) => ({
      ...current,
      studyTasks: current.studyTasks.map((task) =>
        task.id === taskId ? { ...task, plannedFor: addDaysKey(days) } : task,
      ),
    }));
    notify(days === 1 ? "Movido a mañana" : `Movido +${days} días`);
  }

  function deleteStudyTask(taskId: string) {
    if (
      typeof window !== "undefined" &&
      !window.confirm("¿Eliminar este repaso pendiente?")
    )
      return;
    updateState((current) => ({
      ...current,
      studyTasks: current.studyTasks.filter((task) => task.id !== taskId),
    }));
    if (studyTaskEditId === taskId) setStudyTaskEditId(null);
    notify("Anotación eliminada");
  }

  function importStudyTree(
    roots: StudyImportNode[],
    parentId: string | null = null,
  ) {
    if (!roots.length) return;
    const safeParentId =
      parentId && state?.studyNodes.some((node) => node.id === parentId)
        ? parentId
        : null;
    const parent = safeParentId
      ? (state?.studyNodes.find((node) => node.id === safeParentId) ?? null)
      : null;
    const effectiveRoots =
      parent &&
      roots.length === 1 &&
      normalizeStudyLabel(roots[0].name) === normalizeStudyLabel(parent.name)
        ? roots[0].children
        : roots;
    if (!effectiveRoots.length) {
      setStudyImportOpen(false);
      setStudyImportParentId(null);
      return notify("No hay elementos nuevos dentro de la rama seleccionada");
    }
    const merged = mergeStudyImport(
      state?.studyNodes ?? [],
      effectiveRoots,
      safeParentId,
    );
    updateState((current) => ({
      ...current,
      studyNodes: mergeStudyImport(
        current.studyNodes,
        effectiveRoots,
        safeParentId,
      ).nodes,
    }));
    setStudyImportOpen(false);
    setStudyImportParentId(null);
    setStudyView("tree");
    notify(
      merged.created
        ? `${merged.created} elementos nuevos añadidos${parent ? ` dentro de ${parent.name}` : " al temario"}`
        : "Temario actualizado sin duplicados",
    );
  }

  function exportStudyData(rootId?: string) {
    if (!state || !state.studyNodes.length)
      return notify("No hay temario de estudio para exportar");
    const ids = rootId
      ? studyDescendantIds(state.studyNodes, rootId)
      : new Set(state.studyNodes.map((node) => node.id));
    const scopedNodes = state.studyNodes.filter((node) => ids.has(node.id));
    const scopedTasks = state.studyTasks.filter((task) => ids.has(task.nodeId));
    const items = scopedNodes.map((node) => {
      const tasks = scopedTasks.filter((task) => task.nodeId === node.id);
      const done = tasks
        .filter((task) => task.status === "done" && task.completedAt)
        .sort((a, b) =>
          (b.completedAt ?? "").localeCompare(a.completedAt ?? ""),
        );
      const pending = tasks
        .filter((task) => task.status === "pending")
        .sort((a, b) => a.plannedFor.localeCompare(b.plannedFor));
      const latest = done[0] ?? null;
      return {
        id: node.id,
        nombre: node.name,
        ruta: studyNodePath(state.studyNodes, node.id),
        ultima_revision: latest?.completedAt ?? null,
        proxima_revision: pending[0]?.plannedFor ?? null,
        numero_repasos: done.length,
        estado:
          latest?.assessment ?? (pending.length ? "pendiente" : "sin_datos"),
        notas: tasks
          .flatMap((task) => [task.note, task.completionNote])
          .filter(Boolean)
          .slice(-12),
        motivos: [...new Set(tasks.map((task) => task.reason).filter(Boolean))],
        pendientes: pending.map((task) => ({
          fecha: task.plannedFor,
          nota: task.note,
          motivo: task.reason,
          orden: task.queueOrder,
        })),
        historial: done.map((task) => ({
          fecha: task.completedAt,
          resultado: task.assessment,
          nota_previa: task.note,
          comentario_resultado: task.completionNote,
          motivo: task.reason,
        })),
      };
    });
    const root = rootId
      ? state.studyNodes.find((node) => node.id === rootId)
      : null;
    const payload = {
      version: 1,
      fecha_exportacion: nowIso(),
      alcance: root
        ? studyNodePath(state.studyNodes, root.id).join(" > ")
        : "Todo el estudio",
      resumen: {
        elementos: scopedNodes.length,
        repasos_completados: scopedTasks.filter(
          (task) => task.status === "done",
        ).length,
        pendientes: scopedTasks.filter((task) => task.status === "pending")
          .length,
      },
      arbol: studyTreeForExport(state.studyNodes, ids),
      elementos: items,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const base = root?.name ?? "estudio-completo";
    anchor.href = url;
    anchor.download = `${
      base
        .toLocaleLowerCase("es")
        .replace(/[^a-z0-9áéíóúüñ]+/gi, "-")
        .replace(/^-|-$/g, "") || "estudio"
    }-${localDateKey()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    notify(root ? `Exportado: ${root.name}` : "Estudio completo exportado");
  }

  const personalModel = useMemo(
    () => fitPersonalMemoryModel(state?.cards ?? [], state?.reviews ?? []),
    [state],
  );
  const dueCards = useMemo(() => {
    if (!state) return [];
    const now = new Date();
    return state.cards
      .filter(
        (card) =>
          !isOrthographyCard(card) &&
          card.reviewCount > 0 &&
          new Date(card.dueAt).getTime() <= now.getTime(),
      )
      .sort(
        (a, b) =>
          predictPersonalRecall(a, state.reviews, personalModel, now)
            .probability -
          predictPersonalRecall(b, state.reviews, personalModel, now)
            .probability,
      );
  }, [personalModel, state]);
  const todayReviews = useMemo(
    () =>
      state?.reviews.filter(
        (review) => localDateKey(new Date(review.reviewedAt)) === todayKey(),
      ) ?? [],
    [state],
  );
  const savedCardSession = validSession(state?.settings.activeCardSession)
    ? state!.settings.activeCardSession!
    : null;
  const sessionNext = savedCardSession
    ? nextSessionCard(savedCardSession, state?.cards ?? [], sessionClock)
    : null;
  const cardSessionSummary = savedCardSession
    ? sessionSummary(savedCardSession)
    : null;
  useEffect(() => {
    if (!sessionOpen) return;
    const timer = setInterval(() => setSessionClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [sessionOpen]);
  useEffect(() => {
    if (
      sessionOpen &&
      !orthographySession &&
      savedCardSession &&
      reviewIndex >= reviewQueue.length &&
      sessionNext?.kind === "card"
    )
      showSessionNext(savedCardSession, state?.cards ?? []);
  }, [
    sessionOpen,
    sessionClock,
    state,
    reviewIndex,
    reviewQueue.length,
    orthographySession,
  ]);
  const currentQueueItem = reviewQueue[reviewIndex] ?? null;
  const currentCard =
    state?.cards.find((card) => card.id === currentQueueItem?.cardId) ?? null;
  const displayedWrittenResult =
    currentCard && isWrittenCard(currentCard)
      ? (writtenResult ??
        (currentQueueItem?.outcome === "unknown"
          ? zeroWrittenAnswerResult(currentCard)
          : null))
      : null;
  const activeFolder =
    state?.folders.find((folder) => folder.id === selectedFolder) ?? null;
  const activePsych =
    state?.psychTests.find((test) => test.id === selectedPsych) ?? null;
  const openPsych =
    state?.psychTests.find((test) => test.id === editingPsych) ?? null;
  const openPsychTest =
    state?.psychTests.find((test) => test.id === editingPsychTest) ?? null;
  const detailPsych =
    state?.psychTests.find((test) => test.id === psychDetail) ?? null;
  const openAttempt =
    activePsych?.attempts.find((attempt) => attempt.id === editingAttempt) ??
    null;
  const openCard = state?.cards.find((card) => card.id === editingCard) ?? null;
  const movingFolder =
    state?.folders.find((folder) => folder.id === movingFolderId) ?? null;

  useEffect(() => {
    if (currentCard) cardShownAtRef.current = Date.now();
    setRevealed(Boolean(currentQueueItem?.completed));
    setViewingStudyImage(false);
    setSelectedOption(null);
    setSelectedOptions([]);
    setWrittenAnswer("");
    setWrittenResult(null);
  }, [currentCard?.id, currentQueueItem?.completed, reviewIndex]);

  useEffect(() => {
    setBulkSelectMode(false);
    setSelectedCardIds([]);
    setBulkTargetFolderId("");
  }, [selectedFolder]);

  function toggleCardSelection(cardId: string) {
    setSelectedCardIds((current) =>
      current.includes(cardId)
        ? current.filter((id) => id !== cardId)
        : [...current, cardId],
    );
  }

  function moveSelectedCards(targetFolderId: string) {
    if (!state || !targetFolderId || !selectedCardIds.length) return;
    const selected = new Set(selectedCardIds);
    const target = state.folders.find((folder) => folder.id === targetFolderId);
    if (!target)
      return notify("No se ha encontrado el tema o subtema de destino");
    updateState((current) => ({
      ...current,
      cards: current.cards.map((card) =>
        selected.has(card.id) ? { ...card, folderId: targetFolderId } : card,
      ),
    }));
    notify(
      `${selected.size} ${selected.size === 1 ? "tarjeta movida" : "tarjetas movidas"} a ${target.name}`,
    );
    setSelectedCardIds([]);
    setBulkTargetFolderId("");
  }

  function deleteSelectedCards() {
    if (!selectedCardIds.length) return;
    const total = selectedCardIds.length;
    if (
      !confirm(
        `¿Eliminar ${total} ${total === 1 ? "tarjeta seleccionada" : "tarjetas seleccionadas"}? Esta acción no se puede deshacer.`,
      )
    )
      return;
    const selected = new Set(selectedCardIds);
    updateState((current) => ({
      ...current,
      cards: current.cards.filter((card) => !selected.has(card.id)),
    }));
    setSelectedCardIds([]);
    notify(
      `${total} ${total === 1 ? "tarjeta eliminada" : "tarjetas eliminadas"}`,
    );
  }

  function studySelectedCards(mode: StudyMode) {
    if (!state || !selectedCardIds.length) return;
    const ids = selectedCardIds.filter((id) =>
      state.cards.some((card) => card.id === id),
    );
    if (!ids.length) return notify("No hay tarjetas válidas en la selección");
    startReview(activeFolder?.id, mode, ids);
  }

  async function startOrthographySession(
    folderId: string | undefined,
    mode: StudyMode,
    scope: Card[],
  ) {
    const current = stateRef.current;
    if (!current || reviewBusyRef.current) return;
    let words = scope.filter(isOrthographyCard);
    if (mode === "weakest")
      words = weakestStudyCards(words, current.reviews, personalModel);
    if (mode === "random") words = shuffled(words);
    if (mode === "recommended")
      words = words
        .filter((c) => !c.reviewCount || Date.parse(c.dueAt) <= Date.now())
        .slice(0, current.settings.dailyReviewGoal);
    if (!words.length)
      return notify("No hay palabras pendientes en este ámbito");
    const session: CardSession = {
      ...createCardSession(words, mode, uid(), Date.now()),
      format: "orthography",
    };
    reviewBusyRef.current = true;
    setReviewSaving(true);
    const saved = await updateState((c) => ({
      ...c,
      settings: { ...c.settings, activeCardSession: session },
    }));
    reviewBusyRef.current = false;
    setReviewSaving(false);
    if (!saved) return;
    setStudyFlow(null);
    setReviewQueue([]);
    setReviewIndex(0);
    presentationKeyRef.current = "";
    setSessionOpen(true);
    setSessionClock(Date.now());
    showSessionNext(session, current.cards);
  }
  function toggleOrthographyWord(id: string) {
    if (orthographySession?.results || reviewBusyRef.current) return;
    setOrthographySelected((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }
  async function correctOrthographyGroup() {
    const current = stateRef.current,
      session = current?.settings.activeCardSession;
    if (
      !current ||
      !orthographySession ||
      orthographySession.results ||
      !validSession(session) ||
      reviewBusyRef.current
    )
      return;
    reviewBusyRef.current = true;
    setReviewSaving(true);
    const selected = new Set(orthographySelected),
      now = new Date();
    let nextSession = session;
    const updates = new Map<string, Card>(),
      reviews: Review[] = [],
      results: OrthographyStudyResult[] = [];
    for (const id of orthographySession.groupIds) {
      const card = current.cards.find((c) => c.id === id),
        item = session.items.find((i) => i.id === id);
      if (!card || !item || !["new", "reinforce"].includes(item.status))
        continue;
      const shouldBeMarked = card.orthographyIsCorrect === false,
        userMarked = selected.has(id),
        correct = shouldBeMarked === userMarked;
      const rating: Rating = correct ? "good" : "again",
        reinforcement = item.attempts > 0;
      let updated = applyFsrsReview(card, rating, now, reinforcement);
      if (!correct && (item.failures >= 1 || updated.lapses >= 2))
        updated = {
          ...updated,
          orthographyStage: Math.max(2, updated.orthographyStage || 1),
        };
      const review: Review = {
        id: uid(),
        cardId: id,
        rating,
        correct,
        reviewedAt: now.toISOString(),
        responseMs: Math.max(0, +now - orthographyGroupStartedAtRef.current),
        sessionMode: session.mode,
        reinforcement,
        predictedRecall: predictPersonalRecall(
          card,
          current.reviews,
          personalModel,
          now,
        ).probability,
        fsrsRetrievability: fsrsCurrentRetrievability(card, now),
        schedulerVersion: "ts-fsrs-5.4.2",
        fsrsBefore: fsrsSnapshot(card),
        fsrsAfter: fsrsSnapshot(updated),
      };
      updates.set(id, updated);
      reviews.push(review);
      nextSession = answerSession(
        nextSession,
        updated,
        rating,
        review.id,
        +now,
      );
      results.push({ cardId: id, userMarked, shouldBeMarked, correct });
    }
    const saved = await updateState((c) => ({
      ...c,
      cards: c.cards.map((card) => updates.get(card.id) ?? card),
      reviews: [...c.reviews, ...reviews],
      settings: { ...c.settings, activeCardSession: nextSession },
    }));
    reviewBusyRef.current = false;
    setReviewSaving(false);
    if (!saved) return;
    setOrthographySession((s) =>
      s
        ? {
            ...s,
            results,
            responses: nextSession.history.length,
            correctResponses: nextSession.history.filter(
              (r) => r.rating !== "again",
            ).length,
          }
        : null,
    );
    setSessionClock(+now);
  }
  function continueOrthographySession() {
    if (reviewBusyRef.current) return;
    const current = stateRef.current,
      session = current?.settings.activeCardSession;
    if (!current || !validSession(session)) return;
    setOrthographySession(null);
    setSessionClock(Date.now());
    showSessionNext(session, current.cards);
  }
  function closeOrthographySession() {
    setOrthographySession(null);
    setOrthographySelected([]);
    setSessionOpen(false);
  }

  function showSessionNext(session: CardSession, cards: Card[]) {
    const next = nextSessionCard(session, cards, Date.now());
    if (next.kind !== "card") return;
    const key = session.id + ":" + session.turn + ":" + next.id;
    if (presentationKeyRef.current === key) return;
    presentationKeyRef.current = key;
    if (session.format === "orthography") {
      let candidate = session;
      const groupIds: string[] = [];
      for (let i = 0; i < 4; i++) {
        const chosen = nextSessionCard(candidate, cards, Date.now());
        if (chosen.kind !== "card") break;
        groupIds.push(chosen.id);
        candidate = skipSessionCard(candidate, chosen.id, Date.now());
      }
      setOrthographySelected([]);
      orthographyGroupStartedAtRef.current = Date.now();
      setOrthographySession({
        folderId: null,
        mode: session.mode,
        groupIds,
        results: null,
        groupNumber: Math.floor(session.history.length / 4) + 1,
        responses: session.history.length,
        correctResponses: session.history.filter((r) => r.rating !== "again")
          .length,
        scopeLabel: "Ortografía",
      });
      return;
    }
    const item = session.items.find((i) => i.id === next.id)!;
    setReviewQueue((q) => [
      ...q,
      {
        cardId: next.id,
        reinforcement: item.attempts > 0,
        reason:
          item.lastRating === "again"
            ? "again"
            : item.attempts
              ? "hard"
              : "scheduled",
        completed: false,
      },
    ]);
    cardShownAtRef.current = Date.now();
  }

  function resumeCardSession() {
    const current = stateRef.current;
    const session = current?.settings.activeCardSession;
    if (!current || !validSession(session)) return;
    closeOrthographySession();
    setStudyFlow(null);
    presentationKeyRef.current = "";
    setReviewQueue([]);
    setReviewIndex(0);
    setStudyMode(session.mode);
    setSessionDone(session.history.length);
    setSessionClock(Date.now());
    setSessionOpen(true);
    showSessionNext(session, current.cards);
  }

  async function startReview(
    folderId?: string,
    mode: StudyMode = "recommended",
    explicitCardIds?: string[],
    studyTaskId?: string,
    sourceNodeId?: string,
  ) {
    const current = stateRef.current;
    if (!current || reviewBusyRef.current) return;
    const ids = explicitCardIds?.length ? new Set(explicitCardIds) : null;
    const fullScope = ids
      ? current.cards.filter((c) => ids.has(c.id) && isStudyableCard(c))
      : cardsInFolderScope(current, folderId);
    if (!fullScope.length) return notify("Aún no hay tarjetas para estudiar");
    const ortho = fullScope.filter(isOrthographyCard);
    if (ortho.length === fullScope.length) {
      setSessionOpen(false);
      startOrthographySession(folderId, mode, ortho);
      return;
    }
    if (ids && ortho.length)
      return notify("Selecciona Ortografía por separado de los otros tipos");
    let scope = fullScope.filter((c) => !isOrthographyCard(c));
    const now = new Date();
    if (mode === "weakest")
      scope = weakestStudyCards(scope, current.reviews, personalModel);
    let pool = mode === "random" ? shuffled(scope) : scope;
    if (mode === "recommended") {
      const due = scope
        .filter((c) => c.reviewCount > 0 && Date.parse(c.dueAt) <= +now)
        .sort(
          (a, b) =>
            predictPersonalRecall(a, current.reviews, personalModel, now)
              .probability -
            predictPersonalRecall(b, current.reviews, personalModel, now)
              .probability,
        );
      const learning = due.filter(isLearning);
      const ordinary = due
        .filter((c) => !isLearning(c))
        .slice(
          0,
          Math.max(0, current.settings.dailyReviewGoal - learning.length),
        );
      const fresh = scope
        .filter((c) => !c.reviewCount)
        .slice(
          0,
          Math.min(
            current.settings.dailyNewLimit,
            Math.max(
              0,
              current.settings.dailyReviewGoal -
                learning.length -
                ordinary.length,
            ),
          ),
        );
      pool = [...learning, ...ordinary, ...fresh];
    }
    if (!pool.length)
      return notify(
        mode === "weakest"
          ? "No hay tarjetas falladas"
          : "Todo al día. Puedes iniciar un repaso libre.",
      );
    const session = {
      ...createCardSession(pool, mode, uid(), +now),
      studyTaskId,
      sourceNodeId,
    };
    reviewBusyRef.current = true;
    setReviewSaving(true);
    const saved = await updateState((c) => ({
      ...c,
      settings: { ...c.settings, activeCardSession: session },
    }));
    reviewBusyRef.current = false;
    setReviewSaving(false);
    if (!saved) return;
    closeOrthographySession();
    setStudyFlow(null);
    presentationKeyRef.current = "";
    setStudyMode(mode);
    setReviewQueue([]);
    setReviewIndex(0);
    setSessionDone(0);
    setSessionClock(+now);
    setSessionOpen(true);
    showSessionNext(session, pool);
  }

  function currentSelectionIsCorrect(card: Card) {
    if (!isMultipleChoiceCard(card)) return true;
    const correct = cardCorrectOptions(card);
    const selected = isMultipleAnswerTest(card)
      ? selectedOptions
      : selectedOption === null
        ? []
        : [selectedOption];
    return selected.length > 0 && sameNumberSet(selected, correct);
  }

  function submitWrittenAnswer() {
    if (!currentCard || !isWrittenCard(currentCard) || !writtenAnswer.trim())
      return;
    const result = evaluateWrittenAnswer(currentCard, writtenAnswer);
    if (!result)
      return notify(
        "Esta respuesta escrita no tiene una rúbrica válida. Vuelve a importarla desde ChatGPT / JSON.",
      );
    setWrittenResult(result);
    setRevealed(true);
  }

  function goToPreviousCard() {
    if (!reviewBusyRef.current && reviewIndex > 0) setReviewIndex((i) => i - 1);
  }

  async function goToNextCard() {
    if (reviewBusyRef.current) return;
    if (currentQueueItem?.completed && reviewIndex < reviewQueue.length - 1) {
      setReviewIndex((i) => i + 1);
      return;
    }
    const current = stateRef.current,
      session = current?.settings.activeCardSession;
    if (!current || !validSession(session)) return;
    let next = session;
    if (currentCard && !currentQueueItem?.completed) {
      next = skipSessionCard(session, currentCard.id, Date.now());
      reviewBusyRef.current = true;
      setReviewSaving(true);
      const saved = await updateState((c) => ({
        ...c,
        settings: { ...c.settings, activeCardSession: next },
      }));
      reviewBusyRef.current = false;
      setReviewSaving(false);
      if (!saved) return;
      setReviewQueue((q) =>
        q.map((item, i) =>
          i === reviewIndex ? { ...item, completed: true } : item,
        ),
      );
    }
    setReviewIndex(reviewQueue.length);
    setSessionClock(Date.now());
    showSessionNext(next, current.cards);
  }

  function markCurrentUnknown() {
    if (!currentCard || currentQueueItem?.completed) return;
    const zeroResult = isWrittenCard(currentCard)
      ? zeroWrittenAnswerResult(currentCard)
      : null;
    recordCurrentReview("again", zeroResult, false, "unknown");
  }

  function rateCurrent(
    rating: Rating,
    writtenEvaluation?: WrittenAnswerResult | null,
  ) {
    recordCurrentReview(rating, writtenEvaluation, true, "rated");
  }

  async function recordCurrentReview(
    rating: Rating,
    writtenEvaluation: WrittenAnswerResult | null | undefined,
    advance: boolean,
    outcome: ReviewQueueOutcome,
  ) {
    const current = stateRef.current,
      session = current?.settings.activeCardSession;
    if (
      !current ||
      !currentCard ||
      !currentQueueItem ||
      currentQueueItem.completed ||
      !validSession(session) ||
      reviewBusyRef.current
    )
      return;
    const card = current.cards.find((c) => c.id === currentCard.id);
    const item = session.items.find((i) => i.id === card?.id);
    if (!card || !item || !["new", "reinforce"].includes(item.status)) return;
    reviewBusyRef.current = true;
    setReviewSaving(true);
    const now = new Date();
    const effective: Rating =
      isMultipleChoiceCard(card) && !currentSelectionIsCorrect(card)
        ? "again"
        : rating;
    const reinforcement = item.attempts > 0;
    const scheduled = applyFsrsReview(card, effective, now, reinforcement);
    const updated =
      writtenEvaluation && isWrittenCard(card)
        ? applyWrittenStats(scheduled, writtenEvaluation)
        : scheduled;
    const review: Review = {
      id: uid(),
      cardId: card.id,
      rating: effective,
      correct: effective !== "again",
      accuracy: outcome === "unknown" ? 0 : writtenEvaluation?.accuracy,
      reviewedAt: now.toISOString(),
      responseMs: Math.max(0, +now - cardShownAtRef.current),
      sessionMode: session.mode,
      reinforcement,
      predictedRecall: predictPersonalRecall(
        card,
        current.reviews,
        personalModel,
        now,
      ).probability,
      fsrsRetrievability: fsrsCurrentRetrievability(card, now),
      schedulerVersion: "ts-fsrs-5.4.2",
      fsrsBefore: fsrsSnapshot(card),
      fsrsAfter: fsrsSnapshot(updated),
    };
    const nextSession = answerSession(
      session,
      updated,
      effective,
      review.id,
      +now,
    );
    const cards = current.cards.map((c) => (c.id === updated.id ? updated : c));
    const summary = sessionSummary(nextSession);
    const completed =
      nextSessionCard(nextSession, cards, +now).kind === "complete" &&
      summary.remembered === summary.total;
    const stamp = now.toISOString(),
      eventId = "session-" + uid();
    const saved = await updateState((c) => ({
      ...c,
      cards: c.cards.map((v) => (v.id === updated.id ? updated : v)),
      reviews: [...c.reviews, review],
      settings: { ...c.settings, activeCardSession: nextSession },
      studyTasks:
        completed && session.studyTaskId
          ? c.studyTasks.map((t) =>
              t.id === session.studyTaskId && t.status === "pending"
                ? {
                    ...t,
                    status: "done",
                    assessment: "bien",
                    completedAt: stamp,
                    completionNote: t.completionNote || "",
                    _completionEventId: eventId,
                  }
                : t,
            )
          : c.studyTasks,
    }));
    reviewBusyRef.current = false;
    setReviewSaving(false);
    if (!saved) return;
    setReviewQueue((q) =>
      q.map((v, i) =>
        i === reviewIndex ? { ...v, completed: true, outcome } : v,
      ),
    );
    setSessionDone(nextSession.history.length);
    setSessionClock(+now);
    if (advance) {
      setReviewIndex(reviewQueue.length);
      showSessionNext(nextSession, cards);
    } else {
      setWrittenAnswer("");
      setWrittenResult(null);
      setRevealed(true);
    }
  }

  function importGeneratedCards(items: ParsedImportItem[]) {
    if (!state)
      return { imported: 0, skipped: items.length, foldersCreated: 0 };

    const folders = [...state.folders];
    const cards = [...state.cards];
    const topLevelByName = new Map(
      folders
        .filter((folder) => !folder.parentId)
        .map((folder) => [folder.name.trim().toLocaleLowerCase("es"), folder]),
    );
    const childByParentAndName = new Map(
      folders
        .filter((folder) => folder.parentId)
        .map((folder) => [
          `${folder.parentId}::${folder.name.trim().toLocaleLowerCase("es")}`,
          folder,
        ]),
    );
    let imported = 0;
    const skipped = 0;
    let foldersCreated = 0;

    for (const item of items) {
      const tema = item.tema.trim() || "Importado";
      const temaKey = tema.toLocaleLowerCase("es");
      let theme = topLevelByName.get(temaKey);
      if (!theme) {
        theme = {
          id: uid(),
          name: tema,
          color: colors[folders.length % colors.length],
          parentId: null,
          createdAt: nowIso(),
        };
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
          child = {
            id: uid(),
            name: subtema,
            color: theme.color,
            parentId: theme.id,
            createdAt: nowIso(),
          };
          folders.push(child);
          childByParentAndName.set(childKey, child);
          foldersCreated += 1;
        }
        folder = child;
      }

      const type: CardType =
        item.tipo === "ortografia"
          ? "orthography"
          : item.tipo === "respuesta_escrita"
            ? "written"
            : item.tipo === "test"
              ? "test"
              : item.tipo === "vocabulario"
                ? "choice"
                : "basic";
      const correctOptions = isMultipleChoiceType(type)
        ? item.correctas
            .map((letter) => "ABCD".indexOf(letter))
            .filter((index) => index >= 0)
        : [];
      const correctOption = correctOptions[0] ?? 0;
      const isOrthography = item.tipo === "ortografia";
      const isWritten = item.tipo === "respuesta_escrita";
      const word = isOrthography ? item.palabra : item.pregunta;
      cards.push({
        id: uid(),
        folderId: folder.id,
        type,
        front: sanitizeRichHtml(
          `<p>${escapeHtml(word).replaceAll("\n", "<br>")}</p>`,
        ),
        back: isOrthography
          ? orthographyBackHtml(
              item.palabra,
              item.esCorrecta === true,
              item.formaCorrecta,
              item.explicacion,
              item.fuente,
            )
          : importedBackHtml(item),
        options:
          isWritten && item.evaluacion
            ? [encodeWrittenRubric(item.evaluacion)]
            : isMultipleChoiceType(type)
              ? item.opciones.slice(0, 4)
              : [],
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
      imported += 1;
    }

    if (imported > 0) {
      updateState((current) => ({ ...current, folders, cards }));
      notify(
        `${imported} elementos importados${foldersCreated ? ` · ${foldersCreated} temas/subtemas nuevos` : ""}`,
      );
    }
    return { imported, skipped, foldersCreated };
  }

  function openAttemptEditor(testId: string, attemptId: string | null = null) {
    setSelectedPsych(testId);
    setEditingAttempt(attemptId);
    setModal("attempt");
  }

  function deleteAttempt(testId: string, attemptId: string) {
    if (
      !confirm(
        "¿Eliminar este intento? La puntuación dejará de contar en las estadísticas.",
      )
    )
      return;
    updateState((current) => ({
      ...current,
      psychTests: current.psychTests.map((test) =>
        test.id === testId
          ? {
              ...test,
              attempts: test.attempts.filter(
                (attempt) => attempt.id !== attemptId,
              ),
            }
          : test,
      ),
    }));
    notify("Intento eliminado");
  }

  function deletePsychTest(testId: string) {
    if (
      !confirm(
        "¿Eliminar este psicotécnico y todo su historial de intentos? El archivo seguirá disponible en tu cuenta hasta que lo elimines expresamente.",
      )
    )
      return;
    updateState((current) => ({
      ...current,
      psychTests: current.psychTests.filter((test) => test.id !== testId),
    }));
    if (psychDetail === testId) setPsychDetail(null);
    notify("Psicotécnico eliminado");
  }

  function moveFolder(folderId: string, targetParentId: string | null) {
    if (!state) return;
    const folder = state.folders.find((item) => item.id === folderId);
    if (!folder) return notify("No se ha encontrado el tema que quieres mover");
    if (targetParentId === folderId)
      return notify("Un tema no puede estar dentro de sí mismo");
    if (targetParentId) {
      const descendants = descendantFolderIds(state.folders, folderId);
      if (descendants.has(targetParentId))
        return notify(
          "No puedes mover un tema dentro de uno de sus propios apartados",
        );
      if (!state.folders.some((item) => item.id === targetParentId))
        return notify("No se ha encontrado el destino");
    }
    if (folder.parentId === targetParentId) {
      setMovingFolderId(null);
      return;
    }
    const destination = targetParentId
      ? (state.folders.find((item) => item.id === targetParentId)?.name ??
        "el destino")
      : "Biblioteca";
    updateState((current) => ({
      ...current,
      folders: moveBranch(current.folders, folderId, targetParentId),
    }));
    setMovingFolderId(null);
    notify(
      targetParentId
        ? `${folder.name} movido dentro de ${destination}`
        : `${folder.name} movido al nivel principal`,
    );
  }

  function deleteFolder(folderId: string) {
    if (!state) return;
    const ids = descendantFolderIds(state.folders, folderId);
    const label =
      ids.size > 1
        ? "este tema, sus subtemas y todas sus tarjetas"
        : "este subtema y todas sus tarjetas";
    if (!confirm(`¿Eliminar ${label}?`)) return;
    const parentId =
      state.folders.find((folder) => folder.id === folderId)?.parentId ?? null;
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

  const accuracy = state.reviews.length
    ? Math.round(
        (state.reviews.filter((review) => review.correct).length /
          state.reviews.length) *
          100,
      )
    : 0;
  const mastered = state.cards.filter(
    (card) => card.intervalDays >= 21 && card.streak >= 3,
  ).length;
  const orthographyCards = state.cards.filter(isOrthographyCard);
  const orthographyIds = new Set(orthographyCards.map((card) => card.id));
  const orthographyReviews = state.reviews.filter((review) =>
    orthographyIds.has(review.cardId),
  );
  const orthographyStudiedIds = new Set(
    orthographyReviews.map((review) => review.cardId),
  );
  const orthographyStudied = orthographyStudiedIds.size;
  const orthographyMastered = orthographyCards.filter(
    (card) => card.intervalDays >= 21 && card.streak >= 3,
  ).length;
  const orthographyLearning = Math.max(
    0,
    orthographyStudied - orthographyMastered,
  );
  const orthographyAccuracy = orthographyReviews.length
    ? Math.round(
        (orthographyReviews.filter((review) => review.correct).length /
          orthographyReviews.length) *
          100,
      )
    : 0;
  const orthographyDue = orthographyCards.filter(
    (card) =>
      card.reviewCount > 0 && new Date(card.dueAt).getTime() <= Date.now(),
  ).length;
  const orthographyFailures = new Map<string, number>();
  for (const review of orthographyReviews)
    if (!review.correct)
      orthographyFailures.set(
        review.cardId,
        (orthographyFailures.get(review.cardId) ?? 0) + 1,
      );
  const weakestOrthography = [...orthographyCards]
    .filter((card) => (orthographyFailures.get(card.id) ?? 0) > 0)
    .sort(
      (a, b) =>
        (orthographyFailures.get(b.id) ?? 0) -
        (orthographyFailures.get(a.id) ?? 0),
    )
    .slice(0, 5);
  const nextOrthography = [...orthographyCards]
    .filter((card) => card.reviewCount > 0)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, 5);
  const psychCategories = Array.from(
    new Set(state.psychTests.map((test) => test.category).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "es"));
  const filteredPsychTests = sortPsychTests(
    state.psychTests.filter((test) => {
      const query = psychQuery.trim().toLocaleLowerCase("es");
      const matchesQuery =
        !query ||
        `${test.name} ${test.category}`.toLocaleLowerCase("es").includes(query);
      const matchesCategory =
        psychCategory === "all" || test.category === psychCategory;
      return matchesQuery && matchesCategory;
    }),
    psychSort,
  );
  const psychAttemptCount = state.psychTests.reduce(
    (sum, test) => sum + test.attempts.length,
    0,
  );
  const psychAttemptedCount = state.psychTests.filter(
    (test) => test.attempts.length > 0,
  ).length;
  const latestPsychScores = state.psychTests
    .map((test) => psychStats(test).last?.score)
    .filter((score): score is number => score !== undefined);
  const latestPsychAverage = latestPsychScores.length
    ? latestPsychScores.reduce((sum, score) => sum + score, 0) /
      latestPsychScores.length
    : null;
  const studyRoots = state.studyNodes.filter((node) => !node.parentId);
  const studyPending = state.studyTasks
    .filter((task) => task.status === "pending")
    .sort(
      (a, b) =>
        a.plannedFor.localeCompare(b.plannedFor) ||
        a.queueOrder - b.queueOrder ||
        a.createdAt.localeCompare(b.createdAt),
    );
  const studyDue = dueStudyTasks(studyPending);
  const studyUpcoming = studyPending
    .filter((task) => task.plannedFor > localDateKey())
    .slice(0, 8);
  const studyCompleted = state.studyTasks
    .filter((task) => task.status === "done")
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  const studyHistoryIds =
    studyHistoryRoot === "all"
      ? null
      : studyDescendantIds(state.studyNodes, studyHistoryRoot);
  const filteredStudyCompleted = studyHistoryIds
    ? studyCompleted.filter((task) => studyHistoryIds.has(task.nodeId))
    : studyCompleted;
  const studyWeakCount = studyCompleted.filter(
    (task) => task.assessment === "mal" || task.assessment === "regular",
  ).length;
  const studySelectedDeleteIds = new Set<string>();
  selectedStudyNodeIds.forEach((nodeId) =>
    studyDescendantIds(state.studyNodes, nodeId).forEach((id) =>
      studySelectedDeleteIds.add(id),
    ),
  );
  const studySelectedTaskCount = state.studyTasks.filter((task) =>
    studySelectedDeleteIds.has(task.nodeId),
  ).length;

  const saveStatus = !online
    ? "Sin conexión"
    : sync === "saved"
      ? "Guardado"
      : sync === "error"
        ? "Guardado aquí"
        : "Guardando…";
  const todayCompleted = studyCompleted.filter(
    (t) =>
      t.completedAt && localDateKey(new Date(t.completedAt)) === localDateKey(),
  );
  const plannedStudyDue = studyDue.filter((t) => t.reason === "estudio");
  const reviewTreeDue = studyDue.filter((t) => t.reason !== "estudio");
  const studyFlowDone = Boolean(
    studyFlow && studyFlow.index >= studyFlow.entries.length,
  );
  const activeStudyEntry = studyFlow?.entries[studyFlow.index];
  const studyFlowNode = state.studyNodes.find(
    (n) => n.id === activeStudyEntry?.nodeId,
  );
  const studyFlowTask = state.studyTasks.find(
    (t) => t.id === activeStudyEntry?.taskId,
  );
  const previousStudySession = studyCompleted.find(
    (t) => t.nodeId === studyFlowNode?.id,
  );
  const studyReference =
    typeof (studyFlowNode as any)?.content === "string"
      ? (studyFlowNode as any).content
      : typeof (studyFlowNode as any)?.reference === "string"
        ? (studyFlowNode as any).reference
        : undefined;
  function startTodayReview() {
    if (savedCardSession && sessionNext?.kind !== "complete")
      resumeCardSession();
    else if (dueCards.length) startReview();
    else if (orthographyDue)
      startOrthographySession(undefined, "recommended", orthographyCards);
    else if (reviewTreeDue.length) startStudySession(undefined, reviewTreeDue);
    else if (state!.cards.length) startReview(undefined, "all");
    else navigate("study");
  }
  const priorities: PriorityItem[] = [
    ...reviewTreeDue.slice(0, 2).map((task) => ({
      id: task.id,
      title:
        state!.studyNodes.find((n) => n.id === task.nodeId)?.name ?? "Apartado",
      subtitle: task.note || "Repaso del temario",
      kind: "review" as const,
      onStart: () =>
        startStudySession(undefined, [
          task,
          ...reviewTreeDue.filter((t) => t.id !== task.id),
        ]),
    })),
    ...dueCards
      .slice(0, Math.max(0, 2 - Math.min(2, reviewTreeDue.length)))
      .map((card) => ({
        id: card.id,
        title: plainRichText(card.front),
        subtitle:
          state!.folders.find((f) => f.id === card.folderId)?.name ?? "Tarjeta",
        kind: "review" as const,
        onStart: () =>
          startReview(undefined, "all", [
            card.id,
            ...dueCards.filter((c) => c.id !== card.id).map((c) => c.id),
          ]),
      })),
    ...plannedStudyDue.slice(0, 1).map((task) => ({
      id: task.id,
      title:
        state!.studyNodes.find((n) => n.id === task.nodeId)?.name ?? "Apartado",
      subtitle: "Estudio planificado",
      kind: "study" as const,
      onStart: () =>
        startStudySession(undefined, [
          task,
          ...plannedStudyDue.filter((t) => t.id !== task.id),
        ]),
    })),
  ].slice(0, 3);

  const filteredLibraryCards = state.cards.filter(
    (card) =>
      (libraryType === "all" || card.type === libraryType) &&
      `${plainRichText(card.front)} ${plainRichText(card.back)} ${folderPathLabel(state.folders, card.folderId)}`
        .toLocaleLowerCase("es")
        .includes(libraryQuery.trim().toLocaleLowerCase("es")),
  );

  return (
    <div
      className={`app-shell app-v11 app-v12 ${sessionOpen || orthographySession || studyFlow ? "session-active" : ""}`}
    >
      <AppNavigation tab={tab} onNavigate={navigate} status={saveStatus} />
      <main className="ux-main">
        <header
          className={`ux-topbar ${tab === "today" ? "today-topbar" : ""}`}
        >
          <div>
            {["library", "organize", "psych"].includes(tab) && (
              <button className="ux-link" onClick={() => navigate("more")}>
                <Icon name="back" size={17} />
                Más
              </button>
            )}
            {tab === "today" ? (
              <span className="ux-header-brand">
                OpoGC <small>Mi preparación</small>
              </span>
            ) : (
              <h1>
                {
                  {
                    study: "Estudiar",
                    review: "Repasar",
                    progress: "Progreso",
                    more: "Más",
                    library: "Biblioteca",
                    organize: "Organizar estudio",
                    psych: "Psicotécnicos",
                    today: "Hoy",
                  }[tab]
                }
              </h1>
            )}
          </div>
          <span
            className={`ux-save-status ${!online ? "offline" : ""}`}
            role="status"
          >
            <span className="status-dot" />
            {saveStatus}
          </span>
        </header>
        {tab === "today" && (
          <TodayPage
            reviewPending={
              dueCards.length + orthographyDue + reviewTreeDue.length
            }
            cardPending={dueCards.length + orthographyDue}
            reviewDone={
              todayReviews.length +
              todayCompleted.filter((t) => t.reason !== "estudio").length
            }
            studyPending={plannedStudyDue.length}
            studyDone={
              todayCompleted.filter((t) => t.reason === "estudio").length
            }
            nextStudy={
              state.studyNodes.find((n) => n.id === plannedStudyDue[0]?.nodeId)
                ?.name
            }
            priorities={priorities}
            hasCards={state.cards.length > 0}
            preparation={
              state.studyNodes.find((n) => !n.parentId)?.name ??
              "Mi oposición · a tu ritmo"
            }
            onReview={startTodayReview}
            onStudy={() => startStudyWithContent(undefined, plannedStudyDue)}
            onPlanning={() => {
              navigate("organize");
              setStudyView("today");
            }}
          />
        )}
        {tab === "study" && (
          <StudyStartPage
            nodes={state.studyNodes}
            tasks={plannedStudyDue}
            onContinue={() => startStudyWithContent(undefined, plannedStudyDue)}
            onNode={(id) => startStudyWithContent(id)}
            newCards={
              state.cards.filter((c) => !c.reviewCount && !isOrthographyCard(c))
                .length
            }
            onCards={() =>
              startReview(
                undefined,
                "learn",
                state.cards
                  .filter((c) => !c.reviewCount && !isOrthographyCard(c))
                  .slice(0, state.settings.dailyNewLimit)
                  .map((c) => c.id),
              )
            }
            onResume={
              savedCardSession && sessionNext?.kind !== "complete"
                ? resumeCardSession
                : undefined
            }
            onOrganize={() => {
              navigate("organize");
              setStudyView("tree");
            }}
            onPlan={() => {
              navigate("organize");
              setStudyView("today");
            }}
          />
        )}
        {tab === "review" && (
          <ReviewStartPage
            cards={state.cards}
            folders={state.folders}
            pending={dueCards.length + orthographyDue}
            temarioPending={reviewTreeDue.length}
            onStart={startReview}
            onPrimary={startTodayReview}
            onTemario={() => startStudySession(undefined, reviewTreeDue)}
            onLibrary={() => navigate("library")}
          />
        )}
        {tab === "more" && (
          <MorePage
            onNavigate={(next) => {
              navigate(next);
              if (next === "organize") setStudyView("today");
            }}
            onAccount={() =>
              window.dispatchEvent(new CustomEvent("opogc:account"))
            }
            onSettings={() => setPreferencesOpen(true)}
          />
        )}
        {tab === "library" && (
          <section className="page">
            <div className="library-top-actions">
              <div className="ux-search">
                <Icon name="search" size={20} />
                <input
                  placeholder="Buscar temas o tarjetas"
                  aria-label="Buscar biblioteca"
                  value={libraryQuery}
                  onChange={(event) => setLibraryQuery(event.target.value)}
                />
              </div>
              <div>
                <button
                  className="primary-button"
                  onClick={() => {
                    setEditingCard(null);
                    setModal("card");
                  }}
                >
                  <Icon name="plus" size={18} />
                  Tarjeta
                </button>
                <button
                  className="icon-button"
                  aria-label="Opciones de la biblioteca"
                  onClick={() => setLibraryActionsOpen(true)}
                >
                  <Icon name="more" />
                </button>
              </div>
            </div>
            <div className="library-filter-row">
              <label>
                Tipo
                <select
                  aria-label="Filtrar tipo de tarjeta"
                  value={libraryType}
                  onChange={(event) => setLibraryType(event.target.value)}
                >
                  <option value="all">Todos los tipos</option>
                  <option value="basic">Flashcards</option>
                  <option value="choice">Vocabulario</option>
                  <option value="test">Test</option>
                  <option value="orthography">Ortografía</option>
                  <option value="written">Respuesta escrita</option>
                </select>
              </label>
            </div>
            {libraryQuery.trim() || libraryType !== "all" ? (
              <div className="library-results simple-list">
                {filteredLibraryCards.map((card) => (
                  <div className="simple-row" key={card.id}>
                    <button
                      className="library-result-main"
                      onClick={() => startReview(undefined, "all", [card.id])}
                    >
                      <strong>{plainRichText(card.front)}</strong>
                      <small>
                        {cardTypeLabel(card.type)} ·{" "}
                        {folderPathLabel(state.folders, card.folderId)}
                      </small>
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Editar tarjeta"
                      onClick={() => {
                        setEditingCard(card.id);
                        setModal("card");
                      }}
                    >
                      ✎
                    </button>
                  </div>
                ))}
                {!filteredLibraryCards.length && (
                  <p className="empty-inline">
                    No hay tarjetas con esta búsqueda. Prueba otro término o
                    cambia el tipo.
                  </p>
                )}
              </div>
            ) : !activeFolder ? (
              <>
                <div className="section-heading">
                  <div>
                    <span className="section-label">ORGANIZACIÓN</span>
                    <h2>Temas de estudio</h2>
                    <p>
                      Cada tema puede contener subtemas. Puedes estudiar un tema
                      completo o entrar en una parte concreta.
                    </p>
                  </div>
                  <span>
                    {state.folders.filter((folder) => !folder.parentId).length}{" "}
                    temas ·{" "}
                    {state.folders.filter((folder) => folder.parentId).length}{" "}
                    subtemas · {state.cards.length} tarjetas
                  </span>
                </div>
                <div className="folder-grid">
                  {orderedChildren(state.folders, null).map((folder) => {
                    const cards = cardsInFolderScope(state, folder.id);
                    const reviewed = cards.filter(
                      (card) => card.reviewCount > 0,
                    ).length;
                    const pct = cards.length
                      ? Math.round((reviewed / cards.length) * 100)
                      : 0;
                    const children = state.folders.filter(
                      (item) => item.parentId === folder.id,
                    ).length;
                    return (
                      <button
                        className="folder-card"
                        key={folder.id}
                        onClick={() => setSelectedFolder(folder.id)}
                      >
                        <span
                          className="folder-icon"
                          style={{
                            background: `${folder.color}18`,
                            color: folder.color,
                          }}
                        >
                          ▰
                        </span>
                        <span
                          className="folder-menu folder-menu-action"
                          title="Opciones de carpeta"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedFolder(folder.id);
                            setLibraryActionsOpen(true);
                          }}
                        >
                          •••
                        </span>
                        <strong>{folder.name}</strong>
                        <small>
                          {cards.length} tarjetas · {children}{" "}
                          {children === 1 ? "apartado" : "apartados"}
                        </small>
                        <span className="progress-track">
                          <span
                            style={{
                              width: `${pct}%`,
                              background: folder.color,
                            }}
                          />
                        </span>
                        <span className="folder-progress">{pct}% visto</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              (() => {
                const parent = activeFolder.parentId
                  ? (state.folders.find(
                      (folder) => folder.id === activeFolder.parentId,
                    ) ?? null)
                  : null;
                const children = orderedChildren(
                  state.folders,
                  activeFolder.id,
                );
                const scopeCards = cardsInFolderScope(state, activeFolder.id);
                const writtenScopeCards = scopeCards.filter(isWrittenCard);
                const directCards = orderedChildren(
                  state.cards,
                  activeFolder.id,
                  "folderId",
                );
                const isTheme = !activeFolder.parentId;
                return (
                  <div>
                    <div className="folder-breadcrumb">
                      <button
                        className="back-button"
                        onClick={() => setSelectedFolder(parent?.id ?? null)}
                      >
                        ← {parent ? parent.name : "Todos los temas"}
                      </button>
                      {parent && (
                        <span>
                          {parent.name} / <strong>{activeFolder.name}</strong>
                        </span>
                      )}
                    </div>
                    <div className="folder-title">
                      <div>
                        <span
                          className="folder-icon large"
                          style={{
                            background: `${activeFolder.color}18`,
                            color: activeFolder.color,
                          }}
                        >
                          ▰
                        </span>
                        <div>
                          <span className="section-label">
                            {isTheme ? "TEMA" : "APARTADO"}
                          </span>
                          <h2>{activeFolder.name}</h2>
                          <p>
                            {scopeCards.length} tarjetas
                            {children.length
                              ? ` · ${children.length} ${children.length === 1 ? "apartado" : "apartados"}`
                              : ""}
                          </p>
                        </div>
                      </div>
                      <div className="folder-study-actions">
                        <button
                          className="icon-button library-folder-menu"
                          aria-label="Opciones de la carpeta"
                          onClick={() => setLibraryActionsOpen(true)}
                        >
                          <Icon name="more" />
                        </button>
                        <button
                          className="secondary-button danger"
                          onClick={() => deleteFolder(activeFolder.id)}
                        >
                          Eliminar
                        </button>
                        <button
                          className="secondary-button"
                          onClick={() => setMovingFolderId(activeFolder.id)}
                        >
                          Mover
                        </button>
                        <button
                          className="secondary-button"
                          onClick={() => {
                            setNewFolderParentId(activeFolder.id);
                            setModal("folder");
                          }}
                        >
                          ＋ Añadir dentro
                        </button>
                        {isTheme && scopeCards.length > 0 && (
                          <button
                            className={`secondary-button ${bulkSelectMode ? "active-selection" : ""}`}
                            onClick={() => {
                              setBulkSelectMode((value) => !value);
                              setSelectedCardIds([]);
                              setBulkTargetFolderId("");
                            }}
                          >
                            {bulkSelectMode
                              ? "Cancelar selección"
                              : "Seleccionar"}
                          </button>
                        )}
                        <button
                          className="secondary-button"
                          onClick={() =>
                            startReview(activeFolder.id, "recommended")
                          }
                        >
                          Repaso programado
                        </button>
                        <button
                          className="secondary-button"
                          onClick={() =>
                            startReview(activeFolder.id, "weakest")
                          }
                        >
                          🔥 Más falladas
                        </button>
                        <button
                          className="secondary-button"
                          onClick={() => startReview(activeFolder.id, "random")}
                        >
                          🎲 Aleatorias
                        </button>
                        {writtenScopeCards.length > 0 && (
                          <button
                            className="secondary-button"
                            onClick={() =>
                              startReview(
                                activeFolder.id,
                                "learn",
                                writtenScopeCards.map((card) => card.id),
                              )
                            }
                          >
                            ✍ Respuesta escrita
                          </button>
                        )}
                        <button
                          className="primary-button"
                          onClick={() => startReview(activeFolder.id, "learn")}
                        >
                          ◎ Aprender
                        </button>
                      </div>
                    </div>

                    {children.length > 0 && (
                      <section className="subtopic-section">
                        <div className="subtopic-heading">
                          <span className="section-label">APARTADOS</span>
                          <p>
                            Puedes entrar en cualquier rama y seguir bajando por
                            el árbol sin perder sus tarjetas.
                          </p>
                        </div>
                        <div className="subtopic-grid">
                          {children.map((child) => {
                            const childCards = cardsInFolderScope(
                              state,
                              child.id,
                            );
                            const reviewed = childCards.filter(
                              (card) => card.reviewCount > 0,
                            ).length;
                            const pct = childCards.length
                              ? Math.round((reviewed / childCards.length) * 100)
                              : 0;
                            const childIds = childCards.map((card) => card.id);
                            const childSelected =
                              childIds.length > 0 &&
                              childIds.every((id) =>
                                selectedCardIds.includes(id),
                              );
                            return (
                              <button
                                key={child.id}
                                className="subtopic-card"
                                disabled={
                                  bulkSelectMode && childIds.length === 0
                                }
                                onClick={() => {
                                  if (!bulkSelectMode) {
                                    setSelectedFolder(child.id);
                                    return;
                                  }
                                  setSelectedCardIds((current) => {
                                    const next = new Set(current);
                                    const allSelected =
                                      childIds.length > 0 &&
                                      childIds.every((id) => next.has(id));
                                    if (allSelected)
                                      childIds.forEach((id) => next.delete(id));
                                    else childIds.forEach((id) => next.add(id));
                                    return [...next];
                                  });
                                }}
                              >
                                {bulkSelectMode ? (
                                  <span
                                    className="card-select-check"
                                    style={
                                      childSelected
                                        ? {
                                            borderColor: "var(--green)",
                                            background: "var(--green)",
                                          }
                                        : undefined
                                    }
                                  >
                                    {childSelected ? "✓" : ""}
                                  </span>
                                ) : (
                                  <span
                                    className="folder-icon"
                                    style={{
                                      background: `${child.color}18`,
                                      color: child.color,
                                    }}
                                  >
                                    ▰
                                  </span>
                                )}
                                <div>
                                  <strong>{child.name}</strong>
                                  <small>
                                    {childCards.length} tarjetas · {pct}% visto
                                  </small>
                                </div>
                                {bulkSelectMode ? <span /> : <span>→</span>}
                              </button>
                            );
                          })}
                        </div>
                        {bulkSelectMode && isTheme && (
                          <div
                            className="bulk-card-toolbar"
                            style={{ marginTop: 12 }}
                          >
                            <div className="bulk-card-summary">
                              <strong>
                                {selectedCardIds.length} seleccionada
                                {selectedCardIds.length === 1 ? "" : "s"}
                              </strong>
                              <button
                                type="button"
                                className="text-button"
                                onClick={() => {
                                  const scopeIds = scopeCards.map(
                                    (card) => card.id,
                                  );
                                  const allSelected =
                                    scopeIds.length > 0 &&
                                    scopeIds.every((id) =>
                                      selectedCardIds.includes(id),
                                    );
                                  setSelectedCardIds(
                                    allSelected ? [] : scopeIds,
                                  );
                                }}
                              >
                                {scopeCards.length > 0 &&
                                scopeCards.every((card) =>
                                  selectedCardIds.includes(card.id),
                                )
                                  ? "Quitar todas"
                                  : "Seleccionar todas"}
                              </button>
                            </div>
                            <div className="bulk-study-actions">
                              <span>ESTUDIAR SELECCIÓN</span>
                              <button
                                className="secondary-button"
                                disabled={!selectedCardIds.length}
                                onClick={() =>
                                  studySelectedCards("recommended")
                                }
                              >
                                Repaso programado
                              </button>
                              <button
                                className="secondary-button"
                                disabled={!selectedCardIds.length}
                                onClick={() => studySelectedCards("weakest")}
                              >
                                🔥 Más falladas
                              </button>
                              <button
                                className="secondary-button"
                                disabled={!selectedCardIds.length}
                                onClick={() => studySelectedCards("random")}
                              >
                                🎲 Aleatorias
                              </button>
                              <button
                                className="primary-button"
                                disabled={!selectedCardIds.length}
                                onClick={() => studySelectedCards("learn")}
                              >
                                ◎ Aprender
                              </button>
                            </div>
                          </div>
                        )}
                      </section>
                    )}

                    <div className="card-section-head">
                      <div>
                        <span className="section-label">
                          {isTheme
                            ? "TARJETAS SIN SUBTEMA"
                            : "TARJETAS DEL SUBTEMA"}
                        </span>
                        <h3>
                          {directCards.length
                            ? `${directCards.length} tarjetas`
                            : "Sin tarjetas directas"}
                        </h3>
                      </div>
                      <div className="card-section-actions">
                        {directCards.length > 0 && !isTheme && (
                          <button
                            className={`secondary-button ${bulkSelectMode ? "active-selection" : ""}`}
                            onClick={() => {
                              setBulkSelectMode((value) => !value);
                              setSelectedCardIds([]);
                              setBulkTargetFolderId("");
                            }}
                          >
                            {bulkSelectMode
                              ? "Cancelar selección"
                              : "Seleccionar"}
                          </button>
                        )}
                        <button
                          className="secondary-button"
                          onClick={() => {
                            setEditingCard(null);
                            setModal("card");
                          }}
                        >
                          ＋ Tarjeta aquí
                        </button>
                      </div>
                    </div>

                    {bulkSelectMode && directCards.length > 0 && !isTheme && (
                      <div className="bulk-card-toolbar">
                        <div className="bulk-card-summary">
                          <strong>
                            {selectedCardIds.length} seleccionada
                            {selectedCardIds.length === 1 ? "" : "s"}
                          </strong>
                          <button
                            type="button"
                            className="text-button"
                            onClick={() =>
                              setSelectedCardIds(
                                selectedCardIds.length === directCards.length
                                  ? []
                                  : directCards.map((card) => card.id),
                              )
                            }
                          >
                            {selectedCardIds.length === directCards.length
                              ? "Quitar todas"
                              : "Seleccionar todas"}
                          </button>
                        </div>
                        <div className="bulk-card-actions">
                          <select
                            value={bulkTargetFolderId}
                            onChange={(event) =>
                              setBulkTargetFolderId(event.target.value)
                            }
                            aria-label="Tema o subtema de destino"
                          >
                            <option value="">Mover a tema / subtema…</option>
                            {flattenFolderTree(state.folders).map(
                              ({ folder, depth }) => (
                                <option key={folder.id} value={folder.id}>
                                  {"↳ ".repeat(depth)}
                                  {folder.name}
                                </option>
                              ),
                            )}
                          </select>
                          <button
                            className="secondary-button"
                            disabled={
                              !selectedCardIds.length || !bulkTargetFolderId
                            }
                            onClick={() =>
                              moveSelectedCards(bulkTargetFolderId)
                            }
                          >
                            Mover
                          </button>
                          <button
                            className="secondary-button danger"
                            disabled={!selectedCardIds.length}
                            onClick={deleteSelectedCards}
                          >
                            Eliminar
                          </button>
                        </div>
                        <div className="bulk-study-actions">
                          <span>ESTUDIAR SELECCIÓN</span>
                          <button
                            className="secondary-button"
                            disabled={!selectedCardIds.length}
                            onClick={() => studySelectedCards("recommended")}
                          >
                            Repaso programado
                          </button>
                          <button
                            className="secondary-button"
                            disabled={!selectedCardIds.length}
                            onClick={() => studySelectedCards("weakest")}
                          >
                            🔥 Más falladas
                          </button>
                          <button
                            className="secondary-button"
                            disabled={!selectedCardIds.length}
                            onClick={() => studySelectedCards("random")}
                          >
                            🎲 Aleatorias
                          </button>
                          <button
                            className="primary-button"
                            disabled={!selectedCardIds.length}
                            onClick={() => studySelectedCards("learn")}
                          >
                            ◎ Aprender
                          </button>
                        </div>
                      </div>
                    )}

                    {directCards.length > 0 ? (
                      <div
                        className={`card-table ${bulkSelectMode ? "selecting" : ""}`}
                      >
                        {directCards.map((card) => {
                          const selected = selectedCardIds.includes(card.id);
                          return (
                            <div
                              className={`card-row ${bulkSelectMode ? "bulk-selectable" : ""} ${selected ? "selected" : ""}`}
                              key={card.id}
                              onClick={() => {
                                if (bulkSelectMode)
                                  toggleCardSelection(card.id);
                              }}
                            >
                              {bulkSelectMode && (
                                <button
                                  type="button"
                                  className="card-select-check"
                                  aria-label={
                                    selected
                                      ? "Quitar de la selección"
                                      : "Seleccionar tarjeta"
                                  }
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    toggleCardSelection(card.id);
                                  }}
                                >
                                  {selected ? "✓" : ""}
                                </button>
                              )}
                              <span className="card-kind">
                                {cardTypeLabel(card.type)}
                                {isMultipleAnswerTest(card) ? " · MULTI" : ""}
                              </span>
                              <div>
                                <strong>
                                  {plainRichText(card.front) || "Sin pregunta"}
                                  {card.attachment ? " · 🖼️" : ""}
                                </strong>
                                <p>
                                  {plainRichText(card.back) ||
                                    (isMultipleChoiceCard(card)
                                      ? "Sin explicación añadida"
                                      : "Sin respuesta añadida")}
                                </p>
                              </div>
                              <span>
                                {isWrittenCard(card)
                                  ? writtenAverageAccuracy(card) === null
                                    ? "Sin estudiar"
                                    : `${Math.round(writtenAverageAccuracy(card) ?? 0)}% precisión`
                                  : card.reviewCount
                                    ? `${Math.round((card.successCount / card.reviewCount) * 100)}% aciertos`
                                    : "Sin estudiar"}
                              </span>
                              <div className="card-actions">
                                {!bulkSelectMode && (
                                  <button
                                    aria-label="Mover o reordenar tarjeta"
                                    onClick={() => setCardActionsId(card.id)}
                                  >
                                    <Icon name="more" size={19} />
                                  </button>
                                )}
                                {!bulkSelectMode && (
                                  <button
                                    aria-label="Editar tarjeta"
                                    title="Editar tarjeta"
                                    onClick={() => {
                                      setEditingCard(card.id);
                                      setModal("card");
                                    }}
                                  >
                                    ✎
                                  </button>
                                )}
                                {!bulkSelectMode && (
                                  <button
                                    aria-label="Eliminar tarjeta"
                                    title="Eliminar tarjeta"
                                    onClick={() =>
                                      updateState((current) => ({
                                        ...current,
                                        cards: current.cards.filter(
                                          (item) => item.id !== card.id,
                                        ),
                                      }))
                                    }
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="folder-empty-note">
                        {children.length
                          ? "Las tarjetas de este tema están organizadas dentro de sus subtemas."
                          : "Añade tarjetas a este subtema para empezar a estudiarlo."}
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </section>
        )}

        {tab === "organize" && (
          <section className="page study-organizer-page">
            <div className="study-organizer-toolbar">
              <div
                className="study-view-switch"
                role="tablist"
                aria-label="Organización de estudio"
              >
                <button
                  className={studyView === "today" ? "active" : ""}
                  onClick={() => {
                    clearStudySelection();
                    setStudyView("today");
                  }}
                >
                  Hoy
                </button>
                <button
                  className={studyView === "tree" ? "active" : ""}
                  onClick={() => setStudyView("tree")}
                >
                  Temario
                </button>
                <button
                  className={studyView === "history" ? "active" : ""}
                  onClick={() => {
                    clearStudySelection();
                    setStudyView("history");
                  }}
                >
                  Historial
                </button>
              </div>
              <div className="study-organizer-actions">
                <button
                  className="secondary-button"
                  onClick={() => openStudyNodeEditor(null, null)}
                >
                  <Icon name="plus" size={17} /> Añadir elemento
                </button>
                <button
                  className="secondary-button"
                  onClick={() => openStudyImport(null)}
                >
                  <Icon name="upload" size={17} /> Importar / actualizar
                </button>
                <button
                  className="secondary-button"
                  disabled={!state.studyNodes.length}
                  onClick={() => exportStudyData()}
                >
                  <Icon name="download" size={17} /> Exportar todo
                </button>
                <button
                  className="primary-button"
                  disabled={!state.studyNodes.length}
                  onClick={() => openStudyQuick()}
                >
                  <Icon name="plus" size={17} /> Repaso rápido
                </button>
              </div>
            </div>

            {!state.studyNodes.length ? (
              <div className="study-empty-state">
                <span className="study-empty-icon">▤</span>
                <span className="section-label">ORGANIZACIÓN DE ESTUDIO</span>
                <h2>
                  Importa tu temario una vez y anota los repasos en segundos
                </h2>
                <p>
                  Puedes pegar un árbol en JSON, pegar un índice en texto,
                  cargar un archivo .json/.txt o empezar manualmente. Después
                  puedes ampliar cualquier rama cuando quieras.
                </p>
                <div className="study-empty-actions">
                  <button
                    className="primary-button"
                    onClick={() => openStudyImport(null)}
                  >
                    Importar mi temario
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => openStudyNodeEditor(null, null)}
                  >
                    ＋ Crear tema manualmente
                  </button>
                </div>
              </div>
            ) : studyView === "today" ? (
              <StudyPlanPage
                nodes={state.studyNodes}
                tasks={state.studyTasks}
                onStart={(task) =>
                  startStudyWithContent(undefined, [
                    task,
                    ...plannedStudyDue.filter((t) => t.id !== task.id),
                  ])
                }
                onPlan={planStudyNode}
                onEdit={editStudyTask}
                onReorder={reorderStudyTask}
                onDelete={deleteStudyTask}
                onTemario={() => setStudyView("tree")}
                onHistory={() => setStudyView("history")}
              />
            ) : studyView === "tree" ? (
              <TemarioBrowser
                nodes={state.studyNodes}
                tasks={state.studyTasks}
                onStudy={(id) => startStudyWithContent(id)}
                onQuick={openStudyQuick}
                onExport={exportStudyData}
                onCreate={(parent) => openStudyNodeEditor(parent, null)}
                onEdit={(id) =>
                  openStudyNodeEditor(
                    state.studyNodes.find((n) => n.id === id)?.parentId ?? null,
                    id,
                  )
                }
                onImport={openStudyImport}
                onDelete={deleteStudyNodes}
                onReorder={reorderStudyNode}
                onMoveOut={moveStudyOut}
                onPlan={planStudyNode}
              />
            ) : (
              <>
                <div className="study-history-toolbar">
                  <div>
                    <span className="section-label">REGISTRO</span>
                    <h2>Historial de repasos</h2>
                  </div>
                  <select
                    value={studyHistoryRoot}
                    onChange={(event) =>
                      setStudyHistoryRoot(event.target.value)
                    }
                  >
                    <option value="all">Todos los temas</option>
                    {studyRoots.map((root) => (
                      <option key={root.id} value={root.id}>
                        {root.name}
                      </option>
                    ))}
                  </select>
                </div>
                <section className="panel study-history-panel">
                  {filteredStudyCompleted.length ? (
                    <div className="study-history-list">
                      {filteredStudyCompleted.map((task) => {
                        const node = state.studyNodes.find(
                          (item) => item.id === task.nodeId,
                        );
                        return (
                          <div className="study-history-row" key={task.id}>
                            <span
                              className={`study-assessment-dot ${task.assessment ?? ""}`}
                            />
                            <div>
                              <strong>
                                {node?.name ?? "Elemento eliminado"}
                              </strong>
                              <small>
                                {studyNodePath(
                                  state.studyNodes,
                                  task.nodeId,
                                ).join(" · ")}
                              </small>
                              {task.note && (
                                <p className="study-history-note">
                                  <b>Para repasar:</b> {task.note}
                                </p>
                              )}
                              {task.completionNote && (
                                <p className="study-history-completion-note">
                                  <b>Comentario:</b> {task.completionNote}
                                </p>
                              )}
                            </div>
                            <span
                              className={`study-result ${task.assessment ?? ""}`}
                            >
                              {task.assessment ?? "—"}
                            </span>
                            <time>{dateLabel(task.completedAt)}</time>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="study-inline-empty">
                      <strong>Aún no hay repasos completados.</strong>
                      <span>
                        Cuando marques un pendiente como Bien, Regular o Mal
                        aparecerá aquí.
                      </span>
                    </div>
                  )}
                </section>
              </>
            )}
          </section>
        )}

        {tab === "psych" && (
          <section className="page psych-page">
            {detailPsych ? (
              (() => {
                const stats = psychStats(detailPsych);
                return (
                  <div className="psych-detail">
                    <button
                      className="back-button"
                      onClick={() => setPsychDetail(null)}
                    >
                      ← Volver a psicotécnicos
                    </button>
                    <div className="psych-detail-head">
                      <div>
                        <span className="category-chip">
                          {detailPsych.category || "Sin categoría"}
                        </span>
                        <h2>{detailPsych.name || "Psicotécnico sin nombre"}</h2>
                        <p>
                          {detailPsych.totalQuestions || 0} preguntas · añadido
                          el {dateLabel(detailPsych.createdAt)}
                        </p>
                      </div>
                      <div className="psych-detail-actions">
                        <button
                          className="secondary-button"
                          onClick={() => {
                            setEditingPsychTest(detailPsych.id);
                            setModal("psych");
                          }}
                        >
                          Editar ficha
                        </button>
                        {detailPsych.attachment?.type === "application/pdf" ? (
                          <button
                            className="secondary-button"
                            onClick={() => setEditingPsych(detailPsych.id)}
                          >
                            ✎ Abrir PDF
                          </button>
                        ) : detailPsych.attachment ? (
                          <a
                            className="secondary-button"
                            href="#"
                            onClick={(event) => {
                              event.preventDefault();
                              setEditingPsych(detailPsych.id);
                            }}
                          >
                            Abrir documento
                          </a>
                        ) : null}
                        <button
                          className="primary-button"
                          onClick={() => openAttemptEditor(detailPsych.id)}
                        >
                          ＋ Registrar intento
                        </button>
                      </div>
                    </div>

                    <div className="psych-summary-grid">
                      <div>
                        <span>Última nota</span>
                        <strong>
                          {stats.last ? scoreLabel(stats.last.score) : "—"}
                        </strong>
                        <small>
                          {stats.last
                            ? dateLabel(stats.last.date)
                            : "Sin intentos"}
                        </small>
                      </div>
                      <div>
                        <span>Mejor nota</span>
                        <strong>
                          {stats.best === null ? "—" : scoreLabel(stats.best)}
                        </strong>
                        <small>
                          {stats.attempts.length
                            ? `${stats.attempts.length} intentos`
                            : "Sin intentos"}
                        </small>
                      </div>
                      <div>
                        <span>Nota media</span>
                        <strong>
                          {stats.average === null
                            ? "—"
                            : scoreLabel(stats.average)}
                        </strong>
                        <small>histórico completo</small>
                      </div>
                      <div>
                        <span>Último tiempo</span>
                        <strong>
                          {stats.last
                            ? `${scoreLabel(stats.last.minutes)} min`
                            : "—"}
                        </strong>
                        <small>
                          {stats.last
                            ? `${stats.last.correct} ✓ · ${stats.last.wrong} ✕ · ${stats.last.blank} —`
                            : "Sin datos"}
                        </small>
                      </div>
                    </div>

                    <section className="panel psych-history-panel">
                      <div className="panel-head">
                        <div>
                          <span className="section-label">HISTORIAL</span>
                          <h3>Todos los intentos</h3>
                        </div>
                        <span className="psych-history-count">
                          {stats.attempts.length}{" "}
                          {stats.attempts.length === 1
                            ? "registro"
                            : "registros"}
                        </span>
                      </div>
                      {stats.attempts.length ? (
                        <div className="attempt-history">
                          {stats.attempts.map((attempt, index) => (
                            <div
                              className="attempt-history-row"
                              key={attempt.id}
                            >
                              <div className="attempt-rank">
                                <span>{stats.attempts.length - index}</span>
                              </div>
                              <div className="attempt-main">
                                <strong>{dateLabel(attempt.date)}</strong>
                                <small>{attempt.notes || "Sin notas"}</small>
                              </div>
                              <div className="attempt-score">
                                <small>Nota</small>
                                <strong>{scoreLabel(attempt.score)}</strong>
                              </div>
                              <div className="attempt-answers">
                                <span>{attempt.correct} ✓</span>
                                <span>{attempt.wrong} ✕</span>
                                <span>{attempt.blank} —</span>
                              </div>
                              <div className="attempt-time">
                                <small>Tiempo</small>
                                <strong>
                                  {scoreLabel(attempt.minutes)} min
                                </strong>
                              </div>
                              <div className="attempt-actions">
                                <button
                                  title="Editar intento"
                                  aria-label="Editar intento"
                                  onClick={() =>
                                    openAttemptEditor(
                                      detailPsych.id,
                                      attempt.id,
                                    )
                                  }
                                >
                                  ✎
                                </button>
                                <button
                                  title="Eliminar intento"
                                  aria-label="Eliminar intento"
                                  className="danger"
                                  onClick={() =>
                                    deleteAttempt(detailPsych.id, attempt.id)
                                  }
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Empty
                          icon="◎"
                          title="Todavía no hay intentos"
                          copy="Cuando hagas este psicotécnico, registra la nota y la fecha para empezar a ver tu evolución."
                          action="Registrar primer intento"
                          onAction={() => openAttemptEditor(detailPsych.id)}
                        />
                      )}
                    </section>

                    <div className="psych-danger-zone">
                      <button
                        className="text-button danger-text"
                        onClick={() => deletePsychTest(detailPsych.id)}
                      >
                        Eliminar psicotécnico e historial
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : (
              <>
                <div className="section-heading psych-heading">
                  <div>
                    <span className="section-label">PRÁCTICA Y EVOLUCIÓN</span>
                    <h2>Mis psicotécnicos</h2>
                    <p>
                      Guarda los PDF una sola vez y utiliza el historial para
                      decidir cuáles conviene repetir.
                    </p>
                  </div>
                  <button
                    className="primary-button"
                    onClick={() => {
                      setEditingPsychTest(null);
                      setModal("psych");
                    }}
                  >
                    ＋ Añadir psicotécnico
                  </button>
                </div>

                <div className="psych-overview">
                  <div>
                    <span>Psicotécnicos</span>
                    <strong>{state.psychTests.length}</strong>
                    <small>
                      {
                        state.psychTests.filter(
                          (test) => test.attachment?.type === "application/pdf",
                        ).length
                      }{" "}
                      con PDF
                    </small>
                  </div>
                  <div>
                    <span>Ya practicados</span>
                    <strong>{psychAttemptedCount}</strong>
                    <small>
                      {state.psychTests.length - psychAttemptedCount} pendientes
                    </small>
                  </div>
                  <div>
                    <span>Intentos guardados</span>
                    <strong>{psychAttemptCount}</strong>
                    <small>histórico total</small>
                  </div>
                  <div>
                    <span>Media última nota</span>
                    <strong>
                      {latestPsychAverage === null
                        ? "—"
                        : scoreLabel(latestPsychAverage)}
                    </strong>
                    <small>solo tests realizados</small>
                  </div>
                </div>

                <div className="psych-toolbar">
                  <div className="search-box psych-search">
                    <span>⌕</span>
                    <input
                      value={psychQuery}
                      onChange={(event) => setPsychQuery(event.target.value)}
                      placeholder="Buscar por nombre o categoría"
                      aria-label="Buscar psicotécnicos"
                    />
                  </div>
                  <select
                    value={psychCategory}
                    onChange={(event) => setPsychCategory(event.target.value)}
                    aria-label="Filtrar categoría"
                  >
                    <option value="all">Todas las categorías</option>
                    {psychCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  <select
                    value={psychSort}
                    onChange={(event) =>
                      setPsychSort(event.target.value as PsychSort)
                    }
                    aria-label="Ordenar psicotécnicos"
                  >
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

                {state.psychTests.length ? (
                  filteredPsychTests.length ? (
                    <div className="psych-grid">
                      {filteredPsychTests.map((test) => {
                        const stats = psychStats(test);
                        return (
                          <article
                            className="psych-card"
                            key={test.id}
                            role="button"
                            tabIndex={0}
                            aria-label={`Abrir ${test.name}`}
                            onClick={(event) => {
                              if (
                                !(event.target as Element).closest("button,a")
                              )
                                setPsychDetail(test.id);
                            }}
                            onKeyDown={(event) => {
                              if (
                                event.target === event.currentTarget &&
                                (event.key === "Enter" || event.key === " ")
                              ) {
                                event.preventDefault();
                                setPsychDetail(test.id);
                              }
                            }}
                          >
                            <div className="psych-doc">
                              <span>
                                {test.attachment?.type === "application/pdf"
                                  ? "PDF"
                                  : test.attachment
                                    ? "IMG"
                                    : "TEST"}
                              </span>
                            </div>
                            <div className="psych-body">
                              <div className="psych-card-top">
                                <span className="category-chip">
                                  {test.category || "Sin categoría"}
                                </span>
                                <button
                                  className="psych-edit-button"
                                  title="Editar ficha"
                                  onClick={() => {
                                    setEditingPsychTest(test.id);
                                    setModal("psych");
                                  }}
                                >
                                  ✎
                                </button>
                              </div>
                              <h3>{test.name || "Psicotécnico sin nombre"}</h3>
                              <p>
                                {test.totalQuestions || 0} preguntas ·{" "}
                                {stats.attempts.length}{" "}
                                {stats.attempts.length === 1
                                  ? "intento"
                                  : "intentos"}
                              </p>
                              <div className="psych-metrics four">
                                <div>
                                  <small>Última</small>
                                  <strong>
                                    {stats.last
                                      ? scoreLabel(stats.last.score)
                                      : "—"}
                                  </strong>
                                </div>
                                <div>
                                  <small>Mejor</small>
                                  <strong>
                                    {stats.best === null
                                      ? "—"
                                      : scoreLabel(stats.best)}
                                  </strong>
                                </div>
                                <div>
                                  <small>Media</small>
                                  <strong>
                                    {stats.average === null
                                      ? "—"
                                      : scoreLabel(stats.average)}
                                  </strong>
                                </div>
                                <div>
                                  <small>Último día</small>
                                  <strong className="metric-date">
                                    {stats.last
                                      ? dateLabel(stats.last.date)
                                      : "Pendiente"}
                                  </strong>
                                </div>
                              </div>
                              <div className="psych-actions psych-actions-wrap">
                                <button onClick={() => setPsychDetail(test.id)}>
                                  Ver ficha
                                </button>
                                {test.attachment?.type === "application/pdf" ? (
                                  <button
                                    onClick={() => setEditingPsych(test.id)}
                                  >
                                    ✎ Abrir PDF
                                  </button>
                                ) : test.attachment ? (
                                  <a
                                    href="#"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      setEditingPsych(test.id);
                                    }}
                                  >
                                    Abrir documento
                                  </a>
                                ) : null}
                                <button
                                  className="psych-register"
                                  onClick={() => openAttemptEditor(test.id)}
                                >
                                  ＋ Intento
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="psych-no-results">
                      <span>⌕</span>
                      <h3>No hay coincidencias</h3>
                      <p>
                        Cambia la búsqueda, la categoría o el criterio de
                        ordenación.
                      </p>
                    </div>
                  )
                ) : (
                  <Empty
                    icon="▧"
                    title="Añade tu primer psicotécnico"
                    copy="Sube un PDF o una fotografía y empieza a registrar puntuaciones, tiempos y errores."
                    action="Añadir psicotécnico"
                    onAction={() => {
                      setEditingPsychTest(null);
                      setModal("psych");
                    }}
                  />
                )}
              </>
            )}
          </section>
        )}

        {tab === "progress" && (
          <ProgressPage
            state={state}
            onCard={(id) => startReview(undefined, "all", [id])}
            onOrthography={() =>
              startOrthographySession(undefined, "weakest", orthographyCards)
            }
            onWeak={() => startReview(undefined, "weakest")}
            onNode={(id) => startStudySession(id)}
            onHistory={() => {
              navigate("organize");
              setStudyView("history");
            }}
          />
        )}
      </main>
      {libraryActionsOpen && (
        <LibraryActions
          name={activeFolder?.name}
          onClose={() => setLibraryActionsOpen(false)}
          onNewFolder={() => {
            setNewFolderParentId(activeFolder?.id ?? null);
            setModal("folder");
          }}
          onNewCard={() => {
            setEditingCard(null);
            setModal("card");
          }}
          onImport={() => setModal("import")}
          onToStudy={() => setLibraryBridgeOpen(true)}
          onUp={
            activeFolder ? () => reorderFolder(activeFolder.id, -1) : undefined
          }
          onDown={
            activeFolder ? () => reorderFolder(activeFolder.id, 1) : undefined
          }
          onOut={
            activeFolder?.parentId
              ? () => moveFolderOut(activeFolder.id)
              : undefined
          }
          onStudy={(mode) => startReview(activeFolder?.id, mode)}
          onMove={
            activeFolder ? () => setMovingFolderId(activeFolder.id) : undefined
          }
          onDelete={
            activeFolder ? () => deleteFolder(activeFolder.id) : undefined
          }
          onSelect={
            activeFolder
              ? () => {
                  setBulkSelectMode((value) => !value);
                  setSelectedCardIds([]);
                  setBulkTargetFolderId("");
                }
              : undefined
          }
          onWritten={
            activeFolder &&
            cardsInFolderScope(state, activeFolder.id).some(isWrittenCard)
              ? () =>
                  startReview(
                    activeFolder.id,
                    "learn",
                    cardsInFolderScope(state, activeFolder.id)
                      .filter(isWrittenCard)
                      .map((card) => card.id),
                  )
              : undefined
          }
        />
      )}
      {libraryBridgeOpen && (
        <LibraryToStudySheet
          folders={state.folders}
          cards={state.cards}
          nodes={state.studyNodes}
          rootId={activeFolder?.id}
          onClose={() => setLibraryBridgeOpen(false)}
          onConfirm={importLibraryToStudy}
        />
      )}
      {cardActionsId && (
        <CardActionsSheet
          card={state.cards.find((c) => c.id === cardActionsId)!}
          folders={state.folders}
          onClose={() => setCardActionsId(null)}
          onMove={(folder) => moveCard(cardActionsId, folder)}
          onReorder={(direction) => reorderCard(cardActionsId, direction)}
        />
      )}
      {preferencesOpen && (
        <StudyPreferences
          settings={state.settings}
          onClose={() => setPreferencesOpen(false)}
          onSave={(settings) => {
            void updateState((current) => ({
              ...current,
              settings: { ...current.settings, ...settings },
            }));
            setPreferencesOpen(false);
          }}
        />
      )}
      {studyFlow && (
        <StudySession
          key={studyFlow.index}
          title={
            studyFlowDone
              ? "Sesión completada"
              : (studyFlowNode?.name ?? "Apartado no disponible")
          }
          path={
            studyFlowNode
              ? studyNodePath(state.studyNodes, studyFlowNode.id)
                  .slice(0, -1)
                  .join(" · ")
              : ""
          }
          note={studyFlowTask?.note || previousStudySession?.completionNote}
          reference={studyReference}
          position={studyFlow.index + 1}
          total={studyFlow.entries.length}
          status={saveStatus}
          onExit={() => {
            setStudyFlow(null);
            navigate("today");
          }}
          onSkip={() =>
            setStudyFlow((flow) =>
              flow ? { ...flow, index: flow.index + 1 } : null,
            )
          }
          onComplete={finishStudyEntry}
          done={studyFlowDone}
        />
      )}

      {orthographySession && (
        <OrthographyStudy
          cards={orthographySession.groupIds
            .map((id) => state.cards.find((card) => card.id === id))
            .filter((card): card is Card =>
              Boolean(card && isOrthographyCard(card)),
            )
            .map(orthographyStudyCard)}
          selectedIds={orthographySelected}
          results={orthographySession.results}
          groupNumber={orthographySession.groupNumber}
          responses={orthographySession.responses}
          correctResponses={orthographySession.correctResponses}
          scopeLabel={orthographySession.scopeLabel}
          busy={reviewSaving}
          onToggle={toggleOrthographyWord}
          onCorrect={correctOrthographyGroup}
          onContinue={continueOrthographySession}
          onClose={closeOrthographySession}
        />
      )}

      {sessionOpen &&
        reviewQueue.length > 0 &&
        reviewIndex < reviewQueue.length &&
        currentCard &&
        currentQueueItem && (
          <ReviewSession
            card={currentCard}
            folder={
              state.folders.find((folder) => folder.id === currentCard.folderId)
                ?.name ?? "Mis tarjetas"
            }
            position={Math.min(
              (cardSessionSummary?.remembered ?? 0) + 1,
              cardSessionSummary?.total ?? 1,
            )}
            total={cardSessionSummary?.total ?? 1}
            continuous={false}
            busy={reviewSaving}
            canGoBack={reviewIndex > 0}
            doneCount={sessionDone}
            status={saveStatus}
            revealed={revealed}
            completed={Boolean(currentQueueItem.completed)}
            unknown={currentQueueItem.outcome === "unknown"}
            selectedOption={selectedOption}
            selectedOptions={selectedOptions}
            writtenAnswer={writtenAnswer}
            writtenResult={displayedWrittenResult}
            onExit={() => {
              setSessionOpen(false);
              setReviewQueue([]);
            }}
            onReveal={() => setRevealed(true)}
            onQuestion={() => {
              setRevealed(false);
              setViewingStudyImage(false);
            }}
            onOption={(index) => {
              if (isMultipleAnswerTest(currentCard))
                setSelectedOptions((current) =>
                  current.includes(index)
                    ? current.filter((value) => value !== index)
                    : [...current, index],
                );
              else setSelectedOption(index);
            }}
            onWritten={setWrittenAnswer}
            onCheckWritten={submitWrittenAnswer}
            onRate={rateCurrent}
            onNext={goToNextCard}
            onPrevious={goToPreviousCard}
            onUnknown={markCurrentUnknown}
            onSchedule={() => openStudyQuick(null, currentCard.id)}
            onImage={() => setViewingStudyImage(true)}
            correct={currentSelectionIsCorrect(currentCard)}
          />
        )}

      {viewingStudyImage && currentCard?.attachment && (
        <ImageLightbox
          attachment={currentCard.attachment}
          title={
            plainRichText(currentCard.back) ||
            plainRichText(currentCard.front) ||
            "Respuesta visual"
          }
          onClose={() => setViewingStudyImage(false)}
        />
      )}

      {sessionOpen &&
        !orthographySession &&
        savedCardSession &&
        sessionNext &&
        reviewIndex >= reviewQueue.length &&
        sessionNext.kind !== "card" && (
          <SessionStatus
            session={savedCardSession}
            readyAt={
              sessionNext.kind === "waiting" ? sessionNext.readyAt : undefined
            }
            now={sessionClock}
            onClose={() => {
              setSessionOpen(false);
              setReviewQueue([]);
              navigate("today");
            }}
            onFinish={() => {
              void updateState((c) => ({
                ...c,
                settings: { ...c.settings, activeCardSession: null },
              }));
              setSessionOpen(false);
              setReviewQueue([]);
              navigate("today");
            }}
          />
        )}

      {movingFolder && (
        <MoveFolderModal
          folders={state.folders}
          folder={movingFolder}
          onClose={() => setMovingFolderId(null)}
          onMove={(targetParentId) =>
            moveFolder(movingFolder.id, targetParentId)
          }
        />
      )}
      {modal === "folder" && (
        <FolderModal
          parentId={newFolderParentId}
          parentName={
            newFolderParentId
              ? (state.folders.find((folder) => folder.id === newFolderParentId)
                  ?.name ?? "")
              : ""
          }
          onClose={() => {
            setModal(null);
            setNewFolderParentId(null);
          }}
          onCreate={(folder) => {
            updateState((current) => ({
              ...current,
              folders: [...current.folders, folder],
            }));
            setModal(null);
            setNewFolderParentId(null);
            notify(folder.parentId ? "Apartado creado" : "Tema creado");
          }}
        />
      )}
      {modal === "card" && (
        <CardModal
          folders={state.folders}
          defaultFolder={selectedFolder}
          initialCard={openCard}
          onClose={() => {
            setModal(null);
            setEditingCard(null);
          }}
          onSave={(card) => {
            updateState((current) => ({
              ...current,
              cards: openCard
                ? current.cards.map((item) =>
                    item.id === card.id ? card : item,
                  )
                : [...current.cards, card],
            }));
            setModal(null);
            setEditingCard(null);
            notify(openCard ? "Tarjeta actualizada" : "Tarjeta guardada");
          }}
        />
      )}
      {modal === "import" && (
        <CardImportModal
          onClose={() => setModal(null)}
          onImport={importGeneratedCards}
        />
      )}
      {modal === "psych" && (
        <PsychModal
          initialTest={openPsychTest}
          onClose={() => {
            setModal(null);
            setEditingPsychTest(null);
          }}
          onSave={(test) => {
            updateState((current) => ({
              ...current,
              psychTests: openPsychTest
                ? current.psychTests.map((item) =>
                    item.id === test.id ? test : item,
                  )
                : [...current.psychTests, test],
            }));
            setModal(null);
            setEditingPsychTest(null);
            setPsychDetail(test.id);
            notify(
              openPsychTest
                ? "Psicotécnico actualizado"
                : "Psicotécnico guardado",
            );
          }}
        />
      )}
      {modal === "attempt" && activePsych && (
        <AttemptModal
          test={activePsych}
          initialAttempt={openAttempt}
          onClose={() => {
            setModal(null);
            setSelectedPsych(null);
            setEditingAttempt(null);
          }}
          onSave={(attempt) => {
            updateState((current) => ({
              ...current,
              psychTests: current.psychTests.map((test) =>
                test.id === activePsych.id
                  ? {
                      ...test,
                      attempts: openAttempt
                        ? test.attempts.map((item) =>
                            item.id === attempt.id ? attempt : item,
                          )
                        : [...test.attempts, attempt],
                    }
                  : test,
              ),
            }));
            setModal(null);
            setSelectedPsych(null);
            setEditingAttempt(null);
            setPsychDetail(activePsych.id);
            notify(openAttempt ? "Intento actualizado" : "Intento registrado");
          }}
        />
      )}
      {studyQuickOpen && (
        <StudyQuickModal
          nodes={state.studyNodes}
          defaultNodeId={studyQuickDefaultNodeId}
          onClose={() => {
            setStudyQuickOpen(false);
            setStudyQuickDefaultNodeId(null);
            setStudyQuickSourceCardId(null);
          }}
          onSave={saveStudyTask}
        />
      )}
      {studyTaskEditId &&
        state.studyTasks.find((task) => task.id === studyTaskEditId) && (
          <StudyTaskEditModal
            task={state.studyTasks.find((task) => task.id === studyTaskEditId)!}
            nodes={state.studyNodes}
            onClose={() => setStudyTaskEditId(null)}
            onSave={saveStudyTaskEdits}
            onDelete={deleteStudyTask}
          />
        )}
      {studyCompletionPrompt && (
        <StudyCompletionNoteModal
          assessment={studyCompletionPrompt.assessment}
          task={
            state.studyTasks.find(
              (task) =>
                (task as any)._sessionId === studyCompletionPrompt.sessionId ||
                (task as any)._completionEventId ===
                  studyCompletionPrompt.sessionId,
            ) ?? null
          }
          nodes={state.studyNodes}
          onClose={() => setStudyCompletionPrompt(null)}
          onSave={(note) =>
            saveStudyCompletionNote(
              studyCompletionPrompt.taskId,
              note,
              studyCompletionPrompt.sessionId,
            )
          }
        />
      )}
      {studyNodeEditorOpen && (
        <StudyNodeEditorModal
          nodes={state.studyNodes}
          nodeId={studyEditingNodeId}
          defaultParentId={studyNodeEditorParentId}
          onClose={() => {
            setStudyNodeEditorOpen(false);
            setStudyEditingNodeId(null);
            setStudyNodeEditorParentId(null);
          }}
          onSave={saveStudyNode}
        />
      )}
      {studyImportOpen && (
        <StudyImportModal
          nodes={state.studyNodes}
          defaultParentId={studyImportParentId}
          onClose={() => {
            setStudyImportOpen(false);
            setStudyImportParentId(null);
          }}
          onImport={importStudyTree}
        />
      )}
      {openPsych?.attachment &&
        openPsych.attachment.type !== "application/pdf" && (
          <ImageAnnotator
            attachment={openPsych.attachment}
            title={openPsych.name}
            onClose={() => setEditingPsych(null)}
          />
        )}
      {openPsych?.attachment?.type === "application/pdf" && (
        <PdfAnnotator
          attachment={openPsych.attachment}
          title={openPsych.name}
          onClose={() => setEditingPsych(null)}
        />
      )}
      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  );
}
