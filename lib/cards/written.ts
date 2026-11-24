import type { WrittenEvaluation } from "../../app/CardImportModal";
import { plainRichText } from "../../app/RichTextEditor";
export function defaultWrittenRubric(): WrittenEvaluation {
  return {
    criterios: [
      {
        id: "respuesta",
        esperado: "",
        alternativas: [],
        puntos: 10,
        literal: false,
        critico: false,
        maximoSiFalla: null,
        minimoSimilitud: 0.8,
      },
    ],
    normalizacion: {
      ignorarMayusculas: true,
      ignorarAcentos: false,
      ignorarPuntuacion: true,
      ignorarEspaciosExtra: true,
    },
    umbrales: { otraVezHasta: 40, dificilHasta: 65, bienHasta: 85 },
  };
}
export function completeWrittenRubric(
  value: WrittenEvaluation | null,
  answer: string,
  creating: boolean,
): WrittenEvaluation | null {
  if (
    !value ||
    !creating ||
    value.criterios.length !== 1 ||
    value.criterios[0].esperado.trim()
  )
    return value;
  return {
    ...value,
    criterios: [{ ...value.criterios[0], esperado: plainRichText(answer) }],
  };
}
