# Validación ejecutada — OpoGC v14

24 de octubre de 2026. Base funcional v13.2.1 entregada; comparación adicional con el commit de OpoAPP inspeccionado para incluir los archivos anteriores ausentes. No se ha desplegado ni escrito en el repositorio remoto.

| Comprobación | Resultado final |
| --- | --- |
| npm run typecheck | Correcto; código y pruebas TypeScript |
| npm test | 78 aprobadas, 0 fallidas: 68 anteriores y 10 nuevas de Material |
| npm run build | Correcto; Next 16.2.6, webpack, TypeScript y exportación estática out |
| Suite completa Playwright | 80 aprobadas, 0 fallidas, 0 inestables, 0 omitidas: 64 anteriores y 16 nuevas |
| Texto real adjunto | Importación completa, 28 títulos y comparación del texto íntegro del documento renderizado con el HTML convertido; cierre y reapertura correctos |
| Base crítica | 16 archivos idénticos por bytes a v13.2.1, incluidos Auth, sincronización, almacenamiento, FSRS, memoryModel, migraciones y generador PWA |
| Dependencias anteriores | Ninguna versión ya existente en package-lock cambia; se añaden las del editor/conversor |
| Parche | Inventario/hashes respecto al commit inspeccionado, CRC y contenido de cada archivo incluidos comprobados |

Se adjunta RESULTADOS-V14.json con grupos y títulos individuales de navegador. Se ejecutó la suite final completa sin reintentos. Durante el desarrollo se corrigieron las esperas de algunas pruebas heredadas: verificaban el motor o recargaban antes de completar la transacción local. Las aserciones siguen comprobando los mismos datos y persistencia; no se modifica la lógica de sesiones para hacerlas pasar.

## Diez pruebas nuevas de lógica/datos

Markdown: títulos, marcas, listas anidadas, tablas, citas, separadores y Unicode; listas alfabéticas/viñetas escapadas y asteriscos literales. Pegado HTML con estilos y celdas combinadas. Saneamiento contra scripts, atributos ejecutables, medios remotos y estilos de posicionamiento. Árbol independiente: crear, mover con descendientes, impedir ciclos, reordenar y eliminar sin tocar tarjetas/temario/repasos. Copia idempotente de Biblioteca y conservación del orden. Rechazo de edición atrasada. Proyección navegable ante movimientos offline conflictivos. Persistencia IndexedDB/outbox, lectura tras reabrir, proyección remota simulada, mezcla de copia de seguridad y separación por cuenta.

## Dieciséis pruebas nuevas de navegador

- Siete tamaños para crear, pegar Markdown, leer, guardar, recargar y reabrir desde Biblioteca: 360×800, 390×844, 430×932, 768×1024, 1024×768, 1366×768 y 1920×1080. Sin desbordamiento horizontal ni foco automático de campos.
- Formato real en el editor: negrita, fuente/tamaño, alineación/interlineado, sangría por botón y Tab/Mayús+Tab, insertar tabla, añadir fila y deshacer una operación.
- Copia previsualizada de Biblioteca sin duplicados ni cambios en tarjetas/carpetas; crear, renombrar y subir un nivel.
- Pegado HTML con subrayado, color, tamaño y colspan; exportación HTML y persistencia con conectividad simulada offline.
- Versión recibida mientras hay borrador local: conservar las dos mediante guardar copia.
- Traspaso de documento con títulos/negritas entre dos contextos de navegador aislados mediante transporte remoto simulado.
- Importación del TXT real de 31.515 bytes: sus 28 títulos se conservan, se compara íntegramente el texto del DOM con el texto del HTML convertido y se reabre correctamente. Este archivo privado se suministra a la prueba mediante OPOGC_SOURCE_TEXT y no se incluye en el ZIP/proyecto.
- Recarga antes del autoguardado: se comprueba el borrador en IndexedDB y se recupera al abrir el documento.
- Eliminación remota durante edición: recuperar el borrador como otro documento.
- Fallo de guardado simulado: mantener el texto visible y local, reintentar y reabrir sin pérdida.

Las 64 pruebas anteriores vuelven a cubrir todos los tipos de tarjetas, 69 tarjetas con refuerzo, sesión reanudable, colecciones, filtros, movimiento/reordenación de ramas, importaciones, planificación, Bien/Regular/Mal con nota, psicotécnicos, backup, PWA/offline, árbol profundo, ocho tamaños/orientación y capas/foco.

## Entorno y límites reales

Node 24; Chromium 138 headless con Playwright, navegador externo a las dependencias del proyecto. Comando ejecutado: OPOGC_SOURCE_TEXT=<ruta del adjunto> CHROMIUM_EXECUTABLE=/tmp/opogc-material-chromium npm run test:ui. Para repetir en otro entorno: instala Chromium con Playwright y usa npm run test:ui; sin OPOGC_SOURCE_TEXT se ejecutan las otras 79 pruebas. La prueba del adjunto es condicional para no distribuir su contenido.

Las pruebas de aplicación utilizan componentes reales con cuenta sintética, IndexedDB/proyección reales y un motor de fixture; el transporte remoto se simula. SQL/RLS/Storage se comprueban con las migraciones existentes en PGLite y roles de prueba. No se ha probado la sincronización de estos documentos contra tu Supabase real, ni Safari/Android/iOS físicos o teclado físico. Las comprobaciones de teclado/viewport son de navegador automatizado. No se han solicitado credenciales, ejecutado migraciones ni cambiado el servidor. El diálogo real de impresión/PDF no se automatizó; sí se comprueba la descarga HTML. Los paquetes son locales y se empaquetan con la PWA; no se usan servicios externos para generar el contenido.
