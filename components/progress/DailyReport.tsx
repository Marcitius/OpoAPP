import { useMemo, useState } from "react";
import type { AppState } from "../../lib/study/legacy";
import {
  chatgptStudyInstructions,
  dailyReport,
  dayInZone,
} from "../../lib/reports/daily";
import BottomSheet from "../sheets/BottomSheet";
export default function DailyReport({ state }: { state: AppState }) {
  const [open, setOpen] = useState(false),
    [zone] = useState(
      () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Madrid",
    ),
    [date, setDate] = useState(() => dayInZone(new Date(), zone)),
    [planning, setPlanning] = useState(false),
    [message, setMessage] = useState("");
  const report = useMemo(
    () => (open ? dailyReport(state, date, zone, planning) : null),
    [open, state, date, zone, planning],
  );
  function download() {
    try {
      const json = dailyReport(state, date, zone, planning),
        url = URL.createObjectURL(
          new Blob([JSON.stringify(json, null, 2)], {
            type: "application/json",
          }),
        ),
        a = document.createElement("a");
      a.href = url;
      a.download = `OpoGC-informe-${date}${planning ? "-planificacion" : ""}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Informe descargado. Puedes adjuntarlo a ChatGPT.");
    } catch {
      setMessage("No se ha podido exportar. Vuelve a intentarlo.");
    }
  }
  return (
    <section className="daily-report-entry">
      <button
        className="simple-row"
        onClick={() => {
          setMessage("");
          setOpen(true);
        }}
      >
        <span>
          <strong>Informe diario para ChatGPT</strong>
          <small>Resultados, notas y prioridades en un JSON</small>
        </span>
        <span aria-hidden="true">↗</span>
      </button>
      {open && (
        <BottomSheet title="Informe diario" onClose={() => setOpen(false)}>
          <label className="report-date">
            Día
            <input
              type="date"
              aria-label="Fecha del informe"
              value={date}
              max={dayInZone(new Date(), zone)}
              onChange={(e) => {
                if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value))
                  setDate(e.target.value);
              }}
            />
          </label>
          <p className="muted">
            De 00:00 a 00:00 · {zone}. Incluye todos tus temas.
          </p>
          {report && (
            <dl className="daily-report-summary">
              <div>
                <dt>Tarjetas distintas</dt>
                <dd>{report.summary.distinctCards}</dd>
              </div>
              <div>
                <dt>Intentos</dt>
                <dd>{report.summary.attempts}</dd>
              </div>
              <div>
                <dt>Evaluaciones de recuerdo</dt>
                <dd>{report.summary.recallEvaluations}</dd>
              </div>
              <div>
                <dt>Refuerzos</dt>
                <dd>{report.summary.reinforcementAttempts}</dd>
              </div>
            </dl>
          )}
          <label className="report-context">
            <input
              type="checkbox"
              checked={planning}
              onChange={(e) => setPlanning(e.target.checked)}
            />
            <span>
              Añadir contexto para planificar
              <small>
                Pendientes, tarjetas débiles y sesiones abiertas actuales.
              </small>
            </span>
          </label>
          <p>
            El refuerzo no sube tu nota media de recuerdo. Los datos antiguos
            sin nota se incluyen como tales.
          </p>
          <button className="primary-button full" onClick={download}>
            Exportar para ChatGPT
          </button>
          <button
            className="sheet-action"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(chatgptStudyInstructions);
                setMessage("Instrucciones copiadas.");
              } catch {
                setMessage(
                  "No se pudo copiar. Las instrucciones también van dentro del JSON.",
                );
              }
            }}
          >
            Copiar instrucciones para ChatGPT
          </button>
          {message && <p role="status">{message}</p>}
        </BottomSheet>
      )}
    </section>
  );
}
