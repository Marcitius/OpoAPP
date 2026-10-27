# CHANGELOG — OpoGC

## 14.2.1 · 27 de octubre de 2026 — Cursor y teclado en Material

- BottomSheet toma el foco solo al abrirse. Los cambios de dismissible durante el guardado no reenfocan el diálogo; Escape sigue consultando las reglas actuales de cierre y se mantiene el focus trapping.
- Opciones, extensiones y editorProps de Tiptap estables. Se elimina la reconfiguración del editor en cada transacción de texto/selección; setEditable solo se ejecuta si cambia realmente la edición permitida.
- Material distingue las ediciones locales de las cargas externas (importación, recuperación, versión remota y carga explícita). El autoguardado ya no reinyecta la propia edición como contenido externo.
- Pruebas de posición, foco durante autoguardado, guardado retenido, Backspace, Enter/Shift+Enter, listas, negrita, tablas y deshacer/rehacer.
- Sin cambios en datos, esquema, backend, FSRS, sincronización, sesiones o dependencias. Se conservan las optimizaciones v14.2.


## 14.2.0 · 26 de octubre de 2026 — Estudio más fluido

- Respuestas y selección de test aisladas de la aplicación principal; render del contenido enriquecido reutilizado y fondo de estudio conservado mientras está cubierto.
- Búsqueda de Biblioteca solo cuando procede, sin recorrer HTML para búsquedas vacías, con caché invalidada al editar contenido, mover carpetas o cambiar la cuenta.
- Referencias estables para datos sin cambios; modelo de memoria y pendientes dependen de sus datos, no del borrador. Probabilidades precalculadas una vez al ordenar; mismo resultado/algoritmo.
- Borrador local pequeño por cuenta/sesión usando el almacén IndexedDB existente; checkpoint agrupado a 1,5 segundos, guardado al salir/ocultarse y recuperación tras recarga. Protección por ID, turno y revisión; rebase del borrador si se sigue escribiendo durante un checkpoint.
- Optimización pura de project/differences: índice de contadores y omisión de colecciones con la misma referencia. Pruebas de equivalencia con el código v14.1 archivado; sin cambiar formatos, operaciones, motor de sincronización, transacciones o SQL.
- Banco sintético de 2.200 tarjetas y 4.000 repasos, medición antes/después y nuevas pruebas de fluidez, recuperación y error de valoración.
- FSRS, memoryModel, algoritmos de sesión/ortografía, Auth, Supabase, RLS, Realtime, esquema, Material y dependencias permanecen sin cambios.


## 14.1.0 · 26 de octubre de 2026 — Varias sesiones guardadas

- Varias sesiones de tarjetas independientes: empezar una selección nueva conserva las anteriores. Lista desde Hoy, Biblioteca, Repasar y el temario; acceso rápido a la más reciente.
- Cada sesión mantiene selección, orden, cola, tarjeta/cara actuales, respuesta escrita, opciones elegidas, progreso y refuerzos. Salir guarda; Finalizar cierra únicamente el ID confirmado.
- Adopción compatible del antiguo checkpoint único, sin cambiar IDs ni historial. Registros independientes en settings mediante IndexedDB/outbox/sincronización existentes; marcador de cierre que impide resucitar una sesión con un checkpoint atrasado.
- Abrir, guardar o cerrar otra sesión en un dispositivo no sustituye la sesión distinta abierta en otro. Los cambios de turno/cierre de la misma sesión conservan las guardas existentes.
- Retirar una tarjeta de una colección actualiza todas las sesiones de esa colección; conserva las tarjetas y el historial.
- Sin cambios a FSRS, memoryModel, algoritmo intrasesión, Auth, Supabase, RLS, Realtime, esquema SQL, motor offline, Material ni dependencias.
- Nuevas pruebas deterministas y de navegador; se actualizan dos pruebas que antes exigían cerrar una sesión para empezar otra.


## 14.0.0 · 24 de octubre de 2026 — Material de estudio

- Nueva sección con temas, subtemas y documentos editables; búsqueda en nombres/contenido, navegación progresiva, renombrar, mover, reordenar y eliminar ramas.
- Copia de estructura desde Biblioteca con selección y previsualización, conservando tarjetas/IDs/historial y evitando duplicados.
- Editor Tiptap independiente del editor de tarjetas: títulos 1–6, marcas, fuente/tamaño/color, resaltado, listas, sangría, alineación/interlineado, tablas, citas, enlaces, separadores, sub/superíndices y deshacer/rehacer.
- Pegado HTML enriquecido y conversión Markdown, incluyendo listas alfabéticas y viñetas escapadas del texto adjunto. Importación TXT/MD/HTML, lectura, exportación HTML e impresión/PDF.
- Guardado automático a través de settings/cola existentes, borrador local por usuario y recuperación tras recarga. Protección frente a versiones recibidas mientras hay cambios locales; guardar copia y recuperar borradores de apartados eliminados remotamente.
- Editor cargado bajo demanda; sin foco automático de campos al abrir. Nuevos estilos móviles/tablet/escritorio y PWA offline mediante el generador existente.
- Sin migraciones SQL ni cambios a Supabase, Auth, RLS, sincronización, memoria o sesiones. Conserva la reparación de despliegue anterior.

## 13.2.1 · 22 de octubre de 2026 — Corrección del despliegue

- Recupera los archivos de v13.1 que faltaban en el repositorio: selector de modos, componentes, prueba y documentación. Los cuatro componentes comprobados aún eran los de v13 sin cambios propios posteriores.
- Preparación del build: aparta solo cinco rutas antiguas D1/R2 y el manifest dinámico anterior, comprobados por contenido, conservando una copia. No ejecuta ni modifica backend o datos.
- TypeScript incluye la aplicación activa, sus configuraciones y pruebas; evita compilar como entradas los archivos sueltos antiguos de la raíz/ejemplos. Mantiene strict y el control normal de errores.
- Los comandos de build, desarrollo, typecheck y test ejecutan la preparación. Cloudflare debe usar npm run build con salida out.
- Sin cambios en la lógica de sesiones, FSRS, Supabase, Auth, RLS, sincronización ni datos. Sin dependencias nuevas.

## 13.2.0 · 22 de octubre de 2026 — Sesiones a tu ritmo

- Bien y Fácil terminan la tarjeta en esa sesión. El refuerzo exige otras tarjetas distintas; el paso del tiempo no provoca repeticiones consecutivas ni desplaza indefinidamente contenido sin ver.
- Difícil: una comprobación adicional. Otra vez: hasta dos. Sin separación suficiente, queda por reforzar para más adelante, sin presentarla como aprendida.
- Contador de tarjetas únicas vistas y pendientes de refuerzo; resumen conservado hasta finalizar expresamente.
- Checkpoint de tarjeta, cara, selección, respuesta escrita y cola mediante settings/IndexedDB/outbox existentes. Continuar desde Hoy, Biblioteca y Temario y planificación.
- Salir pausa; Finalizar cierra y conserva historial. Empezar otra sesión exige continuar o finalizar la guardada. Marcador de cierre y guardas contra checkpoints o ratings atrasados.
- Biblioteca sustituye a Estudiar en la navegación principal; temario y planificación permanecen accesibles desde Hoy y Más.
- Adaptación compatible de checkpoints v13.1, sin borrar tarjetas, ratings ni IDs; campos JSON opcionales, sin migraciones ni dependencias nuevas. FSRS, memoryModel, motor de sincronización, Auth, RLS y Service Worker se conservan.
- Se conserva la cola específica de ortografía. Se mantienen la edición en directo, retirada de colecciones y los cinco modos de estudio.
- Parche incremental sobre v13.1 con pruebas deterministas y de navegador.

## 13.1.0 · 16 de octubre de 2026 — Sesiones y modos

- Editar tarjetas desde el menú de la sesión, volver a la misma y continuar. Reutiliza el editor real, guarda offline y conserva la programación más reciente aunque haya llegado una valoración mientras se editaba.
- Retirar de la colección actual y continuar con la siguiente tarjeta. Conserva tarjetas, historial y otras colecciones; retira refuerzos pendientes de esa sesión. Retirada individual y por selección también desde la lista.
- La sesión conserva la colección de origen al reabrir, mediante un campo JSON opcional compatible con sesiones antiguas.
- Recupera elección de modo al estudiar una selección: Aprender, Aleatorio, En orden, Más falladas y Repasos pendientes. Las selecciones mixtas permiten elegir ortografía por separado.
- Formularios sin foco automático de texto; espera de guardado, bloqueo de doble envío y conservación del editor si falla el guardado.
- Parche incremental desde v13; sin migraciones ni cambios al algoritmo FSRS, Supabase, autenticación o motor de sincronización.

## 13.0.0 · 14 de octubre de 2026 — Repasos y organización

- Colecciones permanentes y configurables, independientes de los ratings; guardar desde la pregunta, respuesta o selección de Biblioteca sin avanzar ni cambiar memoria.
- Práctica global o filtrada por temas/subtemas y contenido enlazado; responder no elimina tarjetas guardadas.
- Filtros profesionales con búsqueda, ruta y navegación progresiva en toda la app; selección múltiple de ramas.
- Biblioteca separada en un componente: búsqueda, tipos, edición, selección mixta y movimiento entre niveles/ramas sin perder contenido.
- Movimiento individual y en grupo de Temario. Se conservan IDs, relaciones, planificación y progreso; validación previa de ciclos.
- Tarjetas a raíz mediante carpeta real Sin carpeta, sin nueva base de datos ni migración.
- Capas/foco compartidos para paneles y editores; sin autoenfocar texto al abrir.
- Conserva FSRS, Auth, RLS, Realtime, IndexedDB, Storage y motor de sincronización.
- Proyecto completo, guía de actualización GitHub/Cloudflare, inventario, capturas y pruebas en docs.

## 12.0.0 · 2 de octubre de 2026 — Memoria y estudio

- Conserva ts-fsrs 5.4.2: persiste fase, pasos y reps. Cada intento, incluido el refuerzo y ortografía, alimenta FSRS.
- Sesiones finitas con esperas reales, separación entre preguntas, refuerzo adaptado y resumen honesto. Checkpoint recuperable en IndexedDB y sincronizado mediante el motor existente.
- Calibración de prioridad personal cronológica y amortiguada; no entrenamiento automático de pesos.
- Organizar estudio: Hoy/Después/Repasos, estudio hoy/después y repaso mañana sin formulario obligatorio; fecha y nota opcionales; reutiliza IDs pendientes.
- Arriba/abajo, sacar un nivel y mover entre ramas en Biblioteca/temario, además de orden de tarjetas y prioridades. Conserva ramas, contenido, IDs y progreso.
- Biblioteca → temario con selección, nombres, cambio de nivel, destino, preview y confirmación. Vínculos al contenido original, sin duplicar tarjetas. Importación JSON conservada.
- Sin autoFocus en toda la app; foco inicial en contenedores y trapping de la capa superior. El editor de formato no abre el teclado por sí mismo.
- Nuevos componentes y funciones puras; OpoApp pierde la cola continua anterior y el antiguo dashboard de organización.
- Sin migraciones, cambios de Auth, RLS, SQL, engine, Realtime, IDB, Storage o datos reales. Campos nuevos opcionales en JSONB.
- 19 pruebas nuevas de memoria/estudio, 5 recorridos nuevos de navegador. Documentación de pruebas ejecutadas y límites en docs/PRUEBAS.md.
- No se eliminan archivos de código de v11. Se reemplazan los flujos correspondientes dentro de OpoApp. Se conservan documentos y huellas históricas.

## Histórico v11 — Mobile UX

### 11.0.0 · 30 de septiembre de 2026

### Experiencia diaria

- Cinco destinos consistentes: Hoy, Estudiar, Repasar, Progreso y Más. Barra inferior móvil y lateral en escritorio.
- Hoy reemplaza el dashboard inicial: pendientes, dos botones directos, tres prioridades como máximo y avance del día.
- Repaso inmersivo con progreso, revelar/comprobar, cuatro valoraciones grandes y controles fijos. La navegación deja de distraer durante la sesión.
- Sesión de estudio secuencial: terminar → valoración y nota → guardar y siguiente. Guarda el evento mediante la transacción y cola ya existentes antes de avanzar.
- Estudio libre desde un selector rápido por apartado. Los registros se crean al terminar, conservando tareas e historial.
- Planificar Estudiar / Repasar dentro del formulario existente; los motivos anteriores no se transforman.

### Organización y pantallas secundarias

- Temario como carpetas progresivas, búsqueda global, atrás, acciones en ··· y lista/detalle en tablet.
- Reordenación manual de hermanos en el JSONB del nodo, conservando IDs e historial. Importación, exportación, selección y eliminación siguen disponibles.
- Biblioteca secundaria con búsqueda operativa, filtros, carpetas y formularios de pantalla completa en móvil. Conserva todos los tipos y modos.
- Progreso orientado a decidir qué reforzar: porcentajes del temario, última valoración, tarjetas débiles, días, actividad, memoria y detalle de ortografía.
- Psicotécnicos como filas táctiles; conserva fichas, intentos, notas, resultados, adjuntos y anotaciones.
- Cuenta como ajustes móviles con guardado discreto, copias de seguridad, contraseña y sesión.

### Diseño y componentes

- Fuentes de sistema, verde contenido, jerarquía clara, botones de al menos 44–48 px y superficies simples.
- Bottom sheets con cierre fuera/arrastre/Escape, foco controlado y restauración; formularios largos a pantalla completa.
- Zonas seguras, altura dinámica y viewport visual para teclado. Bloqueo estable de la capa inferior.
- Imágenes y PDF montados en un portal sobre los paneles, con foco y Escape; los servicios de archivos/anotación no se modifican.
- Componentes separados en navigation, today, study, review, library, progress, psych, account, sheets y shared. Las utilidades recuperadas se trasladan a lib/study/legacy.ts.
- Animaciones breves y respeto a prefers-reduced-motion.

### Fiabilidad y compatibilidad

- 15 archivos críticos idénticos a v10 y 29 funciones de negocio verificadas estructuralmente.
- Ninguna migración SQL nueva; ninguna sustitución de Auth, RLS, Realtime, IndexedDB, outbox, Storage o FSRS.
- Formato portable de backup v10 y almacenamiento existentes conservados. No se añaden datos iniciales a cuentas con contenido ni a cuentas vacías.
- Versión de paquete/PWA 11.0.0; revisión de recursos regenerada por el generador existente.
- Pruebas de UI ampliadas a ocho tamaños, 50 tarjetas consecutivas, tres valoraciones con nota, árbol profundo, teclado reducido, capas y persistencia offline. Véase docs/PRUEBAS.md para resultados y límites.

### Archivos eliminados

Ningún archivo del proyecto v10 se elimina. Los antiguos bloques de interfaz y utilidades de OpoApp se trasladan o sustituyen por componentes; se conserva la lógica y los datos.
