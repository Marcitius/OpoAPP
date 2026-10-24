# Reparación del despliegue — OpoGC v13.2.1

## Diagnóstico comprobado

Registro aportado: 22 de octubre de 2026, commit `5d28bdea0f36d825a7328e1e2062d47c552e5e39` de Marcitius/OpoAPP. Se inspeccionó el árbol de ese commit por la API de GitHub y se compararon sus hashes Git con el proyecto v13.2 entregado. No se escribió en GitHub ni se cambió la configuración de Cloudflare desde aquí.

El ZIP anterior suponía que v13.1 estaba completa; ese commit no la tenía completa. Faltaba `components/review/StudyModeSheet.tsx`, requerido por OpoApp. También faltaban la prueba de acciones y documentos v13.1. Cuatro componentes seguían siendo exactamente los de v13: ReviewCollections, ModalShell, LibraryBrowser y LibraryEditors. Se verificó que no eran modificaciones propias posteriores antes de reponerlos.

Había rutas antiguas app/api para state, files, files/multipart, annotations y storage-status, con imports @/db del backend D1/R2 anterior. La versión Supabase entregada no utiliza esas rutas. Había también un manifest dinámico antiguo que compite con el manifest público de la PWA actual. Además permanecían archivos TS sueltos de versiones anteriores, ejemplos, worker y configuración Vite antigua que el include global **/*.ts compilaba como entradas.

Cloudflare ejecutaba `npx next build`, omitiendo el script real de package.json. El mensaje sobre Wrangler fue un aviso; el log siguió y terminó por errores de módulos.

## Cambios de este parche

- Repone los archivos funcionales y documentación v13.1 que faltaban. Sus componentes de UI son los mismos que ya se validaron en la entrega v13.2.
- Añade scripts/prepare-build.mjs y un inventario de seis archivos antiguos con huellas SHA256 del contenido normalizado (solo finales de línea y espacio final). Antes de mover nada, valida todos los archivos presentes. Si alguno tiene otro contenido, aborta en lugar de apartar código desconocido.
- Mueve esos archivos a legacy-backup con extensión .disabled, conservando los bytes originales. No borra archivos ni ejecuta peticiones de backend. La lista se limita a cinco rutas antiguas y app/manifest.ts; no incluye el manifest público actual ni ningún archivo Supabase.
- Incluye la aplicación activa, pruebas y configuraciones actuales en tsconfig. No desactiva strict ni ignora errores de build/TypeScript. Cualquier dependencia importada por la aplicación sigue comprobándose, aunque se encuentre fuera de esos patrones iniciales.
- npm run build, dev, typecheck y test ejecutan la preparación. La salida sigue siendo out. El script PWA existente regenera Service Worker y versión mediante el procedimiento habitual.
- Añade pruebas para copia íntegra, conservación de sincronización/archivos ajenos, idempotencia, rechazo de rutas modificadas y protección de copias existentes.

Los originales apartados siguen en el checkout, en legacy-backup. Si haces una compilación local, Git puede mostrar las rutas originales como eliminadas porque se han movido: sus copias permanecen en esa carpeta. En Cloudflare ese traslado ocurre en el entorno temporal del build y no modifica tu repositorio remoto. legacy-backup no entra en out ni debe subirse.

No se toca wrangler.jsonc: convertirlo en configuración Pages podría alterar qué ajustes del panel se consideran autoridad. El aviso puede seguir apareciendo y no impide la compilación. La configuración necesaria se establece en el panel: comando npm run build, directorio de salida out y raíz donde está package.json. Mantén el dominio y variables Supabase actuales.

## Aplicación

Este ZIP es una corrección incremental para el repositorio que ya recibió v13.2. Sube el contenido de actualizar/ a la raíz de OpoAPP respetando sus rutas. Cambia el comando actual de Cloudflare de npx next build a npm run build. Guarda y reintenta el despliegue. No hay que borrar archivos manualmente ni ejecutar SQL. Se incluyen solo archivos añadidos/modificados, no el proyecto completo.

## Validación ejecutada

- Se recompusieron localmente las fuentes activas actuales y los archivos antiguos TypeScript detectados en el commit, incluidos los seis que interferían con Next. Se aplicó el parche sobre esa mezcla.
- npm run build: correcto con Next 16.2.6 / webpack; preparación de los seis archivos, TypeScript y exportación estática correctos.
- npm run typecheck: correcto después de la preparación.
- npm test: 68 aprobadas: 64 pruebas de SQL/datos/memoria/estudio/selección/acciones/checkpoint y 4 de preparación del build.
- Las 4 pruebas de preparación volvieron a pasar tras formatear los archivos del script.
- Exportación: index.html, manifest standalone, iconos existentes y versión 13.2.1 correctos; sin antiguas rutas api en out.
- Comparación de archivos críticos: idénticos a v13.2 en FSRS, memoryModel, Auth, sincronización, persistencia, migraciones, componentes de cuenta/contexto/PWA y generador PWA.
- ZIP: hashes por archivo, CRC e inventario respecto al commit fallido.

No se ha ejecutado un despliegue real de Cloudflare ni pruebas contra tu Supabase. No se ha repetido en esta reparación la suite de 64 pruebas de navegador de v13.2; el informe anterior continúa documentando esa ejecución, no una nueva. Este parche no modifica la lógica de UI/sesiones de v13.2. Los resultados actuales se adjuntan en PRUEBAS-V13.2.1.json.

Fuentes: registro adjunto, árbol/archivos del commit indicado y código local entregado. Referencia de configuración Pages: https://developers.cloudflare.com/pages/functions/wrangler-configuration/ .
