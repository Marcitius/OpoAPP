"use client";
import { useState } from "react";
import type { Card, StudyMode } from "../../lib/study/legacy";
import { isOrthographyCard, isStudyableCard } from "../../lib/study/legacy";
import BottomSheet from "../sheets/BottomSheet";

export default function StudyModeSheet({
  cards,
  onStart,
  onClose,
}: {
  cards: Card[];
  onStart: (mode: StudyMode, ids: string[]) => void;
  onClose: () => void;
}) {
  const ordinary = cards.filter(
    (c) => isStudyableCard(c) && !isOrthographyCard(c),
  );
  const words = cards.filter(isOrthographyCard);
  const [orthography, setOrthography] = useState(!ordinary.length);
  const pool = orthography ? words : ordinary;
  return (
    <BottomSheet
      title="¿Cómo quieres estudiar?"
      onClose={onClose}
      subtitle={`${pool.length} ${orthography ? (pool.length === 1 ? "palabra" : "palabras") : pool.length === 1 ? "tarjeta" : "tarjetas"} de tu selección`}
    >
      {!!ordinary.length && !!words.length && (
        <div className="segmented">
          <button
            aria-pressed={!orthography}
            onClick={() => setOrthography(false)}
          >
            Tarjetas · {ordinary.length}
          </button>
          <button
            aria-pressed={orthography}
            onClick={() => setOrthography(true)}
          >
            Ortografía · {words.length}
          </button>
        </div>
      )}
      <div className="session-mode-list">
        {(
          [
            [
              "learn",
              "Aprender",
              "Con refuerzo de las tarjetas que te cuesten.",
            ],
            [
              "random",
              "Aleatorio",
              "Todas las seleccionadas, en orden mezclado.",
            ],
            [
              "all",
              "En orden",
              "Todas las seleccionadas, en su orden habitual.",
            ],
            [
              "weakest",
              "Más falladas",
              "Prioriza los errores dentro de esta selección.",
            ],
            [
              "recommended",
              "Repasos pendientes",
              "Las que te tocan y las nuevas, según tus límites diarios.",
            ],
          ] as const
        ).map(([mode, label, description]) => (
          <button
            key={mode}
            className="sheet-action"
            disabled={!pool.length}
            onClick={() =>
              onStart(
                mode,
                pool.map((c) => c.id),
              )
            }
          >
            <strong>{label}</strong>
            <small>{description}</small>
          </button>
        ))}
      </div>
      {!pool.length && (
        <p className="empty-inline">No quedan tarjetas en esta selección.</p>
      )}
    </BottomSheet>
  );
}
