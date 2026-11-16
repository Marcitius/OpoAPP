# OpoGC v15.2 — Editor de tarjetas

## Uso

Abre **Biblioteca → Tarjeta**, edita una tarjeta existente o entra en **Opciones del repaso → Editar tarjeta**. Pregunta y respuesta disponen de un editor independiente. Selecciona el texto para aplicarle formato o elige un estilo para seguir escribiendo con él.

La barra principal contiene estilo de párrafo, negrita, cursiva, subrayado, viñetas, numeración y **···**. Este último abre fuente, tamaño, colores, resaltado, tachado, listas alfabéticas, sangría, alineación, interlineado, sub/superíndice, citas, separadores, enlaces, tablas, deshacer/rehacer y quitar formato. Las tablas permiten añadir/eliminar filas y columnas, combinar/separar celdas y eliminar la tabla. Tab y Mayús+Tab ajustan la sangría; dentro de tablas mantienen la navegación por celdas.

El pegado habitual conserva el HTML enriquecido que proporcione la aplicación de origen. Si solo llega texto Markdown, se interpreta como documento con formato. **··· → Pegar Markdown** permite pegar explícitamente texto con `#`, `**`, listas y tablas. También se reconocen viñetas de texto como `•`. El contenido sigue siendo editable por bloques, no una captura ni una imagen.

La reproducción de formato comprende las herramientas de este editor; no importa paginación, macros, comentarios ni otras funciones propias de archivos Word. Una fuente elegida se muestra si está instalada en el dispositivo. Las imágenes de tarjetas conservan **Respuesta visual**; esta entrega no añade imágenes incrustadas dentro del campo de texto.

## Qué se reutiliza

`components/editor/RichEditor.tsx` contiene el editor compartido extraído de Material. `components/material/MaterialEditor.tsx` mantiene la interfaz pública anterior y habilita sus imágenes privadas. `components/editor/CardTextEditor.tsx` configura el editor compacto de las tarjetas sin insertar imágenes de Material. Los controles de formato de bloques viven en `components/editor/blockFormat.ts`.

El editor de tarjetas se carga bajo demanda al crear o editar, como Material. Leer o responder tarjetas no incorpora Tiptap al arranque. El generador de PWA existente incluye sus chunks para el uso offline.

Se conservan las opciones estables del editor y la comparación de HTML antes de recibir contenido externo. Escribir, borrar, pulsar Enter y actualizar el estado React no reconstruyen el documento ni desplazan el cursor. No se añaden llamadas automáticas a focus, autoFocus ni trucos con readonly/blur. BottomSheet y su gestión accesible de foco permanecen intactos.

La sangría y el interlineado atienden todos los bloques de una selección mixta, en vez de modificar solo el párrafo vacío que Tiptap conserva después de un título. La sangría se limita a ocho niveles. Los estilos de párrafo permiten que el interlineado explícito tenga efecto.

## Guardado y compatibilidad

No cambia el modelo de datos: `Card.front` y `Card.back` siguen siendo HTML de texto. Se amplía su política de saneado a la ya utilizada por Material, conservando títulos adicionales, tamaños, fuentes, listas alfabéticas, sangrías y atributos de tablas. Scripts, eventos, URLs ejecutables y CSS de posicionamiento no se incorporan al contenido. Las imágenes siguen fuera de esos campos mediante el adjunto privado existente.

`app/RichTextEditor.tsx` conserva los exports de saneado, texto plano y lectura; no importa el motor Tiptap. Las búsquedas y la corrección de respuestas escritas siguen usando texto plano, con separaciones entre bloques y celdas. `app/card-editor.css` aporta estilos compactos de edición y reglas de lectura independientes del editor.

Se utiliza el guardado existente de CardModal y mergeCardContent, que conserva los IDs, adjuntos, última programación y contadores de una tarjeta editada. No se recorren ni reescriben tarjetas existentes al instalar la actualización. Las tarjetas antiguas con texto plano o HTML se siguen abriendo. La cola offline y las copias portátiles transportan los mismos campos de siempre.

No cambian dependencias, Auth, Supabase, SQL, RLS, IndexedDB, transporte de sincronización/Realtime, FSRS, algoritmo de notas/medias, sesiones, Service Worker ni manifest. La generación del Service Worker durante el build incluye los nuevos archivos compilados como en versiones anteriores. Actualiza la PWA en todos los dispositivos para que también compartan las nuevas reglas de visualización.

## Validación

Los comandos y resultados ejecutados están en `RESULTADOS-V15.2.json`. Se incluyen pruebas del formato, saneado, datos offline, reapertura, proyección entre dispositivos simulados, copias, edición durante repaso, distintos tipos de tarjeta, posiciones del cursor y ausencia de foco automático. La suite existente verifica además Material, imágenes, sesiones, notas y corrección de test/respuestas escritas.

Las pruebas de navegador usan Chromium local a 360×800, 390×844, 430×932, 768×1024, 1024×768, 1366×768 y 1920×1080. No equivalen a una prueba en Safari físico, teclado nativo de iOS o la cuenta real de Supabase. El traspaso de dispositivos y las políticas PostgreSQL/Storage se prueban en el entorno local, sin acceder a datos del usuario.

## Instalación

Aplica el contenido de `actualizar/` sobre la raíz del proyecto **v15.1**, conservando las rutas. No es el proyecto completo. Mantén las variables actuales de Supabase y los archivos no incluidos. No hay archivos que borrar. Incluye package.json y package-lock.json juntos; las dependencias no han cambiado.

Ejecuta `npm ci` y `npm run build`, o deja que el despliegue existente lo haga. En Cloudflare Pages el comando es `npm run build` y la salida `out`. No ejecutes SQL ni crees otro bucket. Tras el despliegue, permite actualizar la PWA en los dispositivos.
