# OpoGC 10.0 — cuentas y sincronización automática

Evolución de los componentes OpoGC 9.17.2, con Next.js, React y TypeScript. La interfaz y el CSS de la versión adjunta se conservan. Supabase es el backend real: Auth, PostgreSQL, RLS, Realtime y archivos privados. No hay autenticación ni base de datos simuladas en la aplicación.

**Antes de empezar:** el ZIP antiguo era un parche: solo incluía `OpoApp.tsx`, `globals.css`, `LocalDataManager.tsx` y notas de versión. Este proyecto completa los archivos de ejecución y las dependencias que faltaban. No contiene tu progreso personal ni tu cuenta de Supabase. Consulta `docs/ANALISIS-Y-CAMBIOS.md` para conocer el alcance de lo recuperado.

## 1. Crear Supabase gratuito

1. Abre https://supabase.com/dashboard y crea tu cuenta.
2. Crea una organización en **Free**, sin pasar a Pro ni añadir servicios de pago.
3. **New project**: nombre `opogc`, región europea y contraseña fuerte para la base de datos. Esta contraseña no va en la PWA.
4. Espera a que el proyecto esté disponible.
5. En **Connect** o **Project Settings → API / API Keys**, copia **Project URL** y la clave **Publishable** (`sb_publishable_...`). Si tu panel ofrece la clave antigua **anon**, también sirve.
6. No copies `service_role`, `sb_secret_...`, la contraseña PostgreSQL ni una clave privada al frontend.

## 2. Ejecutar las migraciones

En **SQL Editor → New query**, abre, copia y ejecuta **en este orden**, en un proyecto nuevo:

1. `supabase/migrations/202609300001_core.sql`
2. `supabase/migrations/202609300002_storage.sql`

Son migraciones de instalación, no scripts para ejecutarlos repetidamente. Con Supabase CLI pueden aplicarse mediante `supabase link --project-ref TU_REFERENCIA` y `supabase db push`, una vez conectado a tu proyecto.

La primera crea perfiles, oposiciones, temarios, nodos, estados, tareas, sesiones de estudio, tarjetas, respuestas, psicotécnicos, intentos, anotaciones y configuración. Incluye claves foráneas por propietario, RLS, RPC de escritura y lectura incremental, recibos idempotentes y publicación Realtime de `sync_heads`. La segunda crea `opogc-private` y sus políticas de archivos privados.

Verifica en **Table Editor** que las tablas tienen RLS y en **Database → Replication / Publications** que `sync_heads` pertenece a `supabase_realtime`. Las migraciones ya lo configuran cuando la publicación existe.

## 3. Configurar Authentication

En **Authentication → Sign In / Providers**, habilita **Email** y el registro mediante contraseña.

En **Authentication → URL Configuration**:

- **Site URL**: durante las pruebas, `http://localhost:3000`; después, tu URL real de Cloudflare, por ejemplo `https://TU_APP.pages.dev`.
- **Redirect URLs**: añade `http://localhost:3000/` y `https://TU_APP.pages.dev/`. Si usas un dominio propio, añade también su URL exacta.
- Mantén la confirmación por correo para las cuentas públicas. Al registrarte, confirma el correo antes de iniciar sesión.
- Contraseña mínima de 8 caracteres en el frontend; ajusta también la política de Supabase.

**Correo en Free:** el proveedor SMTP incluido por Supabase tiene restricciones para destinatarios y límites bajos. Para probar sin SMTP propio, usa direcciones autorizadas de tu organización o desactiva temporalmente **Confirm email** en un proyecto de pruebas con cuentas desechables. Para abrir el registro a otras personas, configura un SMTP propio compatible con un plan gratuito y verifica la entrega; el ZIP no contrata ningún proveedor. No dejes una instalación pública con una configuración de correo sin probar.

La app incluye registro, inicio/cierre de sesión, sesión persistente, solicitud de recuperación y cambio de contraseña. El cliente está aislado en `lib/auth/client.ts`; posteriormente puedes añadir `signInWithOAuth` con Google/Apple y sus proveedores, sin modificar el repositorio de datos.

## 4. Variables y ejecución local

Instala Node.js 22.13 o superior. Descomprime el ZIP y abre una terminal **en la carpeta donde está package.json**.

macOS/Linux:

```bash
cp .env.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Edita `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://TU_REFERENCIA.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_TU_CLAVE_PUBLICA
```

Para una clave antigua utiliza `NEXT_PUBLIC_SUPABASE_ANON_KEY=...` en lugar de la variable Publishable. Son valores públicos: la autorización la realizan Auth y RLS.

```bash
npm ci
npm run dev
```

Abre `http://localhost:3000`, regístrate y confirma el correo si está habilitado. Importa tu árbol desde **Estudio → Importar / actualizar**. Una cuenta nueva empieza vacía.

Para una compilación de producción con PWA y funcionamiento offline:

```bash
npm run build
npm run start
```

`out/` es el frontend compilado. `npm run dev` no activa el Service Worker para evitar cachés durante desarrollo.

## 5. Desplegar en Cloudflare Pages, sin servidor de aplicación

La PWA se genera como archivos estáticos; **sus datos y autenticación son dinámicos y reales en Supabase**. No necesita API de Next en Cloudflare, D1, R2, Functions ni Workers adicionales.

### Desde GitHub

1. Crea un repositorio, añade el proyecto y `package-lock.json`. No subas `.env.local`, `node_modules` ni `.next`.
2. Cloudflare: **Workers & Pages → Create application → Pages → Import an existing Git repository**.
3. Selecciona el repositorio y configura:

| Opción | Valor |
|---|---|
| Preset | Next.js (Static HTML Export), o None con los siguientes valores |
| Build command | `npm run build` |
| Build output directory | `out` |
| Root directory | carpeta que contiene `package.json` |
| Node | 22.13 o superior; por ejemplo `NODE_VERSION=22.16.0` |

4. Añade `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en las variables de **Production**. Si usas previews, configura también Preview y sus redirect URLs de prueba.
5. Despliega. Copia la URL `https://TU_APP.pages.dev` a Auth según el apartado 3.
6. Si cambias una variable `NEXT_PUBLIC_*`, vuelve a compilar/desplegar: Next la incorpora al bundle.

### Subida manual

Configura `.env.local`, ejecuta `npm ci` y `npm run build`. En **Pages → Upload assets**, sube el contenido de **out**, no el código fuente. También puedes usar `npx wrangler pages deploy out --project-name TU_PROYECTO` tras autenticar tu cuenta de Cloudflare. El ZIP no ejecuta ese despliegue ni crea cuentas en tu nombre.

Mantén el mismo origen que la instalación anterior si quieres detectar su almacenamiento local. Un nuevo subdominio no puede leer el IndexedDB de otro dominio: usa una copia JSON para ese traslado inicial.

## 6. Migrar desde 9.17.2

1. Antes de sustituir la instalación antigua, exporta una copia completa de progreso desde **Datos** en cada dispositivo que tenga cambios propios.
2. Conserva también los PDFs/imágenes originales. El ZIP adjunto no contenía esos archivos. Las URL antiguas no son una copia portátil si se elimina el servidor anterior.
3. Actualiza en el mismo dominio, inicia sesión y acepta **Importar a mi cuenta** cuando se detecten datos locales.
4. Se inspeccionan los almacenamientos OpoGC de IndexedDB/localStorage y las respuestas `/api/state` ya presentes en la caché antigua. No se consultan copias de nube compartidas sin autenticar.
5. Si no aparece el aviso, usa **Cuenta → Importar copia de seguridad** con los JSON anteriores. La importación fusiona IDs estables, conserva historial/comentarios y no elimina registros de tu cuenta.
6. Repite la importación en otros dispositivos si guardaban registros que no estaban en la primera copia. El progreso FSRS más avanzado y los repasos completados se conservan al fusionar una copia antigua.
7. La huella SHA-256 evita procesar dos veces la misma copia en el mismo dispositivo; los IDs de registros y sesiones importadas evitan duplicados en la base de datos.

Si falta un archivo antiguo, la importación muestra el problema y no borra la copia original. Reimporta mientras su URL original sea accesible o conserva/reasocia el archivo. Las nuevas copias de esta versión incluyen los archivos asociados y anotaciones, además del progreso. Para exportarlos por primera vez es necesaria conexión si aún no se han descargado.

## 7. Cómo comprobar dos dispositivos

1. PC: inicia sesión como **A** e importa un temario con Tema → Título → Artículo → Apartado.
2. Registra un repaso, complétalo como **Bien** y añade un comentario. Espera a **Todos los cambios guardados** en Cuenta.
3. iPhone/iPad: abre la misma URL e inicia sesión con **A**. El árbol, resultado y comentario deben aparecer sin importar JSON.
4. Mantén ambas sesiones abiertas. Crea otro repaso desde el segundo dispositivo y complétalo como **Mal**. Comprueba que ambos aparecen en **Estudio → Historial** en el PC.
5. Desconecta un dispositivo: crea un repaso y añade un comentario. Recarga; deben conservarse. Recupera Internet y verifica que llegan al otro dispositivo.
6. Cierra sesión y entra como **B**: la cuenta debe estar vacía y no mostrar registros de A.
7. Vuelve a A y verifica sus datos. La cola pendiente de A nunca se sube con la sesión de B.

El aviso de Realtime provoca lectura incremental. Además, se comprueban cambios al volver a la app, al recuperar Internet y cada 30 segundos en primer plano, como respaldo si una conexión Realtime falla. Los navegadores móviles suspenden las apps en segundo plano; la actualización se reanuda al abrirlas.

## 8. Instalar la PWA

- iPhone/iPad: Safari → Compartir → **Añadir a pantalla de inicio** → abrir la app instalada.
- Android/Chrome: menú → **Instalar aplicación / Añadir a pantalla de inicio**.
- PC/Chrome o Edge: icono de instalación de la barra del navegador.

Usa HTTPS en Cloudflare; localhost es válido para pruebas. La instalación requiere abrirla online por primera vez. La caché del Service Worker contiene solo recursos públicos de la aplicación; los datos privados se guardan en IndexedDB separado por cuenta. En la versión de producción se precargan los chunks para poder abrirla sin red. Las actualizaciones muestran un aviso; la cola persistente no depende del bundle que se recarga.

## 9. Pruebas

```bash
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:ui
```

- `npm test`: migraciones reales sobre PostgreSQL WASM (PGlite), roles/RLS, relaciones, transacciones, idempotencia, conflictos, borrado, historial y persistencia/outbox de IndexedDB.
- `npm run test:ui`: navegador, siete tamaños de pantalla, componentes originales y modales, manifest/Service Worker y apertura offline del frontend de producción. Las fixtures de `tests/ui` son exclusivamente para probar componentes, no forman parte de `out/` y no sustituyen Supabase.
- El test PWA incluido espera la compilación **sin variables** que muestra la pantalla de configuración. Para una compilación ya conectada, verifica la instalación y Auth según el apartado 7 o adapta esa expectativa.

Pruebas contra **tu Supabase real**, con dos cuentas desechables confirmadas:

```dotenv
# Añadir a .env.local solo para el script local:
TEST_EMAIL_A=tu-cuenta-de-pruebas-a
TEST_PASSWORD_A=contraseña-de-pruebas-a
TEST_EMAIL_B=tu-cuenta-de-pruebas-b
TEST_PASSWORD_B=contraseña-de-pruebas-b
```

```bash
npm run test:live
```

El script utiliza únicamente claves públicas y Auth real; comprueba persistencia tras cerrar sesión, lectura desde otra sesión, RLS, historial, reintentos y Realtime. Limpia los registros que crea mediante borrado lógico; no elimina las cuentas de prueba. **No se ha ejecutado contra un proyecto de Supabase en esta entrega: no se proporcionó uno.** Consulta el informe `docs/PRUEBAS.md`.

## 10. Arquitectura y límites iniciales

`OpoApp` conserva la lógica de estudio. `SyncEngine` convierte los cambios de la UI en operaciones por registro/campo, las guarda transaccionalmente con el estado local y las envía a `apply_operations`. PostgreSQL aplica lotes atómicos, verifica relaciones por propietario, registra recibos y avisa por `sync_heads`. `pull_changes` actualiza la caché por revisiones; nunca sustituye la cuenta entera con un archivo JSON.

Los repasos y respuestas tienen IDs propios. Dos dispositivos pueden aportar eventos sin pisarlos, incluso si completan la misma tarea. Las ediciones simultáneas de un mismo campo se resuelven por el orden en que llegan al servidor; el diario guarda ambas operaciones y señala conflictos. Las ediciones de campos distintos se fusionan. Los borrados prevalecen sobre ediciones antiguas para no resucitar elementos. No hay selector de versiones para el usuario.

Se pueden consultar contenidos descargados y crear/editar estructuras, tarjetas de texto, tareas, valoraciones y comentarios offline. La primera sesión, nuevos archivos y los correos de Auth requieren red. IndexedDB debe estar disponible; el navegador puede borrar datos locales si elimina el almacenamiento del sitio. No borres ese almacenamiento mientras haya operaciones pendientes.

Supabase Free incluye actualmente 500 MB de base de datos, 1 GB de archivos, 50.000 usuarios activos mensuales, 200 conexiones Realtime y 2 millones de mensajes/mes; puede pausar proyectos inactivos una semana. El límite gratuito de archivo es 50 MB, por eso se reduce el antiguo máximo de 100 MB y se añaden subidas reanudables. No se activan planes de pago. Vigila Usage y conserva backups: Free no incluye copias automáticas de PostgreSQL. Revisa las cuotas antes de abrir el servicio a muchos usuarios.

Fuentes oficiales consultadas el 30/09/2026:

- https://supabase.com/pricing
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/realtime/postgres-changes
- https://supabase.com/docs/guides/storage/uploads/resumable-uploads
- https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/
