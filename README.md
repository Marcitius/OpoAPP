# OpoGC v15.6 — Repasos con distancia

En las sesiones con nota, suspender una tarjeta la deja pendiente. Antes de que pueda volver, tienes que **responder otras tarjetas distintas**. El tiempo con la app abierta, saltar preguntas o consultar la cola no acorta la separación.

| Si estudias… | Tras el primer suspenso | Si vuelves a suspenderla |
|---|---|---|
| 3 tarjetas | Queda para otra vuelta voluntaria | No entra en bucle |
| 10 tarjetas | Al menos 8 respuestas distintas | Necesita 12: queda pendiente si no hay suficientes |
| 69 tarjetas | Al menos 14 respuestas distintas | Al menos 18 respuestas distintas |

El número es un **mínimo**, no un turno reservado. Entre las suspendidas listas tiene prioridad la que peor acabas de responder. A igualdad de nota se compara la media de recuerdo anterior a esta sesión; después, la cantidad de fallos y la espera. Una tarjeta sin historial queda entre una debilidad documentada y una antes aprobada. Mientras haya tarjetas sin intentar, se reservan al menos tres primeras respuestas entre refuerzos automáticos. Tras el tercer suspenso, la tarjeta queda para otra vuelta. Aprobar con 5 o más la retira de la sesión.

En **Aprender** y **Peor nota primero**, al ordenar por media, si dos medias coinciden empieza la de peor último recuerdo independiente. **En orden** y **Aleatorio** siguen respetando cómo quieres ver las tarjetas por primera vez. Si vuelves a una sesión guardada, conservas tu tarjeta abierta y tu borrador. Puedes ver la previsión con **Cola** y elegir **Volver a intentar pendientes** si quieres hacer una vuelta adicional. Los reintentos de esa sesión no suben tu media de recuerdo.

**Actualizar desde v15.5:** descomprime el ZIP y copia el contenido de `actualizar/` a la raíz del proyecto, junto a `package.json`, respetando carpetas y sustituyendo los archivos. En Cloudflare Pages conserva el comando `npm run build` y la salida `out`. Acepta la actualización de la PWA en cada dispositivo. No hay migraciones SQL ni archivos que eliminar.

La regla afecta al orden dentro de las sesiones con nota. FSRS sigue programando los repasos posteriores. Ortografía conserva su flujo propio por palabras. Pruebas ejecutadas y límites: `docs/RESULTADOS-V15.6.json`.

---

# OpoGC v15.5 — Notas y refuerzo personal

Esta actualización añade notas opcionales por tarjeta, tarjetas derivadas y borrado durante el estudio. También permite crear respuestas escritas sin ChatGPT y aceptar explícitamente una respuesta escrita o tabla muda tras revisar la corrección.

## Actualizar desde v15.4

El ZIP es un **parche: solo archivos nuevos/modificados sobre v15.4**. Copia el **contenido de `actualizar/`** a la raíz del proyecto, conservando rutas y sustituyendo archivos. Incluye `package.json` y `package-lock.json` juntos. No borres el proyecto ni subas la carpeta `actualizar` como contenedor. El manifiesto de la raíz enumera cada archivo. No hay archivos que eliminar.

Cloudflare Pages: comando **`npm run build`**, directorio de salida **`out`**. Conserva tus variables actuales. No ejecutes `npm run deploy`: este proyecto no utiliza ese comando. No hay dependencias nuevas, migraciones SQL ni nueva configuración de Supabase. Después del despliegue, acepta la actualización de la PWA cuando la ofrezca la aplicación.

## Cómo se utiliza

- Durante el estudio: **Añadir nota** abre un panel sin activar el teclado. Guarda qué concepto olvidas sin revelar ni calificar la tarjeta. Puedes editar, resolver o eliminar tus notas; seguirán vinculadas a la tarjeta entre sesiones.
- En **··· → Crear tarjeta derivada** redactas una pregunta más concreta con el editor habitual. Se propone el mismo tema/subtema y puedes cambiarlo. La original mantiene sus datos; la derivada tiene identidad, notas y calificaciones independientes.
- **Guardar y continuar** conserva la derivada para sesiones posteriores. **Guardar y practicar en esta sesión** la intercala después de otras tarjetas, si la separación es posible. No aparece inmediatamente por haberla creado ni por esperar unos minutos. Si ya no quedan otras tarjetas, queda pendiente para una ronda voluntaria o una sesión posterior.
- Esa práctica inmediata se identifica como **práctica guiada**: conserva su intento en el historial e informe, pero no aumenta la media ni modifica FSRS. En otra sesión, la primera valoración de la derivada cuenta normalmente.
- **Tarjetas relacionadas** permite consultar origen y derivadas. Si cambia el contenido original se indica que revises las derivadas. No se sobrescriben sus respuestas. Tras revisarlas puedes confirmar que ya las has revisado.
- **··· → Eliminar tarjeta → Eliminar y continuar** elimina la tarjeta de Biblioteca, colecciones y sesiones abiertas, conservando intentos ya registrados, notas e informes. No elimina sus derivadas. Hay confirmación previa.
- En Biblioteca, el menú **···** ofrece las mismas acciones; el buscador global permite consultar notas y relaciones desde la vista previa. Ortografía dispone de opciones por palabra.
- Para crear una **Respuesta escrita**, utiliza **Biblioteca → Tarjeta → Respuesta escrita**. Escribe pregunta y respuesta modelo. El criterio inicial vacío utiliza automáticamente esa respuesta al guardar. Puedes concretar criterios, alternativas, puntos y condiciones como en las tarjetas importadas. Las importaciones JSON y sus prompts siguen disponibles.
- Al corregir una respuesta escrita o tabla aparece **«Después de revisar mi respuesta, considero que es correcta»**. La acción guarda **10/10 como revisión manual y continúa**. Se conserva la respuesta introducida y la evaluación automática en el informe, diferenciadas de tu decisión. En tablas solo se ofrece para el primer intento con todos los huecos contestados y sin respuestas reveladas; un reintento posterior no puede convertir el primer fallo en un acierto independiente.
- **Progreso → Informe diario para ChatGPT** incluye notas creadas/editadas/resueltas/eliminadas durante el día, incluso sin calificación, y derivadas creadas con sus referencias. Las notas actuales de tarjetas estudiadas se etiquetan como contexto actual, no como estado histórico del día.

## Datos y compatibilidad

Se reutilizan los registros JSON existentes: notas y eventos independientes en ajustes; relación opcional de origen en la tarjeta; procedencia de práctica guiada y revisión manual en el intento. No cambian IDs existentes, esquema SQL, Auth, RLS, transporte de sincronización, Realtime, IndexedDB, cola offline, Service Worker, manifest ni FSRS.

El borrado expuso un caso previo: una copia podía contener intentos de una tarjeta eliminada sin su referencia SQL. Ahora el borrado conserva una referencia histórica sin adjuntos; al restaurar se reproduce exclusivamente como registro eliminado, sin devolver la tarjeta a Biblioteca. Se ha probado con las restricciones reales del SQL existente. El archivo de validación de copias y la proyección se ajustan únicamente para esta referencia; no se modifica el transporte de sincronización.

Los eventos de notas y creación de derivadas conservan el contenido relevante para informes posteriores. Las notas borradas desaparecen de la vista habitual; el registro de su creación y eliminación permanece en los informes. Eliminar una tarjeta no equivale a borrar todo su historial.

## Validación de v15.5

Los comandos, recuentos, límites y manifestación de integridad de esta entrega figuran en `docs/RESULTADOS-V15.5.json` y `docs/V15.5-NOTAS-Y-REFUERZO.md`. Las pruebas de sincronización/offline son locales y de base de datos de pruebas. No se ha conectado a tu Supabase real ni probado físicamente Safari/iPhone/iPad; no se ha desplegado la aplicación.

---

# OpoGC v15.4 — Cola visible y buscador

- **Cola de la sesión:** pulsa el botón de tres líneas **Cola** junto al apartado de la tarjeta. En iPad/ordenador se abre un panel lateral para seguir respondiendo mientras ves el orden previsto; en móvil se abre una hoja desplegable. Se actualiza al valorar, muestra movimientos, pendientes de refuerzo y aprobadas.
- **Buscar tarjetas desde Hoy:** pulsa la lupa superior. Busca en preguntas y respuestas de todos los temas, consulta una tarjeta completa y usa **Estudiar tarjeta** o **Editar tarjeta**. La búsqueda ignora mayúsculas y acentos y contempla soluciones de tests y alternativas de tablas mudas.

La cola es una vista de lectura del algoritmo actual. Las posiciones futuras suponen que vas aprobando y cambian con las respuestas reales; abrirla no programa repasos ni añade notas. La búsqueda tampoco registra una valoración por consultar una tarjeta. Los prompts recuperados en v15.3.1 se conservan.

## Actualizar desde v15.3.1

El ZIP contiene **solo archivos nuevos/modificados sobre v15.3.1**. Copia el **contenido de actualizar/** a la raíz del proyecto, conservando rutas y sustituyendo archivos, incluidos `package.json` y `package-lock.json` juntos. No subas una carpeta contenedora llamada `actualizar`.

Cloudflare Pages: **npm run build**, salida **out**. Conserva tus variables de Supabase y actualiza la PWA en los dispositivos. No hay dependencias nuevas, migraciones SQL, archivos que borrar ni cambios en los datos existentes.

Guía y alcance: **docs/COLA-BUSCADOR-V15.4.md**. Pruebas ejecutadas: **docs/RESULTADOS-V15.4.json**. Archivos y hashes: **ARCHIVOS-DEL-PARCHE.json**, dentro del ZIP.

## Validación de v15.4

TypeScript y build correctos; **172 pruebas de lógica/datos y 189 de navegador aprobadas**, sin fallos ni pruebas omitidas en la ejecución final. Incluyen doce casos nuevos de lógica y catorce de interfaz, cola de 137 tarjetas, búsqueda en 2.200, reanudación, edición, tablas mudas, ortografía y conservación del borrador. Pruebas locales con Chromium; no se ha probado tu Supabase real ni Safari físico.

---

Documentación de versiones anteriores:

# OpoGC v15.3.1 — Prompts de importación

Vuelve el selector de tipo y **Copiar prompt** dentro de **Biblioteca → Opciones de la biblioteca → Importar tarjetas JSON**. Incluye Flashcard normal, Test, Tabla muda, Vocabulario, Ortografía y Respuesta escrita.

El prompt y **Ver formato JSON** corresponden al tipo elegido. **Ver prompt** permite leer y copiar el texto manualmente si el navegador no permite usar el portapapeles. Cambiar de tipo o copiar no borra el JSON pegado ni su validación; puedes seguir importando archivos con tipos mezclados. Abrir estas opciones no enfoca campos de texto automáticamente.

## Actualizar desde v15.3

Este ZIP contiene **solo archivos nuevos/modificados sobre v15.3**. Sube el **contenido de actualizar/** a la raíz del repositorio, conservando las rutas y sustituyendo archivos. Incluye `package.json` y `package-lock.json` juntos. No subas otra carpeta contenedora llamada `actualizar`.

Cloudflare Pages: **npm run build**, salida **out**. Conserva las variables existentes y actualiza la PWA en tus dispositivos. No hay dependencias nuevas, SQL ni archivos que borrar. Se conserva el importador de v15.3 y su integración con todos los tipos.

Guía y alcance: **docs/IMPORTAR-PROMPTS-V15.3.1.md**. Pruebas ejecutadas: **docs/RESULTADOS-V15.3.1.json**. Relación completa y hashes: **ARCHIVOS-DEL-PARCHE.json**, en el ZIP.

## Validación de v15.3.1

TypeScript y build correctos; **160 pruebas de lógica/datos y 175 de navegador aprobadas**, sin fallos ni pruebas omitidas en la ejecución final. Incluyen los seis esquemas, copia real al portapapeles, copia manual, siete tamaños de pantalla y conservación del JSON/importación mixta. Pruebas locales con Chromium; no se ha probado Safari físico ni tu cuenta real de Supabase.

---

Documentación de versiones anteriores:

# OpoGC v15.3 — Tablas mudas

**Tabla muda** es un nuevo tipo de flashcard dentro de Biblioteca. Comparte temas, filtros, selecciones, historial y sesiones con las tarjetas normales, y tiene editor visual y corrección propios.

- Crea filas y columnas o pega una tabla con formato. Marca las celdas evaluables, sus respuestas y alternativas; previsualiza sin guardar notas.
- Oculta el 25/50/75/100 % de las respuestas. La combinación y lo que escribes permanecen al salir y continuar la sesión.
- Comprueba, consulta soluciones y practica. **Guardar y continuar** registra una nota objetiva con decimales: 9 de 12 es **7,5/10**. La primera comprobación se conserva frente al refuerzo.
- Las tablas siguen la media existente por primera nota de tarjeta/sesión. Las flashcards normales mantienen su editor, calificación y funcionamiento; no se interpreta `{{…}}` en ellas.
- Importación/exportación JSON, sesiones reanudables, informe para ChatGPT y copias portátiles integrados. No hay SQL ni dependencias nuevas.

## Actualizar desde v15.2

El ZIP contiene **solo archivos nuevos o modificados sobre v15.2**. Sube el **contenido de actualizar/** a la raíz de tu repositorio, conservando las rutas y sustituyendo archivos. Incluye juntos `package.json` y `package-lock.json`. No subas otra carpeta contenedora llamada `actualizar`.

Cloudflare Pages: **npm run build**, salida **out**. Conserva las variables de Supabase y actualiza la PWA en todos los dispositivos. No hay archivos que borrar ni reinicio de datos.

Uso, reglas y arquitectura: **docs/TABLAS-MUDAS-V15.3.md**. Plantilla importable: **docs/ejemplos/tabla-muda.json**. Pruebas e integridad: **docs/RESULTADOS-V15.3.json** y **docs/INTEGRIDAD-V15.3.json**. Relación exacta de archivos y hashes: **ARCHIVOS-DEL-PARCHE.json**, en el ZIP.

## Validación de v15.3

TypeScript y build correctos; **154 pruebas de lógica/datos y 164 de navegador aprobadas**, sin fallos ni pruebas omitidas en la ejecución final. Incluyen 23 casos nuevos de lógica y 23 de interfaz para tablas. Pruebas locales con Chromium, IndexedDB y PostgreSQL mediante PGlite; traspaso entre dispositivos simulado. No se ha probado contra tu Supabase real ni en Safari físico.

---

Documentación de versiones anteriores:

# OpoGC v15.2 — Editor de tarjetas

Las **preguntas y respuestas de las tarjetas** utilizan ahora el mismo editor que Material de estudio, adaptado a un cuadro compacto. Funciona al crear tarjetas en Biblioteca y al editarlas, también durante un repaso.

- Negrita, cursiva, subrayado, tachado, títulos 1–6, listas con viñetas, numeradas y alfabéticas.
- Sangría, fuente, tamaño, color, resaltado, alineación, interlineado, tablas editables, citas, enlaces, subíndices, superíndices y deshacer/rehacer.
- Pegado con formato desde el portapapeles. Si copias Markdown, se convierte en títulos, listas, negritas y tablas; puedes usar también **··· → Pegar Markdown**.
- El formato se conserva al guardar, reabrir y estudiar la tarjeta. No se abre el teclado al abrir el editor o sus hojas de opciones.

Los controles habituales están a la vista; **···** reúne las herramientas adicionales. Las imágenes y respuestas manuscritas conservan su apartado actual de **Respuesta visual**.

## Actualizar desde v15.1

El ZIP contiene únicamente archivos nuevos o modificados **sobre v15.1**. Sube el **contenido de actualizar/** a la raíz de tu repositorio, conservando las rutas y sustituyendo archivos. No subas una carpeta contenedora llamada actualizar. Incluye juntos package.json y package-lock.json.

Cloudflare Pages: **npm run build**, salida **out**. Conserva las variables actuales y actualiza la PWA en todos los dispositivos. No hay dependencias nuevas, migraciones SQL, archivos que borrar ni reinicio de datos. Las notas, medias, sesiones, FSRS, sincronización y adjuntos no cambian.

Detalles: **docs/EDITOR-TARJETAS-V15.2.md**. Pruebas ejecutadas: **docs/RESULTADOS-V15.2.json**. Relación exacta y hashes de los archivos: **ARCHIVOS-DEL-PARCHE.json**, en el ZIP.

## Validación de v15.2

TypeScript y build correctos; **131 pruebas de lógica/datos y 141 de navegador aprobadas**, sin fallos ni pruebas omitidas en la ejecución final. Incluye formato, cursor, controles táctiles, edición offline, reapertura, copias y disponibilidad del editor en el precache PWA de producción. Pruebas locales con Chromium; no se ha probado contra tu cuenta real de Supabase ni en Safari físico.

---

Documentación de la versión anterior; sus reglas de notas siguen vigentes:

# OpoGC v15.1 — Media por sesión y cuatro grupos

Corrección sobre v15.0. La media se actualiza con la **primera valoración numérica de cada tarjeta en cada sesión nueva**, aunque la sesión anterior empezara hace pocos minutos. Las repeticiones de esa misma tarjeta dentro de la misma sesión se guardan, pero no modifican su media. Salir, reabrir, continuar otro día o cambiar de dispositivo conserva la identidad de la sesión.

Se elimina la restricción de 12 horas de v15 para calcular la media. Las primeras valoraciones que esa regla había excluido se recuperan al recalcular con los IDs de sesión del historial, sin borrar ni reescribir respuestas anteriores.

La media conserva sus decimales y se ordena con el valor completo: 6 y 5 en sesiones diferentes dan **5,5**. Si después recibes un 2, queda **4,333…**, se muestra **4,33** y la tarjeta gana prioridad en el siguiente estudio por nota. Los intentos de refuerzo no cambian ese resultado.

## Cuatro botones para valorar

| Grupo | Referencia | Valor que aporta a la media |
| --- | --- | --- |
| Suspendida | 1–4 | 2,5 |
| Suficiente | 5–6 | 5,5 |
| Notable | 7–8 | 7,5 |
| Sobresaliente | 9–10 | 9,5 |

Al elegir un grupo se usa su valor central, porque el botón agrupa varias notas. Las notas numéricas antiguas, por ejemplo 5 o 6, conservan exactamente su valor; no se convierten en valores centrales. El acceso No me la sé sigue registrando 1. Un test objetivamente incorrecto queda suspendido.

Suficiente, Notable y Sobresaliente terminan la tarjeta en esa sesión. Suspendida conserva el refuerzo intercalado. FSRS y el resto del flujo de estudio se mantienen.

## Elegir por grupo

En Biblioteca y Estudiar selección puedes elegir Suspendidas, Suficiente, Notable, Sobresaliente, Sin nota o Todas. El criterio puede ser media o última nota de sesión. Las medias decimales no quedan fuera: por debajo de 5 es Suspendida; de 5 a menos de 7, Suficiente; de 7 a menos de 9, Notable; desde 9, Sobresaliente.

El orden Peor nota primero utiliza la media real, sin redondearla para ordenar. Los modos Aprender, Aleatorio, En orden, Más falladas y Repasos pendientes se conservan. El informe de ChatGPT incluye la regla actual, el grupo y la procedencia de cada nota, para distinguir una nota numérica antigua de un valor central de categoría. El informe también advierte que varias sesiones muy próximas no prueban por sí solas retención a largo plazo.

## Actualizar desde v15.0

El ZIP contiene únicamente archivos nuevos o modificados **sobre v15.0**. Sube el **contenido de actualizar/** a la raíz de tu repositorio conservando rutas y sustituyendo archivos. Incluye package.json y package-lock.json juntos. No subas una carpeta contenedora llamada actualizar.

Cloudflare Pages: **npm run build**, salida **out**. Conserva las variables actuales de Supabase y actualiza la PWA en todos los dispositivos. No hay dependencias nuevas, migraciones SQL, archivos que borrar ni reinicio de datos.

Detalles y compatibilidad: **docs/MEDIAS-GRUPOS-V15.1.md**. Pruebas ejecutadas: **docs/RESULTADOS-V15.1.json**. Lista exacta de archivos: **ARCHIVOS-DEL-PARCHE.json**, en el ZIP.

---

Documentación histórica de v15.0 y anteriores (sus reglas se sustituyen por las descritas arriba):

# OpoGC v15 — Notas e informe diario

Actualización sobre **v14.3** con tres cambios: valorar tarjetas del 1 al 10, exportar el estudio diario para ChatGPT y finalizar sesiones individualmente o en grupo.

## Estudiar por notas

Después de mostrar/comprobar la respuesta, pulsa una nota. **1–4** suspende y prepara refuerzo; **5–10** aprueba y retira la tarjeta de esa sesión. En tests incorrectos solo se permiten notas 1–4; la respuesta elegida y la corrección objetiva se conservan. En respuesta escrita se mantiene la corrección por criterios y eliges la nota de recuerdo.

Las suspendidas vuelven tras otras tarjetas, con prioridad para las de menor nota. Las nuevas de la selección siguen teniendo turnos. Si falta separación porque quedan pocas tarjetas, se mantienen pendientes: puedes salir y continuar otro día, finalizar o pulsar **Volver a intentar pendientes** para otra vuelta explícita. Aprobar nunca vuelve a introducir esa tarjeta automáticamente en la misma sesión.

La **media de recuerdo** utiliza únicamente evaluaciones independientes. Para contar otra nota de recuerdo deben pasar **al menos 12 horas sin practicar esa tarjeta**. Es una regla de producto para separar refuerzo y recuerdo, no un intervalo de FSRS ni una garantía de retención. Reiniciar una sesión, cambiar de dispositivo o cruzar medianoche no basta. Las notas de refuerzo se guardan, pero no elevan esa media. Los recuerdos antiguos sin nota no se convierten en números inventados.

Biblioteca muestra media, última nota de recuerdo y cambio entre los dos últimos recuerdos. Puedes filtrar por suspendidas, intervalo o sin nota y seleccionar los resultados. En **Estudiar selección** hay filtros por media/última nota y un modo **Peor nota primero**. Se conservan Aprender, Aleatorio, En orden, Más falladas y Repasos pendientes. Aprender y el repaso recomendado priorizan notas bajas en sus tarjetas elegibles; Aleatorio y En orden respetan su modo. Las tarjetas sin nota tienen turnos reservados, sin tratarlas como un cero. Ortografía mantiene su flujo por errores.

## Informe diario para ChatGPT

Entra en **Progreso → Informe diario para ChatGPT**. Elige una fecha y pulsa **Exportar para ChatGPT**. Opcionalmente añade el contexto actual para planificar: pendientes, tarjetas débiles, planificación y sesiones abiertas. **Copiar instrucciones para ChatGPT** prepara el texto para interpretar el informe.

El día va de 00:00 a 00:00 de la zona horaria del dispositivo. Los intentos se asignan por su fecha original, aunque se sincronicen después. El JSON distingue tarjetas distintas, intentos iniciales, refuerzos, respuestas de test/escritas, notas y estudio de temario/psicotécnicos registrado. Los nuevos intentos numéricos guardan una copia de pregunta, respuesta y ruta de carpeta de ese momento. Los registros antiguos usan el contenido actual si existe y lo indican. No se inventan respuestas antiguas ni tiempo activo; abrir Material por sí solo no se cuenta como estudio completado.

Adjunta el JSON descargado en ChatGPT. No se integra ni contrata una API de IA. No incluye adjuntos binarios ni credenciales de la aplicación. El informe no sustituye a la copia portátil de seguridad.

## Sesiones abiertas

Desde **Ver las N sesiones** o **Gestionar sesión** puedes continuar o finalizar una, seleccionar varias, seleccionar todas y finalizar todas. El cierre múltiple pide confirmación, avisa de los pendientes y conserva las tarjetas, notas e historial. Guarda también un resumen del cierre para el informe diario. Finalizar no aprueba tarjetas pendientes. Los cierres se guardan offline mediante la cola existente.

## Validación de esta entrega

TypeScript y build correctos; **116 pruebas de lógica/datos y 121 de navegador aprobadas**, sin fallos ni pruebas omitidas en la ejecución final. Entorno local con Chromium y traspaso de dispositivos simulado; no se ha probado contra tu Supabase real ni en Safari físico.

## Actualizar desde v14.3

Este ZIP es **solo un parche**, no el proyecto completo. Sube el **contenido de actualizar/** a la raíz del repositorio de v14.3 conservando rutas y sustituyendo archivos. No subas otra carpeta llamada actualizar. Incluye juntos package.json y package-lock.json. No hay dependencias nuevas ni archivos que borrar. Si tu proyecto es anterior a v14.3, aplica primero los parches anteriores correspondientes.

Cloudflare Pages: **npm run build**, directorio **out**. Mantén las variables existentes de Supabase. No ejecutes SQL ni crees otra base de datos o bucket. Actualiza OpoGC en todos los dispositivos para utilizar los mismos controles y reglas.

Detalles técnicos y limitaciones: **docs/NOTAS-INFORME-V15.md**. Resultados ejecutados: **docs/RESULTADOS-V15.json**. La lista de archivos está en **ARCHIVOS-DEL-PARCHE.json**, en la raíz del ZIP.

---

Documentación de versiones anteriores:

# OpoGC v14.3 — Imágenes en Material

Ahora puedes insertar imágenes entre los bloques de texto de Material de estudio, sin cambiar las tarjetas ni tus documentos existentes.

## Uso

1. Abre un apartado de **Material de estudio** y sitúa el cursor donde quieras.
2. Pulsa **Imagen / Insertar imagen** y elige uno o varios archivos PNG, JPEG, WebP o GIF. También puedes pegar una captura si el navegador entrega el archivo en el portapapeles, o arrastrar archivos al documento en escritorio.
3. Pulsa la imagen para seleccionarla. Ajusta **Tamaño de imagen** (25/50/75/100 %) y alineación; **Descripción** permite cambiar su texto alternativo.
4. **Quitar imagen** elimina su aparición en el documento; puedes deshacer. El archivo no se destruye de Storage al quitarlo, para conservar deshacer y copias.
5. El autoguardado conserva el contenido y el formato. El modo lectura muestra las imágenes.

Se reutiliza el almacenamiento privado de OpoGC. Añadir imágenes requiere conexión, igual que los adjuntos anteriores; una imagen ya guardada en la caché del dispositivo puede abrirse offline. El máximo existente es 50 MB por archivo. No se admiten SVG ni se descargan automáticamente imágenes externas de cualquier URL pegada.

Las copias portátiles incluyen los archivos de Material y reasignan sus referencias al importar en otra cuenta. **Exportar HTML** incorpora las imágenes dentro del archivo descargado, sin URLs temporales. Imprimir/PDF usa las imágenes visibles del documento. Para trasladar todo a otra cuenta, utiliza la copia portátil; un HTML no sustituye a la copia de seguridad.

## Actualizar desde v14.2.1

El ZIP contiene solo archivos nuevos/modificados **sobre v14.2.1**. Sube el contenido de **actualizar/** a la raíz del repositorio, conservando rutas y sustituyendo archivos. Incluye juntos package.json y package-lock.json. No hay dependencias nuevas ni archivos que borrar.

Cloudflare: **npm run build**, salida **out**. Conserva las variables actuales de Supabase. No ejecutes SQL ni crees otro bucket o proyecto. Acepta la actualización en todos tus dispositivos antes de editar documentos con imágenes: las versiones anteriores del editor no reconocen esos bloques.

Detalles: **docs/IMAGENES-MATERIAL-V14.3.md**. Pruebas: **docs/RESULTADOS-V14.3.json**. Los comandos de validación siguen siendo npm run typecheck, npm test y npm run build.

---

Documentación de versiones anteriores, conservada como referencia:

# OpoGC v14.2.1 — Cursor y teclado en Material

Corrección sobre v14.2 para evitar que el autoguardado interrumpa la escritura en Material de estudio.

Se reprodujo una pérdida de foco: al cambiar saving, el panel cambiaba dismissible y su efecto volvía a enfocar el diálogo, quitando el foco del editor. Ahora toma el foco solo al abrirse y consulta las reglas actuales de cierre sin reenfocar al guardar. Además, las opciones de Tiptap se mantienen estables y las ediciones locales no se devuelven como una carga externa del documento en cada pulsación.

Se conservan Markdown, formato, tablas, borradores, guardado automático, modo lectura y conflictos. No se intercepta Backspace ni se introducen readonly temporales, blur repetidos o foco automático de campos.

## Actualizar desde v14.2

El ZIP contiene solo archivos nuevos/modificados **sobre v14.2**. Sube el contenido de **actualizar/** a la raíz del repositorio, conservando rutas y sustituyendo archivos. Incluye juntos package.json y package-lock.json. No hay archivos que eliminar ni dependencias nuevas.

Cloudflare: **npm run build**, salida **out**. Conserva las variables de Supabase y acepta la actualización en todos los dispositivos. No requiere SQL ni reconfigurar el backend. Si usas una versión anterior, aplica primero los parches v14.1 y v14.2 correspondientes.

Detalles y validación: **docs/CURSOR-MATERIAL-V14.2.1.md** y **docs/RESULTADOS-V14.2.1.json**. Pruebas nuevas: **tests/ui/material-cursor.spec.ts**.

---

Documentación anterior, conservada como referencia:

# OpoGC v14.2 — Estudio más fluido

Optimización sobre v14.1 para escribir respuestas, seleccionar opciones y avanzar entre tarjetas con bibliotecas grandes. Conserva las sesiones múltiples, Material, datos y algoritmo de memorización.

## Qué cambia

- La escritura y las opciones de test se actualizan dentro de la tarjeta, sin renderizar la aplicación completa por cada pulsación.
- Biblioteca no analiza todos los textos fuera de su pantalla ni con la búsqueda vacía. Las búsquedas reutilizan el texto convertido cuando el contenido no cambia.
- La pantalla de fondo conserva su estado durante el repaso y se actualiza al salir. Los cálculos de memoria/pendientes reutilizan sus datos y se evalúa la probabilidad una sola vez por tarjeta al ordenar.
- Cada edición deja un borrador local pequeño, separado por cuenta y sesión. El checkpoint completo se agrupa tras 1,5 segundos de pausa; al salir o cambiar de aplicación se fuerza el guardado. Recargar permite recuperar el borrador compatible con la misma sesión y turno.
- El guardado general evita recorrer colecciones que no cambian y calcula los contadores con un índice del historial. La valoración sigue esperando la confirmación local antes de avanzar.

## Resultados medidos

Tres ejecuciones por versión, mismos datos sintéticos de 2.200 tarjetas / 4.000 repasos y unos 13 MB de texto, Chromium con React de desarrollo:

| Acción | Mediana v14.1 | Mediana v14.2 |
| --- | ---: | ---: |
| Escribir 18 caracteres (con 10 ms programados entre teclas) | 24,19 s | 0,30 s |
| Comprobar respuesta escrita | 2,55 s | 0,04 s |
| Guardar y continuar | 5,99 s | 0,27 s |

Es una comparación reproducible en este entorno, no una medición en tu Mac, Safari o la PWA instalada ni una garantía de esos tiempos en todos los dispositivos. Detalles y muestras: **docs/RENDIMIENTO-V14.2.json**. Reproducción con Chromium instalado para Playwright: **node scripts/benchmark-review.mjs ruta-resultados.json**. Puede indicarse CHROMIUM_EXECUTABLE si se usa un navegador externo.

## Actualizar desde v14.1

El ZIP contiene solo archivos nuevos/modificados **sobre v14.1**. Sube el contenido de **actualizar/** a la raíz del repositorio conservando rutas y sustituyendo archivos. No subas una carpeta adicional llamada actualizar. Incluye juntos package.json y package-lock.json. No hay dependencias nuevas ni archivos que borrar.

Cloudflare: **npm run build**, salida **out**. Conserva las variables actuales y acepta la actualización de OpoGC en todos los dispositivos. No ejecutes SQL ni reconfigures Supabase. Si aún estás en v14, aplica primero el parche de sesiones múltiples v14.1.

Detalles técnicos y compatibilidad: **docs/OPTIMIZACION-V14.2.md**. Pruebas ejecutadas: **docs/PRUEBAS-V14.2.md**. Los comandos siguen siendo npm ci, npm run typecheck, npm test y npm run build.

---

Documentación de versiones anteriores, conservada como referencia:

# OpoGC v14.1 — Varias sesiones guardadas

Puedes guardar varias sesiones de tarjetas y elegir cuál continuar. Por ejemplo, Constitución y Ley 40/2015 conservan por separado su selección, orden, tarjeta actual, respuesta escrita, valoraciones de la sesión y refuerzos pendientes.

## Cómo utilizarlo

1. Selecciona los temas o tarjetas en **Biblioteca** y empieza en el modo que prefieras.
2. **Salir** guarda esa sesión sin finalizarla.
3. Empieza otra selección: la sesión anterior se conserva automáticamente.
4. Desde **Hoy**, **Biblioteca**, **Repasar** o el temario, pulsa **Continuar sesión** para la más reciente, o **Ver las N sesiones** para elegir otra.
5. **Finalizar** pide confirmación y cierra solo la sesión elegida. Las tarjetas y el historial se conservan. Las vueltas completadas también permanecen guardadas hasta finalizarlas expresamente.

La sesión que ya existía se adopta automáticamente con el mismo ID y progreso. No hay caducidad ni un límite artificial de una sola sesión. No se cambia el algoritmo de repetición ni la cola particular de ortografía. Si una tarjeta pertenece a varias sesiones, el progreso de cada sesión es independiente; su historial y próxima fecha de repaso siguen siendo únicos para esa tarjeta.

## Actualización desde v14

El ZIP es **un parche sobre OpoGC v14**, no el proyecto completo. Copia **el contenido de actualizar/** a la raíz del repositorio, respetando carpetas y sustituyendo archivos. No subas la carpeta actualizar como una carpeta nueva. Incluye juntos package.json y package-lock.json; cambia la versión, sin añadir ni actualizar dependencias. No hay archivos que eliminar manualmente.

Conserva Cloudflare **npm run build**, salida **out**, y las variables existentes. No ejecutes SQL ni reconfigures Supabase. Tras desplegar, acepta la actualización de OpoGC en todos tus dispositivos para que usen la misma versión. Necesitas tener aplicada v14; este parche no incorpora de nuevo el editor ni las reparaciones de versiones anteriores.

Pruebas: **docs/PRUEBAS-V14.1.md**. Diseño y compatibilidad: **docs/SESIONES-MULTIPLES-V14.1.md**. Validación local: npm ci, npm run typecheck, npm test y npm run build.

---

Documentación de Material de estudio (v14), conservada como referencia:

# OpoGC v14 — Material de estudio

Nueva sección de documentos editables, integrada en la aplicación real. Acceso desde **Biblioteca → Material de estudio** y **Más → Material de estudio**. Conserva las sesiones, tarjetas y backend existentes.

## Usar Material de estudio

1. Crea un tema y sus subapartados o pulsa **Copiar estructura de Biblioteca** para previsualizar y copiar sus carpetas. La copia es independiente; no modifica tarjetas ni duplica ramas ya copiadas.
2. Pulsa **Leer** o **Contenido de…** para abrir el documento del apartado.
3. Pega texto desde ChatGPT: el Markdown se convierte en títulos, negritas, cursivas, listas y tablas. Si el portapapeles contiene HTML enriquecido, se conserva ese formato compatible. También puedes importar TXT, MD y HTML.
4. Edita desde la barra de herramientas. **··· Más formato** muestra fuente, tamaño, colores, alineación, interlineado, listas numeradas/alfabéticas, sangrías, tablas, enlaces y deshacer/rehacer.
5. El contenido se guarda automáticamente. **Cerrar** espera al guardado local; la sincronización entre dispositivos usa el motor habitual. También hay lectura, exportación HTML e impresión/PDF desde el navegador.

Tu TXT de Ley 39/2015 se ha probado completo: los 28 títulos se convierten y el contenido textual se conserva íntegro en el editor. El archivo adjunto no se incorpora como datos iniciales ni se publica en el proyecto.

## Actualizar

El ZIP contiene solo archivos nuevos/modificados respecto al commit de OpoAPP inspeccionado, incluyendo la reparación de despliegue v13.2.1 para no depender de archivos anteriores ausentes. Sube **el contenido de actualizar/** a la raíz del repositorio, respetando rutas y sustituyendo archivos. Conserva las variables actuales de Supabase. Cloudflare: **npm run build**, salida **out**. No ejecutes SQL. Para probar localmente: npm ci, npm run typecheck, npm test, npm run build.

Hay dependencias nuevas del editor y del conversor Markdown; package.json y package-lock.json deben subirse juntos. Son paquetes locales de código abierto: no requieren cuenta Tiptap, IA ni API de pago. No hay cambios en FSRS, Auth, RLS, migraciones, Service Worker ni motor de sincronización; el build renueva la revisión de caché PWA como antes.

Detalles y límites: **docs/MATERIAL-DE-ESTUDIO-V14.md**. Pruebas actuales: **docs/PRUEBAS-V14.md**. Inventario y hashes: **ARCHIVOS-DEL-PARCHE.json**, en la raíz del ZIP.

---

# OpoGC v13.2.1 — Corrección del despliegue

## Parche de despliegue sobre el commit con error

Este ZIP corrige la mezcla encontrada en el commit `5d28bde` de OpoAPP: faltaban archivos de v13.1 y seguían rutas del backend anterior. Copia todo el contenido de `actualizar/` a la raíz del repositorio y cambia en Cloudflare el comando a **npm run build**, salida **out**. No uses npx next build: omite la preparación y regeneración PWA del proyecto.

El build aparta únicamente seis archivos antiguos comprobados por su contenido y conserva sus bytes en `legacy-backup/`. No llama a Supabase ni modifica datos. TypeScript comprueba la aplicación activa, configuraciones actuales y pruebas; los archivos sueltos de versiones anteriores quedan fuera de la entrada inicial, sin desactivar errores de tipado ni de build. Los imports de la aplicación siguen comprobándose.

Se reponen el selector de modos, cuatro componentes y pruebas/documentación de v13.1 que no se habían cargado. No se cambia el algoritmo ni la UX de v13.2. Detalle e inventario: `docs/REPARACION-DESPLIEGUE-V13.2.1.md` y `ARCHIVOS-DEL-PARCHE.json` dentro del ZIP.

Actualización del proyecto real **v13.1**. Se limita a la cola de tarjetas, la continuidad de la sesión y el acceso directo a Biblioteca. Conserva FSRS, datos, backend y sincronización existentes.

## Actualización incremental v13.1 → v13.2

El ZIP contiene **solo archivos nuevos o modificados sobre v13.1**. Copia todo el contenido de `actualizar/` a la raíz de OpoAPP, donde ya están `package.json`, `app/`, `components/` y `lib/`. Acepta sustituir y conserva las rutas. No subas una carpeta adicional llamada `actualizar`. No hay archivos que eliminar ni dependencias nuevas.

- **Bien / Fácil:** terminan esa tarjeta en la sesión actual; su próximo repaso sigue calculándolo FSRS.
- **Difícil / Otra vez:** refuerzo separado por otras tarjetas, con prioridad para avanzar por las que faltan y un límite de intentos. Una pausa larga no adelanta las repeticiones.
- **Salir:** guarda y pausa. **Continuar sesión** aparece en Hoy, Biblioteca y Temario y planificación. Conserva tarjeta, cara, respuestas, selección y cola.
- **Finalizar sesión:** cierra el recorrido cuando tú lo decidas, conservando valoraciones e historial. Empezar otra selección exige elegir entre continuar o finalizar la guardada.
- Navegación: **Hoy · Biblioteca · Repasar · Progreso · Más**. El temario sigue en Hoy y en Más → Temario y planificación / Organizar temario.

Cloudflare Pages: **Build command `npm run build`**, salida **`out`**, misma raíz y variables actuales de Supabase. No ejecutes SQL. Actualiza la app en todos tus dispositivos.

Detalles: `docs/ACTUALIZACION-V13.2.md`. Pruebas ejecutadas y límites: `docs/PRUEBAS-V13.2.md`. Inventario exacto: `ARCHIVOS-DEL-PARCHE.json` en la raíz del ZIP.

## Actualizar OpoApp en GitHub y Cloudflare Pages

1. En OpoGC actual, Cuenta → Exportar copia. Espera a que los cambios pendientes queden guardados.
2. Descomprime este ZIP y entra en `actualizar/`. Verás `package.json`, `app/`, `components/`, etc.
3. Abre tu carpeta local del repositorio **OpoApp**, donde ya tienes `package.json`. Copia **el contenido de actualizar/** encima y acepta sustituir archivos. Conserva `.env.local` y `.git`.
4. Abre la terminal en OpoApp. Con Node >=22.13.0 (Node 24 es compatible), ejecuta:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

5. En GitHub Desktop: abre OpoApp, escribe un resumen, pulsa **Commit** y **Push origin**. Si usas Git por terminal, sigue tu procedimiento habitual de commit/push.
6. Cloudflare Pages compilará la rama conectada. Mantén **Build command: npm run build** y **Build output directory: out**, el mismo dominio y las variables de Supabase que ya tienes.
7. Espera a que el despliegue termine correctamente. Abre OpoGC y acepta el aviso de actualización si aparece.

**Esta actualización no requiere migraciones ni volver a ejecutar SQL.** No crees otro proyecto Supabase ni borres datos del navegador, IndexedDB o la PWA. Reutiliza las variables actuales `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, o `NEXT_PUBLIC_SUPABASE_ANON_KEY`. El ZIP no incluye credenciales ni datos privados.

Desarrollo: `npm run dev`. Compilación local: `npm run start`. Navegador de pruebas: `npx playwright install chromium` y `npm run test:ui`.

## Novedades v13

- **Repasar → Mis repasos:** Próximamente, Mal, Regular, Bien y colecciones propias. Crear, renombrar, eliminar, guardar y retirar.
- **Guardar para repasar** desde la pregunta o respuesta, sin calificar ni avanzar. También desde Biblioteca y selecciones múltiples.
- Una tarjeta puede estar en varias colecciones. Permanece guardada hasta retirarla manualmente, aunque la respondas bien o cambie de carpeta.
- Repaso completo o filtrado por uno o varios temas/subtemas. Los padres incluyen descendientes. Ortografía se practica en su sesión específica.
- Selectores comunes con búsqueda sin tildes, ruta, atrás y entrada por niveles. Aplicados a Estudiar, Repasar, Biblioteca, Progreso, historial, planificación, editores, importación y movimientos. Las listas pequeñas de opciones fijas siguen siendo simples.
- **Biblioteca → Seleccionar:** tarjetas y ramas, seguir navegando sin perder selección, seleccionar nivel/resultados o todo, y **Mover a…**. Los padres llevan toda su rama; padre/hijo seleccionados no se mueven dos veces.
- **Temario:** movimiento individual y en grupo a cualquier rama válida o raíz, conservando IDs, vínculos, notas y planificación.
- Las tarjetas movidas a raíz van a una carpeta real reutilizable **Sin carpeta**, compatible con la relación existente de PostgreSQL.
- Colecciones y pertenencias en filas independientes de ajustes existentes: sin duplicar tarjetas, sin cambiar FSRS y sin migraciones SQL. Se exportan/importan con los datos actuales.
- Bottom sheets y editores comparten orden de capas y foco. Abrirlos no enfoca campos de texto ni solicita automáticamente el teclado.

Detalles: `docs/CAMBIOS-V13.md`, `docs/ARCHIVOS-V13.md`, `docs/PRUEBAS.md` y CHANGELOG.

## Uso diario

| Entrada  | Qué hacer                                                                                                                   |
| -------- | --------------------------------------------------------------------------------------------------------------------------- |
| Hoy      | Repasar ahora, retomar la sesión guardada o continuar estudio planificado.                                                  |
| Biblioteca | Acceso directo a tarjetas, carpetas, selección y modos de estudio; continuar sesión guardada. |
| Repasar  | Programados, temario, libre, aleatorio y más falladas.                                                                      |
| Progreso | Detectar contenido que necesita atención e historial.                                                                       |
| Más      | Temario y planificación, Organizar temario, psicotécnicos, cuenta y preferencias.                                                        |

Se conservan barra inferior móvil, lateral en escritorio, safe areas, tablet, scroll interior y formularios a pantalla completa de v11.

## Memoria y sesiones

El adaptador **ts-fsrs 5.4.2 / FSRS-6** y `memoryModel` no cambian respecto a v13.1. Cada intento valorado conserva su registro y programación FSRS. La cola de la sesión y la fecha del siguiente repaso son decisiones distintas.

- Otra vez: no recordada. Difícil: recordada con esfuerzo. Bien: recordada correctamente. Fácil: recordada sin esfuerzo. Un test incorrecto siempre cuenta como fallo.
- Bien y Fácil salen del recorrido actual, incluso si FSRS mantiene un paso de aprendizaje para un repaso posterior.
- Un refuerzo exige hasta ocho tarjetas **distintas** intermedias, o todas las otras si la selección tiene menos de nueve. Tras cada refuerzo entran al menos tres sin ver mientras queden disponibles. No se sustituye esa separación por una espera de tiempo.
- Difícil permite una comprobación posterior; Otra vez, hasta dos. Si falta contenido para separar otro intento, la tarjeta queda por reforzar para un repaso posterior, sin declararla aprendida.
- El contador muestra tarjetas únicas vistas / seleccionadas y pendientes de refuerzo. Pasar una tarjeta no inventa un rating.
- Salir pausa y guarda; la sesión, incluido su resumen, permanece hasta Finalizar. Antes de comenzar otra se pide continuar o finalizar la guardada.
- El checkpoint usa settings e IndexedDB/outbox existentes. Conserva pregunta/respuesta visible, opciones y borrador escrito. Se recupera tras recargar y a través de la sincronización habitual. Para cambiar de dispositivo, sal y espera a que los cambios estén guardados; sin conexión solo pueden enviarse al recuperar conexión.
- Ortografía conserva sus grupos, corrección y cola temporal anterior. No se ha aplicado el cambio de refuerzo de flashcards a las palabras de ortografía.

La calibración personal existente sigue sirviendo para priorizar los repasos recomendados; no se entrenan pesos nuevos ni se añade IA.

## Organización rápida

Más → Organizar temario abre **Hoy / Después / Repasos**. Añade un apartado con una pulsación desde el selector o el menú del temario:

- Estudiar hoy / Añadir a hoy.
- Estudiar después, sin fecha obligatoria.
- Repasar mañana.
- Subir/bajar prioridad, empezar, fecha/nota opcional o quitar del plan.

Las tareas pendientes del mismo apartado y tipo se reutilizan conservando ID y nota. Las completadas permanecen en Historial. Temario sigue accesible con navegación progresiva y búsqueda; JSON/texto, creación, edición, importación/exportación y valoraciones Bien/Regular/Mal siguen disponibles.

## Reordenación

Menú ··· en carpetas, tarjetas y temario: arriba, abajo, sacar un nivel y mover a otra rama. El formulario Editar o mover del temario permite elegir cualquier padre válido. Una rama se mueve cambiando su padre, no recreando sus hijos. No se utiliza drag & drop como requisito: todas las operaciones funcionan con touch y teclado. `sortOrder` es opcional, persistido en el JSONB existente. Los elementos antiguos sin orden explícito conservan su orden anterior.

## Biblioteca → temario

Biblioteca → ··· → **Importar al temario de estudio**.

1. Toda Biblioteca o la carpeta actual, con sus subcarpetas y artículos identificables.
2. Selecciona/desmarca elementos, edita nombres, cambia el padre o saca un nivel.
3. Elige un destino, previsualiza y confirma.
4. Se generan nodos enlazados a carpetas/IDs de tarjetas; no se duplican tarjetas, contenido ni ratings.
   Una segunda importación reutiliza los nodos enlazados existentes. La vista previa indica qué se creará y qué se actualizará. No mezcla por nombre ramas antiguas sin vínculo ni elimina contenido preexistente. Los nombres editados en esta importación pertenecen al temario; no renombran las carpetas de origen. La importación JSON original se conserva.

## Datos y seguridad

Sin cambios en Auth, RLS, SQL, Realtime, Storage, IndexedDB, proyección, motor de sincronización, persistencia de sesión ni importación/exportación. No se resetea contenido ni se insertan seeds. Campos nuevos opcionales dentro del JSONB ya existente; no hay columnas, tablas ni migraciones nuevas. El formato de backup y los nombres internos v10 de almacenamiento/caché permanecen por compatibilidad. No se ha accedido a la cuenta real.
Los formularios no llevan `autoFocus`. Los diálogos enfocan su contenedor y mantienen el trap de teclado, sin restaurar foco sobre inputs al cerrar. Formatear texto no fuerza el foco de un editor no activado.

## Verificar

```bash
npm run check:preserved
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:ui
```

`check:preserved` conserva las huellas históricas v10 y verifica **13 archivos críticos y 21 funciones** intactos. Declara expresamente los dos adaptadores y ocho funciones autorizados a cambiar en v12, cubiertos por pruebas nuevas.
`npm test`: 46 pruebas: 16 SQL/datos, 12 memoria, 7 estudio y 11 colecciones/selección/progreso.
`npm run test:ui`: recorridos en ocho tamaños, sesiones, 50 tarjetas, offline local, overlays, foco, planificación, creación, reordenación, conversión y recuperación de la sesión con reloj controlado. Solo usa fixtures aisladas y los servicios locales reales.
El test de caché PWA de producción usa una compilación sin variables: valida la pantalla de configuración offline, no una sesión autenticada en Safari instalado.
El script existente `npm run test:live` requiere dos cuentas de pruebas confirmadas y `TEST_EMAIL_A`, `TEST_PASSWORD_A`, `TEST_EMAIL_B`, `TEST_PASSWORD_B`. **No se ejecutó contra tu Supabase ni tu cuenta.**

Consulta `docs/MEMORIA-V12.md` (auditoría y comportamiento), `docs/PRUEBAS.md` (resultados y límites), `docs/ARCHIVOS-V13.md` y `CHANGELOG.md`. Capturas reales de navegador en `docs/capturas/`, con datos de prueba. Los documentos V10/V11 se conservan como referencia histórica, no como instrucciones de esta actualización.
