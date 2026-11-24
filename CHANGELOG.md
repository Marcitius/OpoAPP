## 15.5.0 — 2026-11-23

- Notas opcionales por flashcard, con edición, resolución, acceso en estudio/Biblioteca/buscador y eventos diarios para ChatGPT incluso sin calificación.
- Tarjetas derivadas en la misma organización, relación de origen, aviso al cambiar la original y revisión explícita. Calificaciones independientes.
- Práctica derivada voluntaria dentro de la sesión con separación entre tarjetas; excluida de media y programación FSRS por ser práctica guiada.
- Eliminar tarjeta mientras se estudia, con confirmación y continuidad; limpieza de colecciones y todas las sesiones abiertas, sin borrar sus notas, historial ni derivadas.
- Copias compatibles con historial de tarjetas eliminadas: referencias históricas restauradas como registros eliminados, sin SQL nuevo.
- Creación manual de respuestas escritas con respuesta modelo y rúbrica editable, conservando JSON/prompts actuales.
- Aceptación manual como correcta tras revisar respuestas escritas/tablas; guarda 10/10 con procedencia explícita y conserva la evaluación automática.
- Componentes separados en `components/cards/` y funciones puras en `lib/cards/`; sin dependencias nuevas ni cambios de autenticación/transporte/PWA.

# v15.4.0 — Cola visible y buscador

- Botón de tres líneas Cola dentro de las sesiones, incluidas las tablas mudas y los grupos de ortografía. Panel lateral desde 768 px y hoja móvil por debajo; la sesión conserva su contenido y borrador al abrirlo.
- Vista del orden previsto mediante el selector de la sesión existente: tarjeta actual, próximas, pendientes de refuerzo y aprobadas. Se recalcula con las valoraciones y señala movimientos de posición; no cambia el scheduler ni escribe valoraciones de la previsión.
- Previsión progresiva de 30 tarjetas por bloque y listado de aprobadas bajo demanda, evitando procesar o dibujar una sesión completa al abrir el panel.
- Lupa en Hoy con búsqueda global por pregunta/respuesta, lectura completa, comienzo de estudio y acceso al editor existente. Incluye soluciones correctas de test/vocabulario, respuestas escritas, ortografía y respuestas/alternativas de tablas mudas.
- Índice local de texto, normalización de mayúsculas/acentos y resultados por bloques. Estado de escritura aislado de la aplicación; apertura sin enfocar automáticamente campos.
- Componentes cargados bajo demanda y estilos propios. Se conservan los prompts, tipos, medias, sesiones, FSRS, Auth, RLS, Realtime, cola offline y PWA. Sin SQL ni dependencias nuevas.

---

# v15.3.1 — Prompts de importación

- Restaura la elección de tipo y Copiar prompt en Importar tarjetas JSON, con los seis tipos actuales, incluida Tabla muda.
- Prompt completo y ejemplo JSON específico por tipo, con campos compatibles con el importador real. Las tablas priorizan datos concretos y respuestas breves; la respuesta escrita incluye rúbrica y alternativas.
- Consulta del prompt y copia manual si el portapapeles está denegado o no está disponible. Mensaje de confirmación sin enfocar el texto ni abrir el teclado automáticamente.
- Cambiar la selección o copiar conserva el borrador JSON y la validación; siguen admitiéndose importaciones de tipos mezclados.
- Catálogo separado de la pantalla y estilos acotados. Sin cambios en el parser, persistencia, datos, calificaciones, sesiones, sincronización, FSRS o backend.

---

# v15.3.0 — Tablas mudas

- Nuevo tipo de tarjeta Tabla muda, integrado en Biblioteca, carpetas, filtros, selección mixta y sesiones. Las flashcards normales y el resto de tipos conservan su funcionamiento.
- Editor visual propio: filas/columnas, celdas con formato, pegado de tablas, marcar respuestas individuales o por columna, alternativas explícitas y vista previa.
- Ocultación 25/50/75/100 %, aleatoria y estable por intento; comprobar, revelar, reintentar y nueva combinación. Desplazamiento horizontal acotado en móvil.
- Corrección estricta de contenido, flexible con mayúsculas, acentos y espacios. Nota objetiva exacta de 0 a 10 sobre los campos ocultos; una tabla equivale a una tarjeta y una nota.
- Primer resultado preservado frente al refuerzo; guardado explícito sin duplicados. Media con decimales por primera nota de tarjeta/sesión; notas manuales normales intactas.
- Borrador/checkpoint existentes conservan campos, máscara y resultado al salir/reanudar; metadatos opcionales compatibles con JSONB, offline y sincronización actuales.
- Importación JSON compatible con archivos anteriores, nuevo tipo tabla_muda y estructura editable; exportación individual con rutas profundas y copias completas existentes. Informe diario con evidencia de la tabla.
- Componentes propios cargados bajo demanda y contenido estático memorizado para no procesar toda la cuenta al escribir.
- Sin dependencias nuevas, migraciones SQL, archivos eliminados ni cambios al transporte de Auth, sincronización, FSRS o PWA.

---

# v15.2.0 — Editor de tarjetas

- Pregunta y respuesta comparten el editor Tiptap de Material, con una barra compacta y herramientas ampliadas en ···. Sustituye el antiguo contentEditable con execCommand.
- Títulos 1–6, listas, marcas, fuentes, tamaños, colores, resaltado, alineación, sangría, interlineado, tablas, citas, enlaces y deshacer/rehacer en las tarjetas.
- Pegado HTML enriquecido y conversión Markdown, incluyendo viñetas Unicode y fragmentos subrayados o en cursiva sin contenedor.
- Política de formato y estilos de lectura unificados: se conservan al guardar/editar y se muestran correctamente durante el estudio. Las tablas se desplazan dentro del contenido cuando es necesario.
- Sangría e interlineado se aplican a todos los párrafos y títulos seleccionados, también cuando se mezclan en la selección.
- Editor estable durante la escritura: conserva la corrección de cursor/retroceso y no enfoca automáticamente campos al abrirse.
- Carga del editor bajo demanda, sin incluir Tiptap en el arranque de las sesiones de estudio/repaso. El precache PWA existente conserva los chunks para editar offline.
- Sin dependencias nuevas ni SQL. Se mantienen imágenes/adjuntos, tipos de tarjeta, rúbricas, notas, medias, sesiones, historial, FSRS, Auth y sincronización.

---

# v15.1.0 — Media por sesión y cuatro grupos

- Corrige la media: primera valoración numérica por tarjeta y sesión guardada, sin la restricción de 12 horas. Continuar la misma sesión conserva el refuerzo; una sesión nueva aporta otra nota.
- Recupera las primeras notas de sesiones v15 que habían quedado excluidas por aquella restricción, usando los IDs del historial sin modificarlo.
- Mantiene decimales completos para calcular, filtrar y ordenar; los muestra con formato español.
- Sustituye diez botones por Suspendida, Suficiente, Notable y Sobresaliente. Los grupos aportan valores centrales 2,5/5,5/7,5/9,5; las notas numéricas antiguas se conservan.
- Agrupa los filtros por esos cuatro niveles, incluyendo correctamente medias decimales.
- Actualiza el informe para ChatGPT con la política por sesión y la procedencia de las notas.
- Conserva sesiones, historial, FSRS, sincronización, offline, Material e imágenes. Sin SQL ni dependencias nuevas.

---

# v15.0.0 — Notas e informe diario

- Notas 1–10 con aprobación desde 5 y refuerzos intercalados priorizados por menor nota. Aprobadas fuera de la cola de esa sesión.
- Media y última nota de recuerdo calculadas desde registros persistidos; refuerzos separados mediante una pausa mínima de 12 h. Sin convertir las valoraciones antiguas ni cambiar FSRS.
- Filtros por media/última nota, suspendidas, intervalo y sin nota en Biblioteca y en las opciones de selección; nuevo modo Peor nota primero. Modos existentes conservados.
- Informe diario JSON para ChatGPT, con respuestas/contexto del intento, refuerzos, resultados de temario/psicotécnicos y planificación opcional. Fechas por zona horaria y registros offline originales.
- Finalización individual, selección múltiple o todas las sesiones con confirmación; resumen de cierres y pendientes conservado.
- Pruebas deterministas nuevas de notas, sesiones, media, límites diarios/DST, persistencia y exportación; regresiones UI adaptadas a los controles numéricos.
- Sin dependencias ni migraciones SQL. Auth, sincronización, RLS, Storage, FSRS, editor de Material y transporte offline se reutilizan.

---

# CHANGELOG — OpoGC

## 14.3.0 · 29 de octubre de 2026 — Imágenes en Material

- Inserción de una o varias imágenes en el cursor, pegado de archivos del portapapeles y drop de archivos. Se conservan las ediciones realizadas mientras se sube mediante selección mapeada por transacciones.
- Nodo de imagen Tiptap con almacenamiento privado y caché existentes; HTML persistente con referencias estables, sin blobs ni base64 en settings.
- Tamaño relativo, alineación, descripción alternativa, quitar/deshacer y lectura. La imagen elegida sigue siendo el destino de sus controles aunque un selector o panel tome el foco.
- Sanitización de referencias; se retiran URLs/scripts y etiquetas de imagen externas no registradas.
- Copias portátiles incluyen imágenes de Material y restauran su propietario; HTML exportado incorpora los bytes. No cambian los formatos de copia ni los IDs de nodos/tarjetas.
- Sin dependencias nuevas, SQL, configuración de Supabase, cambios de Auth, RLS, sincronización, FSRS o sesiones. Se conserva la corrección del cursor v14.2.1.


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
