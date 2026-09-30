"use client";
import { useState } from "react";
import type { Card, Rating, WrittenAnswerResult } from "../../lib/study/legacy";
import {
  isMultipleChoiceCard,
  isMultipleAnswerTest,
  isWrittenCard,
  cardCorrectOptions,
} from "../../lib/study/legacy";
import { RichContent, plainRichText } from "../../app/RichTextEditor";
import { AnnotatedCardImage } from "../../app/CardImage";
import Icon from "../shared/Icon";
import BottomSheet from "../sheets/BottomSheet";
interface Props {
  card: Card;
  folder: string;
  position: number;
  total: number;
  continuous: boolean;
  doneCount: number;
  status: string;
  revealed: boolean;
  completed: boolean;
  unknown: boolean;
  selectedOption: number | null;
  selectedOptions: number[];
  writtenAnswer: string;
  writtenResult: WrittenAnswerResult | null;
  onExit: () => void;
  onReveal: () => void;
  onQuestion: () => void;
  onOption: (index: number) => void;
  onWritten: (text: string) => void;
  onCheckWritten: () => void;
  onRate: (rating: Rating, result?: WrittenAnswerResult | null) => void;
  onNext: () => void;
  onPrevious: () => void;
  onUnknown: () => void;
  onSchedule: () => void;
  onImage: () => void;
  correct: boolean;
}
export default function ReviewSession(p: Props) {
  const [more, setMore] = useState(false);
  const written = isWrittenCard(p.card),
    choice = isMultipleChoiceCard(p.card),
    multi = isMultipleAnswerTest(p.card);
  const action = (fn: () => void) => {
    setMore(false);
    fn();
  };
  return (
    <div className="review-overlay review-v11 immersion">
      <header className="immersion-header">
        <button className="exit-session" onClick={p.onExit}>
          <Icon name="back" size={20} />
          Salir
        </button>
        <span>
          {p.continuous ? (
            `${p.doneCount} repasos`
          ) : (
            <>
              {p.position}
              <small> / {p.total}</small>
            </>
          )}
        </span>
        <small className="session-save" role="status">
          {p.status}
        </small>
      </header>
      <div className="session-progress-line">
        <i
          style={{
            width: `${p.continuous ? 100 : Math.round(((p.position - 1) / p.total) * 100)}%`,
          }}
        />
      </div>
      <div
        className="review-stage"
        key={p.card.id + ":" + p.position + ":" + p.revealed}
      >
        <div className="review-context">
          <span>{p.folder}</span>
          <button
            className="icon-button"
            aria-label="Opciones del repaso"
            onClick={() => setMore(true)}
          >
            <Icon name="more" />
          </button>
        </div>
        <article
          className={`review-question ${p.revealed ? "answer-side" : "question-side"}`}
        >
          <span className="ux-label">
            {p.revealed
              ? written
                ? "CORRECCIÓN"
                : "RESPUESTA"
              : written
                ? "RESPUESTA ESCRITA"
                : choice
                  ? multi
                    ? "TEST · VARIAS RESPUESTAS"
                    : "ELIGE UNA RESPUESTA"
                  : "RECUERDA"}
          </span>
          <RichContent html={p.card.front} className="review-prompt" />
          {!p.revealed && written && (
            <label className="written-entry">
              <span className="sr-only">Tu respuesta</span>
              <textarea
                value={p.writtenAnswer}
                onChange={(e) => p.onWritten(e.target.value)}
                placeholder="Escribe tu respuesta…"
                rows={5}
              />
            </label>
          )}
          {!p.revealed && choice && (
            <div className="review-options">
              {p.card.options.map((option, index) => {
                const selected = multi
                  ? p.selectedOptions.includes(index)
                  : p.selectedOption === index;
                return (
                  <button
                    key={index}
                    className={selected ? "selected" : ""}
                    aria-pressed={selected}
                    onClick={() => p.onOption(index)}
                  >
                    <span>
                      {multi
                        ? selected
                          ? "✓"
                          : "○"
                        : String.fromCharCode(65 + index)}
                    </span>
                    <span>{option}</span>
                  </button>
                );
              })}
            </div>
          )}
          {p.revealed && (
            <div className="review-answer">
              {written && p.writtenResult ? (
                <>
                  <div
                    className={`written-result-summary ${p.writtenResult.rating}`}
                  >
                    <strong>{p.writtenResult.accuracy}%</strong>
                    <span>
                      {p.unknown ? "No recordada" : "De la respuesta esperada"}
                    </span>
                  </div>
                  {p.writtenAnswer && (
                    <details className="review-detail">
                      <summary>Tu respuesta</summary>
                      <p>{p.writtenAnswer}</p>
                    </details>
                  )}
                  <div className="written-criteria-list">
                    {p.writtenResult.criteria.map((c) => (
                      <div className={c.cumplido ? "ok" : "miss"} key={c.id}>
                        <span>{c.cumplido ? "✓" : "×"}</span>
                        <div>
                          <strong>{c.esperado}</strong>
                          <small>
                            {Math.round(c.conseguido * 10) / 10} / {c.puntos}{" "}
                            puntos
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                  {plainRichText(p.card.back) && (
                    <details className="review-detail">
                      <summary>Respuesta modelo</summary>
                      <RichContent html={p.card.back} />
                    </details>
                  )}
                </>
              ) : (
                <>
                  {choice && (
                    <>
                      <p
                        className={`choice-feedback ${p.correct ? "correct" : "incorrect"}`}
                      >
                        {p.correct ? "✓ Correcto" : "Repásala una vez más"}
                      </p>
                      <div className="choice-solution">
                        {cardCorrectOptions(p.card).map((i) => (
                          <p key={i}>
                            <strong>{String.fromCharCode(65 + i)}.</strong>{" "}
                            {p.card.options[i]}
                          </p>
                        ))}
                      </div>
                    </>
                  )}
                  {plainRichText(p.card.back) && (
                    <RichContent
                      html={p.card.back}
                      className="review-answer-text"
                    />
                  )}
                  {p.card.attachment && (
                    <AnnotatedCardImage
                      attachment={p.card.attachment}
                      onOpen={p.onImage}
                    />
                  )}
                  <button className="ux-link" onClick={p.onQuestion}>
                    Ver pregunta
                  </button>
                </>
              )}
            </div>
          )}
        </article>
      </div>
      <footer className="review-controls">
        {!p.revealed && !p.completed ? (
          <>
            <button
              className="primary-button full"
              disabled={
                written
                  ? !p.writtenAnswer.trim()
                  : choice
                    ? multi
                      ? p.selectedOptions.length === 0
                      : p.selectedOption === null
                    : false
              }
              onClick={written ? p.onCheckWritten : p.onReveal}
            >
              {written
                ? "Comprobar respuesta"
                : choice
                  ? "Comprobar"
                  : "Mostrar respuesta"}
            </button>
            <div className="review-secondary-actions">
              <button onClick={p.onUnknown}>No me la sé</button>
              <button onClick={p.onNext}>
                Pasar <Icon name="arrow" size={15} />
              </button>
            </div>
          </>
        ) : p.completed ? (
          <button className="primary-button full" onClick={p.onNext}>
            Continuar <Icon name="arrow" size={18} />
          </button>
        ) : written && p.writtenResult ? (
          <button
            className="primary-button full"
            onClick={() => p.onRate(p.writtenResult!.rating, p.writtenResult)}
          >
            Guardar y continuar <Icon name="arrow" size={18} />
          </button>
        ) : (
          <>
            <p className="rating-prompt">
              {choice ? "¿Cómo te ha resultado?" : "¿Qué tal la recordabas?"}
            </p>
            <div className="review-rating-buttons">
              {(
                [
                  { value: "again", label: "Otra vez", symbol: "↻" },
                  { value: "hard", label: "Difícil", symbol: "≈" },
                  { value: "good", label: "Bien", symbol: "✓" },
                  { value: "easy", label: "Fácil", symbol: "✓✓" },
                ] as const
              ).map((r) => (
                <button
                  aria-label={r.label}
                  className={r.value}
                  key={r.value}
                  onClick={() => p.onRate(r.value)}
                >
                  <span>{r.symbol}</span>
                  <strong>{r.label}</strong>
                </button>
              ))}
            </div>
          </>
        )}
      </footer>
      {more && (
        <BottomSheet title="En este repaso" onClose={() => setMore(false)}>
          <button
            className="sheet-action"
            disabled={p.position <= 1}
            onClick={() => action(p.onPrevious)}
          >
            Volver a la tarjeta anterior
          </button>
          <button className="sheet-action" onClick={() => action(p.onSchedule)}>
            Añadir repaso de temario o nota
          </button>
          <button className="sheet-action" onClick={() => action(p.onNext)}>
            Pasar esta tarjeta
          </button>
          <button className="sheet-action" onClick={() => action(p.onExit)}>
            Terminar sesión
          </button>
        </BottomSheet>
      )}
    </div>
  );
}
