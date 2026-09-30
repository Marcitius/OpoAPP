export type CardPromptKind =
  | "flashcard"
  | "test"
  | "vocabulario"
  | "ortografia"
  | "respuesta_escrita"
  | "mixto";

export const cardPromptLabels: Record<CardPromptKind, string> = {
  flashcard: "Flashcards",
  test: "Test",
  vocabulario: "Vocabulario",
  ortografia: "Ortografía",
  respuesta_escrita: "Respuesta escrita",
  mixto: "Mixto",
};

export function buildStudyTreePrompt() {
  return `Quiero que conviertas el temario que te adjunte o pegue en un árbol de estudio compatible con la función «Estudio → Importar temario» de OpoGC.

REGLAS OBLIGATORIAS:

1. Devuelve EXCLUSIVAMENTE JSON válido.
2. No añadas explicaciones antes ni después.
3. No uses bloques Markdown.
4. No escribas \`\`\`json.
5. Respeta la estructura real del temario.
6. No inventes contenido.
7. No elimines artículos, apartados o subapartados existentes.
8. No agrupes artículos distintos arbitrariamente.
9. Conserva todos los niveles necesarios.

Utiliza esta estructura EXACTA:

{
  "nombre": "Nombre del tema principal",
  "hijos": [
    {
      "nombre": "Apartado",
      "hijos": [
        {
          "nombre": "Subapartado",
          "hijos": []
        }
      ]
    }
  ]
}

El árbol puede tener tantos niveles como sean necesarios.

Para legislación, respeta cuando existan:

Tema
→ Título
→ Capítulo
→ Sección
→ Artículo
→ Apartado
→ Subapartado

EJEMPLO:

{
  "nombre": "Constitución Española",
  "hijos": [
    {
      "nombre": "Título IV. Del Gobierno y de la Administración",
      "hijos": [
        {
          "nombre": "Artículo 97",
          "hijos": []
        },
        {
          "nombre": "Artículo 98",
          "hijos": []
        }
      ]
    }
  ]
}

IMPORTANTE:

- Si te adjunto un PDF, imagen o texto, utiliza únicamente el contenido proporcionado.
- Conserva la numeración y denominación de títulos, capítulos, secciones y artículos.
- Si un artículo tiene apartados relevantes, puedes incluirlos como hijos.
- No resumas el contenido salvo que sea necesario para nombrar un nodo.
- No añadas IDs.
- Devuelve únicamente el JSON.`;
}

export function buildCardPrompt(kind: CardPromptKind) {
  const common = `Quiero que conviertas el material que te adjunte o pegue en tarjetas de estudio compatibles con OpoGC.

DEVUELVE EXCLUSIVAMENTE JSON VÁLIDO.

No añadas:
- explicaciones fuera del JSON;
- Markdown;
- bloques \`\`\`json;
- comentarios.

El objeto raíz debe tener SIEMPRE esta forma:

{
  "tarjetas": [
    ...
  ]
}

REGLAS GENERALES:

- No inventes información.
- Basa las tarjetas exclusivamente en el material proporcionado.
- Divide el conocimiento en preguntas concretas.
- Evita preguntas demasiado amplias.
- En legislación presta especial atención a literalidad, sujetos, órganos, plazos, mayorías, requisitos, excepciones, competencias y enumeraciones.
- Es preferible crear varias tarjetas concretas de un artículo que una sola pregunta del tipo «¿Qué dice el artículo X?».
- "tema" identifica el tema principal.
- "subtema" identifica el artículo, apartado o bloque concreto.
- "fuente" puede indicar artículo o referencia.
`;

  const prompts: Record<CardPromptKind, string> = {
    flashcard: `
GENERA ÚNICAMENTE TARJETAS DE TIPO "flashcard".

Formato de cada tarjeta:

{
  "tipo": "flashcard",
  "tema": "Constitución Española",
  "subtema": "Artículo 27",
  "pregunta": "Pregunta concreta",
  "respuesta": "Respuesta concreta",
  "explicacion": "",
  "fuente": "Artículo 27 CE"
}

Para legislación:
- crea varias preguntas cuando el precepto contenga varias ideas;
- prioriza la formulación literal cuando sea relevante;
- separa enumeraciones, requisitos y excepciones;
- no simplifiques hasta perder palabras importantes.
`,

    test: `
GENERA ÚNICAMENTE TARJETAS DE TIPO "test".

Formato:

{
  "tipo": "test",
  "tema": "Constitución Española",
  "subtema": "Artículo 27",
  "pregunta": "Pregunta",
  "respuesta": "",
  "explicacion": "Explicación breve de la respuesta",
  "fuente": "Artículo 27 CE",
  "opciones": [
    "Opción A",
    "Opción B",
    "Opción C",
    "Opción D"
  ],
  "correctas": ["A"]
}

REGLAS:

- Debe haber EXACTAMENTE cuatro opciones.
- "correctas" debe contener letras: A, B, C o D.
- Puede haber más de una correcta cuando sea necesario.
- Los distractores deben ser plausibles.
- No utilices respuestas absurdamente evidentes.
`,

    vocabulario: `
GENERA ÚNICAMENTE TARJETAS DE TIPO "vocabulario".

Formato:

{
  "tipo": "vocabulario",
  "tema": "Vocabulario psicotécnico",
  "subtema": "Test 1",
  "pregunta": "¿Cuál es el sinónimo de EFÍMERO?",
  "respuesta": "",
  "explicacion": "Breve o de corta duración.",
  "fuente": "",
  "opciones": [
    "Duradero",
    "Breve",
    "Complejo",
    "Inmóvil"
  ],
  "correctas": ["B"]
}

REGLAS:

- EXACTAMENTE cuatro opciones.
- Utiliza "correctas" con letras A-D.
- Puedes preguntar significado, sinónimo o antónimo.
- Los distractores deben ser plausibles.
`,

    ortografia: `
GENERA ÚNICAMENTE TARJETAS DE TIPO "ortografia".

Formato de palabra correcta:

{
  "tipo": "ortografia",
  "tema": "Ortografía",
  "subtema": "Ejercicio 1",
  "palabra": "espabilar",
  "esCorrecta": true,
  "formaCorrecta": "",
  "explicacion": "Explicación breve",
  "fuente": ""
}

Formato de palabra incorrecta:

{
  "tipo": "ortografia",
  "tema": "Ortografía",
  "subtema": "Ejercicio 1",
  "palabra": "espavilar",
  "esCorrecta": false,
  "formaCorrecta": "espabilar",
  "explicacion": "Explicación breve",
  "fuente": ""
}

REGLAS:

- "esCorrecta" debe ser true o false real, no texto.
- Si es falsa, "formaCorrecta" es obligatoria.
`,

    respuesta_escrita: `
GENERA ÚNICAMENTE TARJETAS DE TIPO "respuesta_escrita".

Estas tarjetas obligan al usuario a escribir la respuesta y OpoGC la corrige mediante criterios.

Formato:

{
  "tipo": "respuesta_escrita",
  "tema": "Constitución Española",
  "subtema": "Artículo 27",
  "pregunta": "Escribe los elementos solicitados.",
  "respuesta": "Respuesta completa de referencia",
  "explicacion": "",
  "fuente": "Artículo 27 CE",
  "evaluacion": {
    "criterios": [
      {
        "id": "c1",
        "esperado": "Fragmento o concepto que debe aparecer",
        "alternativas": [],
        "puntos": 25,
        "literal": true,
        "critico": false,
        "maximoSiFalla": null,
        "minimoSimilitud": 0.8
      }
    ],
    "normalizacion": {
      "ignorarMayusculas": true,
      "ignorarAcentos": false,
      "ignorarPuntuacion": true,
      "ignorarEspaciosExtra": true
    },
    "umbrales": {
      "otraVezHasta": 40,
      "dificilHasta": 65,
      "bienHasta": 85
    }
  }
}

REGLAS IMPORTANTES:

- Divide la respuesta en varios criterios evaluables.
- Los IDs de los criterios deben ser únicos: c1, c2, c3...
- "puntos" debe ser un número positivo.
- Procura que la suma total sea 100.
- Usa "literal": true cuando deba recordarse literalmente.
- Usa "critico": true solamente cuando omitir ese punto sea especialmente importante.
- "alternativas" puede contener formulaciones equivalentes aceptables.
- Para artículos legales largos crea varias preguntas escritas en lugar de una gigantesca.
`,

    mixto: `
PUEDES GENERAR UNA COMBINACIÓN de:

- flashcard
- test
- vocabulario
- ortografia
- respuesta_escrita

Cada tarjeta debe respetar EXACTAMENTE el formato correspondiente.

Para test y vocabulario:
- cuatro opciones;
- "correctas" con letras A-D.

Para ortografía:
- palabra;
- esCorrecta;
- formaCorrecta cuando sea falsa.

Para respuesta escrita:
- añade "evaluacion" con criterios.

Selecciona el tipo que resulte más útil para memorizar cada contenido.
`,
  };

  return `${common}

${prompts[kind]}

OBJETIVO DIDÁCTICO:

Quiero material útil para preparar una oposición. Prioriza la recuperación activa y la memorización precisa.

Devuelve únicamente:

{
  "tarjetas": [...]
}`;
}
