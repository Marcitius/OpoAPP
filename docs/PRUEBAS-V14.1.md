# Validación ejecutada — OpoGC v14.1

26 de octubre de 2026. Parche sobre el código v14 entregado. No se ha desplegado ni escrito en GitHub.

| Comprobación final | Resultado |
| --- | --- |
| npm run typecheck | Correcto, aplicación y pruebas |
| npm test | 85 aprobadas, 0 fallidas: 78 anteriores y 7 nuevas |
| npm run build | Correcto: Next 16.2.6, webpack, TypeScript y exportación estática out |
| Suite completa Playwright | 89 aprobadas, 0 fallidas, 0 inestables, 0 omitidas; un intento por prueba en la ejecución final |
| Pruebas nuevas de navegador | 9 aprobadas: siete tamaños, offline y dos contextos de dispositivo |
| Memorización y backend | 26 archivos críticos/de Material idénticos por bytes a v14; incluye FSRS, memoryModel, cola intrasesión, cola de ortografía, Auth, motor offline/sync, migraciones y generador PWA |
| Dependencias | Mismos 400 registros de dependencias del lockfile; solo cambian versión raíz y script de pruebas |
| Revisión visual interna | Lista de sesiones a 390×844 y 1366×768, con nombres largos; sin capturas personales ni capturas dentro del parche |
| ZIP | Solo archivos nuevos/modificados respecto a v14; CRC y hashes verificados |

## Sesiones verificadas

- Adopción del checkpoint único anterior sin perder ID, cola, respuesta ni historial; varias sesiones sin duplicar la anterior.
- Creación de otra selección conservando la primera; progreso y valoraciones independientes, incluidas tarjetas compartidas.
- Elegir cualquiera desde la lista; tarjeta/cara revelada, respuesta escrita y opciones restauradas sin foco automático de texto.
- Salir, recargar y retomar; guardado con desconexión, cola local real e IndexedDB reabierta.
- Finalizar una sesión elegida conserva otra; un cierre no se revierte con un checkpoint atrasado.
- Sesiones completas guardadas hasta finalización expresa; creación de 21 sesiones en prueba de lógica, sin límite artificial de una.
- Actualizaciones offline de sesiones distintas generan registros distintos y se conservan al recibir cambios remotos.
- Dos contextos de navegador: crear otra sesión no interrumpe la abierta; continuar y cerrar una no altera la distinta; historial sin duplicados en el traspaso secuencial.
- Retirar de una colección limpia todas sus sesiones, sin borrar tarjetas ni historial ni otras sesiones.
- Serialización de copia de seguridad y aislamiento entre cuentas en IndexedDB.

Tamaños de sesiones: 360×800, 390×844, 430×932, 768×1024, 1024×768, 1366×768 y 1920×1080. La suite existente también comprueba navegación, repasos consecutivos, modos, temario, organización, importación, Material con el TXT íntegro adjunto, editor, overlays, PWA y recarga offline del shell de producción.

## Incidencia de la revisión y límites

La primera ejecución completa detectó una carrera en la prueba antigua de arrastre: boundingBox/mouse se ejecutaban durante la animación de entrada. Se añadió una espera al final de la animación en esa prueba, conservando el gesto y la aserción de cierre. La ejecución final completa pasó sin reintentos. No se modificó la implementación del bottom sheet. Dos pruebas antiguas también se adaptaron al requisito nuevo: ya no se exige cerrar la sesión anterior para crear otra.

Los traspasos entre dispositivos se simulan con la proyección real y dos contextos aislados; no se ha probado en esta iteración el transporte real de Supabase, dos cuentas autenticadas, la persistencia de Auth en una PWA física ni Safari/iPhone/Android reales. El teclado se comprueba mediante foco y viewport reducido, no mediante un teclado físico. No se ha modificado esa infraestructura. La misma sesión editada simultáneamente sin conexión conserva la política de conflictos existente, sin bloqueo distribuido nuevo.

Resultados por prueba: RESULTADOS-V14.1.json.
