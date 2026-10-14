"use client";
export interface OrthographyStudyCard {
  id: string;
  word: string;
  isCorrect: boolean;
  correctForm: string;
  explanation: string;
  source: string;
}
export interface OrthographyStudyResult {
  cardId: string;
  userMarked: boolean;
  shouldBeMarked: boolean;
  correct: boolean;
}
interface Props {
  cards: OrthographyStudyCard[];
  selectedIds: string[];
  results: OrthographyStudyResult[] | null;
  groupNumber: number;
  responses: number;
  correctResponses: number;
  scopeLabel: string;
  onToggle: (id: string) => void;
  onCorrect: () => void;
  onContinue: () => void;
  onClose: () => void;
  busy?: boolean;
}
export default function OrthographyStudy(p: Props) {
  return (
    <div className="review-overlay orthography-overlay">
      <header className="review-top orthography-top">
        <button onClick={p.onClose} disabled={p.busy} aria-label="Cerrar">
          ×
        </button>
        <strong>{p.scopeLabel}</strong>
        <span>Grupo {p.groupNumber}</span>
      </header>
      <div className="review-stage orthography-stage">
        <section className="orthography-question-card">
          <span className="eyebrow">ORTOGRAFÍA</span>
          <h2>Marca las palabras incorrectas</h2>
          <p className="orthography-hint">Puedes marcar varias o ninguna.</p>
          <div className="orthography-options">
            {p.cards.map((c) => {
              const r = p.results?.find((r) => r.cardId === c.id),
                selected = p.selectedIds.includes(c.id);
              return (
                <button
                  className={`orthography-option ${selected ? "selected" : ""} ${r ? (r.correct ? "result-correct" : "result-wrong") : ""}`}
                  key={c.id}
                  disabled={!!p.results || p.busy}
                  aria-pressed={selected}
                  onClick={() => p.onToggle(c.id)}
                >
                  <span className="orthography-checkbox">
                    {selected ? "✓" : ""}
                  </span>
                  <strong>{c.word}</strong>
                  {r && (
                    <span className="orthography-result-icon">
                      {r.correct ? "✓" : "×"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {!p.results ? (
            <button
              className="primary-button full"
              disabled={p.busy}
              onClick={p.onCorrect}
            >
              Corregir
            </button>
          ) : (
            <div className="orthography-feedback">
              <p>
                {p.correctResponses} aciertos de {p.responses} respuestas en
                esta sesión.
              </p>
              <div className="orthography-feedback-list">
                {p.cards.map((c) => (
                  <div key={c.id} className="orthography-feedback-item">
                    <strong>
                      {c.word}
                      {!c.isCorrect && ` → ${c.correctForm}`}
                    </strong>
                    <p>{c.explanation}</p>
                    <small>{c.source}</small>
                  </div>
                ))}
              </div>
              <button className="primary-button" onClick={p.onContinue}>
                Continuar
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
