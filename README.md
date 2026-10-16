# OpoGC v13.1 — Sesiones y modos de estudio

Actualización del proyecto real OpoGC v12. Colecciones permanentes de repaso, filtros por niveles y movimiento de selecciones completas, conservando Supabase, datos y memoria. Las fixtures solo pertenecen a los tests.

## Actualización incremental v13 → v13.1

El ZIP de esta iteración contiene solo archivos nuevos o modificados sobre **OpoGC v13 — Repasos y organización**. Copia el contenido de `actualizar/` a la raíz de OpoAPP, donde ya están `package.json`, `app/`, `components/` y `lib/`. Sustituye los archivos y sube los cambios conservando sus rutas. No subas la carpeta `actualizar` como una carpeta adicional. No hay archivos que eliminar entre v13 y v13.1.

- Durante una tarjeta: **··· → Editar tarjeta**. Guarda y vuelve a la misma tarjeta; pregunta, respuesta, opciones e imágenes usan el editor existente. El teclado se abre al tocar un campo. El cambio de tipo se hace fuera de la sesión.
- En una sesión iniciada desde una colección: **Quitar de «nombre» y continuar**. Retira esa pertenencia y sus futuras apariciones en esa sesión, sin borrar la tarjeta, otras colecciones ni historial. También hay **Quitar de aquí** en cada fila de la colección.
- Al pulsar **Estudiar selección**: elige Aprender, Aleatorio, En orden, Más falladas o Repasos pendientes. Se aplica solo a lo seleccionado. Disponible en Biblioteca, Estudiar y colecciones; las selecciones mixtas permiten elegir tarjetas u ortografía.

Cloudflare Pages: **Build command `npm run build`**, salida **`out`**, raíz donde esté `package.json`. Mantén las variables actuales de Supabase. Los archivos antiguos ajenos a v13 que aparecían en los registros de despliegue no se borran al aplicar este parche; ver `COMIENZA-AQUI.txt`.

Detalle, compatibilidad e inventario: `docs/ACTUALIZACION-V13.1.md`. Pruebas de esta iteración: `docs/PRUEBAS-V13.1.md`. El apartado siguiente conserva la guía de instalación del proyecto completo v13.

## Actualizar OpoApp en GitHub y Cloudflare Pages

1. En OpoGC actual, Cuenta → Exportar copia. Espera a que los cambios pendientes queden guardados.
2. Descomprime el ZIP y entra en `opogc/`. Verás `package.json`, `app/`, `components/`, etc.
3. Abre tu carpeta local del repositorio **OpoApp**, donde ya tienes `package.json`. Copia **el contenido de opogc/** encima y acepta sustituir archivos. Conserva `.env.local` y `.git`.
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
| Estudiar | Aprender tarjetas nuevas, retomar una sesión o elegir un apartado. Los apartados enlazados abren sus tarjetas directamente. |
| Repasar  | Programados, temario, libre, aleatorio y más falladas.                                                                      |
| Progreso | Detectar contenido que necesita atención e historial.                                                                       |
| Más      | Biblioteca, Organizar estudio, psicotécnicos, cuenta y preferencias.                                                        |

Se conservan barra inferior móvil, lateral en escritorio, safe areas, tablet, scroll interior y formularios a pantalla completa de v11.

## Memoria y sesiones

Se mantiene **ts-fsrs 5.4.2 / FSRS-6**, sin cambiar dependencias, retención objetivo (90 %) ni parámetros predeterminados. Se corrige el adaptador para conservar estado, pasos de aprendizaje y número de intentos. **Cada intento real**, también el refuerzo, actualiza FSRS y genera un registro con ID propio.

- Otra vez: no recordada. Difícil: recordada con esfuerzo. Bien: recordada correctamente. Fácil: recordada sin esfuerzo. Un test incorrecto siempre se registra como fallo.
- Las tarjetas nuevas/falladas vuelven según los pasos de aprendizaje/reaprendizaje de FSRS, con separación entre tarjetas cuando hay otras disponibles. No se repiten inmediatamente al agotarse la cola.
- Una tarjeta madura marcada Difícil recibe una comprobación espaciada adicional; su fecha de largo plazo sigue viniendo de FSRS.
- Cuando solo quedan tarjetas esperando, puedes salir y retomar. Si permaneces, reaparecen automáticamente al estar listas.
- Una sesión tiene un conjunto finito. Tras seis intentos débiles de una misma tarjeta se deja explícitamente pendiente de refuerzo, sin declarar que está aprendida ni eliminar su próximo repaso.
- Al finalizar ves estudiadas, recordadas y pendientes de refuerzo. Pasar una tarjeta no inventa una valoración.
- La cola, intentos, esperas y avance se guardan junto al rating y la tarjeta en la transacción/outbox existente. Una sesión activa por cuenta; otra sesión elegida explícitamente sustituye su cola, nunca el historial.
- Ortografía conserva su selección por grupos de hasta cuatro palabras y su corrección automática; ahora utiliza las mismas esperas y persistencia. La rúbrica de respuesta escrita se conserva.

Los contadores históricos de primer encuentro no se inflan con refuerzos; `fsrsReps` registra todos los intentos. Los parámetros FSRS no se entrenan automáticamente: se conserva el modelo existente, que utiliza su memoria acumulada y el historial para priorizar. La calibración personal es una prioridad de cola, no un entrenamiento de pesos.

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
