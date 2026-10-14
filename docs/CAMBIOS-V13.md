# OpoGC v13 — Repasos y organización

Base: OpoGC-v12-Memoria-y-Estudio(1).zip. Proyecto real con las mismas entidades y backend. No se ha accedido a la cuenta de Marc ni se ha publicado en Cloudflare.

## Guardar y estudiar

Repasar → Mis repasos permite colecciones permanentes: Repasar próximamente, Mal, Regular, Bien y las que crees. Desde una tarjeta, Guardar para repasar funciona antes o después de mostrar la respuesta, sin valorar ni avanzar. También se pueden guardar selecciones desde Biblioteca.

Ejemplo: estudias Título I, guardas artículo 27 en Regular y después calificas la respuesta. Otro día entras en Regular, eliges Constitución → Título I y empiezas. Puedes seleccionar toda Constitución, varias ramas o Todos los temas. La práctica manual puede incluir tarjetas que no estén vencidas.

Guardar es una clasificación manual independiente de Otra vez/Difícil/Bien/Fácil. Una tarjeta permanece hasta retirarla explícitamente, borrar la colección o eliminar la propia tarjeta. Responder bien no la retira. Puede pertenecer a varias colecciones. Para pasar de Regular a Bien, desmarca Regular y marca Bien. Ortografía conserva sus sesiones de palabras y corrección; una selección mixta ofrece un acceso independiente a ortografía. No se cambian los tipos actuales de tarjetas ni gramática.

## Modelo compatible

Sin migraciones. Cada definición usa un ajuste genérico `reviewCollection:<id>` con nombre e indicador de borrado. Cada pertenencia usa `reviewMembership:<collectionId>:<cardId>` con booleano. Los IDs se escapan en la clave de pertenencia para evitar colisiones. Las definiciones borradas conservan su indicador para no restaurar predeterminadas al abrir. Las pertenencias se almacenan por separado, evitando sobrescribir una lista entera al guardar distintas tarjetas desde dispositivos diferentes. Los conflictos en la misma pertenencia conservan la política existente.

Export/import conserva estos datos porque ya incluye settings. No hay duplicación de tarjetas ni nuevos IDs de tarjetas. Guardar no toca los campos FSRS ni los ratings. `Folder.isUnfiled` es opcional en JSONB: se usa únicamente para crear/reutilizar la carpeta Sin carpeta si mueves tarjetas a raíz, respetando la clave foránea cards → folders. No se añaden seeds ni se reconfigura Supabase.

## Filtros y movimiento

HierarchyPicker/HierarchyField comparten búsqueda sin tildes, ruta, atrás, selección y entrada por niveles. Seleccionar un padre incluye sus descendientes. La flecha entra; la selección elige. Los resúmenes muestran hasta dos nombres y el número restante para evitar listas gigantes. ContentScope permite Biblioteca o temario enlazado: elegir uno limpia el otro. Un apartado sin vínculo no inventa asociaciones por nombres; puede enlazarse mediante Biblioteca → Importar al temario.

En Biblioteca la selección persiste al navegar, admite tarjetas/carpetas y permite seleccionar nivel/resultados o todo. Mover a muestra un destino navegable. Se validan todas las ramas antes del lote, se reduce a raíces superiores y se cambia parentId conservando descendientes. Las tarjetas dentro de ramas seleccionadas viajan con ellas; no se extraen por estar también marcadas. Las sueltas se reasignan al destino manteniendo el resto de datos. El orden se añade al final del nivel receptor. Todo se guarda por la actualización y transacción existentes.

Temario admite el mismo movimiento individual/en grupo. Se impiden ciclos y destinos inexistentes. Arriba/abajo/sacar nivel siguen disponibles; no se depende de arrastrar con el dedo. Biblioteca y Temario mantienen entidades distintas; su importación enlaza contenido y no duplica tarjetas. La importación JSON sigue existiendo.

## Capas y teclado

BottomSheet utiliza portal y comparte orden de apertura con OverlayPortal. Solo la capa superior atiende Escape y atrapa Tab, incluso si el foco quedó fuera. El foco inicial/restauración evita campos de texto. Tocar un campo permite escribir; no se usan autoFocus, readonly temporal ni blur repetido. Se mantienen bloqueo de scroll y safe areas.
