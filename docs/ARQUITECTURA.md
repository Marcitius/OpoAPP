# Arquitectura — OpoGC v11 - Mobile UX

La UI conserva el AppState anterior como una proyección de datos. La autoridad central es PostgreSQL; IndexedDB conserva los registros descargados y operaciones pendientes por cuenta.

| Colección | Tabla | Relación |
|---|---|---|
| Perfiles | profiles | auth.users |
| Oposiciones | competitions | usuario |
| Temarios | syllabi | oposición del mismo usuario |
| Árbol | syllabus_nodes | temario y nodo padre del mismo usuario |
| Estado | node_states | nodo |
| Planificación | study_tasks | nodo |
| Sesiones/historial/valoración | study_sessions | tarea y nodo |
| Notas de estudio | note/completionNote de tarea y sesión | registro de estudio concreto |
| Biblioteca | folders, cards | padre/carpeta |
| Respuestas | card_reviews | tarjeta |
| Psicotécnicos | psych_tests, psych_attempts | test |
| Anotaciones | annotations | archivo, página y trazo |
| Configuración | user_settings | clave individual |
| Diario | operation_receipts | usuario + op_id |
| Aviso de cambios | sync_heads | usuario |

Los IDs de entidades son texto para conservar IDs antiguos, y los de operación son UUID. Hay created_at, updated_at, revision y deleted_at en registros sincronizables. Los campos propios de cada función se mantienen en JSONB individual; las relaciones son columnas generadas e índices con claves foráneas compuestas `(user_id, id)`, diferibles para importar árboles completos en una transacción. Nuevas oposiciones y temarios se pueden añadir al modelo; la UI actual usa el espacio predeterminado y raíces arbitrarias.

`apply_operations` es un RPC SECURITY DEFINER con search_path vacío, lista cerrada de colecciones, comprobación de sesión, propiedad impuesta por auth.uid, claves foráneas por propietario, bloqueo transaccional de la cuenta y validación de ciclos. Los clientes no reciben privilegios de escritura directa sobre las tablas centrales. Las lecturas directas y el RPC SECURITY INVOKER `pull_changes` pasan por RLS. El RPC no acepta que el usuario cambie la propiedad ni la revisión del servidor.

El outbox se mantiene aunque falle una petición, caduque el token, se recargue la app o se cierre sesión. La eliminación del pendiente ocurre solo tras recibir un recibo confirmado; repetir la misma operación no duplica eventos. Una operación lógica conserva su grupo de transacción para no dividir una importación con padres/hijos. Los límites de lote del servidor son 50.000 operaciones y 25 MB de JSON; una importación mayor requiere separar copias independientes o ampliar el diseño antes de ese volumen.

Realtime solo comunica que hay cambios. No transmite el AppState ni es la única vía de recuperación: las revisiones permiten descargar lo ocurrido durante una desconexión. El polling consume poco tráfico cuando no hay cambios. No se sincroniza en segundo plano cuando el sistema suspende la PWA, y no se garantiza una latencia concreta del proveedor.

Los archivos se descargan por Storage con token y RLS y se convierten en blob URL local. Las URLs firmadas no se persisten como permisos portátiles. El bucket no es público. La caché de blobs está separada por usuario y las URLs se revocan al cambiar de sesión. Añadir archivos requiere red; las anotaciones y archivos descargados funcionan offline. El Service Worker no almacena respuestas Auth ni de base de datos.

Un ciclo causado por movimientos concurrentes se rechaza en PostgreSQL. La app conserva ese lote en rejectedOperations local y en el backup, recupera el último árbol válido y continúa enviando los siguientes registros.


## Capa de interfaz v11

`OpoApp` sigue coordinando el AppState existente y el motor proporcionado por `SyncContext`. Los componentes visuales reciben datos y callbacks: no abren clientes Supabase propios, no cambian el modelo de cuenta y no escriben directamente en PostgreSQL.

| Carpeta | Responsabilidad |
|---|---|
| components/navigation | Cinco destinos y acciones secundarias de Más. |
| components/today | Acciones directas, prioridades y contadores diarios. |
| components/study | Selector rápido, sesión secuencial, árbol progresivo y editores existentes. |
| components/review | Inicio del repaso y representación inmersiva de tarjetas. |
| components/library | Acciones y formularios de tarjetas/carpetas. |
| components/progress | Información útil, gráficos existentes y ortografía. |
| components/psych | Formularios existentes de tests e intentos. |
| components/account | Cuenta y preferencias como ajustes. |
| components/sheets | Panel inferior y adaptación de formularios antiguos. |
| components/shared | Iconos SVG, viewport visual, portal y widgets existentes. |
| lib/study/legacy.ts | Tipos y utilidades trasladados; cálculo y lógica conservados. |

La sesión de estudio mantiene una cola temporal de IDs de nodos/tareas. Al terminar, una sola llamada al `engine.update` existente guarda valoración, nota y evento con ID único. Se avanza tras la escritura local durable; el motor original se encarga del envío offline/online. La cola temporal no es una tabla nueva. Una tarea planificada completada sigue usando el mismo ID; un estudio libre añade un registro normal del modelo ya existente.

`sortOrder` es un atributo opcional de los datos JSONB ya sincronizados de `syllabus_nodes`. Cambiar el orden edita cada nodo mediante operaciones normales. Los nodos anteriores conservan el orden original mientras no sean reordenados. La navegación, exportación del árbol y selección de estudio leen ese orden.

Auth, Storage, sync y SQL se verifican con `npm run check:preserved`. Las huellas se calcularon contra el ZIP v10 original, no contra una versión modificada. Los componentes Auth/Supabase y su gestión de sesión no se trasladan ni reescriben.

La PWA conserva el generador y patrón de caché de v10: solo los recursos de aplicación reciben una nueva revisión. No se cambian las claves de IndexedDB ni el formato de copia de seguridad. El número 10 que aparezca internamente no indica que falte la actualización visual.
