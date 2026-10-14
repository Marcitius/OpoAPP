# Pruebas ejecutadas — OpoGC v13

14 de octubre de 2026. Base: OpoGC-v12-Memoria-y-Estudio(1).zip. La copia final se reconstruyó después de una desconexión/mantenimiento del entorno y se volvió a validar. No se accedió a la cuenta real ni se publicó en Cloudflare.

| Comprobación | Resultado |
| --- | --- |
| npm ci --no-audit --no-fund | Correcto; dependencias desde package-lock.json |
| npm run typecheck | Correcto |
| npm test | 46 aprobadas: 7 SQL/RLS/Storage + 9 datos/offline + 12 memoria + 7 estudio + 11 colecciones/selección/progreso |
| npm run build | Correcto; Next 16.2.6, exportación estática out |
| Suite completa Playwright | 43 aprobadas: 25 anteriores + 5 v12 + 13 v13 |
| check:preserved | 13 archivos críticos y 21 funciones conservados respecto a las huellas históricas v10 |
| Comparación directa con v12 | 20 archivos centrales idénticos; detalle en v13-base-integrity.json |

## Cobertura

- Guardar desde la pregunta, antes de responder, no modifica tarjeta ni rating. Guarda offline y permanece tras responder bien, cerrar y recargar.
- Crear, renombrar, borrar colecciones y retirar pertenencias expresamente. Una predeterminada eliminada no reaparece al abrir.
- Filtrar por ramas y descendientes, varias raíces, búsqueda sin tildes y apartados enlazados. Progreso respeta el ámbito.
- Seleccionar padres/hijos/tarjetas entre niveles y mover a otra rama sin pérdida de IDs, relaciones, contenido, memoria, historial ni planificación.
- Movimiento de varias tarjetas filtradas y movimiento a raíz mediante carpeta válida/reutilizable. Rechazo de ciclos y destinos inexistentes sin cambios parciales.
- Persistencia de pertenencias/movimientos en IndexedDB y outbox reales; simulación de asignaciones de dispositivos distintos, aislamiento local de cuentas y backup/import.
- FSRS: tarjetas nuevas, fallos repetidos, esperas espaciadas, intervalos, lapsos de maduras, ratings y checkpoint al cerrar.
- Temario crear/editar/mover/reordenar/eliminar; planificación Hoy/Después/Repasos; Bien/Regular/Mal con nota y siguiente automático.
- Todos los tipos actuales de tarjeta, edición/importación, búsqueda, ortografía, psicotécnicos e intentos.
- Foco inicial en contenedores, input editable al tocar, sin foco automático de texto. Tab/Escape de la capa superior, paneles anidados e imagen/PDF sobre formularios.
- 50 tarjetas consecutivas, árboles de doce niveles, tarjetas largas, orientación y viewport reducido para el espacio disponible con teclado.
- Manifest, iconos, Service Worker y caché sobre build sin variables Supabase; recarga offline de la pantalla de configuración.

## Tamaños y entorno

Chromium 153 headless: 390×844, 430×932, 360×800, 412×915, 768×1024, 1024×768, 1366×768 y 1920×1080; orientación a 844×390. Comprobaciones de overflow, navegación, scroll, overlays y foco. Capturas reales del navegador con datos sintéticos aislados.

En este entorno se usó un Chromium externo al proyecto: `CHROMIUM_EXECUTABLE=/tmp/opogc-v13-chromium npm run test:ui`. No se añadió esa dependencia al paquete. En tu PC: `npx playwright install chromium` y `npm run test:ui`.

## Límites

No se han ejecutado Auth/persistencia contra tu Supabase, Realtime PC↔iPhone, envío/descarga real de cola offline, Storage remoto ni dos cuentas reales. RLS y Storage se verifican con las migraciones reales en PGLite y roles simulados, no en tu servidor.

Safari/iOS/Android físicos, teclado real e instalación standalone deben comprobarse tras desplegar. El test PWA local sin variables no equivale a una sesión autenticada instalada. El motor y archivos críticos se conservan; no se afirma que las simulaciones sean esas integraciones reales. test:live sigue disponible para dos cuentas de pruebas confirmadas.
