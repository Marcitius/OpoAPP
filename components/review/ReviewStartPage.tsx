import { useState } from "react";
import type { AppState } from "../../lib/study/legacy";
import ContentScope from "../filters/ContentScope";
import { scopedCards } from "../../lib/study/selection";
import type { Card, Folder, StudyMode } from "../../lib/study/legacy";
import { isOrthographyCard } from "../../lib/study/legacy";
import Icon from "../shared/Icon";
export default function ReviewStartPage({
  state,
  cards,
  folders,
  pending,
  temarioPending,
  onStart,
  onPrimary,
  onTemario,
  onLibrary,
}: {
  state: AppState;
  cards: Card[];
  folders: Folder[];
  pending: number;
  temarioPending: number;
  onStart: (folderId?: string, mode?: StudyMode, ids?: string[]) => void;
  onPrimary: () => void;
  onTemario: () => void;
  onLibrary: () => void;
}) {
  const [fs, setFs] = useState<string[]>([]),
    [ns, setNs] = useState<string[]>([]);
  const scoped = scopedCards(state, fs, ns),
    normal = scoped.filter((c) => !isOrthographyCard(c));
  const start = (mode: StudyMode) => {
    if (scoped.length)
      onStart(
        undefined,
        mode,
        (normal.length ? normal : scoped).map((c) => c.id),
      );
  };
  return (
    <section className="ux-page review-start-page">
      <p className="ux-intro">Recuerda hoy. Avanza mañana.</p>
      <button
        className="today-start review-start"
        onClick={() =>
          fs.length || ns.length ? start("recommended") : onPrimary()
        }
      >
        <span className="action-symbol">
          <Icon name="review" size={26} />
        </span>
        <span className="action-main">
          <small>RECOMENDADO PARA TI</small>
          <strong>{pending ? "Repasar ahora" : "Repaso libre"}</strong>
          <span>
            {pending
              ? `${pending} tarjetas pendientes`
              : cards.length
                ? "Un repaso con tus tarjetas"
                : "Elige un apartado de tu temario"}
          </span>
        </span>
        <Icon name="arrow" />
      </button>
      {temarioPending > 0 && (
        <button className="simple-row" onClick={onTemario}>
          <span>
            <strong>Repasos del temario</strong>
            <small>
              {temarioPending} elementos previstos · Bien / Regular / Mal
            </small>
          </span>
          <Icon name="arrow" size={20} />
        </button>
      )}
      <div className="ux-section-head">
        <h2>Otra forma de practicar</h2>
      </div>
      <ContentScope
        state={state}
        folders={fs}
        nodes={ns}
        onFolders={setFs}
        onNodes={setNs}
      />
      <div className="review-modes">
        <button disabled={!scoped.length} onClick={() => start("weakest")}>
          <Icon name="review" />
          <strong>Más falladas</strong>
          <small>Dedica tiempo a lo que cuesta</small>
        </button>
        <button disabled={!scoped.length} onClick={() => start("learn")}>
          <Icon name="study" />
          <strong>Aprender</strong>
          <small>Refuerza las tarjetas de tu selección</small>
        </button>
        <button disabled={!scoped.length} onClick={() => start("random")}>
          <Icon name="more" />
          <strong>Aleatorio</strong>
          <small>Cambia el orden del repaso</small>
        </button>
        {scoped.some(isOrthographyCard) && (
          <button
            onClick={() =>
              onStart(
                undefined,
                "recommended",
                scoped.filter(isOrthographyCard).map((c) => c.id),
              )
            }
          >
            <strong>Ortografía</strong>
            <small>Practica tus palabras</small>
          </button>
        )}
      </div>
      <div className="ux-section-head">
        <h2>Por tema</h2>
        <button className="ux-link" onClick={onLibrary}>
          Biblioteca <Icon name="chevron" size={16} />
        </button>
      </div>
      <p className="muted">
        Selecciona uno o varios temas arriba; cada rama incluye sus
        subapartados.
      </p>
      {!cards.length && (
        <p className="empty-inline">
          Puedes añadir tarjetas desde Más → Biblioteca.
        </p>
      )}
    </section>
  );
}
