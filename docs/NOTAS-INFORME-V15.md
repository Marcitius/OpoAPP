# OpoGC v15 — Notas, informe diario y sesiones

Parche sobre v14.3. No cambia la infraestructura de autenticación, PostgreSQL, RLS, Realtime, Storage, IndexedDB ni el motor de sincronización. Tampoco cambia los parámetros o la implementación de FSRS, el editor de Material ni su soporte de imágenes.

## Notas y memoria

Las tarjetas ordinarias se valoran del 1 al 10 con una pulsación. Las notas 1–4 se traducen al grado Again existente de FSRS, 5–6 a Hard, 7–8 a Good y 9–10 a Easy. Se conservan los campos rating y las instantáneas FSRS anteriores/posteriores de cada intento. La base de datos sigue recibiendo los valores admitidos por su restricción actual.

La cola de la sesión y la programación de largo plazo tienen responsabilidades diferentes:

- Una nota >=5 deja la tarjeta en estado remembered y no vuelve a seleccionarse automáticamente en esa sesión, incluso con una nota 5 o 6 traducida a Hard.
- Una nota <5 deja refuerzo pendiente, sin aprobar ni descartar la tarjeta por acumular intentos. Los refuerzos elegibles se ordenan por la menor nota del intento más reciente.
- Se buscan hasta tres tarjetas distintas entre repeticiones (o las otras disponibles si la selección es más pequeña). Mientras hay tarjetas sin ver, se limita el refuerzo para permitir avanzar con ellas. Una pausa del reloj no hace reaparecer una tarjeta aprobada.
- Si no queda separación suficiente, se muestra el resumen con pendientes. La sesión puede conservarse, finalizarse o abrir otra vuelta mediante Volver a intentar pendientes. Esta acción explícita reinicia la separación, no el historial, las notas ni el progreso aprobado. Incrementa el turno para invalidar borradores anteriores.
- FSRS recibe cada intento real, incluidos los refuerzos. No se calculan intervalos manuales a partir de una media ni se reinician estabilidad, lapses o historial.

En tests incorrectos los botones 5–10 están desactivados y el guardado limita defensivamente la nota a 4. Se conserva por separado la respuesta elegida y si fue objetivamente correcta. En respuesta escrita se conserva el texto, porcentaje y criterios de la corrección existente, y el usuario decide la nota de recuerdo; el informe diferencia ambas cosas. No me la sé registra una nota 1 y permite ver la solución antes de continuar. Ortografía mantiene su flujo anterior por errores y no recibe notas inventadas.

## Media sin inflarla con el refuerzo

La regla de esta versión considera independiente un intento tras **12 horas como mínimo sin practicar la tarjeta**. Es una regla de producto explícita y conservadora para distinguir práctica inmediata de una nueva evaluación, no una afirmación científica sobre consolidación ni un parámetro de FSRS. Se comprueba el último intento de toda la cuenta, no únicamente la sesión que está abierta. Cada nuevo refuerzo vuelve a iniciar ese plazo.

Cambiar de dispositivo, crear otra sesión, salir y continuar o cruzar medianoche no convierte por sí solo un refuerzo en evaluación independiente. Una sesión conservada sí puede aportar otro recuerdo si ha transcurrido esa pausa, aunque aún no se haya finalizado.

Todos los intentos se conservan. La media aritmética y la última nota de recuerdo se derivan de los registros numéricos independientes; las repeticiones inmediatas quedan fuera. Ejemplo: 2 inicial → 4 de refuerzo → 8 de refuerzo deja una media 2. Otro recuerdo independiente de 4 deja una media 3. El último refuerzo de 8 no se presenta como última nota de recuerdo.

Los eventos se ordenan por fecha y, en empates, por ID. Los IDs duplicados se cuentan una vez. Si dos dispositivos sin conexión registran casi simultáneamente una evaluación inicial, al reunir los eventos solo la primera contribuye a la media; ambos intentos permanecen visibles. No se sincroniza un contador absoluto de media que pueda pisar los resultados del otro dispositivo.

El historial anterior se conserva sin convertir Again/Hard/Good/Easy en notas ficticias. Si una tarjeta se practicó recientemente con la versión anterior, ese intento también evita considerar una práctica inmediata como independiente. Las tarjetas sin evaluación numérica independiente aparecen como Sin nota de recuerdo.

## Elegir qué estudiar

Biblioteca incorpora un filtro desplegable por notas. Permite elegir todas, suspendidas (<5), intervalo o sin nota. Puede usar la media o la última nota de recuerdo. Las filas muestran media, última nota y el cambio entre los dos últimos recuerdos cuando existen.

Estudiar selección incluye los mismos filtros dentro de las tarjetas elegidas y añade Peor nota primero. Se mantienen Aprender, Aleatorio, En orden, Más falladas y Repasos pendientes. Peor nota primero y Aprender usan el orden por nota; el repaso recomendado mantiene la elegibilidad y los límites existentes, y ordena sus candidatos por nota. Aleatorio y En orden conservan su significado. Se reservan turnos para tarjetas sin nota sin calificarlas como cero.

## Informe para ChatGPT

Progreso ofrece Informe diario para ChatGPT, independiente de los filtros visuales de Progreso y con ámbito de todos los temas. El JSON es `opogc-daily-study`, versión de formato 1, y contiene:

- Fecha local, zona horaria y momento de exportación.
- Resumen de tarjetas distintas, intentos, evaluaciones independientes, refuerzos, aprobadas inicialmente/tras practicar y pendientes.
- Resultados por tarjeta, notas de recuerdo y últimos valores para analizar evolución.
- Intentos con ID estable, sesión, momento original, puntuación, corrección objetiva disponible, respuesta escrita/opciones y próximo repaso calculado en ese momento.
- Copia de pregunta/respuesta/ruta al contestar para los nuevos intentos numéricos. En registros antiguos se indica si se usa el contenido actual o no está disponible.
- Completados y notas del temario, intentos de psicotécnicos y resúmenes de sesiones finalizadas ese día.
- Opcionalmente, contexto **actual al exportar** para planificar: vencidas, tarjetas débiles, planificación y sesiones abiertas. Se identifica como tal aunque el informe corresponda a un día anterior.
- Instrucciones para que ChatGPT distinga recuerdo, refuerzo, autoevaluación y corrección objetiva.

Los límites del día se evalúan en la zona horaria del dispositivo, incluyendo días de 23 o 25 horas por cambio horario. La fecha de sincronización no cambia el día original del intento. Exportar no requiere una llamada a IA ni una suscripción de API. Funciona con los datos locales disponibles offline; actividad de otro dispositivo todavía sin sincronizar solo aparecerá cuando llegue.

La media de un informe histórico se calcula con la historia hasta ese día, sin incorporar notas posteriores. Los eventos sin nota permanecen como legacy-unscored. No se inventan respuestas anteriores ni se afirma que abrir Material pruebe haberlo estudiado. responseMs es tiempo transcurrido y puede incluir pausas: el tiempo activo se declara no medido. El JSON no lleva adjuntos binarios ni configuración de autenticación y no sustituye la copia portátil.

## Cerrar una, varias o todas las sesiones

Se conserva el botón individual Finalizar y su confirmación. Ver las N sesiones/Gestionar sesión permite marcar sesiones, seleccionar todas, limpiar selección, finalizar selección o finalizar todas. El cierre colectivo confirma cantidad y pendientes; cancelar no modifica nada.

Los cierres se guardan mediante una única actualización local y la transacción/outbox existentes. Se conserva el marcador closedCardSession para impedir que un borrador tardío o un dispositivo desactualizado vuelva a abrir la sesión. Se añade un resumen finishedCardSession con fechas, modo, contadores e IDs pendientes; no se borran tarjetas ni registros de respuesta y no se aprueba lo que quedó pendiente. Finalizar otra vez es idempotente.

## Compatibilidad y datos

No hay migración SQL, nuevas tablas, cambios de buckets ni dependencias nuevas. Los campos opcionales de Review (`score`, `scoreKind`, `cardSessionId`, `cardSnapshot`, `answerEvidence`) y de sesión utilizan los JSON ya sincronizados por el proyecto. Los resúmenes de cierre utilizan los ajustes existentes. La copia portátil conserva estos datos por el mecanismo actual de exportación/restauración. IDs y valoraciones previas permanecen intactos.

Actualizar todas las PWA evita mezclar los controles y reglas de versiones distintas. El código de Auth, RLS, transporte de sincronización/offline, adjuntos y FSRS no se ha sustituido. Los controles de integridad existentes continúan ejecutándose; solo se autorizan explícitamente los dos manejadores de valoración que ahora reciben notas numéricas, además de los cambios previamente autorizados.

## Validación y entrega

Se ejecutan TypeScript, pruebas de lógica/datos, build estático y pruebas Chromium. Las pruebas nuevas comprueban notas y límite de aprobado, fallos repetidos, separación y prioridad, media no inflada, concurrencia, filtros, persistencia/reapertura/proyección, cierre múltiple y borradores tardíos, informes históricos y cambio horario. La interfaz prueba notas, tests/escritas, selección, exportación, cancelación/cierre y traspaso simulado entre dispositivos. Las regresiones previas se adaptan a los nombres accesibles de las notas; no se mantienen botones antiguos ocultos para hacerlas pasar.

Los resultados exactos están en RESULTADOS-V15.json. Las pruebas de servidor usan PostgreSQL local de pruebas; los recorridos UI usan fixtures e IndexedDB, y el traspaso entre dispositivos es simulado. No se ha accedido al Supabase de producción ni se ha probado un iPhone/iPad físico o Safari real. Las dimensiones móviles/tablet y las pruebas PWA locales no equivalen a esas comprobaciones físicas.

El ZIP contiene exclusivamente archivos nuevos/modificados sobre v14.3, con manifiesto de rutas y hashes. No incluye node_modules, builds, datos de usuario ni credenciales. No hay archivos que borrar. El Service Worker y la versión se regeneran mediante el build existente. Despliegue: npm run build; salida out.

## Resultado final ejecutado

- npm run typecheck: correcto.
- npm test: 116 pruebas aprobadas, 0 fallidas; incluye 21 nuevas de notas/informe y las verificaciones de preservación.
- npm run build: compilación y exportación estática correctas.
- npm run test:ui: 121 pruebas aprobadas, 0 fallidas, 0 omitidas, 0 inestables y un intento por prueba en la ejecución final. Incluye 14 nuevas de notas/informe/sesiones y regresiones previas.
- Dimensiones de los controles de notas: 360×800, 390×844, 430×932, 768×1024, 1024×768, 1366×768 y 1920×1080. También se comprueba que la cabecera con media y refuerzos no desborde en 360 px.
- 21 archivos críticos idénticos byte a byte respecto a v14.3, incluidos Auth, motor de sincronización, almacenamiento local/adjuntos, FSRS, migraciones SQL y manifest. Detalle en INTEGRIDAD-V15.json.

En las pruebas UI se espera la confirmación persistida al simular el traspaso entre dispositivos o comprobar una retirada, en lugar de leer el motor de pruebas antes de terminar su transacción. Las comprobaciones siguen exigiendo que los datos se conserven; no se omiten pruebas ni se ocultan errores con reintentos automáticos.
