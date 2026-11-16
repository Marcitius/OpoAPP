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
          <option value="sufficient">Suficiente</option>
          <option value="notable">Notable</option>
          <option value="outstanding">Sobresaliente</option>
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
    </fieldset>
  );
}
