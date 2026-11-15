"use client";
import { useMemo, useState } from "react";
import type { Card, StudyMode } from "../../lib/study/legacy";
import { isOrthographyCard, isStudyableCard } from "../../lib/study/legacy";
import {
  defaultGradeFilter,
  filterByGrade,
  gradeIndex,
  type GradeFilter as Filter,
} from "../../lib/memory/grades";
import GradeFilter from "./GradeFilter";
import type { Review } from "../../lib/study/legacy";
import BottomSheet from "../sheets/BottomSheet";

export default function StudyModeSheet({
  cards,
  reviews,
  onStart,
  onClose,
}: {
  cards: Card[];
  reviews: Review[];
  onStart: (mode: StudyMode, ids: string[], metric?: Filter["metric"]) => void;
  onClose: () => void;
}) {
  const ordinary = cards.filter(
    (c) => isStudyableCard(c) && !isOrthographyCard(c),
  );
  const words = cards.filter(isOrthographyCard);
  const [orthography, setOrthography] = useState(!ordinary.length);
  const [filter, setFilter] = useState<Filter>(defaultGradeFilter);
  const grades = useMemo(() => gradeIndex(reviews), [reviews]);
  const pool = orthography ? words : filterByGrade(ordinary, grades, filter);
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
      {!orthography && (
        <>
          <GradeFilter value={filter} onChange={setFilter} />
          <p className="score-help">
            {pool.length} tarjetas coinciden. Los refuerzos inmediatos no suben
            la media.
          </p>
        </>
      )}
      <div className="session-mode-list">
        {(
          [
            ...(!orthography
              ? ([
                  [
                    "grades",
                    "Peor nota primero",
                    "Toda la selección filtrada; prioridad para las notas bajas.",
                  ],
                ] as const)
              : []),
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
                filter.metric,
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
