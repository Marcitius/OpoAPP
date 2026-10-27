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
