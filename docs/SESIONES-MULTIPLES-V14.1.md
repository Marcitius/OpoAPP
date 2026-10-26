# Sesiones múltiples — OpoGC v14.1

## Comportamiento

Una sesión es una selección fija de tarjetas con su modo, orden, historial interno, refuerzos y presentación actual. Puedes tener una de Constitución y otra de Ley 40/2015, salir de cualquiera y retomarla otro día o en otro dispositivo con la misma cuenta. Empezar otra no finaliza ninguna anterior. No se añaden tarjetas nuevas a una selección guardada automáticamente.

Hoy, Biblioteca, Repasar y Temario muestran la más reciente; «Ver las N sesiones» abre una lista con nombre del contenido, modo, progreso y fecha de creación. Cada fila permite continuar o finalizar. Finalizar pide confirmación sobre el ID de esa fila, aunque no sea la sesión más reciente. No se abre un campo editable al mostrar la lista.

Las sesiones no caducan y las vueltas completadas permanecen hasta cerrarlas expresamente. La lista no tiene un límite artificial de una sesión. Para evitar repetir selecciones por error, se ven la fecha de creación y su progreso. Se mantiene la navegación y la selección de modos existentes.

## Datos compatibles

Antes, settings.activeCardSession contenía un único checkpoint. Ahora cada sesión tiene su propio registro settings con clave cardSession:<id>. El campo antiguo se conserva como pista compatible; la lista usa los registros individuales como autoridad. Si solo existe el campo antiguo, se lee sin escribir ni resetear nada. El primer guardado o la creación de otra sesión adopta la anterior con sus mismos datos, ID, orden y presentación.

La sesión visible se resuelve siempre por su ID, sin depender de cuál se inició recientemente en otro dispositivo. Los checkpoints se guardan por ID y turno. Una actualización de otra sesión no altera el registro de esta. Se conservan los marcadores closedCardSession:<id>: al finalizar se vacía solo el checkpoint elegido y se guarda su marcador. Un mensaje antiguo no puede reabrirlo. No se eliminan tarjetas ni reseñas.

Retirar una tarjeta de una colección limpia las apariciones pendientes de todas las sesiones que usan esa colección. Las sesiones ajenas, otros grupos de repaso y el historial no se modifican.

No hay migración SQL ni cambios de IndexedDB: se reutilizan los registros JSON de settings, la transacción/outbox y el transporte actual. No se cambia Supabase, Auth, RLS, Realtime, Storage, Service Worker ni importación/exportación. Las copias existentes conservan el campo antiguo y las nuevas contienen los registros de sesiones.

## Memorización y concurrencia

FSRS, memoryModel y la cola intrasesión permanecen idénticos a v14. Una tarjeta compartida conserva una única identidad, historial y programación a largo plazo, aunque se estudie en varias sesiones. El progreso de cada selección es independiente.

La sincronización es la existente: los cambios sin conexión llegan a otros dispositivos cuando pueden sincronizar. Las sesiones diferentes tienen registros independientes para evitar reemplazar la lista completa. Para la misma sesión se mantienen las guardas por turno y cierre; esto no introduce un bloqueo distribuido ni combina automáticamente dos respuestas simultáneas realizadas sin conexión sobre la misma sesión. Usa la misma versión de OpoGC en todos los dispositivos.

## Archivos de la funcionalidad

- app/OpoApp.tsx: sesiones visibles por ID, arranque independiente y cierre dirigido.
- lib/memory/checkpoint.ts: enumeración, adopción, escritura y cierre de sesiones.
- lib/review/sessionActions.ts: retirada de colecciones en todas las sesiones afectadas.
- components/review/SavedSessions.tsx: acceso y lista de sesiones (nuevo).
- components/review/ResumeSession.tsx y app/mobile-ux.css: progreso, fecha y presentación adaptable.
- tests/multi-session.test.ts y tests/ui/multi-session.spec.ts (nuevos): persistencia, aislamiento, dispositivos y siete tamaños de pantalla.
- tests/ui/v13.spec.ts y v132.spec.ts: actualización del comportamiento anterior de exclusión de sesiones.
- tests/ui/responsive.spec.ts: el gesto por coordenadas espera a que termine la animación del sheet, conservando la comprobación de arrastre.
- components/navigation/MorePage.tsx: etiqueta de versión 14.1.
- package.json / package-lock.json: versión 14.1.0 y registro de la prueba nueva; mismas dependencias.

No se elimina ningún archivo. Este parche no modifica el editor de Material de estudio.
