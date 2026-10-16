# OpoGC v13.1 — Sesiones y modos

Base exacta: OpoGC-v13-Repasos-y-Organizacion.zip, versión 13.0.0 entregada en esta conversación. No se ha obtenido ni modificado el repositorio remoto ni la cuenta real del usuario.

## Edición durante una tarjeta

El menú de tres puntos abre el mismo CardModal de Biblioteca sobre la sesión. Permite corregir el contenido, opciones, rúbrica e imagen de los tipos existentes. En una sesión se mantiene el tipo de tarjeta; para convertirla se utiliza Biblioteca. Guardar vuelve a la tarjeta actual sin responder ni pasar a otra. Se descarta la respuesta temporal/corrección calculada sobre el contenido antiguo para volver a comprobarla con el contenido nuevo. Cancelar conserva lo que había.

mergeCardContent aplica exclusivamente los campos de contenido sobre la versión más reciente de la tarjeta: no copia desde el formulario el scheduling antiguo, contadores, ID, fecha de creación ni orden. Por tanto una valoración recibida durante la edición no se revierte al guardar el texto. El guardado espera a la actualización local existente; si falla, el editor permanece abierto. No se fuerza el foco de ningún campo editable.

## Retirar de una colección

Empezar repaso conserva sourceCollectionId dentro de settings.activeCardSession. En una sesión de una colección hay una acción visible y otra en el menú: Quitar de nombre y continuar. La actualización pone esa pertenencia a false y retira el elemento de la lista pendiente de esa sesión, incluyendo refuerzos, en una sola actualización del motor existente. Pasa a la siguiente o al cierre si no quedan tarjetas. No añade ratings, no modifica el próximo repaso FSRS ni borra el historial de intentos o pertenencias a otras colecciones.

La lista de la colección también permite quitar una tarjeta o las seleccionadas; si hay una sesión guardada de esa misma colección, se retiran sus futuras apariciones. La acción general Guardar para repasar sigue permitiendo administrar las demás pertenencias. Las sesiones iniciadas antes de esta actualización no tienen colección de origen: pueden continuar y usar Guardar para repasar; para tener la acción directa de retirada hay que iniciar el repaso desde la colección.

## Elegir modo

El selector común se abre desde Estudiar selección en Biblioteca, desde Estudiar tarjetas de esta selección y desde Elegir modo de estudio o una selección de una colección. Ofrece los cinco modos ya existentes; no sustituye su lógica. Aprender conserva los refuerzos, Aleatorio mezcla la selección, En orden recorre la selección, Más falladas utiliza el historial de errores y Repasos pendientes aplica vencimientos/límites diarios. Si no hay falladas o pendientes, se mantiene el aviso existente. En selecciones mixtas se elige tarjetas u ortografía para conservar su tratamiento específico.

Empezar repaso en una colección y los accesos directos de Hoy mantienen su inicio rápido. El selector puede cerrarse sin comenzar ni sobrescribir la sesión guardada.

## Compatibilidad

Único campo adicional: sourceCollectionId?: string en el JSON existente del checkpoint de sesión. Es opcional y se guarda mediante settings, IndexedDB/outbox y sincronización existentes. Sin migración SQL. No cambian FSRS, memoryModel, tablas, RLS, Auth, Realtime, archivos privados ni IDs. La versión del paquete es 13.1.0; el generador PWA existente actualiza su revisión de caché.

El parche no incorpora rutas de API ni wrangler.json ajenos al ZIP v13, y no elimina automáticamente los archivos sobrantes que aparecían en registros anteriores. Ese problema de despliegue exige comparar/limpiar el repositorio y usar npm run build con salida out.

## Inventario

Se adjunta ARCHIVOS-DEL-PARCHE.json con estados, rutas y SHA256 de los archivos incluidos. No hay archivos eliminados. Los componentes nuevos de producción son components/review/StudyModeSheet.tsx y lib/review/sessionActions.ts. Las pruebas nuevas son tests/session-actions.test.ts y tests/ui/v131.spec.ts. El resto de cambios se limita a integrar esas acciones y documentar/versionar la actualización.
