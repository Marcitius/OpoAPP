"use client";

export type OrthographyStudyCard = {
  id: string;
  word: string;
  isCorrect: boolean;
  correctForm: string;
  explanation: string;
  source: string;
};

export type OrthographyStudyResult = {
  cardId: string;
  userMarked: boolean;
  shouldBeMarked: boolean;
  correct: boolean;
};

type Props = {
  cards: OrthographyStudyCard[];
  selectedIds: string[];
  results: OrthographyStudyResult[] | null;
  groupNumber: number;
  responses: number;
  correctResponses: number;
  scopeLabel: string;
  onToggle: (cardId: string) => void;
  onCorrect: () => void;
  onContinue: () => void;
  onClose: () => void;
};

function resultMessage(card: OrthographyStudyCard, result: OrthographyStudyResult) {
  if (!card.isCorrect && result.userMarked) return "Incorrecta bien detectada";
  if (!card.isCorrect && !result.userMarked) return "Era incorrecta y no la marcaste";
  if (card.isCorrect && result.userMarked) return "Era correcta y la marcaste como incorrecta";
  return "Correcta y bien dejada sin marcar";
}

export default function OrthographyStudy({
  cards,
  selectedIds,
  results,
  groupNumber,
  responses,
  correctResponses,
  scopeLabel,
  onToggle,
  onCorrect,
  onContinue,
  onClose,
}: Props) {
  const resultMap = new Map((results ?? []).map((result) => [result.cardId, result]));
  const accuracy = responses ? Math.round((correctResponses / responses) * 100) : null;

  return (
    <div className="review-overlay orthography-overlay">
      <div className="review-top continuous orthography-top">
        <button onClick={onClose} aria-label="Cerrar práctica">×</button>
        <div className="learn-session-title">
          <strong>Ortografía · práctica dinámica</strong>
          <small>{scopeLabel} · cada palabra mantiene su progreso individual</small>
        </div>
        <span>{responses} palabras{accuracy !== null ? ` · ${accuracy}%` : ""}</span>
        <button className="finish-learn-button" onClick={onClose}>Terminar sesión</button>
      </div>

      <div className="orthography-stage">
        <div className="orthography-question-card">
          <span className="study-card-type">GRUPO {groupNumber}</span>
          <h2>Señala la palabra o palabras escritas incorrectamente.</h2>
          <p className="orthography-hint">Puede haber ninguna, una o varias. Marca solo las que consideres incorrectas.</p>

          <div className={`orthography-options ${results ? "corrected" : ""}`}>
            {cards.map((card) => {
              const selected = selectedIds.includes(card.id);
              const result = resultMap.get(card.id) ?? null;
              const resultClass = result ? (result.correct ? "result-correct" : "result-wrong") : "";
              return (
                <button
                  type="button"
                  key={card.id}
                  className={`orthography-option ${selected ? "selected" : ""} ${resultClass}`}
                  onClick={() => !results && onToggle(card.id)}
                  disabled={Boolean(results)}
                >
                  <span className="orthography-checkbox" aria-hidden="true">{selected ? "✓" : ""}</span>
                  <strong>{card.word}</strong>
                  {result && <span className="orthography-result-icon">{result.correct ? "✓" : "✕"}</span>}
                </button>
              );
            })}
          </div>

          {!results ? (
            <button type="button" className="primary-button full orthography-correct-button" onClick={onCorrect}>Corregir</button>
          ) : (
            <div className="orthography-feedback">
              <div className="orthography-feedback-list">
                {cards.map((card) => {
                  const result = resultMap.get(card.id)!;
                  return (
                    <article key={card.id} className={`orthography-feedback-item ${result.correct ? "correct" : "wrong"}`}>
                      <div className="orthography-feedback-main">
                        <strong>
                          {card.isCorrect
                            ? <>{card.word} <span>✓</span></>
                            : <>{card.word} <span>✗</span> <em>→</em> {card.correctForm} <span>✓</span></>}
                        </strong>
                        <small>{resultMessage(card, result)}</small>
                      </div>
                      {card.explanation && <p>{card.explanation}</p>}
                      {card.source && <span className="orthography-source">Fuente: {card.source}</span>}
                    </article>
                  );
                })}
              </div>
              <div className="orthography-feedback-actions">
                <button type="button" className="secondary-button" onClick={onClose}>Terminar</button>
                <button type="button" className="primary-button" onClick={onContinue}>Continuar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
