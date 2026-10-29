# OpoGC v14.3 — Imágenes en Material

Parche sobre v14.2.1. Añade imágenes a los documentos reales de Material de estudio. Mantiene el editor, sus borradores y conflictos, la corrección del cursor, la organización y los datos existentes.

## Uso

1. Abre un documento y sitúa el cursor en el punto de inserción.
2. Pulsa **Imagen / Insertar imagen**. Puedes seleccionar varios PNG, JPEG, WebP o GIF. También puedes pegar capturas cuando el navegador entregue un archivo de imagen, o arrastrar archivos desde el escritorio.
3. Pulsa una imagen para seleccionarla y usa sus controles: tamaño 25/50/75/100 %, alineación izquierda/centro/derecha, descripción alternativa y quitar. Deshacer permite recuperar una imagen quitada.
4. Continúa escribiendo. Se conserva el autoguardado; el modo lectura muestra las imágenes. Durante la subida se evita cerrar el documento y perder la inserción pendiente.

No se enfoca un campo al abrir Descripción. Los controles recuerdan la imagen seleccionada aunque el navegador mueva la selección al tocar un control. Quitar imagen selecciona de nuevo su bloque por identificador y no borra por accidente el texto seleccionado.

Al pegar texto con formato y archivos de imagen juntos, se conserva primero el texto y se insertan después las imágenes. No se reconstruye la posición exacta de cada imagen dentro del HTML original del portapapeles. Las imágenes remotas incluidas únicamente como enlaces HTML no se descargan automáticamente; utiliza un archivo o una captura.

## Guardado y compatibilidad

- Se usa el bucket privado existente y las funciones de adjuntos de OpoGC, con la autenticación y políticas actuales. No hay otro bucket, nueva dependencia, migración SQL ni cambio del modelo de tarjetas o del algoritmo de estudio.
- Cada imagen tiene una referencia lógica UUID en el documento y un registro `studyMaterialImage:<UUID>` en los ajustes ya sincronizados. Los bytes se guardan como archivo privado. El HTML persistido no incluye base64, URLs temporales ni enlaces públicos.
- Las inserciones asíncronas siguen la posición del cursor a través de los cambios del editor mientras sube el archivo. La metadata se confirma localmente antes de insertar el bloque. Se comprueba que el archivo siga perteneciendo a la cuenta actual.
- Añadir un archivo requiere conexión, como los adjuntos anteriores. Las imágenes previamente almacenadas en la caché de ese dispositivo pueden verse sin conexión; un dispositivo que nunca las descargó necesita conexión para obtenerlas.
- Formatos: PNG, JPEG, WebP y GIF; máximo existente de 50 MB por archivo. No se acepta SVG. No se insertan imágenes HTML arbitrarias ni sus atributos ejecutables.
- Quitar una imagen retira su bloque del documento. Su archivo y registro se conservan para deshacer y copias; esta versión no elimina archivos de Storage automáticamente.
- Actualiza OpoGC en todos los dispositivos antes de editar documentos con imágenes. Un editor anterior no reconoce estos bloques y podría descartarlos al volver a guardar.

## Copias y exportación

La enumeración de adjuntos de la copia portátil incorpora los registros de Material. Al restaurar en otra cuenta, el mecanismo existente sube los archivos al nuevo propietario y reasigna las referencias de almacenamiento; el UUID lógico del documento permanece estable. Se mantiene el formato existente de la copia.

Exportar HTML resuelve las imágenes y las incorpora como datos dentro del archivo descargado. El documento guardado en OpoGC sigue conteniendo solo referencias. La exportación avisa si no puede obtener un archivo. Imprimir/PDF utiliza las imágenes cargadas en pantalla. Un HTML exportado no sustituye a una copia portátil para trasladar todo a otra cuenta.

En `lib/data/files.ts` solo se amplía la enumeración de adjuntos y el remapeo al restaurar. Se mantienen idénticos los cuerpos de `userId`, `uploadAttachment`, `attachmentBlob`, `attachmentUrl`, `releaseFileUrls`, `readAnnotations`, `saveAnnotations` y `preparePortableBackup`. Sus huellas estructurales están verificadas por `scripts/check-preserved.mjs` y `docs/v14.3-file-function-fingerprints.json`.

## Actualización

Descomprime el ZIP y sube el **contenido** de `actualizar/` a la raíz del repositorio de v14.2.1, conservando las rutas y sustituyendo archivos. No subas una carpeta contenedora llamada actualizar. Incluye juntos package.json y package-lock.json. No hay archivos que borrar ni dependencias nuevas.

El ZIP contiene únicamente archivos nuevos o modificados. `ARCHIVOS-DEL-PARCHE.json` enumera todos ellos y sus hashes. No contiene node_modules, builds, credenciales, datos de usuario ni capturas. El Service Worker y la versión PWA se generan mediante el build existente: **npm run build**, directorio de salida **out**. Conserva las variables actuales de Supabase; no ejecutes SQL ni reconfigures el backend.

## Validación ejecutada

- `npm run typecheck`: correcto.
- `npm test`: 95 pruebas aprobadas, 0 fallidas; incluye cuatro pruebas nuevas de imágenes y las verificaciones de preservación.
- `npm run build`: compilación y exportación estática correctas.
- `npm run test:ui`: 108 pruebas aprobadas en Chromium, 0 fallidas, 0 omitidas y 0 inestables. Incluye ocho pruebas nuevas de imágenes y las regresiones de editor/cursor, sesiones, estudio, navegación y rendimiento.

Las pruebas nuevas cubren inserción y reapertura a 390×844, 768×1024 y 1366×768; tamaño/alineación; pegado de texto con formato más imagen; drop; selección, descripción sin autofocus, quitar y deshacer; HTML con los bytes incorporados; caché offline; subida offline rechazada sin perder lo anterior; múltiples archivos y SVG rechazado; escritura durante una subida pendiente.

Las pruebas de datos ejercitan outbox, reapertura de IndexedDB, proyección remota y separación por cuenta. Las funciones de producción de subida/descarga privada, caché, copia portátil y restauración entre cuentas se ejecutan con transporte HTTP y autenticación simulados, sin usar cuentas reales. La UI usa un proveedor de archivos de pruebas con IndexedDB real del navegador; la aplicación de producción utiliza las funciones privadas existentes.

No se ha probado en Safari físico, teclado virtual real, una PWA instalada ni contra el Supabase de producción. Tampoco se afirma una sincronización PC ↔ iPhone real. Los resultados detallados y las limitaciones están en `RESULTADOS-V14.3.json`.

## Archivos

Componentes nuevos: `MaterialImage.tsx`, `MaterialImageServices.tsx`, `useMaterialImages.ts`. Utilidades nuevas: `lib/material/images.ts`, `lib/material/exportImages.ts`. Se actualizan MaterialEditor, MaterialDocument, sus extensiones, CSS y sanitización; la enumeración/remapeo de adjuntos; identificación de versión, documentación y pruebas. La lista exacta completa está en `ARCHIVOS-DEL-PARCHE.json`. **Archivos eliminados: ninguno.**
