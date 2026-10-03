# OpoGC v12 — Memoria y estudio

Aplicación real sobre OpoGC v11 Mobile UX, con el mismo Supabase y los mismos datos. Esta iteración mejora el aprendizaje, la planificación y la relación Biblioteca → Estudiar → Repasar. No es una demo; las fixtures solo pertenecen a los tests.

## Actualizar la rama actual

1. Sustituye el código por el contenido de `opogc/` de este ZIP. Conserva tu `.env.local`, las variables del despliegue, el dominio y el mismo proyecto Supabase.
2. Desde la carpeta con `package.json`, con Node >=22.13.0:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

3. Despliega `out/` mediante tu procedimiento actual y acepta la actualización de la PWA. No borres el almacenamiento del sitio, IndexedDB ni la sesión.
   **No requiere migraciones SQL ni volver a configurar Supabase.** Los SQL conservados son para instalaciones nuevas, no para volver a ejecutarlos al actualizar.
   Reutiliza `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` actuales; sigue admitiéndose `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Nunca uses `service_role` en el cliente. El ZIP no contiene credenciales ni datos privados. Desarrollo: `npm run dev`; compilación local: `npm run start`.

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
`npm test`: 16 pruebas anteriores + 12 de memoria + 7 de planificación/jerarquías/conversión.
`npm run test:ui`: recorridos en ocho tamaños, sesiones, 50 tarjetas, offline local, overlays, foco, planificación, creación, reordenación, conversión y recuperación de la sesión con reloj controlado. Solo usa fixtures aisladas y los servicios locales reales.
El test de caché PWA de producción usa una compilación sin variables: valida la pantalla de configuración offline, no una sesión autenticada en Safari instalado.
El script existente `npm run test:live` requiere dos cuentas de pruebas confirmadas y `TEST_EMAIL_A`, `TEST_PASSWORD_A`, `TEST_EMAIL_B`, `TEST_PASSWORD_B`. **No se ejecutó contra tu Supabase ni tu cuenta.**

Consulta `docs/MEMORIA-V12.md` (auditoría y comportamiento), `docs/PRUEBAS.md` (resultados y límites), `docs/ARCHIVOS-V12.md` y `CHANGELOG.md`. Capturas reales de navegador en `docs/capturas/`, con datos de prueba. Los documentos V10/V11 se conservan como referencia histórica, no como instrucciones de esta actualización.
