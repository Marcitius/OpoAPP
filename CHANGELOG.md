# CHANGELOG — OpoGC

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
