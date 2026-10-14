import type { AppState } from "../../lib/study/legacy";
import { plainRichText } from "../../app/RichTextEditor";
import {
  localDateKey,
  studyNodePath,
  isOrthographyCard,
} from "../../lib/study/legacy";
import { ActivityChart, MemoryBreakdown, streakDays } from "./LegacyCharts";
import OrthographyProgress from "./OrthographyProgress";
import Icon from "../shared/Icon";
export default function ProgressPage({
  state,
  onWeak,
  onNode,
  onHistory,
  onCard,
  onOrthography,
}: {
  state: AppState;
  onWeak: () => void;
  onNode: (id: string) => void;
  onHistory: () => void;
  onCard: (id: string) => void;
  onOrthography: () => void;
}) {
  const done = state.studyTasks
      .filter((t) => t.status === "done")
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")),
    latest = new Map<string, (typeof done)[number]>();
  done.forEach((t) => {
    if (!latest.has(t.nodeId)) latest.set(t.nodeId, t);
  });
  const leaves = state.studyNodes.filter(
    (n) => !state.studyNodes.some((c) => c.parentId === n.id),
  );
  const studied = leaves.filter((n) => latest.has(n.id)).length,
    pct = leaves.length ? Math.round((studied / leaves.length) * 100) : 0;
  const weakNodes = [...latest.values()]
    .filter((t) => t.assessment === "mal" || t.assessment === "regular")
    .sort(
      (a, b) => Number(a.assessment !== "mal") - Number(b.assessment !== "mal"),
    )
    .slice(0, 5);
  const weakCards = state.cards
    .filter((c) => c.reviewCount > 0 && c.successCount < c.reviewCount)
    .sort(
      (a, b) => a.successCount / a.reviewCount - b.successCount / b.reviewCount,
    )
    .slice(0, 5);
  const days = new Set([
    ...state.reviews.map((r) => localDateKey(new Date(r.reviewedAt))),
    ...done
      .filter((t) => t.completedAt)
      .map((t) => localDateKey(new Date(t.completedAt!))),
  ]).size;
  const counts = { bien: 0, regular: 0, mal: 0 };
  latest.forEach((t) => {
    if (t.assessment) counts[t.assessment]++;
  });
  return (
    <section className="ux-page progress-page-v11">
      <p className="ux-intro">
        Entiende qué reforzar. Elige tu siguiente paso.
      </p>
      <section className="syllabus-progress">
        <span className="ux-label">TU TEMARIO</span>
        <div>
          <h2>
            {pct}
            <small>%</small>
          </h2>
          <p>
            {studied} de {leaves.length} apartados estudiados
          </p>
        </div>
        <div className="ux-progress-track">
          <i style={{ width: `${pct}%` }} />
        </div>
        <div className="assessment-summary">
          {(["bien", "regular", "mal"] as const).map((v) => (
            <span key={v} className={v}>
              <i />
              {counts[v]} {v}
            </span>
          ))}
        </div>
      </section>
      <section>
        <div className="ux-section-head">
          <h2>Dedica tiempo a esto</h2>
        </div>
        <div className="simple-list">
          {weakNodes.map((t) => (
            <button
              className="simple-row"
              key={t.nodeId}
              onClick={() => onNode(t.nodeId)}
            >
              <span>
                <strong>
                  {state.studyNodes.find((n) => n.id === t.nodeId)?.name ??
                    "Apartado"}
                </strong>
                <small>
                  {t.completionNote ||
                    studyNodePath(state.studyNodes, t.nodeId)
                      .slice(0, -1)
                      .join(" · ")}
                </small>
              </span>
              <span className={`assessment-chip ${t.assessment}`}>
                {t.assessment}
              </span>
            </button>
          ))}
          {!weakNodes.length && (
            <p className="empty-inline">
              Tus valoraciones Regular y Mal aparecerán aquí para que puedas
              reforzarlas.
            </p>
          )}
        </div>
      </section>
      {weakCards.length > 0 && (
        <section>
          <div className="ux-section-head">
            <h2>Tarjetas que cuestan</h2>
            <button className="ux-link" onClick={onWeak}>
              Repasar <Icon name="arrow" size={16} />
            </button>
          </div>
          <div className="simple-list">
            {weakCards.map((c) => (
              <button
                className="simple-row"
                onClick={() => onCard(c.id)}
                key={c.id}
              >
                <span>
                  <strong>{plainRichText(c.front)}</strong>
                  <small>
                    {state.folders.find((f) => f.id === c.folderId)?.name}
                  </small>
                </span>
                <span className="weak-percentage">
                  {Math.round((c.successCount / c.reviewCount) * 100)}%
                  <small>acierto</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
      <section className="study-rhythm">
        <h2>Tu constancia</h2>
        <div className="rhythm-numbers">
          <div>
            <strong>{days}</strong>
            <small>días de estudio</small>
          </div>
          <div>
            <strong>{state.reviews.length}</strong>
            <small>repasos de tarjetas</small>
          </div>
          <div>
            <strong>{done.length}</strong>
            <small>sesiones de temario</small>
          </div>
        </div>
        <ActivityChart reviews={state.reviews} />
      </section>
      <details className="progress-details">
        <summary>Estado de las tarjetas</summary>
        <MemoryBreakdown
          cards={state.cards.filter((c) => !isOrthographyCard(c))}
        />
      </details>
      {state.cards.some(isOrthographyCard) && (
        <OrthographyProgress
          cards={state.cards.filter(isOrthographyCard)}
          reviews={state.reviews}
          onReview={onOrthography}
        />
      )}
      <button className="simple-row" onClick={onHistory}>
        <span>
          <strong>Historial de estudio</strong>
          <small>Valoraciones y notas, siempre disponibles</small>
        </span>
        <Icon name="chevron" size={20} />
      </button>
    </section>
  );
}
