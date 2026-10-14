import Icon from "../shared/Icon";
export interface PriorityItem {
  id: string;
  title: string;
  subtitle: string;
  kind: "review" | "study";
  onStart: () => void;
}
interface Props {
  reviewPending: number;
  cardPending: number;
  reviewDone: number;
  studyPending: number;
  studyDone: number;
  nextStudy?: string;
  priorities: PriorityItem[];
  hasCards: boolean;
  preparation: string;
  onReview: () => void;
  onStudy: () => void;
  onPlanning: () => void;
}
export default function TodayPage(p: Props) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";
  const progress = (done: number, pending: number) =>
    Math.round((done / Math.max(1, done + pending)) * 100);
  return (
    <section className="ux-page today-page-v11">
      <div className="today-welcome">
        <div>
          <span className="ux-label">MI PREPARACIÓN</span>
          <h1>
            {greeting}
            <span className="greeting-dot">.</span>
          </h1>
          <p>{p.preparation}</p>
        </div>
        <time>
          {new Intl.DateTimeFormat("es-ES", {
            day: "numeric",
            month: "short",
          }).format(new Date())}
        </time>
      </div>
      <div className="today-section-heading">
        <h2>Vamos con lo de hoy</h2>
        <span>Un paso cada vez</span>
      </div>
      <div className="today-actions">
        <button className="today-start review-start" onClick={p.onReview}>
          <span className="action-symbol">
            <Icon name="review" size={26} />
          </span>
          <span className="action-main">
            <small>
              {p.reviewPending ? "TU SIGUIENTE PASO" : "MANTÉN EL RITMO"}
            </small>
            <strong>
              {p.reviewPending ? "Repasar ahora" : "Repaso libre"}
            </strong>
            <span>
              {p.reviewPending
                ? `${p.reviewPending} ${p.reviewPending === 1 ? "repaso pendiente" : "repasos pendientes"}`
                : p.hasCards
                  ? "Practica lo que ya has aprendido"
                  : "Elige un apartado de tu temario"}
            </span>
            {p.cardPending > 0 && p.reviewPending > p.cardPending && (
              <em>
                {p.cardPending} tarjetas · {p.reviewPending - p.cardPending} de
                temario
              </em>
            )}
          </span>
          <Icon name="arrow" />
        </button>
        <button className="today-start study-start" onClick={p.onStudy}>
          <span className="action-symbol">
            <Icon name="study" size={26} />
          </span>
          <span className="action-main">
            <small>CONTINÚA AVANZANDO</small>
            <strong>
              {p.studyPending ? "Continuar estudio" : "Estudiar ahora"}
            </strong>
            <span>{p.nextStudy ?? "Elige por dónde empezar"}</span>
            {p.studyPending > 0 && (
              <em>
                {p.studyPending}{" "}
                {p.studyPending === 1
                  ? "elemento previsto"
                  : "elementos previstos"}
              </em>
            )}
          </span>
          <Icon name="arrow" />
        </button>
      </div>
      <section className="priority-section">
        <div className="ux-section-head">
          <h2>Prioridad de hoy</h2>
          <span>
            {p.priorities.length ? "Empieza por aquí" : "Todo a tu ritmo"}
          </span>
        </div>
        <div className="priority-list">
          {p.priorities.map((item, index) => (
            <button
              key={item.id}
              className="priority-row"
              onClick={item.onStart}
            >
              <span className="priority-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>
                <strong>{item.title}</strong>
                <small>
                  {item.subtitle ||
                    (item.kind === "review" ? "Repasar" : "Estudiar")}
                </small>
              </span>
              <span className={`action-tag ${item.kind}`}>
                {item.kind === "review" ? "Repasar" : "Estudio"}
              </span>
            </button>
          ))}
          {!p.priorities.length && (
            <p className="empty-inline">
              No tienes pendientes. Puedes hacer un repaso libre o elegir algo
              nuevo.
            </p>
          )}
        </div>
        <button className="ux-link" onClick={p.onPlanning}>
          Ver planificación completa <Icon name="arrow" size={16} />
        </button>
      </section>
      <section className="daily-progress">
        <div className="ux-section-head">
          <h2>Tu avance de hoy</h2>
          <Icon name="check" size={18} />
        </div>
        {[
          { label: "Repasos", done: p.reviewDone, pending: p.reviewPending },
          { label: "Estudio", done: p.studyDone, pending: p.studyPending },
        ].map((item) => (
          <div className="daily-progress-row" key={item.label}>
            <span>{item.label}</span>
            <strong>
              {item.done}
              <small> / {item.done + item.pending}</small>
            </strong>
            <div className="ux-progress-track">
              <i style={{ width: `${progress(item.done, item.pending)}%` }} />
            </div>
          </div>
        ))}
      </section>
    </section>
  );
}
