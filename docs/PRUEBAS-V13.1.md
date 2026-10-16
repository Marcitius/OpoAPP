# Pruebas ejecutadas — OpoGC v13.1

16 de octubre de 2026. Se parte del ZIP completo v13 entregado anteriormente. No se ha modificado el repositorio remoto ni se ha usado la cuenta real del usuario. docs/PRUEBAS.md corresponde a la entrega anterior v13; este documento registra la validación nueva.

| Comprobación | Resultado |
| --- | --- |
| npm run build | Correcto; Next 16.2.6 con webpack, exportación out; comprobación TypeScript de Next correcta |
| npm run typecheck | Correcto; incluye las pruebas TypeScript |
| npm test | 51 aprobadas: 7 SQL/RLS/Storage, 9 datos/offline, 12 memoria, 7 estudio, 11 colecciones/selección y 5 acciones de sesión nuevas |
| node --import tsx tests/session-actions.test.ts | 5 aprobadas, repetidas tras ajustar los tipos de las pruebas |
| Suite completa Playwright | 56 aprobadas, 0 fallidas, 0 inestables, 0 omitidas: 43 anteriores y 13 nuevas |
| Protección de base existente | 13 archivos críticos y 21 funciones conservados; excepciones históricas v12 explícitas en el script |
| Parche incremental | Archivos nuevos/modificados comparados por bytes contra el ZIP v13; comprobación de CRC y reconstrucción de los archivos de producción |

## Cobertura nueva de lógica y persistencia

- La edición aplica solo campos de contenido y conserva el scheduling más reciente, IDs y contadores recibidos mientras se editaba.
- Retirar de una colección conserva la tarjeta, historial y pertenencias a otras colecciones; retira tanto tarjetas nuevas como refuerzos pendientes de esa sesión.
- Retirar la última termina sin inventar ratings; una sesión de otra colección y las sesiones antiguas sin origen permanecen compatibles.
- Edición, retirada y checkpoint con origen persisten usando IndexedDB y cola reales tras una nueva lectura.

## Trece pruebas nuevas de navegador

- Edición en directo a 390×844 y 1366×768: guardar sin valorar ni avanzar, salir, recargar, retomar y seguir valorando; guardado con conexión simulada como offline.
- Cancelar la edición conserva el contenido y la tarjeta actual.
- Quitar desde el menú de sesión, finalizar al quedar vacía y conservar el resultado tras recarga.
- Mantener colección de origen al reabrir; retirada individual desde la lista también actualiza la sesión guardada.
- Biblioteca con selección de ramas y cada uno de los cinco modos: Aprender, Aleatorio, En orden, Más falladas y Repasos pendientes. Más falladas se verifica tras generar un error real en la sesión de pruebas.
- Selector desde Estudiar, cierre sin iniciar y selector de colección que conserva el origen.
- Retirar una tarjeta ya fallada y continuar con la siguiente a 768×1024; conserva el intento y la pertenencia a Mal mientras se retira de Regular.
- Selección mixta a 430×932: elegir ortografía y modo aleatorio sin mezclar las demás tarjetas.
- Apertura sin enfocar automáticamente inputs/textarea/contenteditable y sin desbordamiento horizontal en el selector a 360×800.

Las 43 pruebas anteriores vuelven a cubrir ocho tamaños (360/390/412/430 px, iPad vertical y horizontal, desktop 1366×768 y 1920×1080), navegación y capas, 50 tarjetas consecutivas, formularios, árbol profundo, cambios de orientación, todos los tipos de tarjeta, organización, importación, movimientos, datos offline y caché PWA de producción.

## Entorno y límites

Chromium 138.0.7204.0 headless, navegador externo al proyecto. Comando ejecutado: CHROMIUM_EXECUTABLE=/tmp/opogc-chromium npm run test:ui. No se añade dependencia de navegador a package.json. Las pruebas UI usan componentes reales con una cuenta sintética aislada y persistencia IndexedDB real. El test de producción PWA sirve out sin credenciales Supabase y verifica caché/configuración; no sustituye una sesión real instalada.

No se han probado esta vez Auth contra el servidor real, Realtime entre dispositivos físicos, subida de cola a tu Supabase, Storage remoto, Safari/iPhone/Android físicos, teclado real ni instalación standalone autenticada. RLS/Storage se ejecutan con las migraciones existentes en PGLite y roles simulados. No se ha publicado la actualización ni validado la mezcla actual de archivos de GitHub. No hay cambios de algoritmo FSRS, SQL, Auth o motor de sincronización.

Detalle de las 56 pruebas: RESULTADOS-V13.1.json.
