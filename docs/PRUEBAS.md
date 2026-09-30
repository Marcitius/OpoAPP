# Pruebas de la entrega — 30/09/2026

## Ejecutadas

| Comprobación | Resultado | Alcance |
|---|---|---|
| TypeScript estricto | PASS | Todos los archivos TS/TSX. |
| Compilación Next producción | PASS | Export completo de frontend. |
| Migración del esquema | PASS | Ejecutada sobre PostgreSQL WASM real (PGlite). |
| Migración y políticas Storage | PASS | SQL ejecutado sobre esquema Storage de prueba y acceso con roles distintos. No prueba una subida HTTP real. |
| Relaciones de árbol y sesiones | PASS | Claves foráneas compuestas, referencias ausentes rechazadas y ciclos con rollback. |
| Aislamiento A/B y anónimo | PASS | SELECT, intentos de escritura/borrado y referencias a otro propietario rechazados por privilegios/RLS y claves foráneas. |
| Dos repasos Bien/Mal | PASS | Dos sesiones y comentarios conservados. |
| Reintento idempotente | PASS | Mismo lote aplicado dos veces sin duplicar sesiones. |
| Ediciones concurrentes | PASS | Parches de campos distintos preservados y conflictos anotados. |
| Borrado + edición antigua | PASS | El registro no se resucita. |
| Caché y outbox local | PASS | Operaciones conservadas al releer IndexedDB y aisladas por cuenta. |
| Dos pestañas locales | PASS | Escrituras transaccionales concurrentes sin borrar operaciones. |
| Token al cambiar de cuenta | PASS | Petición rechaza sesión de otra cuenta y fija Authorization al JWT original. |
| Importación JSON | PASS | Jerarquía, comentarios, configuración y estados completados conservados; padres de sesiones reconstruidos para una cuenta nueva. |
| Responsive y modales | PASS | Chromium: 320×568, 390×844, 412×915, 768×1024, 1024×768, 1366×768 y 1920×1080. Sin overflow de página ni movimiento del documento al abrir/cerrar el modal. |
| PWA y offline del frontend | PASS | Manifest standalone, iconos PNG, Service Worker listo y recarga de producción con red desactivada. |

La suite de datos contiene 16 pruebas: 7 de PostgreSQL/políticas y 9 de proyecciones/persistencia. La suite de navegador contiene 8 pruebas. Las fixtures usadas para inspeccionar los componentes no se incluyen en el frontend de producción.

## Pruebas obligatorias del encargo: alcance real

| Test solicitado | Estado |
|---|---|
| 1. Registro, cierre/reinicio y persistencia en Supabase | Implementado; pendiente de proyecto real. Persistencia SQL/IndexedDB probada. |
| 2. Cambios entre dos sesiones/dispositivos de A | Modelo y fusiones probados; Auth/Realtime externo pendiente. Script test:live incluido. |
| 3. B no accede a A | Aislamiento SQL/RLS/RPC y Storage PASS; validación HTTP con Auth externo pendiente. |
| 4. Bien y posteriormente Mal, ambos en historial | PASS local en PostgreSQL y en la proyección de la UI. |
| 5. JSON y jerarquía/datos compatibles | PASS local. |
| 6. Responsive | PASS en siete viewports Chromium. No se han usado dispositivos físicos ni Safari/WebKit. |
| 7. Instalación PWA | Requisitos y Service Worker/offline PASS; el gesto de instalación en iPhone/Android físico está pendiente. |
| 8. Recarga sin pérdida | PASS en persistencia/outbox local y en caché del frontend. Recarga autenticada contra Supabase real pendiente. |

No se proporcionó un proyecto Supabase, URL, clave pública ni cuentas de prueba. No se afirma que Auth, correo, Storage HTTP o Realtime hayan pasado una prueba externa. `npm run test:live` está preparado para ejecutar la comprobación sobre tu proyecto con dos cuentas desechables. El procedimiento manual con dos dispositivos está en README, apartado 7.

Las pruebas del navegador detectaron un desplazamiento horizontal al enfocar controles antes de abrir un modal. Se corrigió el bloqueo del documento y la reserva de scrollbar en pantallas pequeñas, sin modificar la organización visual de 9.17.2.
