# Análisis del original y cambios de OpoGC 10

## Qué incluía el ZIP

- `app/OpoApp.tsx`: 231.961 bytes, componente React con TypeScript y directiva `use client`. Navegación Hoy/Biblioteca/Estudio/Psicotécnicos/Progreso, modales y lógica de negocio en el mismo componente.
- `app/globals.css`: 116.144 bytes, estilos, múltiples media queries, safe areas y correcciones previas de capas.
- `app/LocalDataManager.tsx`: 21.650 bytes, exportación/importación y botones manuales de nube.
- `public/version.json` y `LEEME-V9.17.2.txt`.
- No incluía package.json, página/layout, manifest, Service Worker, APIs, configuración de compilación, SQL ni varios componentes importados. Por tanto, el ZIP original no era ejecutable de forma autónoma.

El patrón `app/`, TypeScript y los componentes existentes corresponden a React/Next. Se mantiene esa familia, sin migrar a otro framework. Se recuperó el editor de PDF y recursos PWA del proyecto OpoGC disponible en el entorno; los componentes auxiliares que no estaban en ninguna de esas fuentes se completaron respetando los contratos de `OpoApp`.

## Almacenamiento anterior, según el código entregado

`OpoApp` leía `/api/state` al abrir y guardaba la representación completa con PUT tras un debounce de 350 ms. `LocalDataManager` utilizaba ese mismo endpoint y la cabecera `x-opogc-force-cloud` para descargar/subir una copia completa. Fusionaba IDs de tarjetas, respuestas, psicotécnicos, árbol y tareas, pero necesitaba una acción manual. El ZIP no incluía la implementación del endpoint, por lo que no permite afirmar qué IndexedDB o base de datos concreta tenía desplegada esa versión.

La nueva migración inspecciona localStorage, bases IndexedDB identificables como OpoGC y cachés de `/api/state`, sin asumir que una URL nueva puede leer el almacenamiento del dominio antiguo.

## Modelo funcional conservado

| Parte | Funcionamiento |
|---|---|
| Temario | Nodos con ID y parentId, raíces múltiples y profundidad arbitraria; importación español/inglés y texto indentado; edición, movimiento, selección y borrado de ramas. |
| Registro de estudio | Tareas por nodo, fecha, razón y nota; orden, aplazamiento, valoración Bien/Regular/Mal y comentario posterior; historial y exportación. |
| Biblioteca | Carpetas/subcarpetas, tarjetas básicas, vocabulario, test de respuesta múltiple, ortografía y respuestas escritas con rúbrica; movimientos individuales y por selección. |
| Repaso | Modos recomendado, aleatorio, todos, aprender y más falladas; refuerzo de errores; programación FSRS y valoración escrita por criterios. |
| Psicotécnicos | Documento, categoría, intentos independientes, notas, aciertos/fallos/blancos, tiempo, resultados y gráficos. |
| Progreso | Actividad, precisión, tarjetas dominadas, ortografía, rachas y seguimiento semanal. |
| Responsive | Se conservan CSS y bloqueo de capas de 9.17.2; se amplían a Cuenta/Auth y se evita desplazamiento horizontal de fondo. |

El ZIP no aportó las implementaciones originales de `fsrs`, `memoryModel`, `RichTextEditor`, `CardImage`, `CardImportModal` ni `OrthographyStudy`. No es posible certificar identidad exacta de los algoritmos omitidos. Se usa la librería real `ts-fsrs` y se conserva la estructura de campos FSRS existente; el ajuste personal añadido es una calibración sencilla basada en respuestas anteriores, no entrenamiento de IA. Las variantes de importación y rúbricas siguen los tipos y campos que consume el componente original. Los datos y algoritmos disponibles en `OpoApp` permanecen en su código.

## Cambios implementados

1. Proyecto completo con dependencias fijadas en lockfile, comandos, Next export, TypeScript y fuente local.
2. Auth real con correo/contraseña, registro, sesión persistente, cierre por dispositivo, recuperación y cambio de contraseña.
3. Tablas relacionales por entidad; JSONB se usa por **registro** para mantener campos compatibles de la versión anterior, con columnas y claves foráneas para las relaciones. No se almacena un archivo JSON de toda la cuenta como backend.
4. RLS en todas las tablas y políticas privadas de Storage. El RPC asigna siempre `auth.uid()` como propietario y limita los nombres de tabla a una lista cerrada.
5. Cola duradera de operaciones por usuario en IndexedDB. Caché y operaciones se guardan en la misma transacción.
6. Actualización por campos, lotes atómicos, IDs de operación idempotentes, revisiones de servidor y borrado lógico.
7. Cada intento psicotécnico, respuesta de tarjeta y sesión de estudio tiene un registro individual. Dos resultados de la misma tarea desde dispositivos distintos quedan en sesiones separadas.
8. Comentarios rápidos y comentarios del historial actualizan la sesión correspondiente; no sustituyen otra sesión.
9. Avisos Realtime sobre un registro pequeño por cuenta, lectura incremental y reintento al volver a primer plano/red; respaldo periódico de 30 segundos.
10. Peticiones ligadas al JWT de su cuenta; la cola de A nunca se ejecuta con el token de B al cambiar de usuario.
11. Migración de copias anteriores por ID/huella, comprobación de referencias/ciclos y mantenimiento de datos originales.
12. Sustitución de los botones de nube por Cuenta y copia de seguridad. Las copias nuevas incluyen archivos disponibles y anotaciones.
13. PDFs e imágenes en bucket privado, caché por cuenta, anotaciones por trazo y subidas reanudables para archivos grandes.
14. Hoy incorpora temario pendiente, prioridad por últimos resultados y sugerencias de nodos aún no estudiados.
15. Corrección de fecha local para el resumen del día; eliminación del límite de 20 registros en el export de estudio y de 100 registros al mostrar historial.
16. Manifest, iconos PNG/maskable/iOS, precache de recursos compilados, funcionamiento offline y actualización sin borrar datos privados.
17. SQL, guía exacta de Supabase/Auth/Cloudflare y pruebas locales más script de integración real.

La reducción de 100 MB a 50 MB por archivo responde al máximo de Storage en Supabase Free. No se eliminan tarjetas o temarios automáticamente y las cuentas nuevas empiezan vacías, sin insertar contenido de demostración.

## Conflictos

Los eventos con IDs distintos se añaden. Para ediciones de un mismo registro, solo se envían los campos modificados; los cambios en campos diferentes se fusionan. Si dos dispositivos editan el mismo campo, gana la última operación recibida por el servidor, y ambas se conservan en `operation_receipts`, con una marca `conflict`. Los relojes de los dispositivos no deciden el orden de las ediciones. Los borrados prevalecen sobre ediciones posteriores de copias antiguas; importar de nuevo un ID borrado no lo resucita. Para recuperarlo explícitamente debe generarse un nuevo ID.

FSRS es una proyección de planificación: su última escritura decide la próxima fecha si llegan valoraciones concurrentes. Las respuestas individuales siempre se conservan y los contadores visibles se completan desde ese historial. No se aplica aún una reconstrucción global del calendario de tarjetas a partir de todos los eventos, ni un algoritmo nuevo de repetición espaciada del árbol.

## Estructura final

```text
app/                 interfaz de estudio conservada y auxiliares
components/          cuenta, contexto y ciclo PWA
lib/auth/            cliente público de Supabase
lib/data/            modelos, IndexedDB, proyecciones, importación y archivos
lib/sync/            outbox, reintentos, pull incremental y Realtime
supabase/migrations/ esquema PostgreSQL, RLS, RPC y Storage
scripts/             compilación PWA y prueba contra Supabase real
public/              manifest, iconos, PDF.js y cabeceras Cloudflare
out/                 frontend de producción, recompilar con las variables reales
 tests/              pruebas de datos y fixtures exclusivas de componentes
```

No se ha creado ni publicado una cuenta o proyecto Supabase/Cloudflare. El código requiere configurar el backend siguiendo README. Tampoco se ha afirmado que el correo o Realtime hayan pasado pruebas contra un proyecto externo no suministrado.

Si dos movimientos concurrentes producirían un ciclo, PostgreSQL conserva el árbol válido. La app retira el lote de movimientos rechazado de los reintentos, lo conserva como `rejectedOperations` en la copia de seguridad, recupera el árbol del servidor y muestra el motivo. No se bloquea el envío de los siguientes registros de estudio. Una proyección local temporal tampoco deja un ciclo que pueda romper la navegación.
