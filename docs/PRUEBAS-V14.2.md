# Validación ejecutada — OpoGC v14.2

26 de octubre de 2026. Base: proyecto v14.1 entregado. No se ha desplegado ni modificado el repositorio remoto.

| Comprobación | Resultado final |
| --- | --- |
| npm run typecheck | Correcto, aplicación y pruebas |
| npm test | 91 aprobadas, 0 fallidas: 85 anteriores + 6 nuevas |
| npm run build | Correcto, Next 16.2.6 webpack y exportación estática out |
| Suite completa Playwright | 94 aprobadas, 0 fallidas, 0 inestables, 0 omitidas; un intento por prueba en la ejecución final |
| Nuevas pruebas de navegador | 5 aprobadas: carga grande, borrador, error/reintento, multirrespuesta y escritura durante guardado lento |
| Archivos críticos / Material | 25 idénticos por bytes a v14.1, incluidos Auth, SyncEngine, transacciones locales, FSRS, memoryModel, colas, migraciones y generador PWA |
| Proyección local optimizada | Equivalencia con versión v14.1 archivada: 50 cargas, contadores, refuerzos, filas eliminadas; patches, altas, edición, reordenación, borrados, importación y completado de tareas |
| Dependencias | Sin cambios; el lockfile solo cambia la versión raíz |
| ZIP | Archivos nuevos/modificados sobre v14.1; sin borrados; inventario, CRC y hashes verificados |

## Rendimiento medido

Banco sintético: 2.200 tarjetas, 4.000 repasos y unos 13 MB de texto. Tres contextos Chromium nuevos por versión con el mismo fixture instrumentado, React/Vite de desarrollo, IndexedDB y proyección reales. El benchmark comprueba una sesión de respuesta escrita. No mide red de Supabase ni el Mac del usuario.

| Acción | Mediana v14.1 | Mediana v14.2 |
| --- | ---: | ---: |
| Escritura de 18 caracteres a 10 ms programados por tecla | 24,19 s | 0,30 s |
| Comprobar respuesta | 2,55 s | 0,04 s |
| Guardar y continuar | 5,99 s | 0,27 s |

La prueba de regresión grande exige completar la escritura en menos de 2,5 segundos y verifica que no se actualiza la cuenta durante esas pulsaciones. Estos tiempos no son una garantía para otros dispositivos, datos, navegadores ni la compilación de producción. Muestras completas: RENDIMIENTO-V14.2.json. Script reproducible: scripts/benchmark-review.mjs.

## Fiabilidad verificada

- Recuperación del borrador tras recargar antes del checkpoint general (se espera a la transacción local del borrador).
- Escritura nueva durante un checkpoint retenido: rebase de la revisión local y recuperación tras recarga.
- Fallo inducido al guardar una valoración: respuesta conservada, reintento y un único registro de historial.
- Corrección inmediata de multirrespuesta con los valores actuales; 100% en respuesta escrita conocida.
- Borradores separados por cuenta y sesión; rechazo de ID, turno o revisión incompatibles.
- Mismos resultados de ordenación de pendientes; compartir referencias no oculta ediciones, borrados ni reordenaciones.
- Las 89 pruebas anteriores de Material, navegación, varias sesiones, modos, FSRS, ortografía, árbol, Biblioteca, importación, PWA y offline pasan.

Tamaños de las pruebas anteriores conservadas: móviles 360/390/430 px, iPad vertical y horizontal, escritorio 1366×768 y 1920×1080. El TXT original de Material se comprueba íntegro mediante OPOGC_SOURCE_TEXT; no se incorpora como contenido inicial ni al parche.

## Límites e incidencias de desarrollo

No se han utilizado cuentas reales de Supabase ni dispositivos físicos del usuario. Los traspasos se simulan con dos contextos y la proyección real. No se ha probado Safari, el teclado físico de iOS/Android ni Auth en una PWA instalada real en esta iteración. No cambia la política de conflictos existente para respuestas simultáneas offline en la misma sesión.

Durante el desarrollo, la comparación de operaciones detectó timestamps de creación diferentes entre las dos llamadas de prueba. Se excluyeron exclusivamente los metadatos generados (ID, transacción y timestamp) de esa comparación, conservando iguales los patches, base revision, orden y borrados. La protección histórica de corrección se adaptó para aceptar solo la nueva lectura inicial del input ref, conservando el fingerprint del resto del código. La ejecución final pasó sin reintentos.

La primera preparación del benchmark se detuvo y se repitió en una copia aislada de la base para separar las mediciones del desarrollo. Solo las tres ejecuciones completadas de cada versión se incluyen en RENDIMIENTO-V14.2.json.

Resultados de cada prueba: RESULTADOS-V14.2.json.
