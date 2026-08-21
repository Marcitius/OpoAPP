"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import PdfAnnotator from "./PdfAnnotator";
import { AnnotatedCardImage, ImageAnnotator, ImageLightbox } from "./CardImage";
import RichTextEditor, { plainRichText, RichContent, sanitizeRichHtml } from "./RichTextEditor";
import { applyFsrsReview, fsrsCurrentRetrievability, fsrsDueLabel } from "./fsrs";
import { fitPersonalMemoryModel, personalModelLabel, predictPersonalRecall } from "./memoryModel";

type Tab = "today" | "library" | "psych" | "progress";
type CardType = "basic" | "choice";
type Rating = "again" | "hard" | "good" | "easy";
type StudyMode = "recommended" | "random" | "all";
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
  const normalizedCards = state.cards.map((card) => {
    const normalized = {
      ...card,
      attachment: card.attachment ?? null,
      fsrsStability: Number(card.fsrsStability ?? (card.reviewCount > 0 ? Math.max(1, card.intervalDays || 1) : 0)),
      fsrsDifficulty: Number(card.fsrsDifficulty ?? (card.reviewCount > 0 ? 5 : 0)),
    };
    if (card.attachment === undefined || card.fsrsStability === undefined || card.fsrsDifficulty === undefined) changed = true;
    return normalized;
  });

  if (Number(state.settings.seedVersion ?? 0) >= 1) {
    return { state: { ...state, cards: normalizedCards }, changed };
  }

  let folders = [...state.folders];
  let folder = folders.find((item) => item.name.trim().toLocaleLowerCase("es") === CONSTITUTION_FOLDER_NAME.toLocaleLowerCase("es"));
  if (!folder) {
    folder = { id: CONSTITUTION_FOLDER_ID, name: CONSTITUTION_FOLDER_NAME, color: "#2C6E8F", parentId: null, createdAt: nowIso() };
    folders.push(folder);
    changed = true;
  }

  const existing = new Set(normalizedCards.map((card) => card.id));
  const cards = [...normalizedCards];
  for (const seed of constitutionSeedCards) {
    if (existing.has(seed.id)) continue;
    cards.push({
      id: seed.id,
      folderId: folder.id,
      type: seed.type ?? "basic",
      front: seed.front,
      back: seed.back,
      options: seed.options ?? [],
      correctOption: seed.correctOption ?? 0,
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
    });
    changed = true;
  }

  return { state: { ...state, folders, cards, settings: { ...state.settings, seedVersion: 1 } }, changed: true };
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


export default function OpoApp() {
  const [tab, setTab] = useState<Tab>("today");
  const [state, setState] = useState<AppState | null>(null);
  const [sync, setSync] = useState<"loading" | "saved" | "saving" | "error">("loading");
  const [modal, setModal] = useState<null | "folder" | "card" | "psych" | "attempt">(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
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
  const [sessionDone, setSessionDone] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardShownAtRef = useRef(Date.now());
  const reinforcementCountsRef = useRef<Map<string, number>>(new Map());

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
      .filter((card) => card.reviewCount > 0 && new Date(card.dueAt).getTime() <= now.getTime())
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
  }, [currentCard?.id, reviewIndex]);

  function startReview(folderId?: string, mode: StudyMode = "recommended") {
    if (!state) return;
    const scope = state.cards.filter((card) => isStudyableCard(card) && (!folderId || card.folderId === folderId));
    const now = new Date();
    let selectedPool: Card[] = [];

    if (mode === "random") {
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
        ? "No hay tarjetas programadas ahora. Usa Aleatorias o Estudiar todas si quieres seguir."
        : folderId ? "Aún no hay tarjetas en esta carpeta" : "Aún no hay tarjetas para estudiar");
    }

    setStudyMode(mode);
    reinforcementCountsRef.current = new Map();
    setReviewQueue(selectedPool.map((card) => ({ cardId: card.id, reinforcement: false, reason: "scheduled" })));
    setReviewIndex(0);
    setSessionDone(0);
    setRevealed(false);
    setViewingStudyImage(false);
    setSelectedOption(null);
    cardShownAtRef.current = Date.now();
  }

  function rateCurrent(rating: Rating) {
    if (!state || !currentCard || !currentQueueItem) return;
    const now = new Date();
    const choiceWasWrong = currentCard.type === "choice" && selectedOption !== null && selectedOption !== currentCard.correctOption;
    const effectiveRating: Rating = choiceWasWrong ? "again" : rating;
    const correct = effectiveRating !== "again";
    const responseMs = Math.max(0, Date.now() - cardShownAtRef.current);
    const recall = predictPersonalRecall(currentCard, state.reviews, personalModel, now);
    const updated = scheduleCard(currentCard, effectiveRating);
    const review: Review = {
      id: uid(),
      cardId: currentCard.id,
      rating: effectiveRating,
      correct,
      reviewedAt: now.toISOString(),
      responseMs,
      sessionMode: studyMode,
      reinforcement: currentQueueItem.reinforcement,
      predictedRecall: recall.probability,
      fsrsRetrievability: fsrsCurrentRetrievability(currentCard, now),
    };
    updateState((current) => ({
      ...current,
      cards: current.cards.map((card) => (card.id === updated.id ? updated : card)),
      reviews: [...current.reviews, review],
    }));

    const nextQueue = [...reviewQueue];
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

    setReviewQueue(nextQueue);
    setSessionDone((value) => value + 1);
    setReviewIndex((value) => value + 1);
    setRevealed(false);
    setViewingStudyImage(false);
    setSelectedOption(null);
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
    if (!confirm("¿Eliminar esta carpeta y todas sus tarjetas?")) return;
    updateState((current) => ({
      ...current,
      folders: current.folders.filter((folder) => folder.id !== folderId),
      cards: current.cards.filter((card) => card.folderId !== folderId),
    }));
    setSelectedFolder(null);
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
            <div className="action-row"><div className="search-box"><span>⌕</span><input placeholder="Buscar carpetas o tarjetas" aria-label="Buscar" /></div><button className="secondary-button" onClick={() => startReview(undefined, "random")}>🎲 Aleatorias</button><button className="secondary-button" onClick={() => startReview(undefined, "all")}>▶ Estudiar todas</button><button className="secondary-button" onClick={() => setModal("folder")}>＋ Carpeta</button><button className="primary-button" onClick={() => { setEditingCard(null); setModal("card"); }}>＋ Tarjeta</button></div>
            {!activeFolder ? (
              <>
                <div className="section-heading"><div><span className="section-label">ORGANIZACIÓN</span><h2>Tus carpetas</h2></div><span>{state.folders.length} carpetas · {state.cards.length} tarjetas</span></div>
                <div className="folder-grid">
                  {state.folders.map((folder) => {
                    const cards = state.cards.filter((card) => card.folderId === folder.id);
                    const reviewed = cards.filter((card) => card.reviewCount > 0).length;
                    const pct = cards.length ? Math.round((reviewed / cards.length) * 100) : 0;
                    return <button className="folder-card" key={folder.id} onClick={() => setSelectedFolder(folder.id)}><span className="folder-icon" style={{ background: `${folder.color}18`, color: folder.color }}>▰</span><span className="folder-menu">•••</span><strong>{folder.name}</strong><small>{cards.length} tarjetas</small><span className="progress-track"><span style={{ width: `${pct}%`, background: folder.color }} /></span><span className="folder-progress">{pct}% visto</span></button>;
                  })}
                </div>
              </>
            ) : (
              <div>
                <button className="back-button" onClick={() => setSelectedFolder(null)}>← Todas las carpetas</button>
                <div className="folder-title"><div><span className="folder-icon large" style={{ background: `${activeFolder.color}18`, color: activeFolder.color }}>▰</span><div><span className="section-label">CARPETA</span><h2>{activeFolder.name}</h2><p>{state.cards.filter((card) => card.folderId === activeFolder.id).length} tarjetas</p></div></div><div><button className="secondary-button danger" onClick={() => deleteFolder(activeFolder.id)}>Eliminar</button><button className="secondary-button" onClick={() => startReview(activeFolder.id, "random")}>🎲 Aleatorias</button><button className="primary-button" onClick={() => startReview(activeFolder.id, "all")}>Estudiar todas</button></div></div>
                <div className="card-table">
                  {state.cards.filter((card) => card.folderId === activeFolder.id).map((card) => <div className="card-row" key={card.id}><span className="card-kind">{card.type === "choice" ? "TEST" : "TARJETA"}</span><div><strong>{plainRichText(card.front) || "Sin pregunta"}{card.attachment ? " · 🖼️" : ""}</strong><p>{plainRichText(card.back) || (card.type === "choice" ? "Sin explicación añadida" : "Sin respuesta añadida")}</p></div><span>{card.reviewCount ? `${Math.round((card.successCount / card.reviewCount) * 100)}% aciertos` : "Sin estudiar"}</span><div className="card-actions"><button aria-label="Editar tarjeta" title="Editar tarjeta" onClick={() => { setEditingCard(card.id); setModal("card"); }}>✎</button><button aria-label="Eliminar tarjeta" title="Eliminar tarjeta" onClick={() => updateState((current) => ({ ...current, cards: current.cards.filter((item) => item.id !== card.id) }))}>×</button></div></div>)}
                  {!state.cards.some((card) => card.folderId === activeFolder.id) && <Empty icon="□" title="Esta carpeta está vacía" copy="Añade tu primera tarjeta para empezar a estudiarla." action="Crear tarjeta" onAction={() => { setEditingCard(null); setModal("card"); }} />}
                </div>
              </div>
            )}
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
              <StatCard label="Tarjetas" value={state.cards.length.toString()} detail={`${dueCards.length} pendientes`} tone="green" />
              <StatCard label="Repasos" value={state.reviews.length.toString()} detail={`${todayReviews.length} hoy`} tone="amber" />
              <StatCard label="Precisión" value={`${accuracy}%`} detail="histórico global" tone="purple" />
              <StatCard label="Racha" value={`${streakDays(state.reviews)} d`} detail="días seguidos" tone="blue" />
            </div>
            <div className="content-grid">
              <section className="panel"><div className="panel-head"><div><span className="section-label">ACTIVIDAD</span><h3>Últimos 7 días</h3></div></div><ActivityChart reviews={state.reviews} /></section>
              <section className="panel"><div className="panel-head"><div><span className="section-label">MEMORIA</span><h3>Estado de tarjetas</h3></div></div><MemoryBreakdown cards={state.cards} /></section>
            </div>
            <section className="panel weak-panel"><div className="panel-head"><div><span className="section-label">ATENCIÓN PRIORITARIA</span><h3>Conceptos más débiles</h3></div></div><div className="weak-list">{[...state.cards].filter((card) => card.reviewCount > 0).sort((a, b) => (a.successCount / a.reviewCount) - (b.successCount / b.reviewCount)).slice(0, 5).map((card) => <div key={card.id}><span>{plainRichText(card.front)}</span><strong>{Math.round((card.successCount / card.reviewCount) * 100)}%</strong></div>)}{!state.cards.some((card) => card.reviewCount > 0) && <p className="muted">Completa algunos repasos para detectar tus puntos débiles.</p>}</div></section>
          </section>
        )}
      </main>

      <nav className="bottom-nav">{navItems.map((item) => <NavButton key={item.id} item={item} active={tab === item.id} onClick={() => setTab(item.id)} />)}</nav>

      {reviewQueue.length > 0 && reviewIndex < reviewQueue.length && currentCard && currentQueueItem && (
        <div className="review-overlay">
          <div className="review-top"><button onClick={() => setReviewQueue([])}>×</button><div className="session-progress"><span style={{ width: `${Math.round((reviewIndex / reviewQueue.length) * 100)}%` }} /></div><span>{reviewIndex + 1}/{reviewQueue.length}</span></div>
          <div className="review-stage">
            <span className="deck-label">{state.folders.find((folder) => folder.id === currentCard.folderId)?.name ?? "Sin carpeta"}</span>
            <div className={`study-card ${revealed ? "revealed answer-side" : "question-side"}`}>
              <span className="study-card-type">{currentQueueItem.reinforcement ? "REFUERZO · " : ""}{revealed ? "RESPUESTA" : currentCard.type === "choice" ? "ELIGE LA RESPUESTA" : "RECUERDA EL CONCEPTO"}</span>
              {!revealed ? (
                <>
                  <RichContent html={currentCard.front} className="study-front" />
                  {currentCard.type === "choice" ? (
                    <div className="options-list">{currentCard.options.map((option, index) => <button key={`${index}-${option}`} className={selectedOption === index ? "selected" : ""} onClick={() => setSelectedOption(index)}><span>{String.fromCharCode(65 + index)}</span>{option}</button>)}</div>
                  ) : (
                    <button className="reveal-button" onClick={() => setRevealed(true)}>Mostrar respuesta</button>
                  )}
                </>
              ) : (
                <div className="answer-side-content">
                  {currentCard.type !== "choice" && plainRichText(currentCard.back) && <div className="answer-box"><RichContent html={currentCard.back} /></div>}
                  {currentCard.type === "choice" && <div className="answer-box choice-answer"><strong>{String.fromCharCode(65 + currentCard.correctOption)} · {currentCard.options[currentCard.correctOption]}</strong>{plainRichText(currentCard.back) && <RichContent html={currentCard.back} />}</div>}
                  {currentCard.attachment && (
                    <div className="answer-visual-block">
                      <span>RESPUESTA VISUAL</span>
                      <AnnotatedCardImage attachment={currentCard.attachment} onOpen={() => setViewingStudyImage(true)} />
                      <small>Toca la imagen para abrirla a pantalla completa.</small>
                    </div>
                  )}
                  {!plainRichText(currentCard.back) && !currentCard.attachment && currentCard.type !== "choice" && <p className="empty-answer">Esta tarjeta no tiene respuesta escrita ni visual.</p>}
                  <button className="flip-back-button" onClick={() => { setRevealed(false); setViewingStudyImage(false); }}>↶ Volver a la pregunta</button>
                </div>
              )}
            </div>
            {currentCard.type === "choice" && !revealed && <button className="check-button" disabled={selectedOption === null} onClick={() => setRevealed(true)}>Comprobar</button>}
            {revealed && <div className="rating-bar"><p>{currentCard.type === "choice" && selectedOption !== null ? selectedOption === currentCard.correctOption ? "¡Correcto! ¿Cómo te ha resultado?" : "No era esa. La repetiremos pronto." : "¿Qué tal la recordabas?"} <span className="fsrs-badge">{personalModelLabel(personalModel)}</span></p><div><button className="again" onClick={() => rateCurrent("again")}><strong>Otra vez</strong><small>↻ tras 2 tarjetas</small></button><button className="hard" onClick={() => rateCurrent("hard")}><strong>Difícil</strong><small>↻ tras 4 tarjetas</small></button><button className="good" onClick={() => rateCurrent(currentCard.type === "choice" && selectedOption !== currentCard.correctOption ? "again" : "good")}><strong>Bien</strong><small>{fsrsDueLabel(currentCard, "good")}</small></button><button className="easy" onClick={() => rateCurrent("easy")}><strong>Fácil</strong><small>{fsrsDueLabel(currentCard, "easy")}</small></button></div></div>}
          </div>
        </div>
      )}

      {viewingStudyImage && currentCard?.attachment && (
        <ImageLightbox attachment={currentCard.attachment} title={plainRichText(currentCard.back) || plainRichText(currentCard.front) || "Respuesta visual"} onClose={() => setViewingStudyImage(false)} />
      )}

      {reviewQueue.length > 0 && reviewIndex >= reviewQueue.length && (
        <div className="review-overlay complete"><div className="complete-card"><span className="complete-icon">✓</span><span className="section-label">SESIÓN COMPLETADA</span><h2>Buen trabajo, Marc</h2><p>Has repasado {sessionDone} tarjetas. El motor ya ha recalculado cuándo debes volver a ver cada una.</p><button className="primary-button" onClick={() => setReviewQueue([])}>Volver a Hoy</button></div></div>
      )}

      {modal === "folder" && <FolderModal onClose={() => setModal(null)} onCreate={(folder) => { updateState((current) => ({ ...current, folders: [...current.folders, folder] })); setModal(null); notify("Carpeta creada"); }} />}
      {modal === "card" && <CardModal folders={state.folders} defaultFolder={selectedFolder} initialCard={openCard} onClose={() => { setModal(null); setEditingCard(null); }} onSave={(card) => { updateState((current) => ({ ...current, cards: openCard ? current.cards.map((item) => item.id === card.id ? card : item) : [...current.cards, card] })); setModal(null); setEditingCard(null); notify(openCard ? "Tarjeta actualizada" : "Tarjeta guardada"); }} />}
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

function FolderModal({ onClose, onCreate }: { onClose: () => void; onCreate: (folder: Folder) => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(colors[0]);
  return <ModalShell title="Crear carpeta" subtitle="Agrupa tarjetas por tema, bloque o tipo de ejercicio." onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); if (name.trim()) onCreate({ id: uid(), name: name.trim(), color, parentId: null, createdAt: nowIso() }); }}><label>Nombre<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Tema 4 · Derecho Penal" /></label><label>Color<div className="color-picker">{colors.map((item) => <button type="button" key={item} className={color === item ? "selected" : ""} style={{ background: item }} onClick={() => setColor(item)} aria-label={`Color ${item}`} />)}</div></label><button className="primary-button full" disabled={!name.trim()}>Crear carpeta</button></form></ModalShell>;
}

function CardModal({ folders, defaultFolder, initialCard, onClose, onSave }: { folders: Folder[]; defaultFolder: string | null; initialCard: Card | null; onClose: () => void; onSave: (card: Card) => void }) {
  const [type, setType] = useState<CardType>(initialCard?.type ?? "basic");
  const [folderId, setFolderId] = useState(initialCard?.folderId ?? defaultFolder ?? folders[0]?.id ?? "");
  const [front, setFront] = useState(initialCard?.front ?? "");
  const [back, setBack] = useState(initialCard?.back ?? "");
  const [options, setOptions] = useState(() => {
    const existing = initialCard?.options ?? [];
    return Array.from({ length: Math.max(4, existing.length) }, (_, index) => existing[index] ?? "");
  });
  const [correctOption, setCorrectOption] = useState(initialCard?.correctOption ?? 0);
  const [attachment, setAttachment] = useState<Attachment | null>(initialCard?.attachment ?? null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState("");
  const [editingImage, setEditingImage] = useState(false);

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
    };
    onSave({
      ...base,
      folderId,
      type,
      front: sanitizeRichHtml(front),
      back: sanitizeRichHtml(back),
      options: type === "choice" ? options.map((option) => option.trim()) : [],
      correctOption: type === "choice" ? Math.min(correctOption, Math.max(0, options.length - 1)) : 0,
      attachment,
    });
  }

  return <ModalShell title={initialCard ? "Editar tarjeta" : "Crear tarjeta"} subtitle="La imagen y la escritura manuscrita forman parte de la respuesta y solo aparecen al darle la vuelta a la tarjeta." label={initialCard ? "EDITAR" : "NUEVO"} onClose={onClose}>
    <form onSubmit={submit}>
      <div className="segmented"><button type="button" className={type === "basic" ? "active" : ""} onClick={() => setType("basic")}>Pregunta y respuesta</button><button type="button" className={type === "choice" ? "active" : ""} onClick={() => setType("choice")}>Elección múltiple</button></div>
      <label>Carpeta<select value={folderId} onChange={(event) => setFolderId(event.target.value)}><option value="">Sin carpeta</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
      <div className="flashcard-side-editor question-editor">
        <span className="flashcard-side-label">ANVERSO · PREGUNTA</span>
        <label>Pregunta</label><RichTextEditor value={front} onChange={setFront} placeholder="Escribe la pregunta" />
        {type === "choice" && <fieldset><legend>Opciones · marca la correcta si quieres</legend>{options.map((option, index) => <label className="option-input" key={index}><input type="radio" name="correct" checked={correctOption === index} onChange={() => setCorrectOption(index)} /><span>{String.fromCharCode(65 + index)}</span><input value={option} onChange={(event) => setOptions((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`Opción ${index + 1}`} /></label>)}</fieldset>}
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
      <button className="primary-button full" disabled={uploadingImage}>{initialCard ? "Guardar cambios" : "Guardar tarjeta"}</button>
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
