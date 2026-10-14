import type { Card, Review } from "../../lib/study/legacy";
import { dateLabel } from "../../lib/study/legacy";
import { plainRichText } from "../../app/RichTextEditor";
export default function OrthographyProgress({
  cards,
  reviews,
  onReview,
}: {
  cards: Card[];
  reviews: Review[];
  onReview: () => void;
}) {
  const ids = new Set(cards.map((c) => c.id)),
    events = reviews.filter((r) => ids.has(r.cardId)),
    studied = new Set(events.map((r) => r.cardId)),
    mastered = cards.filter(
      (c) => c.intervalDays >= 21 && c.streak >= 3,
    ).length;
  const failed = new Map<string, number>();
  events.forEach((r) => {
    if (!r.correct) failed.set(r.cardId, (failed.get(r.cardId) ?? 0) + 1);
  });
  const weak = cards
      .filter((c) => failed.has(c.id))
      .sort((a, b) => (failed.get(b.id) ?? 0) - (failed.get(a.id) ?? 0))
      .slice(0, 5),
    next = cards
      .filter((c) => c.reviewCount > 0)
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
      .slice(0, 5);
  return (
    <details className="progress-details">
      <summary>Ortografía · tu evolución</summary>
      <div className="rhythm-numbers">
        <div>
          <strong>{studied.size}</strong>
          <small>palabras estudiadas de {cards.length}</small>
        </div>
        <div>
          <strong>{mastered}</strong>
          <small>dominadas</small>
        </div>
        <div>
          <strong>
            {events.length
              ? Math.round(
                  (events.filter((r) => r.correct).length / events.length) *
                    100,
                )
              : 0}
            %
          </strong>
          <small>de acierto</small>
        </div>
      </div>
      <h3>Palabras que cuestan</h3>
      <div className="simple-list">
        {weak.map((c) => (
          <div className="simple-row" key={c.id}>
            <strong>{plainRichText(c.front)}</strong>
            <small>{failed.get(c.id)} fallos</small>
          </div>
        ))}
        {!weak.length && (
          <p className="empty-inline">Aún no hay fallos registrados.</p>
        )}
      </div>
      <button className="secondary-button" onClick={onReview}>
        Practicar más falladas
      </button>
      <h3 style={{ marginTop: 24 }}>Próximos repasos</h3>
      <div className="simple-list">
        {next.map((c) => (
          <div className="simple-row" key={c.id}>
            <strong>{plainRichText(c.front)}</strong>
            <small>
              {new Date(c.dueAt).getTime() <= Date.now()
                ? "Ahora"
                : dateLabel(c.dueAt)}
            </small>
          </div>
        ))}
      </div>
    </details>
  );
}
