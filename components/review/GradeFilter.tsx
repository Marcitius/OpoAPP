import type { GradeFilter as Filter } from "../../lib/memory/grades";
export default function GradeFilter({
  value,
  onChange,
}: {
  value: Filter;
  onChange: (value: Filter) => void;
}) {
  return (
    <fieldset className="grade-filter">
      <legend>Elegir por nota de recuerdo</legend>
      <label>
        Tarjetas
        <select
          aria-label="Filtrar por nota"
          value={value.kind}
          onChange={(e) =>
            onChange({ ...value, kind: e.target.value as Filter["kind"] })
          }
        >
          <option value="all">Todas las notas</option>
          <option value="failed">Solo suspendidas · menos de 5</option>
          <option value="range">Intervalo de notas</option>
          <option value="unrated">Sin nota de recuerdo</option>
        </select>
      </label>
      {value.kind !== "unrated" && (
        <label>
          Usar
          <select
            aria-label="Criterio de nota"
            value={value.metric}
            onChange={(e) =>
              onChange({ ...value, metric: e.target.value as Filter["metric"] })
            }
          >
            <option value="average">Nota media de recuerdo</option>
            <option value="latest">Última nota de recuerdo</option>
          </select>
        </label>
      )}
      {value.kind === "range" && (
        <div className="grade-range">
          <label>
            Desde
            <select
              aria-label="Nota mínima"
              value={value.min}
              onChange={(e) =>
                onChange({
                  ...value,
                  min: +e.target.value,
                  max: Math.max(+e.target.value, value.max),
                })
              }
            >
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i + 1}>{i + 1}</option>
              ))}
            </select>
          </label>
          <label>
            Hasta
            <select
              aria-label="Nota máxima"
              value={value.max}
              onChange={(e) =>
                onChange({
                  ...value,
                  max: +e.target.value,
                  min: Math.min(+e.target.value, value.min),
                })
              }
            >
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i + 1}>{i + 1}</option>
              ))}
            </select>
          </label>
        </div>
      )}
    </fieldset>
  );
}
