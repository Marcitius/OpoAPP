# Auditoría y cambios — v12

## Base inspeccionada

ZIP actual OpoGC-v11-Mobile-UX(1).zip, completo. Se inspeccionaron OpoApp, componentes, adaptador FSRS, memoryModel, tipos/utilidades de estudio, Auth, local/IndexedDB, flatten/project/differences, engine/outbox/Realtime, backups, SQL/RLS/Storage, PWA, manifest, CSS y tests. Se reutiliza su arquitectura; no se reconstruye el backend.

## Sistema anterior y problemas

- ts-fsrs 5.4.2, FSRS-6, retención 0.9, sin fuzz, aprendizaje corto activo. FSRS calcula fechas, estabilidad, dificultad y lapsos; memoryModel calibra probabilidad/prioridad usando ratings históricos.
- El adaptador reconstruía cada tarjeta como Review si reviewCount > 0. Perdía el estado Learning/Relearning y learning_steps: una fecha corta podía persistir sin su fase correspondiente.
- Aprender/Más falladas solo programaban FSRS en el primer encuentro de la sesión. Los ratings posteriores quedaban en historial pero no actualizaban memoria.
- El aprendizaje continuo podía no terminar y el selector podía ignorar cooldown al escasear candidatos. El refuerzo por posición de cola no garantizaba separación temporal.
- Ortografía tenía el mismo límite de un único intento aplicado a memoria y selección por grupos que podía repetir demasiado pronto.
- Orden de Biblioteca principalmente implícito en arrays; temario permitía reordenar hermanos, pero faltaban acciones rápidas universales.
- Biblioteca y temario no tenían un vínculo explícito; los forms contenían autoFocus.
- La organización de pendientes requería demasiada gestión para decidir el siguiente estudio.

## Memoria corregida, no sustituida

El adaptador conserva fsrsState, fsrsLearningSteps y fsrsReps, además de todos los campos anteriores. La siguiente respuesta se entrega a FSRS con su estado real. No se cambian versión de dependencia, pesos, fórmula, retención objetivo ni SQL.
Las tarjetas antiguas sin metadatos nuevos adoptan Review si tienen historial, o New si son nuevas, conservando S/D/última revisión/lapsos/IDs. No se intenta adivinar o reproducir intentos antiguos perdidos, ni se reinicia su memoria. A partir del siguiente intento se conserva su fase correctamente.
Cada rating queda con schedulerVersion, fsrsBefore/fsrsAfter y fecha. fsrsReps cuenta todos los intentos; reviewCount/successCount conservan su interpretación histórica de primeros encuentros, compatible con project y estadísticas existentes. Las valoraciones reforzadas mantienen reinforcement=true. Se preserva cada registro histórico.
memoryModel ordena los datos cronológicamente, descarta predicciones inválidas y amortigua calibración con muestras pequeñas. No entrena parámetros FSRS ni promete optimización individual de pesos inexistente.

## Dos escalas

**Dentro de la sesión:** lib/memory/session.ts, funciones puras con reloj explícito. Conjunto fijo y deduplicado, estado por tarjeta, IDs de reviews, intentos, fallos, último turno y elegibilidad. Again/Hard/fases Learning/Relearning siguen en refuerzo. Pasos predeterminados de la biblioteca: nuevo Again ~1 min, nuevo Good ~10 min; reaprendizaje según FSRS. Se combina tiempo con otras tarjetas (Again: dos turnos; resto de refuerzo: tres) si las hay. Si solo quedan refuerzos y el tiempo ya venció, se relaja el requisito de turnos para no bloquear. No se relaja el tiempo. Una madura Hard tiene una confirmación usando la duración Hard inicial de la biblioteca (~6 min), sin inventar un intervalo largo.
Máximo seis intentos débiles por tarjeta en esa sesión: queda débil y con su fecha FSRS intacta. Pasar no modifica memoria ni ratings. Estado resumido distingue vistas, recordadas y débiles/no completadas. Ortografía usa grupos de hasta cuatro, mismas esperas y corrección real Good/Again.
**Largo plazo:** todas las respuestas reales atraviesan scheduler.next. Good/Easy tras aprender permiten graduación, recuerdo consistente aumenta S/intervalo y un lapso reduce S y entra en Relearning sin borrar reps, ratings previos ni historial. Los modelos usan el estado acumulado de las respuestas, incluyendo refuerzos. No se introducen intervalos de días hechos a mano ni un algoritmo nuevo.

## Persistencia e integración

Una transacción de engine.update guarda tarjeta, review y settings.activeCardSession; el motor existente aplica differences/IndexedDB y outbox. No se añade una base local distinta ni un almacenamiento paralelo. La misma información se sincroniza como JSONB. Al salir, cerrar o recargar se ofrece retomar sin repetir respuestas ya guardadas.
El conjunto de la sesión guarda IDs, no copias del contenido. Tarjetas eliminadas durante la sesión dejan de ser elegibles. Una sesión activa por cuenta; abrir otra explícitamente sustituye su planificación temporal pero no elimina registros.
Los nodos enlazados permiten empezar sus tarjetas desde Estudiar. Una planificación de tarjetas se completa con evento de estudio solo si todas las previstas quedan recordadas; no si se saltaron o siguen débiles. El estudio de apartados sin tarjetas conserva valoración y nota de v11.

## Organización y estructura

planBucket opcional distingue Después sin fecha de lo debido hoy. Acciones reutilizan una tarea pendiente del mismo nodo/tipo, no modifican registros done. Reordenar prioridad solo afecta a pendientes del mismo bloque. Los motivos antiguos no se reclasifican.
El movimiento jerárquico solo modifica parentId y orden del nodo; hijos mantienen sus enlaces. Se rechazan ciclos/destinos inválidos. Mover tarjetas cambia folderId/orden, nunca ID/progreso.
Library draft crea una estructura editable con vínculos a origen. materializeLibraryDraft valida y genera el resultado antes de guardar. Desmarcar un padre promociona hijos seleccionados al ancestro seleccionado más próximo/destino. Se detectan artículos cuyo título comienza Artículo N; el resto de contenido sigue enlazado por carpeta. Reimportar reutiliza sourceKey/sourceFolderId y conserva ID/createdAt/datos ajenos. No hay copia de tarjetas. La preview es de estructura, no una simulación de aplicación.

## Modelo de datos (sin migración SQL)

Campos opcionales JSONB:

- cards: fsrsState, fsrsLearningSteps, fsrsReps, sortOrder.
- reviews: schedulerVersion, fsrsBefore, fsrsAfter.
- settings: activeCardSession (o null).
- studyTasks: planBucket.
- studyNodes: sourceKey, sourceFolderId, sourceCardIds; sortOrder ya existía.
- folders: sortOrder.
  Se usan tablas y columnas existentes. Importación/exportación genéricas ya conservan estos campos; se prueba con las mismas proyecciones y transacciones. Las instalaciones anteriores no deben volver a ejecutar SQL. Una versión antigua puede no aplicar esta lógica nueva, por lo que conviene actualizar todos los dispositivos antes de continuar practicando.

## Foco y teclado

Se eliminan todos los autoFocus. El foco inicial y restaurado no cae en campos editables. Trap Tab/Escape para la capa superior, incluidos sheets anidados; no se utiliza readonly temporal ni bucles blur. RichTextEditor no fuerza focus al tocar formato sin una selección dentro del editor. Tests comprueban activeElement y viewport reducido; no se afirma haber probado un teclado físico de iOS/Android.

## Referencias primarias usadas para contrastar el comportamiento

- https://open-spaced-repetition.github.io/ts-fsrs/
- https://github.com/open-spaced-repetition/ts-fsrs
- https://faqs.ankiweb.net/what-spaced-repetition-algorithm.html
  No se actualiza a una versión algorítmica más reciente durante este cambio: se conserva la dependencia instalada/locked y se corrige su uso.
