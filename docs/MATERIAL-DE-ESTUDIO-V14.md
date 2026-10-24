# Material de estudio — OpoGC v14

## Flujo

La sección se abre desde Biblioteca o Más. Es un árbol independiente de carpetas/apartados; cada nodo puede contener texto y también subapartados. Se puede abrir directamente su documento con Leer, navegar hacia sus hijos con la fila y volver con Atrás. Busca tanto nombres/rutas como contenido. Las acciones secundarias se abren en un bottom sheet: renombrar, mover a otra rama, subir un nivel, mover arriba/abajo y eliminar una rama previa confirmación.

Copiar estructura de Biblioteca permite seleccionar una rama o toda la Biblioteca y revisar sus rutas antes de confirmar. Copia carpetas y su jerarquía/orden, no tarjetas. Cada copia mantiene una referencia opcional a la carpeta de origen para no duplicarla al volver a copiar y para incorporar nuevas carpetas. La estructura resultante es independiente: puedes cambiar nombres y mover temas sin alterar Biblioteca, tarjetas, planificación o historial. No se actualizan automáticamente los nombres que hayas editado en Material.

## Edición con formato

Se usa Tiptap/ProseMirror, con extensiones de código abierto locales. Se carga al entrar en Material, no al abrir Hoy o una sesión de tarjetas. El editor básico de flashcards sigue intacto.

Herramientas: títulos 1–6 y párrafos, negrita/cursiva/subrayado/tachado, colores/resaltado, fuente/tamaño, alineación e interlineado, listas de viñetas/numeradas/alfabéticas, anidación y sangrías, citas, enlaces, separadores, subíndice/superíndice y deshacer/rehacer. Tab y Mayús+Tab gestionan sangrías/listas; en tablas se conserva la navegación de celdas del editor. Las tablas permiten insertar, añadir/eliminar filas/columnas, combinar/separar celdas y ajustar anchuras. Las acciones de la barra tienen etiquetas accesibles y no enfocan campos al abrir el documento.

El pegado da prioridad al HTML enriquecido si existe en el portapapeles. Si hay texto plano, interpreta Markdown: #, **, *, listas y tablas se convierten en formato real. Las viñetas escapadas que aparecen como \\- en el adjunto también se convierten. Las listas consecutivas a), b), c) se conservan como listas alfabéticas editables. Los asteriscos literales de referencias —por ejemplo (*)— se mantienen; no se borra puntuación del temario.

Importar texto admite archivos UTF-8 TXT, MD/Markdown y HTML, hasta 2 MB por archivo, y añade el contenido al documento actual. También se ofrece Pegar Markdown en un bottom sheet. No se introduce contenido de ejemplo en cuentas existentes ni se añade el texto adjunto al código distribuido.

El archivo TXT aportado solo expresa texto y Markdown: no contiene información sobre tipografías, márgenes o paginación de Word. Se preserva su contenido/estructura y se interpreta el formato que realmente incluye. La sección ofrece edición visual de texto, sin pretender implementar todo Microsoft Word: no importa/exporta DOCX, comentarios, control de cambios, cabeceras/pies o maquetación de páginas. La exportación es HTML; Imprimir/PDF utiliza el diálogo de impresión del navegador. Imágenes y recursos remotos no se importan en este editor de texto. No se requieren servicios de IA, cuentas de Tiptap ni APIs de pago.

## Guardado y dispositivos

El autoguardado agrupa escritura durante 550 ms sin actividad, y también se intenta al ocultar la página. Cerrar espera a la transacción local. Cada cambio mantiene además un borrador local separado por usuario y documento, usando el almacén genérico IndexedDB existente; se recupera al volver a abrir y se limpia tras guardar. No se modifica el esquema de IndexedDB. Una interrupción antes de finalizar una escritura local sigue dependiendo del comportamiento del navegador; no se promete guardar cambios que el proceso no haya llegado a escribir.

Los documentos guardados usan la sincronización y cola offline existentes. Sin conexión, quedan locales y se envían al volver; para cambiar de dispositivo, espera a que la sincronización habitual termine. Las copias de seguridad generales contienen los documentos guardados y su estructura, mediante settings. Los borradores locales pendientes no forman parte de esa copia hasta guardarlos.

Si llega otra versión del mismo documento mientras hay cambios locales, se avisa y se ofrece Guardar mi texto como copia o cargar explícitamente la versión recibida. Un fallo de guardado mantiene el texto y permite reintentar. Si se elimina el apartado remotamente mientras se escribe, se puede recuperar el borrador como un documento nuevo. Son protecciones de la interfaz sobre el motor existente: no se añade edición colaborativa/CRDT ni se sustituye su resolución de escrituras simultáneas offline.

## Datos y seguridad

No hay migración SQL. Se usan nuevas claves independientes en settings:

- studyMaterialNode:<id>: metadatos versión 1, nombre, parentId, sortOrder, fechas y referencia opcional de carpeta de origen.
- studyMaterialContent:<id>: versión 1, HTML y fecha del documento.

Metadatos y texto son registros distintos: editar un tema no reenvía todo el material ni sustituye la sesión de tarjetas. Los IDs nuevos son UUID; ninguno de los existentes se modifica. El borrado de ramas usa marcas lógicas para mantener una proyección coherente. Los registros permanecen sujetos a las políticas existentes de user_settings por cuenta. El HTML se sanea al importar, pegar, guardar y mostrar: se excluyen scripts, iframes, imágenes remotas, manejadores y estilos ejecutables o de posicionamiento.

Se reutilizan proyección, IndexedDB, outbox, Auth, Realtime, RLS, exportación/importación y PWA. FSRS, memoryModel y la lógica de sesiones permanecen idénticos a v13.2.1. Se añade CSS propio para documento a pantalla completa, safe areas, toolbar, tablas con scroll e impresión. La revisión de caché y los nuevos chunks offline los genera el script PWA existente.

## Componentes y entrega

Nuevos: components/material/MaterialPage.tsx, MaterialDocument.tsx, MaterialEditor.tsx y extensions.ts; lib/material/model.ts, format.ts y sanitize.ts; app/material.css; pruebas material.test.ts y ui/material.spec.ts; documentación e informe.

Integraciones: OpoApp, navegación Más, acceso desde Biblioteca, layout/CSS, package.json/lock y fixture de pruebas. Las pruebas de sesiones heredadas esperan explícitamente la transacción antes de leer el motor; no cambian sus criterios ni la lógica de sesiones. No hay archivos eliminados manualmente.

El ZIP contiene solo archivos nuevos/modificados respecto al commit de GitHub inspeccionado e incorpora los archivos de reparación v13.2.1 que allí faltaban. Se conserva npm run build con salida out y la preparación de rutas antiguas. El inventario exhaustivo y hashes están en ARCHIVOS-DEL-PARCHE.json. No se ha escrito ni desplegado en el repositorio remoto desde aquí.
