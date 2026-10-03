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
10. Utiliza exclusivamente comillas dobles ASCII rectas ("). Nunca uses comillas tipográficas (“ ”).

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
- No inventes niveles que no existan en el documento.
- No conviertas cada línea del documento en un nodo.
- Devuelve únicamente el JSON válido.`;
}

export function buildCardPrompt(kind: CardPromptKind) {
  const common = `Quiero que conviertas el material que te adjunte o pegue en tarjetas de estudio compatibles con OpoGC.

DEVUELVE EXCLUSIVAMENTE JSON VÁLIDO.

No añadas:
- explicaciones fuera del JSON;
- Markdown;
- bloques \`\`\`json;
- comentarios.

Utiliza exclusivamente comillas dobles ASCII rectas (").
Nunca utilices comillas tipográficas (“ ”).

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
- Evita preguntas excesivamente amplias.
- Prioriza recuperación activa y memorización.
- En legislación presta especial atención a literalidad, sujetos, órganos, plazos, mayorías, requisitos, excepciones, competencias y enumeraciones.
- Es preferible crear varias tarjetas concretas de un artículo que una sola pregunta del tipo "¿Qué dice el artículo X?".
- No elimines matices jurídicamente relevantes.
- "tema" identifica el tema principal.
- "subtema" identifica el artículo, apartado o bloque concreto.
- "fuente" puede indicar artículo o referencia.
`;

  const prompts: Record<CardPromptKind, string> = {
    flashcard: `
GENERA ÚNICAMENTE TARJETAS DE TIPO "flashcard".

Formato EXACTO:

{
  "tipo": "flashcard",
  "tema": "Constitución Española",
  "subtema": "Artículo 27",
  "pregunta": "Pregunta concreta",
  "respuesta": "Respuesta concreta",
  "explicacion": "",
  "fuente": "Artículo 27 CE"
}

REGLAS:

- Crea varias preguntas cuando el precepto contenga varias ideas.
- Prioriza la formulación literal cuando sea relevante.
- Separa enumeraciones, sujetos, requisitos y excepciones.
- Evita tarjetas gigantes.
- No simplifiques hasta perder palabras importantes.
`,

    test: `
GENERA ÚNICAMENTE TARJETAS DE TIPO "test".

Formato EXACTO:

{
  "tipo": "test",
  "tema": "Constitución Española",
  "subtema": "Artículo 27",
  "pregunta": "Pregunta",
  "respuesta": "",
  "explicacion": "Explicación breve",
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
- "correctas" debe contener letras A, B, C o D.
- Puede haber más de una correcta únicamente cuando proceda.
- Los distractores deben ser plausibles.
- Evita opciones absurdas.
- En legislación utiliza distractores basados en confusiones realistas.
`,

    vocabulario: `
GENERA ÚNICAMENTE TARJETAS DE TIPO "vocabulario".

Formato EXACTO:

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

Ejemplo de palabra correcta:

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

Ejemplo de palabra incorrecta:

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
- No inventes reglas ortográficas.
`,

    respuesta_escrita: `
GENERA ÚNICAMENTE TARJETAS DE TIPO "respuesta_escrita".

Estas tarjetas obligan al usuario a escribir la respuesta.

Formato EXACTO:

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

REGLAS:

- Divide la respuesta en varios criterios evaluables.
- Los IDs deben ser únicos: c1, c2, c3...
- "puntos" debe ser positivo.
- Procura que la suma de puntos sea 100.
- Usa "literal": true cuando deba memorizarse la formulación.
- Usa "critico": true únicamente en elementos cuya omisión sea especialmente relevante.
- "alternativas" puede contener formulaciones equivalentes válidas.
- Para artículos largos crea varias preguntas en lugar de una gigantesca.
`,

    mixto: `
GENERA UNA COMBINACIÓN de los tipos que resulten más útiles:

- flashcard
- test
- vocabulario
- ortografia
- respuesta_escrita

IMPORTANTE:

"mixto" NO es un tipo de tarjeta.

Cada elemento debe tener como "tipo" uno de los cinco tipos anteriores y respetar exactamente su esquema.

Selecciona el tipo más útil para cada contenido.

Para legislación combina especialmente:

- flashcards para conceptos concretos;
- respuesta escrita para enumeraciones y literalidad;
- test para discriminación entre conceptos parecidos.
`,
  };

  return `${common}

${prompts[kind]}

OBJETIVO DIDÁCTICO:

El material se utilizará para preparar una oposición.

Prioriza:
- recuperación activa;
- memorización precisa;
- división adecuada del conocimiento;
- literalidad cuando sea importante;
- discriminación entre conceptos similares.

Devuelve únicamente:

{
  "tarjetas": [...]
}`;
}