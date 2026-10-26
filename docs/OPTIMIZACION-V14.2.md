# Optimización — OpoGC v14.2

## Diagnóstico y alcance

En v14.1, cada pulsación cambiaba estado de OpoApp, ejecutaba el filtro de Biblioteca con plainRichText sobre todos los textos y renderizaba la pantalla situada detrás del repaso. El checkpoint de 150 ms también pasaba por la cuenta completa. El modelo personal dependía de todo state; project recorría todo el historial por cada tarjeta y differences expandía/serializaba colecciones sin cambios.

Se reprodujo con 2.200 tarjetas, 4.000 repasos y unos 13 MB de texto sintético. La comparación usa el mismo fixture, tres contextos nuevos por versión, Chromium/React de desarrollo y almacenamiento local real. El benchmark se centra en una sesión de respuesta escrita; las sesiones múltiples se comprueban por separado en la suite funcional. Los resultados no miden Supabase ni hardware real del usuario.

## Interacción

ReviewSession mantiene texto y opciones en estado local. OpoApp recibe los valores actuales en una referencia; las funciones de corrección/valoración leen esa referencia para no usar un cierre con respuestas antiguas. El contenido enriquecido se memoriza sin retirar su sanitización. Cada cambio de tarjeta o edición reinicia los campos mediante una clave de presentación. StudyBackground conserva la pantalla montada y su estado durante el repaso y la refresca al salir.

Las búsquedas vacías no convierten HTML a texto y fuera de Biblioteca no se ejecuta el filtro. Una caché de texto por tarjeta comprueba front, back y ruta: las ediciones, movimientos, cambios de tipo y borrados no quedan ocultos por el caché. El estado recibido se comparte estructuralmente por contenido, no solo por ID, para reutilizar referencias iguales. Al cambiar de cuenta se remonta la aplicación existente; el borrador siempre incluye la cuenta en su clave.

Memoria depende del historial; ordenar pendientes calcula cada probabilidad una vez y conserva el mismo orden. Los pendientes se refrescan periódicamente fuera de la sesión; el reloj de un segundo se mantiene para Ortografía, cuya cola temporal no cambia. FSRS, memoryModel y las dos colas de aprendizaje no se editan.

## Borrador y checkpoint

Se reutiliza el object store legacy de IndexedDB, sin cambiar el esquema. Cada edición escribe un registro pequeño review-draft:<cuenta>:<sesión> con ID, turno, revisión base y presentación (IDs/cola/opciones/texto, sin copiar todas las tarjetas). No se usa localStorage ni readonly/blur para el teclado.

El checkpoint de cuenta se agrupa a 1,5 segundos de inactividad; la escritura continua puede mantenerlo pendiente, conservando mientras tanto el borrador local. Salir, visibilitychange/pagehide fuerzan el checkpoint. Como cualquier escritura asíncrona del navegador, un cierre forzado del proceso no garantiza guardar una pulsación cuya transacción aún no terminó. La prueba de recarga verifica un borrador cuya transacción local sí ha finalizado.

Al retomar se recupera el borrador solo si coincide ID, turno y revisión. No reabre una sesión cerrada ni aplica un borrador viejo sobre un turno o checkpoint remoto distinto. Las escrituras completas se serializan; si se escribe texto nuevo mientras una está pendiente, se vuelve a guardar su borrador con la revisión recién confirmada. La valoración sigue siendo una transacción local confirmada antes de avanzar, con reversión del estado si falla. Los checkpoints y ratings siguen usando el motor existente, su cola offline y su transporte automático.

## Optimización de datos compatible

Solo cambia el cálculo puro de lib/data/projection.ts: project indexa los contadores en una pasada del historial, con la misma exclusión de refuerzos y máximos absolutos. differences omite colecciones que comparten exactamente referencia entre before/after y evita serializar valores idénticos. Si una colección tiene referencia distinta, conserva la comparación completa, incluido orden, eliminaciones y completado de tareas.

No se cambia SyncEngine, local.ts, modelos, SQL/RLS, Realtime, Auth, Storage ni backups. La optimización de la proyección fue necesaria para reducir el trabajo local de cada guardado; no introduce otro backend ni cambia la política de conflictos. Las pruebas comparan la salida y los patches con tests/fixtures/projection-v14.1.ts, copia del algoritmo anterior. La comprobación histórica permite explícitamente este archivo, mantiene el manifiesto original y añade esa prueba de equivalencia. Las funciones de corrección conservan su fingerprint original al descontar únicamente la nueva lectura inicial del input ref.

## Archivos

Modificados: app/OpoApp.tsx; components/review/ReviewSession.tsx y useSessionCheckpoint.ts; lib/data/projection.ts; components/navigation/MorePage.tsx (versión); scripts/check-preserved.mjs; tests/ui/main.tsx; package.json/package-lock.json y documentación.

Nuevos: components/review/StudyBackground.tsx; lib/memory/draft.ts y performance.ts; scripts/benchmark-review.mjs; tests/performance.test.ts; tests/ui/performance.spec.ts; tests/fixtures/projection-v14.1.ts y documentos v14.2.

Eliminados: ninguno. Sin migración SQL, cambio de versión de IndexedDB, seed, IDs nuevos para datos existentes ni dependencias nuevas. public/sw.js y version.json se regeneran mediante el build habitual y no se distribuyen como cambios manuales.
