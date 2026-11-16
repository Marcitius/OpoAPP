# OpoGC v15.3 — Tablas mudas

Actualización sobre **v15.2 — Editor de tarjetas**. «Tabla muda» es un tipo de tarjeta propio dentro de Biblioteca. Puede convivir con las flashcards normales en cualquier tema, subtema, selección y sesión. Los tipos de vocabulario, test, respuesta escrita y ortografía existentes también se conservan.

## Crear y editar

1. En **Biblioteca → Tarjeta**, selecciona **Tabla muda**.
2. Escribe el enunciado con el editor con formato habitual.
3. Usa **+ Fila / + Columna**, o **Pegar tabla** para pegar una tabla de ChatGPT/Markdown, Word o una hoja de cálculo.
4. Toca cada celda para editar su contenido con formato. Marca **Evaluable** en las respuestas que quieras ocultar; **✓ Evaluar** permite marcar o desmarcar toda una columna, salvo la cabecera.
5. La respuesta principal se toma del texto de la celda. Puedes especificar otra respuesta principal y añadir alternativas admitidas, una por línea: por ejemplo, `4 años`, con alternativas `4` y `Cuatro años`.
6. Elige el porcentaje predeterminado y utiliza **Vista previa**. Esta permite practicar sin escribir notas ni historial.
7. Guarda la tarjeta. **Exportar esta tabla** descarga su plantilla JSON importable, con la ruta completa al tema/subtema.

El editor visual no requiere llaves ni Markdown manual. No interpreta `{{…}}` en tarjetas normales. Al editar una tarjeta existente se mantiene su tipo: no se convierte automáticamente una respuesta antigua en una tabla interactiva.

Se necesita al menos una celda evaluable con respuesta. Se admiten tablas rectangulares; las celdas combinadas de Word/Excel deben separarse antes de pegarlas. Al pegar varias tablas se utiliza la primera.

## Estudiar

En el filtro de tipos puedes elegir **Todos**, **Flashcards normales** o **Tablas mudas**, además de los otros tipos existentes. Una selección mixta abre cada tarjeta con su interfaz correspondiente. Los modos Aprender, Aleatorio, En orden, Más falladas, Peor nota primero y Repasos pendientes conservan sus reglas.

Elige **25 %, 50 %, 75 % o 100 %** de ocultación en las opciones previas de una selección con tablas, o pulsa **Ocultación** durante el ejercicio. El valor previo de sesión sustituye al predeterminado de la tarjeta para esa sesión. Un cambio dentro del ejercicio se conserva para esa tarjeta al continuar o reforzarla.

El porcentaje se aplica solo a las celdas marcadas como evaluables. El número se redondea al entero más próximo y se oculta al menos una celda. Con veinte respuestas y 50 %, se ocultan diez. Las demás son texto de apoyo. La combinación se elige una sola vez y no cambia al escribir, renderizar, salir o reanudar.

- **Comprobar respuestas** corrige los campos ocultos. Los vacíos cuentan como errores. Cada error muestra su solución; el texto que escribiste sigue visible.
- **Mostrar soluciones** permite consultar las respuestas. Los campos revelados sin respuesta nunca cuentan como aciertos.
- **Reintentar** vacía las respuestas manteniendo la combinación.
- **Nueva combinación** cambia los campos ocultos cuando hay otras combinaciones posibles. Si hay respuestas sin comprobar, pide confirmar su borrado.
- **Ver tabla completa** muestra el contenido original, con su formato.
- **Guardar [nota] y continuar** registra una sola evaluación global y pasa al siguiente elemento según las reglas existentes de sesión.

La tabla se desplaza horizontalmente dentro de su contenedor cuando es ancha. Abrir opciones o editar una celda no enfoca automáticamente campos de texto; el teclado se solicita al tocar el campo.

## Corrección y notas

La comparación ignora mayúsculas, acentos y espacios adicionales. Mantiene diferencias de contenido, signos, negaciones, singular/plural y la distinción entre `n` y `ñ`. Solo la respuesta principal y las alternativas configuradas son válidas; no se utiliza IA ni equivalencia semántica automática.

La nota es `10 × aciertos / campos ocultos`. Nueve aciertos de doce producen **7,5**, no una categoría aproximada. La tabla es **una tarjeta**, con una nota y una entrada de historial, independientemente del número de celdas. Un resultado totalmente incorrecto puede ser **0/10**; esto no cambia la escala ni los botones de las tarjetas normales.

La primera comprobación o revelado fija la nota del intento. Reintentar o generar combinaciones después sirve como refuerzo y no sustituye esa nota. La interfaz muestra la nota que se conservará. Comprobar, previsualizar o mostrar soluciones **no escribe una calificación**: se escribe al pulsar **Guardar y continuar**. Los fallos de guardado permiten reintentar sin duplicar el registro.

Se reutiliza la política v15.1 de medias: **primera nota de cada tarjeta en cada sesión nueva**, con decimales completos. Los refuerzos de la misma sesión no elevan la media. Salir, recargar o continuar en otro dispositivo conserva la identidad de la sesión. Una tabla de 7,5 y después 5 en otra sesión obtiene media **6,25**. Una nota desde 5 termina la tarjeta en esa sesión; las suspendidas conservan el refuerzo intercalado existente. FSRS recibe la valoración equivalente; su algoritmo no se modifica.

El historial conserva campos evaluados, respuestas dadas, soluciones, alternativas, porcentaje y primer resultado. El informe diario para ChatGPT incorpora esa evidencia y distingue la puntuación objetiva de tablas de las categorías manuales. Comparar porcentajes de ocultación diferentes requiere tener en cuenta las pistas visibles; el informe conserva ese contexto.

## Continuidad y datos

El borrador y el checkpoint existentes guardan la combinación, las respuestas escritas y la corrección. Salir y reanudar recupera el mismo ejercicio; también se conserva la presentación del turno al consultar una tarjeta ya respondida. El contenido original no se sobrescribe al corregir.

Si se modifica la estructura o las respuestas de una tabla durante un ejercicio, se invalida su intento anterior para no corregir con soluciones que ya han cambiado. El identificador de contenido es estable aunque PostgreSQL reordene las claves de JSONB.

No hay SQL, dependencias nuevas ni otro backend. `Card.type` incorpora `table` y `Card.table` almacena la estructura opcional; `back` mantiene una representación HTML estática completa para los lectores existentes. Las sesiones añaden metadatos opcionales del intento y del porcentaje; las evaluaciones usan el historial existente. Los campos se transportan mediante el almacenamiento JSONB, IndexedDB, cola offline, sincronización y copias ya existentes. Se conservan los IDs actuales.

No se cambian Auth, RLS, Realtime, transporte de sincronización, Storage, motor FSRS, editor de Material, Service Worker ni manifiesto. Actualiza todos los dispositivos antes de editar o estudiar este nuevo tipo: versiones anteriores no conocen su interfaz interactiva.

## JSON

El formato general sigue siendo `{ "tarjetas": [...] }`. Los JSON sin `tipo` siguen siendo flashcards normales. La nueva tarjeta utiliza `tipo: "tabla_muda"`, `pregunta` (o `enunciado`) y `tabla`. `ruta` es opcional y permite conservar varios niveles de tema/subtema sin duplicarlos.

Ejemplo completo importable: **docs/ejemplos/tabla-muda.json**. Este archivo es una plantilla manual; no se instala como contenido inicial ni se introduce en tu cuenta al actualizar.

```json
{
  "tarjetas": [{
    "tipo": "tabla_muda",
    "tema": "Mi temario",
    "subtema": "Órgano de ejemplo",
    "ruta": ["Mi temario", "Órgano de ejemplo"],
    "pregunta": "Completa la tabla del órgano de ejemplo.",
    "tabla": {
      "columnas": ["Concepto", "Respuesta"],
      "filas": [
        ["Mandato", {"contenido": "**4 años**", "evaluable": true, "alternativas": ["4", "Cuatro años"]}]
      ],
      "porcentajeOculto": 100
    }
  }]
}
```

`contenido` admite Markdown. `respuesta` es una cadena opcional para sustituir el texto de la celda como respuesta principal; `alternativas` es una lista de cadenas. El formato exportado por **Exportar esta tabla** utiliza `version: 1`, `columns`, `rows`, IDs estables por fila/celda, `html` saneado, `evaluable`, `respuesta` opcional y `alternativas`. Ese formato también es importable. Las copias portátiles completas mantienen además los IDs de tarjeta, historial y sesiones mediante su flujo habitual. Importar una plantilla crea contenido; no es la operación para restaurar una copia completa.

Los saltos de línea deben estar codificados como `\n` en cadenas JSON, como antes. No se ejecutan HTML ni scripts procedentes de Markdown o del JSON; se reutiliza la política de saneamiento existente.

## Archivos e integración

| Archivos | Función |
| --- | --- |
| `lib/tables/model.ts` | Modelo, validación, normalización, tabla visual, pegado, formato JSON y firma estable |
| `lib/tables/learning.ts`, `grading.ts`, `json.ts` | Intentos, máscaras, corrección, primer resultado, restauración y exportación |
| `components/tables/TableEditor.tsx` | Editor visual y configuración por celda |
| `TableContent.tsx`, `TableExercise.tsx`, `TableReview.tsx` | Tabla accesible, controles y adaptación al repaso existente |
| `components/review/ReviewSession.tsx`, `ReviewSessionView.tsx` | Despacho por tipo; vista convencional extraída y compartida |
| `components/library/LibraryEditors.tsx`, `LibraryBrowser.tsx`, `components/review/StudyModeSheet.tsx` | Crear/editar, filtros, selección mixta y porcentaje previo |
| `app/OpoApp.tsx`, `app/CardImportModal.tsx` | Guardado existente, checkpoint, historial e importación |
| `lib/study/legacy.ts`, `lib/memory/session.ts`, `grades.ts`, `lib/reports/daily.ts`, `lib/review/sessionActions.ts` | Metadatos opcionales, notas objetivas, medias, informe y edición sin perder progreso |
| `app/table-cards.css`, `app/layout.tsx` | Estilos acotados al nuevo tipo |
| `tests/table-card.test.ts`, `tests/ui/table-card.spec.ts`, `tests/ui/main.tsx` | Lógica/datos, recorridos reales de interfaz y fixture |
| `package.json`, `package-lock.json`, `scripts/check-preserved.mjs` | Versión, ejecución de nuevas pruebas y excepción explícita del importador |

No se eliminan archivos. El ZIP contiene la relación completa de archivos nuevos/modificados y sus hashes en **ARCHIVOS-DEL-PARCHE.json**.

## Actualizar y verificar

Aplica el contenido de **actualizar/** en la raíz del proyecto **v15.2**, conservando rutas y reemplazando archivos. Incluye juntos `package.json` y `package-lock.json`. No subas una carpeta adicional llamada `actualizar` ni elimines archivos del proyecto. Cloudflare Pages: **npm run build**, salida **out**. Mantén tus variables de Supabase. No ejecutes migraciones.

Resultados ejecutados y límites: **docs/RESULTADOS-V15.3.json**. Comprobación de archivos críticos: **docs/INTEGRIDAD-V15.3.json**. La validación automatizada usa Chromium local, IndexedDB y PostgreSQL local mediante PGlite; el traspaso entre dispositivos se simula. No se ha ejecutado contra tu Supabase real, dos dispositivos físicos, Safari instalado ni el teclado nativo de iOS/Android.
