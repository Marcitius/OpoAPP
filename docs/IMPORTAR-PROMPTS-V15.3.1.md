# OpoGC v15.3.1 — Prompts al importar JSON

Se recupera el acceso a los prompts dentro de la aplicación. No necesitas buscar este chat para generar tarjetas.

## Uso

1. Abre **Biblioteca → Opciones de la biblioteca → Importar tarjetas JSON**.
2. Elige **Flashcard normal**, **Test**, **Tabla muda**, **Vocabulario**, **Ortografía** o **Respuesta escrita**.
3. Pulsa **Copiar prompt**. Pégalo en ChatGPT, sustituye `[TEMA]` y `[SUBTEMA]` y añade tu material al final. Si no quieres subtema, indica una cadena vacía `""`.
4. **Ver prompt** permite consultarlo. Si el navegador deniega el portapapeles o no dispone de esa función, el texto se muestra para copiarlo manualmente, sin enfocar el campo ni abrir el teclado.
5. **Ver formato JSON** muestra el esquema correspondiente al tipo elegido.
6. Pega o carga el JSON generado, valídalo e impórtalo con el flujo habitual.

La selección solo cambia el prompt y el ejemplo. No filtra el importador, no altera los datos, no borra el texto pegado y no invalida un JSON ya comprobado. Un archivo puede mezclar los seis tipos.

## Contenido

Los prompts solicitan exclusivamente JSON válido, conservan condiciones y excepciones y evitan inventar fuentes o metadatos de historial. Cada tipo lleva sus campos propios:

- Normal: pregunta y respuesta en texto plano, compatibles con el camino actual de importación. El editor con formato de las tarjetas sigue disponible después.
- Test y vocabulario: cuatro opciones y letras correctas. Test permite varias correctas cuando se solicita expresamente.
- Ortografía: palabra, booleano esCorrecta y formaCorrecta.
- Respuesta escrita: respuesta modelo, conceptos breves, alternativas explícitas, normalización y rúbrica existentes. La corrección comprueba expresiones configuradas; no utiliza comprensión semántica por IA.
- Tabla muda: tabla estructurada, celdas evaluables, alternativas y porcentaje. Prioriza datos concretos y respuestas breves para evitar exigir frases largas. Conserva la importación opcional de rutas profundas de v15.3.

No se contrata ni conecta una API de IA. Copiar el prompt no envía a ChatGPT los datos de tu cuenta; el usuario pega el prompt y el material que quiera utilizar.

## Integración y alcance

- `lib/import/cardPrompts.ts`: catálogo y ejemplos para los seis tipos.
- `components/library/ImportPromptPicker.tsx`: selector, copia, mensajes y consulta manual.
- `app/CardImportModal.tsx`: incorpora el componente en la pantalla actual. La función `parseCardImport`, la validación del JSON y la confirmación de importación se conservan.
- `app/card-editor.css`: estilos acotados a `.card-import-prompts`.
- `tests/import-prompts.test.ts` y `tests/ui/import-prompts.spec.ts`: compatibilidad de los seis esquemas y recorridos de copia/importación.
- `package.json` y `package-lock.json`: versión 15.3.1 y ejecución de las nuevas pruebas, sin cambiar dependencias.

No se modifican el backend, Auth, RLS, Realtime, cola offline, Storage, algoritmos, calificaciones, medias ni sesiones. No hay migraciones ni archivos eliminados. Las tablas mudas de v15.3 permanecen integradas.

## Actualización y pruebas

Aplica **actualizar/** sobre **v15.3**, conservando rutas y sustituyendo archivos. Cloudflare Pages: **npm run build**, salida **out**. Conserva las variables actuales y actualiza la PWA de los dispositivos.

Resultados reales, comandos, integridad y límites: **docs/RESULTADOS-V15.3.1.json**. Las pruebas de interfaz se ejecutan en Chromium local; no equivalen a probar Safari instalado en un iPhone físico o tu cuenta real de Supabase.
