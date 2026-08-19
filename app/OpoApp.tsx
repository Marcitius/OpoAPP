"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import PdfAnnotator from "./PdfAnnotator";

type Tab = "today" | "library" | "psych" | "progress";
type CardType = "basic" | "choice";
type Rating = "again" | "hard" | "good" | "easy";

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
};

type Review = {
  id: string;
  cardId: string;
  rating: Rating;
  correct: boolean;
  reviewedAt: string;
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
  settings: { dailyReviewGoal: number; dailyNewLimit: number };
};

const colors = ["#285943", "#B66A3C", "#6F5B8C", "#2C6E8F", "#8A784D"];
const uid = () => typeof crypto !== "undefined" && "randomUUID" in crypto
  ? crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
const nowIso = () => new Date().toISOString();
const todayKey = () => new Date().toISOString().slice(0, 10);

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
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
    settings: { dailyReviewGoal: 30, dailyNewLimit: 12 },
  };
}

function scheduleCard(card: Card, rating: Rating): Card {
  const reviewedAt = nowIso();
  if (rating === "again") {
    const due = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    return {
      ...card,
      dueAt: due,
      lastReviewedAt: reviewedAt,
      intervalDays: 0,
      ease: Math.max(1.3, card.ease - 0.2),
      repetitions: 0,
      lapses: card.lapses + 1,
      streak: 0,
      reviewCount: card.reviewCount + 1,
    };
  }

  let interval = 1;
  let ease = card.ease;
  if (rating === "hard") {
    interval = Math.max(1, Math.round(Math.max(1, card.intervalDays) * 1.2));
    ease = Math.max(1.3, ease - 0.08);
  } else if (rating === "good") {
    interval = card.repetitions === 0 ? 1 : card.repetitions === 1 ? 3 : Math.max(4, Math.round(card.intervalDays * ease));
  } else {
    interval = card.repetitions === 0 ? 4 : Math.max(7, Math.round(Math.max(1, card.intervalDays) * ease * 1.3));
    ease = Math.min(3.2, ease + 0.12);
  }

  return {
    ...card,
    dueAt: addDays(interval),
    lastReviewedAt: reviewedAt,
    intervalDays: interval,
    ease,
    repetitions: card.repetitions + 1,
    streak: card.streak + 1,
    reviewCount: card.reviewCount + 1,
    successCount: card.successCount + 1,
  };
}

function isStudyableCard(card: Card) {
  return Boolean(card.front.trim() || card.back.trim() || card.options.some((option) => option.trim()));
}

function scoreLabel(value: number) {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(value);
}

export default function OpoApp() {
  const [tab, setTab] = useState<Tab>("today");
  const [state, setState] = useState<AppState | null>(null);
  const [sync, setSync] = useState<"loading" | "saved" | "saving" | "error">("loading");
  const [modal, setModal] = useState<null | "folder" | "card" | "psych" | "attempt">(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedPsych, setSelectedPsych] = useState<string | null>(null);
  const [editingPsych, setEditingPsych] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<string | null>(null);
  const [reviewQueue, setReviewQueue] = useState<string[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [sessionDone, setSessionDone] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        const loaded = remote ?? initialState();
        setState(loaded);
        setSync("saved");
        if (!remote) saveNow(loaded);
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

  const dueCards = useMemo(
    () => state?.cards.filter((card) => new Date(card.dueAt).getTime() <= Date.now()).sort((a, b) => a.dueAt.localeCompare(b.dueAt)) ?? [],
    [state],
  );
  const todayReviews = useMemo(
    () => state?.reviews.filter((review) => review.reviewedAt.startsWith(todayKey())) ?? [],
    [state],
  );
  const currentCard = state?.cards.find((card) => card.id === reviewQueue[reviewIndex]) ?? null;
  const activeFolder = state?.folders.find((folder) => folder.id === selectedFolder) ?? null;
  const activePsych = state?.psychTests.find((test) => test.id === selectedPsych) ?? null;
  const openPsych = state?.psychTests.find((test) => test.id === editingPsych) ?? null;
  const openCard = state?.cards.find((card) => card.id === editingCard) ?? null;

  function startReview(folderId?: string, includeAll = false) {
    if (!state) return;
    const pool = state.cards
      .filter((card) => isStudyableCard(card) && (!folderId || card.folderId === folderId))
      .sort((a, b) => {
        const aDue = new Date(a.dueAt).getTime() <= Date.now() ? 0 : 1;
        const bDue = new Date(b.dueAt).getTime() <= Date.now() ? 0 : 1;
        if (aDue !== bDue) return aDue - bDue;
        const aRate = a.reviewCount ? a.successCount / a.reviewCount : 0;
        const bRate = b.reviewCount ? b.successCount / b.reviewCount : 0;
        return aRate - bRate;
      });
    const selectedPool = includeAll ? pool : pool.slice(0, state.settings.dailyReviewGoal);
    const ids = selectedPool.map((card) => card.id);
    if (!ids.length) return notify(folderId ? "Aún no hay tarjetas en esta carpeta" : "Aún no hay tarjetas para estudiar");
    setReviewQueue(ids);
    setReviewIndex(0);
    setSessionDone(0);
    setRevealed(false);
    setSelectedOption(null);
  }

  function rateCurrent(rating: Rating) {
    if (!state || !currentCard) return;
    const choiceWasWrong = currentCard.type === "choice" && selectedOption !== null && selectedOption !== currentCard.correctOption;
    const effectiveRating: Rating = choiceWasWrong ? "again" : rating;
    const correct = effectiveRating !== "again";
    const updated = scheduleCard(currentCard, effectiveRating);
    const review: Review = { id: uid(), cardId: currentCard.id, rating: effectiveRating, correct, reviewedAt: nowIso() };
    updateState((current) => ({
      ...current,
      cards: current.cards.map((card) => (card.id === updated.id ? updated : card)),
      reviews: [...current.reviews, review],
    }));

    const nextQueue = [...reviewQueue];
    if (effectiveRating === "again" && !nextQueue.slice(reviewIndex + 1).includes(currentCard.id)) nextQueue.push(currentCard.id);
    setReviewQueue(nextQueue);
    setSessionDone((value) => value + 1);
    setReviewIndex((value) => value + 1);
    setRevealed(false);
    setSelectedOption(null);
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
                <span className="pill">REPASO RECOMENDADO</span>
                <h2>{dueCards.length ? `${dueCards.length} tarjetas esperan hoy` : "Tu memoria está al día"}</h2>
                <p>{dueCards.length ? "Empezaremos por lo que más riesgo tiene de olvidarse y mezclaremos algunos conceptos ya dominados." : "Puedes hacer una sesión mixta para reforzar lo aprendido o añadir nuevas tarjetas."}</p>
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
                    return <button className="review-row" key={card.id} onClick={() => startReview(card.folderId)}><span className="folder-swatch" style={{ background: folder?.color }} /><span className="review-row-copy"><strong>{card.front}</strong><small>{folder?.name ?? "Sin carpeta"}</small></span><span className={`strength ${success >= 80 ? "high" : success >= 50 ? "mid" : "low"}`}>{card.reviewCount ? `${success}%` : "Nueva"}</span></button>;
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
            <div className="action-row"><div className="search-box"><span>⌕</span><input placeholder="Buscar carpetas o tarjetas" aria-label="Buscar" /></div><button className="secondary-button" onClick={() => startReview(undefined, true)}>▶ Estudiar todas</button><button className="secondary-button" onClick={() => setModal("folder")}>＋ Carpeta</button><button className="primary-button" onClick={() => { setEditingCard(null); setModal("card"); }}>＋ Tarjeta</button></div>
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
                <div className="folder-title"><div><span className="folder-icon large" style={{ background: `${activeFolder.color}18`, color: activeFolder.color }}>▰</span><div><span className="section-label">CARPETA</span><h2>{activeFolder.name}</h2><p>{state.cards.filter((card) => card.folderId === activeFolder.id).length} tarjetas</p></div></div><div><button className="secondary-button danger" onClick={() => deleteFolder(activeFolder.id)}>Eliminar</button><button className="primary-button" onClick={() => startReview(activeFolder.id, true)}>Estudiar todas</button></div></div>
                <div className="card-table">
                  {state.cards.filter((card) => card.folderId === activeFolder.id).map((card) => <div className="card-row" key={card.id}><span className="card-kind">{card.type === "choice" ? "TEST" : "TARJETA"}</span><div><strong>{card.front || "Sin pregunta"}</strong><p>{card.back || (card.type === "choice" ? "Sin explicación añadida" : "Sin respuesta añadida")}</p></div><span>{card.reviewCount ? `${Math.round((card.successCount / card.reviewCount) * 100)}% aciertos` : "Sin estudiar"}</span><div className="card-actions"><button aria-label="Editar tarjeta" title="Editar tarjeta" onClick={() => { setEditingCard(card.id); setModal("card"); }}>✎</button><button aria-label="Eliminar tarjeta" title="Eliminar tarjeta" onClick={() => updateState((current) => ({ ...current, cards: current.cards.filter((item) => item.id !== card.id) }))}>×</button></div></div>)}
                  {!state.cards.some((card) => card.folderId === activeFolder.id) && <Empty icon="□" title="Esta carpeta está vacía" copy="Añade tu primera tarjeta para empezar a estudiarla." action="Crear tarjeta" onAction={() => { setEditingCard(null); setModal("card"); }} />}
                </div>
              </div>
            )}
          </section>
        )}

        {tab === "psych" && (
          <section className="page">
            <div className="section-heading psych-heading"><div><span className="section-label">PRÁCTICA Y EVOLUCIÓN</span><h2>Mis psicotécnicos</h2><p>Guarda tus cuadernillos y compara cada intento.</p></div><button className="primary-button" onClick={() => setModal("psych")}>＋ Añadir psicotécnico</button></div>
            {state.psychTests.length ? (
              <div className="psych-grid">
                {state.psychTests.map((test) => {
                  const attempts = [...test.attempts].sort((a, b) => b.date.localeCompare(a.date));
                  const last = attempts[0];
                  const best = attempts.length ? Math.max(...attempts.map((attempt) => attempt.score)) : null;
                  return <article className="psych-card" key={test.id}><div className="psych-doc"><span>{test.attachment?.type === "application/pdf" ? "PDF" : test.attachment ? "IMG" : "TEST"}</span></div><div className="psych-body"><span className="category-chip">{test.category}</span><h3>{test.name}</h3><p>{test.totalQuestions} preguntas · {attempts.length} {attempts.length === 1 ? "intento" : "intentos"}</p><div className="psych-metrics"><div><small>Última</small><strong>{last ? scoreLabel(last.score) : "—"}</strong></div><div><small>Mejor</small><strong>{best === null ? "—" : scoreLabel(best)}</strong></div><div><small>Tiempo</small><strong>{last ? `${last.minutes}m` : "—"}</strong></div></div><div className="psych-actions">{test.attachment?.type === "application/pdf" ? <button onClick={() => setEditingPsych(test.id)}>✎ Abrir y escribir</button> : test.attachment ? <a href={test.attachment.url} target="_blank" rel="noreferrer">Abrir documento</a> : null}<button onClick={() => { setSelectedPsych(test.id); setModal("attempt"); }}>Registrar intento</button></div></div></article>;
                })}
              </div>
            ) : <Empty icon="▧" title="Añade tu primer psicotécnico" copy="Sube un PDF o una fotografía y empieza a registrar puntuaciones, tiempos y errores." action="Añadir psicotécnico" onAction={() => setModal("psych")} />}
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
            <section className="panel weak-panel"><div className="panel-head"><div><span className="section-label">ATENCIÓN PRIORITARIA</span><h3>Conceptos más débiles</h3></div></div><div className="weak-list">{[...state.cards].filter((card) => card.reviewCount > 0).sort((a, b) => (a.successCount / a.reviewCount) - (b.successCount / b.reviewCount)).slice(0, 5).map((card) => <div key={card.id}><span>{card.front}</span><strong>{Math.round((card.successCount / card.reviewCount) * 100)}%</strong></div>)}{!state.cards.some((card) => card.reviewCount > 0) && <p className="muted">Completa algunos repasos para detectar tus puntos débiles.</p>}</div></section>
          </section>
        )}
      </main>

      <nav className="bottom-nav">{navItems.map((item) => <NavButton key={item.id} item={item} active={tab === item.id} onClick={() => setTab(item.id)} />)}</nav>

      {reviewQueue.length > 0 && reviewIndex < reviewQueue.length && currentCard && (
        <div className="review-overlay">
          <div className="review-top"><button onClick={() => setReviewQueue([])}>×</button><div className="session-progress"><span style={{ width: `${Math.round((reviewIndex / reviewQueue.length) * 100)}%` }} /></div><span>{reviewIndex + 1}/{reviewQueue.length}</span></div>
          <div className="review-stage"><span className="deck-label">{state.folders.find((folder) => folder.id === currentCard.folderId)?.name ?? "Sin carpeta"}</span><div className={`study-card ${revealed ? "revealed" : ""}`}><span className="study-card-type">{currentCard.type === "choice" ? "ELIGE LA RESPUESTA" : "RECUERDA EL CONCEPTO"}</span><h2>{currentCard.front}</h2>{currentCard.type === "choice" && !revealed ? <div className="options-list">{currentCard.options.map((option, index) => <button key={`${index}-${option}`} className={selectedOption === index ? "selected" : ""} onClick={() => setSelectedOption(index)}><span>{String.fromCharCode(65 + index)}</span>{option}</button>)}</div> : revealed ? <div className="answer-box"><small>RESPUESTA</small><p>{currentCard.back}</p>{currentCard.type === "choice" && <strong>{String.fromCharCode(65 + currentCard.correctOption)} · {currentCard.options[currentCard.correctOption]}</strong>}</div> : <button className="reveal-button" onClick={() => setRevealed(true)}>Mostrar respuesta</button>}</div>{currentCard.type === "choice" && !revealed && <button className="check-button" disabled={selectedOption === null} onClick={() => setRevealed(true)}>Comprobar</button>}{revealed && <div className="rating-bar"><p>{currentCard.type === "choice" && selectedOption !== null ? selectedOption === currentCard.correctOption ? "¡Correcto! ¿Cómo te ha resultado?" : "No era esa. La repetiremos pronto." : "¿Qué tal la recordabas?"}</p><div><button className="again" onClick={() => rateCurrent("again")}><strong>Otra vez</strong><small>10 min</small></button><button className="hard" onClick={() => rateCurrent("hard")}><strong>Difícil</strong><small>{Math.max(1, currentCard.intervalDays)} d</small></button><button className="good" onClick={() => rateCurrent(currentCard.type === "choice" && selectedOption !== currentCard.correctOption ? "again" : "good")}><strong>Bien</strong><small>{currentCard.repetitions ? Math.max(3, Math.round(Math.max(1, currentCard.intervalDays) * currentCard.ease)) : 1} d</small></button><button className="easy" onClick={() => rateCurrent("easy")}><strong>Fácil</strong><small>{currentCard.repetitions ? Math.max(7, Math.round(Math.max(1, currentCard.intervalDays) * currentCard.ease * 1.3)) : 4} d</small></button></div></div>}</div>
        </div>
      )}

      {reviewQueue.length > 0 && reviewIndex >= reviewQueue.length && (
        <div className="review-overlay complete"><div className="complete-card"><span className="complete-icon">✓</span><span className="section-label">SESIÓN COMPLETADA</span><h2>Buen trabajo, Marc</h2><p>Has repasado {sessionDone} tarjetas. El motor ya ha recalculado cuándo debes volver a ver cada una.</p><button className="primary-button" onClick={() => setReviewQueue([])}>Volver a Hoy</button></div></div>
      )}

      {modal === "folder" && <FolderModal onClose={() => setModal(null)} onCreate={(folder) => { updateState((current) => ({ ...current, folders: [...current.folders, folder] })); setModal(null); notify("Carpeta creada"); }} />}
      {modal === "card" && <CardModal folders={state.folders} defaultFolder={selectedFolder} initialCard={openCard} onClose={() => { setModal(null); setEditingCard(null); }} onSave={(card) => { updateState((current) => ({ ...current, cards: openCard ? current.cards.map((item) => item.id === card.id ? card : item) : [...current.cards, card] })); setModal(null); setEditingCard(null); notify(openCard ? "Tarjeta actualizada" : "Tarjeta guardada"); }} />}
      {modal === "psych" && <PsychModal onClose={() => setModal(null)} onCreate={(test) => { updateState((current) => ({ ...current, psychTests: [...current.psychTests, test] })); setModal(null); notify("Psicotécnico guardado"); }} />}
      {modal === "attempt" && activePsych && <AttemptModal test={activePsych} onClose={() => { setModal(null); setSelectedPsych(null); }} onCreate={(attempt) => { updateState((current) => ({ ...current, psychTests: current.psychTests.map((test) => test.id === activePsych.id ? { ...test, attempts: [...test.attempts, attempt] } : test) })); setModal(null); setSelectedPsych(null); notify("Intento registrado"); }} />}
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
      ease: 2.35,
      repetitions: 0,
      lapses: 0,
      streak: 0,
      reviewCount: 0,
      successCount: 0,
    };
    onSave({
      ...base,
      folderId,
      type,
      front: front.trim(),
      back: back.trim(),
      options: type === "choice" ? options.map((option) => option.trim()) : [],
      correctOption: type === "choice" ? Math.min(correctOption, Math.max(0, options.length - 1)) : 0,
    });
  }

  return <ModalShell title={initialCard ? "Editar tarjeta" : "Crear tarjeta"} subtitle={initialCard ? "Modifica cualquier campo y conserva todo el historial de estudio de la tarjeta." : "Puedes guardarla aunque todavía quieras completar algún campo más adelante."} label={initialCard ? "EDITAR" : "NUEVO"} onClose={onClose}><form onSubmit={submit}><div className="segmented"><button type="button" className={type === "basic" ? "active" : ""} onClick={() => setType("basic")}>Pregunta y respuesta</button><button type="button" className={type === "choice" ? "active" : ""} onClick={() => setType("choice")}>Elección múltiple</button></div><label>Carpeta<select value={folderId} onChange={(event) => setFolderId(event.target.value)}><option value="">Sin carpeta</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label><label>Pregunta<textarea value={front} onChange={(event) => setFront(event.target.value)} placeholder="Escribe el anverso de la tarjeta" /></label>{type === "choice" && <fieldset><legend>Opciones · marca la correcta si quieres</legend>{options.map((option, index) => <label className="option-input" key={index}><input type="radio" name="correct" checked={correctOption === index} onChange={() => setCorrectOption(index)} /><span>{String.fromCharCode(65 + index)}</span><input value={option} onChange={(event) => setOptions((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`Opción ${index + 1}`} /></label>)}</fieldset>}<label>Respuesta o explicación <small>(opcional)</small><textarea value={back} onChange={(event) => setBack(event.target.value)} placeholder="Qué debes recordar" /></label><button className="primary-button full">{initialCard ? "Guardar cambios" : "Guardar tarjeta"}</button></form></ModalShell>;
}

function PsychModal({ onClose, onCreate }: { onClose: () => void; onCreate: (test: PsychTest) => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Razonamiento verbal");
  const [total, setTotal] = useState(80);
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
    if (!initResponse.ok || !init.id || !init.key || !init.uploadId) {
      throw new Error(init.error ?? "No se pudo iniciar la subida");
    }

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
        if (!partResponse.ok || !part.partNumber || !part.etag) {
          throw new Error(part.error ?? `No se pudo subir la parte ${partNumber}`);
        }
        parts.push({ partNumber: part.partNumber, etag: part.etag });
        setUploadProgress(Math.round((partNumber / (totalParts + 1)) * 100));
      }

      const completeResponse = await fetch("/api/files/multipart?action=complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: init.id,
          key: init.key,
          uploadId: init.uploadId,
          name: selectedFile.name,
          type: selectedFile.type || "application/pdf",
          size: selectedFile.size,
          parts,
        }),
      });
      const completed = await readJson(completeResponse) as { attachment?: Attachment; error?: string };
      if (!completeResponse.ok || !completed.attachment) {
        throw new Error(completed.error ?? "No se pudo completar la subida");
      }
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
    if (!name.trim()) return;
    setUploading(true);
    setUploadProgress(0);
    setError("");
    let attachment: Attachment | null = null;
    try {
      if (file) {
        if (file.size > 100 * 1024 * 1024) throw new Error("El archivo no puede superar 100 MB");
        attachment = file.size <= 6 * 1024 * 1024 ? await uploadDirect(file) : await uploadInParts(file);
      }
      onCreate({ id: uid(), name: name.trim(), category, totalQuestions: total, attachment, attempts: [], createdAt: nowIso() });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar");
      setUploading(false);
    }
  }
  return <ModalShell title="Añadir psicotécnico" subtitle="Guarda el documento y registra todos tus intentos." onClose={onClose}><form onSubmit={submit}><label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Cuadernillo verbal 01" /></label><div className="form-grid"><label>Categoría<select value={category} onChange={(event) => setCategory(event.target.value)}><option>Razonamiento verbal</option><option>Razonamiento numérico</option><option>Razonamiento abstracto</option><option>Atención y percepción</option><option>Memoria</option><option>Mixto</option></select></label><label>Preguntas<input type="number" min="1" value={total} onChange={(event) => setTotal(Number(event.target.value))} /></label></div><label className="file-drop"><input type="file" accept="application/pdf,image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><span>⇧</span><strong>{file ? file.name : "Seleccionar PDF o imagen"}</strong><small>Máximo 100 MB</small></label>{uploading && <div className="upload-progress"><span style={{ width: `${uploadProgress}%` }} /><small>{uploadProgress}%</small></div>}{error && <p className="form-error">{error}</p>}<button className="primary-button full" disabled={!name.trim() || uploading}>{uploading ? `Subiendo… ${uploadProgress}%` : "Guardar psicotécnico"}</button></form></ModalShell>;
}

function AttemptModal({ test, onClose, onCreate }: { test: PsychTest; onClose: () => void; onCreate: (attempt: Attempt) => void }) {
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [blank, setBlank] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [score, setScore] = useState(0);
  const [notes, setNotes] = useState("");
  return <ModalShell title="Registrar intento" subtitle={test.name} onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); onCreate({ id: uid(), date: nowIso(), correct, wrong, blank, score, minutes, notes: notes.trim() }); }}><div className="form-grid three"><label>Aciertos<input type="number" min="0" value={correct} onChange={(event) => setCorrect(Number(event.target.value))} /></label><label>Fallos<input type="number" min="0" value={wrong} onChange={(event) => setWrong(Number(event.target.value))} /></label><label>Blancas<input type="number" min="0" value={blank} onChange={(event) => setBlank(Number(event.target.value))} /></label></div><div className="form-grid"><label>Puntuación<input type="number" step="0.01" value={score} onChange={(event) => setScore(Number(event.target.value))} /></label><label>Tiempo (min)<input type="number" min="0" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} /></label></div><label>Notas<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Qué te ha costado, errores repetidos…" /></label><p className="attempt-total">Registradas: <strong>{correct + wrong + blank}</strong> de {test.totalQuestions} preguntas</p><button className="primary-button full">Guardar intento</button></form></ModalShell>;
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
