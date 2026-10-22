# Pruebas ejecutadas — OpoGC v13.2

22 de octubre de 2026. Base: ZIP completo v13 más parche v13.1 entregados. Trabajo sobre esa aplicación real; no se ha modificado ni desplegado el repositorio remoto ni se ha usado una cuenta real del usuario.

| Comprobación ejecutada | Resultado final |
| --- | --- |
| npm run typecheck | Correcto, incluye código y pruebas TypeScript |
| npm test | 64 aprobadas, 0 fallidas: 7 SQL/RLS/Storage, 9 datos/offline, 12 memoria, 7 estudio, 11 colecciones/selección, 5 acciones de sesión y 13 checkpoint/cola |
| npm run build | Correcto, Next 16.2.6 con webpack, TypeScript de Next y exportación estática out |
| Suite completa Playwright | 64 aprobadas, 0 fallidas, 0 inestables y 0 omitidas |
| Protección histórica | check-preserved: 13 archivos críticos y 21 funciones conservados; excepciones históricas v12 explícitas |
| Comparación adicional sobre v13.1 | 16 archivos críticos idénticos por bytes, incluidos FSRS, memoryModel, Auth, sincronización, persistencia, migraciones y generador PWA |
| ZIP incremental | Comparación de nuevos/modificados contra v13.1, CRC, hashes de contenido y reconstrucción del proyecto sobre la base; sin archivos eliminados |

Los resultados enumerados son de la ejecución final completa. Durante el desarrollo se corrigieron las pruebas de navegación para usar Biblioteca y Más → Temario y planificación, los casos que ahora requieren finalizar antes de otra sesión, y esperas de finalización de transacciones/recarga antes de leer el estado. No se omiten esas pruebas ni se usan reintentos para declarar un resultado satisfactorio. El detalle de títulos/estados se adjunta en RESULTADOS-V13.2.json.

## Cobertura de la cola y persistencia

- Bien y Fácil terminan la tarjeta en la sesión aunque FSRS siga en Learning; el vencimiento FSRS se conserva.
- Difícil tiene una comprobación posterior; fallos repetidos terminan como débiles con un máximo de tres intentos. Se preservan historial, FSRS y próximos vencimientos.
- Separación por tarjetas distintas; ni una pausa de cinco minutos ni otra de dos días la evitan. No se repite inmediatamente la última. Contenido sin ver avanza con cuota protegida.
- Selección de 69: prueba determinista con fallos y pausas largas, y prueba UI completa con 70 valoraciones (69 tarjetas únicas, una fallada y reforzada). Tras Bien no vuelve a aparecer esa tarjeta.
- Caso de una única tarjeta fallada: concluye pendiente de refuerzo, sin bucle ni recuperación inventada.
- Repetición consistente y crecimiento de intervalos, Hard antes de Good/Easy y fallo tras intervalo largo: se mantienen las pruebas deterministas del adaptador FSRS existente.
- Saltar no crea ratings; duplicados y vistas atrasadas no sobreescriben respuestas.
- Adopción de checkpoint antiguo sin cambiar IDs, intentos ni historial.
- Checkpoint en IndexedDB/outbox real: recarga, cara visible, borrador escrito, opciones múltiples y cola. Guardado con conectividad simulada offline.
- Dos contextos de navegador aislados: desktop → móvil → desktop, usando la proyección y persistencia existentes con transporte remoto simulado. Se retoma exactamente tarjeta/cara y no se duplica el rating; un cierre remoto cierra la vista antigua.
- Marcador independiente de cierre contra una instantánea offline atrasada. Aislamiento de checkpoint entre cuentas locales de prueba.
- Contenido borrado mientras está pausada: se omiten referencias obsoletas sin borrar ratings.
- Ortografía conserva sus pasos y espera temporales; la UI y la corrección existentes siguen pasando.

## Cobertura de interfaz y regresiones

Ocho tamaños: 390×844, 430×932, 360×800, 412×915, 768×1024, 1024×768, 1366×768 y 1920×1080. Navegación principal con Biblioteca a una pulsación, temario desde Más, safe areas/configuración CSS, barra inferior/lateral, scroll, overlays, formularios, doce niveles, orientación y altura visual de teclado simulada.

Pasan también creación/edición de tarjetas, edición en directo sin alterar memoria, retirada de colecciones, los cinco modos de selección, selección mixta con ortografía, todos los tipos actuales, estudio Bien/Regular/Mal con nota y siguiente automático, planificación, movimientos de ramas/grupos, importación Biblioteca → temario, exportación/validación de copia, psicotécnicos y cuenta vacía sin reiniciar ni introducir semillas.

El test PWA sirve el out de producción y verifica manifest, iconos, Service Worker y recarga offline. No equivale a una PWA autenticada instalada en un dispositivo físico. Los formularios y la reanudación de respuesta escrita se abren sin enfocar automáticamente campos; se comprueba foco DOM y no un teclado físico.

## Entorno y límites

Node 24, Chromium 138 headless externo al proyecto, Playwright. Comando: CHROMIUM_EXECUTABLE=/tmp/opogc-v132-chromium npm run test:ui. No se añade un navegador a las dependencias del proyecto. Las pruebas usan componentes reales, cuenta sintética y IndexedDB real. SQL/RLS/Storage se prueban con las migraciones existentes en PGLite y roles simulados.

No se han ejecutado aquí inicio/persistencia de sesión de Auth contra tu Supabase, Realtime en dispositivos físicos, envío de tu cola offline al servidor real, Storage remoto, Safari/iOS/Android físicos, teclado físico ni instalación standalone autenticada. El traspaso entre contextos es una simulación local del transporte, no una conexión real a Supabase. Esas comprobaciones requieren tu despliegue y dispositivos. No se han cambiado sus componentes de backend ni solicitado credenciales.
