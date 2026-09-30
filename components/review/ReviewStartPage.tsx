import type { Card, Folder, StudyMode } from "../../lib/study/legacy";
import { isOrthographyCard } from "../../lib/study/legacy";
import Icon from "../shared/Icon";
export default function ReviewStartPage({
  cards,
  folders,
  pending,
  temarioPending,
  onStart,
  onPrimary,
  onTemario,
  onLibrary,
}: {
  cards: Card[];
  folders: Folder[];
  pending: number;
  temarioPending: number;
  onStart: (folderId?: string, mode?: StudyMode, ids?: string[]) => void;
  onPrimary: () => void;
  onTemario: () => void;
  onLibrary: () => void;
}) {
  return (
    <section className="ux-page review-start-page">
      <p className="ux-intro">Recuerda hoy. Avanza mañana.</p>
      <button className="today-start review-start" onClick={onPrimary}>
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
      <div className="review-modes">
        <button onClick={() => onStart(undefined, "weakest")}>
          <Icon name="review" />
          <strong>Más falladas</strong>
          <small>Dedica tiempo a lo que cuesta</small>
        </button>
        <button onClick={() => onStart(undefined, "learn")}>
          <Icon name="study" />
          <strong>Aprender</strong>
          <small>Practica sin límite de tarjetas</small>
        </button>
        <button onClick={() => onStart(undefined, "random")}>
          <Icon name="more" />
          <strong>Aleatorio</strong>
          <small>Cambia el orden del repaso</small>
        </button>
        {cards.some(isOrthographyCard) && (
          <button
            onClick={() =>
              onStart(
                undefined,
                "recommended",
                cards.filter(isOrthographyCard).map((c) => c.id),
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
      <div className="simple-list">
        {folders
          .filter((f) => !f.parentId)
          .map((f) => (
            <button
              className="simple-row"
              key={f.id}
              onClick={() => onStart(f.id, "learn")}
            >
              <span>
                <strong>{f.name}</strong>
                <small>Empezar directamente</small>
              </span>
              <Icon name="arrow" size={20} />
            </button>
          ))}
      </div>
      {!cards.length && (
        <p className="empty-inline">
          Puedes añadir tarjetas desde Más → Biblioteca.
        </p>
      )}
    </section>
  );
}
