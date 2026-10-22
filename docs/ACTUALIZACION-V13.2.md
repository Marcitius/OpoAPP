# OpoGC v13.2 — Sesiones a tu ritmo

Parche incremental sobre el proyecto real v13.1. Alcance: cola de flashcards, sesión conservada hasta cierre explícito y acceso principal a Biblioteca. No incluye generación de preguntas con IA ni otras ampliaciones.

## Problema encontrado

La cola v13.1 consideraba pendiente de refuerzo cualquier tarjeta cuyo estado FSRS siguiera siendo Learning, aunque acabara de valorarse Bien. Además priorizaba los refuerzos cuya hora ya había llegado sobre tarjetas aún no vistas. Una pausa larga hacía elegibles varios refuerzos y podía hacer que reaparecieran reiteradamente antes de avanzar por la selección. El checkpoint guardaba intentos y tarjetas, pero no la cara y el borrador exactos que se estaban viendo. Empezar otra selección sustituía la sesión anterior.

## Recorrido nuevo

La fecha de próximo repaso sigue calculándola el adaptador FSRS de v13.1. Esta actualización cambia únicamente qué tarjeta mostrar dentro del recorrido activo:

| Valoración | Dentro de esta sesión | Próximo repaso |
| --- | --- | --- |
| Otra vez | Refuerzo; máximo tres intentos en total | FSRS, con cada intento real registrado |
| Difícil | Una comprobación posterior; máximo dos intentos en total si se mantiene Difícil | FSRS |
| Bien | Termina esa tarjeta en esta sesión | FSRS; puede seguir existiendo un paso de aprendizaje próximo |
| Fácil | Termina esa tarjeta en esta sesión | FSRS, conserva su diferencia frente a Bien |

La separación requerida son ocho tarjetas distintas, o todas las otras si hay menos de nueve. Las repeticiones de una misma tarjeta intermedia no cuentan varias veces. Se evita repetir consecutivamente la última. Tras un refuerzo entran al menos tres tarjetas sin ver mientras queden disponibles. El reloj no adelanta esta cola. Si al terminar el contenido disponible no puede lograrse separación, la vuelta concluye con esas tarjetas pendientes de refuerzo en el resumen; no se inventa una recuperación ni se modifica su fecha FSRS para ocultarlas. Pasar no asigna ninguna valoración.

En un recorrido de diez tarjetas: falla la 1; aparecen 2 a 9; vuelve la 1; si la marcas Bien, sale; después aparece la 10. Las ya marcadas Bien/Fácil no vuelven en esa sesión. En una selección de 69 se aplica el mismo criterio sin dejar que los refuerzos impidan ver las restantes. En Repasos pendientes se conserva la priorización existente y se intercalan nuevas disponibles entre los vencidos, dentro de los límites diarios existentes. En orden, Aleatorio, Aprender y Más falladas conservan sus ámbitos y selector; todos los modos ordinarios comparten el nuevo criterio de refuerzo. Ortografía mantiene la cola específica v13.1, extraída sin cambiar sus reglas.

Dos días después, continuar la misma sesión recupera el punto guardado y no reabre las tarjetas que ya se terminaron. Para un repaso nuevo, finaliza la sesión anterior y abre Repasos pendientes: se usan las fechas FSRS e historial existentes, incluidas las de tarjetas añadidas a una selección nueva.

## Continuidad de sesión

Salir guarda y pausa. Continuar sesión aparece en Hoy, Biblioteca y Más → Temario y planificación. Se conservan selección inicial, modo, tarjeta actual, cara visible, opciones elegidas, respuesta escrita, corrección, cola recorrida e intentos pendientes. El texto se agrupa durante 150 ms; Salir y los eventos de ocultación de página fuerzan el guardado del estado visible mediante la transacción local existente. Se espera a que termine el guardado para ocultar la sesión al salir. Como en la app anterior, un cierre forzado del proceso antes de finalizar una escritura local puede interrumpirla.

La vuelta completada muestra el resumen y sigue guardada. Solo Finalizar sesión la cierra; también se puede finalizar desde el menú de la tarjeta o el aviso de sesión guardada. El historial y la memoria de las tarjetas permanecen. Una selección nueva nunca sustituye silenciosamente la sesión: se elige continuar o finalizar la actual y comenzar la nueva.

Hay una sesión activa por cuenta. La sincronización habitual transporta su checkpoint a otros dispositivos. Conviene salir y esperar a que esté guardado antes de cambiar de dispositivo. Sin conexión, el otro dispositivo recibirá los cambios al volver la conexión y enviarse la cola. Las guardas de ID/turno rechazan valoraciones y borradores de una vista atrasada; si llega un avance o cierre remoto mientras la sesión está abierta, la vista antigua se cierra para retomarla con el estado recibido. Se conserva el comportamiento de resolución de conflictos del motor existente: no se introduce un bloqueo distribuido ni se fusionan dos recorridos simultáneos iniciados sin conexión.

## Navegación

Barra móvil y lateral: Hoy · Biblioteca · Repasar · Progreso · Más. Biblioteca es un acceso principal y conserva selección, búsqueda, filtros, movimientos, edición e importaciones. El estudio planificado sigue desde Hoy; Más incluye Temario y planificación y Organizar temario. Se conservan edición en directo, retirar de una colección y los cinco modos de v13.1.

## Compatibilidad y modelo

No hay migración SQL. No se modifican tablas, Supabase, Auth, RLS, Realtime, Storage, IndexedDB, proyección, sincronización, FSRS ni memoryModel. No hay dependencias nuevas. Los metadatos son campos opcionales en el JSON ya existente `settings.activeCardSession`: versión del criterio de cola, etiqueta, secuencia de tarjetas intermedias, presentación y marcas de visto. `settings["closedCardSession:" + id]` guarda el cierre como clave independiente para que una instantánea atrasada no reactive una sesión ya finalizada.

Los checkpoints v13.1 se adoptan de forma compatible: Bien/Fácil ya registrados se consideran terminados para ese recorrido, conservando IDs, intentos e historial. Si una sesión antigua aún no tenía presentación, se recupera el siguiente elemento pendiente. Actualiza todos tus dispositivos para que usen el mismo criterio. Si se borra contenido mientras está pausada, las referencias a tarjetas que ya no existen se omiten al recuperar el recorrido.

Service Worker, manifest y generador PWA no cambian de lógica. El build regenera `public/sw.js` y `public/version.json` con la revisión correspondiente, como antes.

## Actualización

Copia el contenido de actualizar/ sobre la raíz de v13.1, conservando rutas, .env.local y .git. Ejecuta npm ci, npm run typecheck, npm test y npm run build. Sube a la rama conectada a Cloudflare Pages: compilación npm run build, salida out y variables actuales. No subas actualizar/ como carpeta adicional. Sin archivos eliminados. El ZIP no contiene credenciales, datos de cuenta, node_modules ni out.

Inventario exacto de archivos nuevos/modificados y hashes en ARCHIVOS-DEL-PARCHE.json, en la raíz del ZIP. Pruebas ejecutadas y limitaciones en PRUEBAS-V13.2.md.

## Archivos principales

Creados: components/review/ResumeSession.tsx, components/review/useSessionCheckpoint.ts, lib/memory/checkpoint.ts y lib/memory/orthographyQueue.ts; pruebas tests/session-checkpoint.test.ts y tests/ui/v132.spec.ts; documentación v13.2 y resultados.

Modificados: lib/memory/session.ts, integración de sesión en app/OpoApp.tsx, ReviewSession/SessionStatus, AppNavigation/MorePage, estilos de reanudación, retirada compatible de colecciones en lib/review/sessionActions.ts, pruebas existentes adaptadas a la navegación/cierre explícito, versionado, README y CHANGELOG. Los archivos PWA generados se renuevan con el generador existente. **Eliminados: ninguno.** La lista exhaustiva y los hashes están en ARCHIVOS-DEL-PARCHE.json.
