# OpoGC v11 - Mobile UX

Aplicación completa sobre la base funcional de OpoGC v10. La pantalla inicial es **Hoy**: repasar y continuar el estudio planificado se abren directamente. Supabase sigue siendo el backend real. Las cuentas existentes usan los mismos datos y los mismos IDs.

## Actualizar tu v10

1. Sustituye el código de tu rama por el contenido de `opogc/` de este ZIP. Conserva tu `.env.local` y las variables del despliegue actual.
2. Mantén **el mismo proyecto Supabase, la misma URL y la misma clave pública**. Mantén también el dominio actual de la app para conservar el almacenamiento y la sesión de la PWA.
3. Ejecuta, desde la carpeta de `package.json`:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

4. Despliega `out/` mediante el procedimiento que ya usabas. En Cloudflare Pages siguen siendo `npm run build` y directorio de salida `out`.
5. Abre la app y acepta el aviso de actualización cuando aparezca. La sesión y la cola se mantienen con el mecanismo de v10.

**Esta actualización no requiere SQL, migraciones nuevas ni reconfigurar Supabase.** Los dos SQL existentes se conservan para instalaciones nuevas; no debes volver a ejecutarlos para actualizar una v10 configurada. No borres IndexedDB, el almacenamiento del sitio ni los datos de tu cuenta como paso de actualización. No hace falta reimportar tu progreso.

El ZIP contiene código fuente y documentación; no contiene claves ni una copia de tus datos privados. Antes de compilar, reutiliza la configuración que ya funciona:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO_ACTUAL.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICA_ACTUAL
```

La variable antigua `NEXT_PUBLIC_SUPABASE_ANON_KEY` continúa admitida. No uses una clave privada o `service_role`. Para desarrollo: `npm run dev`. Para servir la compilación: `npm run start`. Se conserva Node.js >=22.13.0 y el mismo conjunto de dependencias de v10.

## Nueva navegación

| Entrada | Uso principal |
|---|---|
| Hoy | Pendientes, prioridades y dos acciones directas: Repasar ahora / Continuar estudio. |
| Estudiar | Continuar una planificación o buscar y empezar rápidamente un apartado. |
| Repasar | Tarjetas programadas, repaso libre, repasos del temario y modos alternativos. |
| Progreso | Apartados débiles, tarjetas que cuestan, evolución, días y acceso al historial. |
| Más | Biblioteca, psicotécnicos, organización avanzada, cuenta/datos y preferencias. |

En móvil, la barra inferior tiene icono y texto y respeta la zona segura. En escritorio, las mismas cinco entradas aparecen en una barra lateral. El temario dispone de lista y detalle en tablet cuando hay espacio.

## Sesiones de estudio y repaso

**Tarjetas:** Hoy → Repasar ahora. Se oculta la navegación y se mantiene visible el avance. Los controles de revelar/comprobar y Otra vez / Difícil / Bien / Fácil están al alcance sin bajar hasta el final de una tarjeta larga. Se conservan FSRS, vocabulario, test simple/múltiple, respuesta escrita, ortografía, aprendizaje, aleatorio y más falladas.

**Estudio:** Hoy → Continuar estudio. Terminar estudio abre la valoración Mal / Regular / Bien y una nota opcional; Guardar y siguiente guarda mediante el motor existente y abre el siguiente elemento automáticamente. Si no hay estudio planificado, Estudiar ahora abre un selector rápido. Las sesiones sin planificación generan el registro existente al completar el apartado, no al abrirlo.

Los repasos del temario existentes permanecen en **Repasar → Repasos del temario** y en **Más → Organizar temario → Hoy**. Conservan su motivo original. Para nuevas planificaciones, el panel permite escoger Estudiar o Repasar usando el campo `reason` ya existente (`estudio` para estudio). Esto separa los contadores diarios sin migrar ni reclasificar registros antiguos.

**Organizar:** Más → Organizar temario. El árbol se recorre nivel a nivel, con atrás y búsqueda global. El menú ··· permite editar/mover, reordenar hermanos, añadir, importar, exportar y eliminar. Para estudiar no es obligatorio pasar por este árbol.

**Biblioteca:** búsqueda global por contenido y carpeta, filtro por tipo y navegación por carpetas. Creación/edición e importación ocupan toda la pantalla móvil; los modos y acciones secundarias están en ···. **Cuenta** es una pantalla de ajustes con guardado, copias, contraseña y sesión.

## Compatibilidad y conservación

- Sin cambios en Auth, PostgreSQL, RLS, Realtime, motor de sincronización, outbox, esquema o versión de IndexedDB, Storage, FSRS o modelo de memoria.
- Sin seeds nuevos, reinicios de cuenta, IDs reemplazados ni base de datos nueva.
- La versión **10** del formato de backup y los nombres internos `v10` del almacenamiento/caché se conservan deliberadamente por compatibilidad. La aplicación se identifica como 11.0.0.
- El orden manual del temario usa `sortOrder` opcional dentro del JSONB existente del nodo. No añade columnas ni cambia SQL. Los nodos sin este dato mantienen el orden anterior.
- El generador del Service Worker conserva su comportamiento. Regenera únicamente la revisión de recursos y la versión visible para distribuir la nueva interfaz.
- Fuentes de sistema, zonas seguras, `100dvh`, altura de `visualViewport`, campos móviles de 16 px, scroll interior, foco restaurado y movimiento reducido.

El acceso inicial a una cuenta y los nuevos adjuntos siguen requiriendo conexión, como en v10. La sincronización es automática: no se añaden botones de subir, descargar o sincronizar.

## Verificación reproducible

```bash
npm run check:preserved
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:ui
```

`check:preserved` verifica hashes de 15 archivos críticos y huellas estructurales de 29 funciones conservadas de v10. `npm test` ejecuta además las 16 pruebas originales de PostgreSQL/RLS/Storage/IndexedDB/outbox. Las pruebas de navegador recorren ocho tamaños y los flujos reales de la UI con un motor de prueba que utiliza las mismas transacciones y proyecciones locales. Las fixtures solo están en `tests/ui`; **no se compilan en la aplicación** y no reemplazan Supabase.

El test automático de caché PWA usa una compilación sin variables y comprueba la pantalla de configuración offline. Para ejecutarlo sobre una compilación configurada debes adaptar esa expectativa. No es una prueba de sesión autenticada en Safari instalado.

El script existente `npm run test:live` permite validar Auth/RLS/Realtime contra dos cuentas de prueba confirmadas del mismo proyecto usando `TEST_EMAIL_A`, `TEST_PASSWORD_A`, `TEST_EMAIL_B` y `TEST_PASSWORD_B` en `.env.local`. No lo ejecutes con cuentas privadas que no quieras usar para pruebas. No se ejecutó contra tu cuenta en esta entrega: no se facilitaron las credenciales ni un proyecto conectado.

Consulta **docs/PRUEBAS.md** para los resultados reales, los límites de la validación y la matriz A–O; **CHANGELOG.md** para cambios; **docs/ARCHIVOS-V11.md** para el inventario; **docs/capturas/** para las siete capturas solicitadas. La guía de instalación inicial de v10 se conserva como referencia histórica en `docs/INSTALACION-V10.md`; no es el procedimiento para actualizar.
