export const cardPromptTypes = [
  { type: "flashcard", label: "Flashcard normal" },
  { type: "test", label: "Test" },
  { type: "tabla_muda", label: "Tabla muda" },
  { type: "vocabulario", label: "Vocabulario" },
  { type: "ortografia", label: "Ortografía" },
  { type: "respuesta_escrita", label: "Respuesta escrita" },
] as const;

export type CardPromptType = (typeof cardPromptTypes)[number]["type"];

const location = { tema: "[TEMA]", subtema: "[SUBTEMA]" };
const formats: Record<
  CardPromptType,
  { rules: string[]; example: Record<string, unknown> }
> = {
  flashcard: {
    rules: [
      "Crea preguntas concretas, comprensibles por sí solas y sin duplicados equivalentes.",
      "Conserva sujetos, competencias, plazos, condiciones, excepciones y negaciones.",
      "Organiza las respuestas con varias ideas mediante saltos de línea codificados como \\n.",
      "Usa texto plano en pregunta, respuesta y explicación, sin HTML ni marcadores Markdown.",
    ],
    example: {
      tipo: "flashcard",
      ...location,
      pregunta: "Pregunta concreta",
      respuesta: "Respuesta completa",
      explicacion: "",
      fuente: "",
    },
  },
  test: {
    rules: [
      "Cada pregunta debe tener exactamente cuatro opciones, como un array de cuatro textos sin prefijos A), B), C) o D).",
      "Por defecto, incluye una sola respuesta correcta. Identifícala mediante su letra A, B, C o D dentro de correctas.",
      "Si te pido varias respuestas correctas, indícalo en la pregunta e incluye todas sus letras en correctas.",
      "Crea distractores próximos y plausibles, pero inequívocamente incorrectos para lo preguntado. Evita dos opciones equivalentes o parcialmente correctas.",
      "Puedes alterar sujetos, cifras o condiciones solo para construir distractores; la solución y explicación deben respetar el material.",
      "Reparte las posiciones de las respuestas correctas y explica la solución y la confusión principal.",
      "Usa texto plano, sin HTML ni Markdown.",
    ],
    example: {
      tipo: "test",
      ...location,
      pregunta: "Pregunta",
      opciones: ["Opción A", "Opción B", "Opción C", "Opción D"],
      correctas: ["B"],
      explicacion: "Justificación basada en el material",
      fuente: "",
    },
  },
  vocabulario: {
    rules: [
      "Evalúa el significado, traducción o uso en contexto de palabras y expresiones presentes en el material.",
      "No inventes significados o traducciones que el material no permita establecer.",
      "Incluye exactamente cuatro opciones de texto y una única correcta, identificada por su letra dentro de correctas.",
      "Los distractores no deben ser válidos en el contexto de la pregunta. Reparte la posición de la respuesta correcta.",
      "Añade una explicación breve y usa texto plano, sin HTML ni Markdown.",
    ],
    example: {
      tipo: "vocabulario",
      ...location,
      pregunta: "Palabra o expresión en contexto",
      opciones: [
        "Significado correcto",
        "Distractor 1",
        "Distractor 2",
        "Distractor 3",
      ],
      correctas: ["A"],
      explicacion: "Justificación",
      fuente: "",
    },
  },
  ortografia: {
    rules: [
      "Presenta palabras o expresiones para decidir si están correctamente escritas, mezclando formas correctas e incorrectas.",
      "Puedes introducir errores ortográficos deliberados; no trates cambios de significado como errores ortográficos.",
      "esCorrecta debe ser un booleano real: true o false, nunca una cadena de texto.",
      "Si esCorrecta es false, formaCorrecta contiene la corrección; si es true, repite la forma correcta presentada.",
      "Explica brevemente la regla o corrección sin inventar reglas. No uses opciones A–D. Utiliza texto plano.",
    ],
    example: {
      tipo: "ortografia",
      ...location,
      palabra: "Forma que se evaluará",
      esCorrecta: false,
      formaCorrecta: "Forma correcta",
      explicacion: "Regla o explicación",
      fuente: "",
    },
  },
  respuesta_escrita: {
    rules: [
      "Formula preguntas delimitadas y añade una respuesta modelo completa, conservando sujetos, funciones, plazos, condiciones y excepciones. Usa texto plano.",
      "Divide cada respuesta en conceptos evaluables independientes. esperado debe ser una expresión breve, no toda la respuesta ni palabras sueltas que puedan aparecer sin expresar el concepto.",
      "Conserva la relación entre sujeto y función cuando sea esencial. La corrección utiliza expresiones configuradas, no comprensión semántica por IA.",
      "alternativas contiene solo otras formas válidas de cumplir ese mismo criterio. Añade variantes explícitas de singular/plural o redacción cuando sean equivalentes; no son conceptos adicionales obligatorios.",
      "Cada criterio tiene un id único dentro de la tarjeta y puntos positivos según su importancia.",
      "Usa literal false y minimoSimilitud 1 para exigir las palabras del concepto permitiendo otro orden. Usa literal true si se necesita una expresión concreta.",
      "Mantén critico false y maximoSiFalla null salvo que te pida límites específicos. Conserva la normalización y los umbrales del ejemplo.",
    ],
    example: {
      tipo: "respuesta_escrita",
      ...location,
      pregunta: "Pregunta",
      respuesta: "Respuesta modelo completa",
      explicacion: "",
      fuente: "",
      evaluacion: {
        criterios: [
          {
            id: "c1",
            esperado: "Concepto clave",
            alternativas: ["Variante equivalente"],
            puntos: 1,
            literal: false,
            critico: false,
            maximoSiFalla: null,
            minimoSimilitud: 1,
          },
        ],
        normalizacion: {
          ignorarMayusculas: true,
          ignorarAcentos: true,
          ignorarPuntuacion: true,
          ignorarEspaciosExtra: true,
        },
        umbrales: { otraVezHasta: 40, dificilHasta: 65, bienHasta: 85 },
      },
    },
  },
  tabla_muda: {
    rules: [
      "Cada tabla completa constituye una única tarjeta. Agrupa datos relacionados para memorizar y comparar; divide tablas demasiado grandes en varias tarjetas coherentes.",
      "Escribe un enunciado claro en pregunta. columnas contiene encabezados y filas solo los datos; todas las filas tienen el mismo número de celdas que columnas.",
      "Deja visibles las etiquetas o conceptos. Las respuestas evaluables son objetos con contenido, evaluable true y alternativas.",
      "Prioriza respuestas breves: números, fechas, duraciones, nombres o conceptos concretos. No obligues a reproducir frases largas; pon el contexto y las condiciones en las celdas visibles sin perder significado.",
      "contenido admite Markdown sencillo y su texto es la respuesta principal. Puedes añadir respuesta en la celda si necesitas una respuesta principal distinta del contenido mostrado.",
      "alternativas incluye solo respuestas expresamente equivalentes. No elimines condiciones ni alteres competencias o significados jurídicos. Si no hay alternativas seguras, usa [].",
      "La aplicación ya ignora mayúsculas, acentos y espacios adicionales; no necesitas enumerar esas variantes.",
      "Usa porcentajeOculto 100 salvo que indique 25, 50 o 75. No escribas marcadores {{respuesta}} ni crees una tarjeta por celda.",
      "Si proporciono una ruta profunda, añade ruta como un array de nombres, desde el tema hasta el destino. No incluyas nombres vacíos en ruta.",
    ],
    example: {
      tipo: "tabla_muda",
      ...location,
      pregunta: "Completa la tabla",
      tabla: {
        columnas: ["Concepto", "Respuesta"],
        filas: [
          [
            "Concepto del material",
            {
              contenido: "Respuesta principal",
              evaluable: true,
              alternativas: [],
            },
          ],
        ],
        porcentajeOculto: 100,
      },
    },
  },
};

export function cardImportExample(type: CardPromptType) {
  return JSON.stringify({ tarjetas: [formats[type].example] }, null, 2);
}

export function cardImportPrompt(type: CardPromptType) {
  const label = cardPromptTypes.find((item) => item.type === type)!.label;
  return `Convierte el material del final en tarjetas compatibles con OpoGC.
Tipo solicitado: ${label} (${type}).

DEVUELVE EXCLUSIVAMENTE JSON VÁLIDO.
No añadas explicaciones fuera del JSON, comentarios ni bloques de código.
Utiliza exclusivamente comillas dobles ASCII rectas (").
El objeto raíz debe tener siempre la forma { "tarjetas": [...] }.

REGLAS GENERALES:
- Basa las soluciones exclusivamente en el material proporcionado; no inventes información.
- Prioriza recuperación activa y preguntas concretas, sin duplicados equivalentes.
- Conserva las condiciones, excepciones y negaciones del material.
- Sustituye los ejemplos del esquema por el contenido real; no los copies como tarjetas.
- Usa el tema y subtema indicados. Si no quiero subtema, utiliza una cadena vacía ("").
- Deja fuente vacía si el material no identifica una referencia; no inventes fuentes.
- No generes IDs de tarjeta, notas, historial, fechas de repaso ni datos de planificación.
- Escapa correctamente comillas y saltos de línea dentro de las cadenas JSON.

REGLAS DEL TIPO:
${formats[type].rules.map((rule) => `- ${rule}`).join("\n")}

Tema: [TEMA]
Subtema: [SUBTEMA]

ESTRUCTURA JSON:
${cardImportExample(type)}

MATERIAL:
[PEGA AQUÍ EL MATERIAL]`;
}
