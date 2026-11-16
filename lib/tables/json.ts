import type { Card, Folder } from "../study/legacy";
import { exportStudyTable, validateStudyTable } from "./model";
export function tableTemplate(
  card: Pick<Card, "front" | "folderId" | "table">,
  folders: Folder[],
) {
  if (!card.table) throw Error("No se ha encontrado la tabla.");
  const table = validateStudyTable(card.table);
  const route: string[] = [],
    seen = new Set<string>();
  let current = folders.find((f) => f.id === card.folderId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    route.unshift(current.name);
    current = folders.find((f) => f.id === current!.parentId);
  }
  return {
    tarjetas: [
      {
        tipo: "tabla_muda",
        tema: route[0] ?? "Sin tema",
        subtema: route.slice(1).join(" / "),
        ruta: route,
        pregunta: card.front,
        tabla: exportStudyTable(table),
      },
    ],
  };
}
