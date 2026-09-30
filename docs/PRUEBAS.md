# Pruebas — OpoGC v11 - Mobile UX

Fecha de entrega: 30/09/2026. Base inspeccionada: ZIP completo de OpoGC v10.0 Supabase. No se utilizó la cuenta privada ni se modificaron datos remotos.

## Resultados ejecutados

| Comprobación | Resultado | Evidencia / alcance |
|---|---|---|
| TypeScript estricto | PASS | `npm run typecheck` y verificación TypeScript de Next. |
| Compilación de producción | PASS | `npm run build`; export estático Next completo. |
| Integridad del núcleo v10 | PASS | 15 archivos byte a byte y 29 funciones de negocio por huella de AST. Huellas obtenidas del ZIP original. |
| Datos y persistencia | PASS · 16/16 | 7 pruebas PostgreSQL/PGlite + 9 de IndexedDB/proyección/outbox originales. |
| Navegador y UX | PASS · 25/25 | Chromium automatizado, ocho tamaños y flujos descritos debajo. |
| Capturas | PASS | Siete PNG de la interfaz implementada; contenido de la fixture de pruebas. |

**Las pruebas locales no sustituyen una prueba contra el Supabase de producción.** No se recibió su URL/clave pública ni cuentas de prueba en esta iteración. Auth, envío/recepción Realtime y Storage HTTP reales no se han ejecutado aquí. Se conserva el código que el usuario indica que ya funciona en v10.

## Tamaños y recorridos UX

Cada tamaño recorre Hoy → Repaso → valoración → Hoy → Estudio → valoración con nota → siguiente → Temario → editar/cerrar → Progreso. Comprueba cinco destinos, controles visibles, límite del viewport, ausencia de overflow horizontal, posición de scroll restaurada y ausencia de errores JavaScript.

| Dispositivo / viewport | Tamaño | Resultado |
|---|---|---|
| iPhone pequeño | 390 × 844 | PASS |
| iPhone grande | 430 × 932 | PASS |
| Android pequeño | 360 × 800 | PASS |
| Android grande | 412 × 915 | PASS |
| iPad vertical | 768 × 1024 | PASS |
| iPad horizontal | 1024 × 768 | PASS |
| Desktop | 1366 × 768 | PASS |
| Desktop grande | 1920 × 1080 | PASS |

Se ejecuta en Chromium de escritorio con esos viewports. No se afirma validación en Safari/WebKit ni en hardware iPhone/Android. Los `env(safe-area-inset-*)` están implementados; el home indicator y la Dynamic Island requieren la comprobación física indicada abajo.

## Pruebas de flujo adicionales

- Cinco tarjetas consecutivas: cinco registros con IDs propios y actualización del estado FSRS.
- Cincuenta tarjetas seguidas: sin volver a configurar, sin perder registros.
- Bien, Regular y Mal con notas distintas: siguiente automático y datos conservados al recargar IndexedDB; tres eventos de sesión.
- Árbol: creación, renombrado, movimiento, orden manual y eliminación; el ID se conserva en edición/movimiento.
- Búsqueda y tipos de Biblioteca: vocabulario, test múltiple, respuesta escrita con rúbrica y ortografía, además de flashcards.
- Tarjeta larga: scroll interior y valoración visible sin tener que ir hasta el final del contenido.
- Psicotécnicos: listado, ficha, intento existente, nota y apertura del formulario de registro.
- Bottom sheet: arrastre para cerrar, Escape, foco, cuenta y reducción de altura.
- Temario de doce niveles: navegación atrás y cambio de orientación sin overflow.
- Teclado: reducción del viewport a 500 px y simulación de `visualViewport` con altura 480 px/offset 80 px. No reproduce el teclado físico de Safari.
- Offline: valoración y nota durable en IndexedDB, operación en outbox y backup portable con IDs/historial conservados. La prueba no envía el outbox al Supabase remoto.
- Cuenta vacía: no aparece seed data ni se reinician datos existentes.
- Editor de tarjetas e importación: pantalla completa móvil, controles/formulario accesibles y cierre.
- Imagen y PDF sobre formulario: portal al body, tamaño de pantalla, capa superior, foco y Escape sin cerrar el formulario inferior. Esta prueba no abre un archivo privado real ni verifica su subida HTTP.
- Planificación heredada de v10: motivo conservado, valoración y siguiente desde Repasar → Repasos del temario, sin contar como estudio nuevo.
- Plan mixto: una prioridad de estudio continúa únicamente los elementos de estudio; conserva pendientes los repasos distintos.
- PWA de producción sin configuración: manifest standalone, iconos, Service Worker y recarga de su pantalla de configuración offline. No equivale a una sesión autenticada instalada.

## Matriz obligatoria A–O

| Test | Resultado real de esta entrega | Pendiente externo |
|---|---|---|
| A · Login, cerrar PWA, reabrir y sesión | Gestión de Auth/sesión conservada byte a byte. | Iniciar sesión y reabrir PWA instalada contra tu proyecto. |
| B · PC → iPhone | Motor y fusiones conservados; concurrencia y campos verificados localmente. | Recepción Realtime entre dispositivos autenticados. |
| C · iPhone → PC | Mismo motor; persistencia/transacciones verificadas localmente. | Envío/recepción en ambos dispositivos reales. |
| D · Offline, modificar, recuperar conexión | PASS local: escritura durable, outbox y conservación al recargar. | Confirmar entrega al servidor y aparición en el otro dispositivo. |
| E · A nunca ve B | PASS SQL/RLS/RPC, propiedad de relaciones y políticas Storage; aislamiento local/token PASS. | Peticiones HTTP con dos cuentas de tu proyecto. |
| F · Importar/exportar copia | PASS portable: preparar, JSON, parsear, validar y conservar IDs/historial; tests originales de fusión. | Descarga/subida de los adjuntos privados reales y gesto de descarga del navegador móvil. |
| G · Repaso desde Hoy | PASS UI: una pulsación abre sesión. | — |
| H · Varias tarjetas seguidas | PASS UI: 5 y 50 tarjetas; registros y estado FSRS. | — |
| I · Estudio desde Hoy | PASS UI: una pulsación abre planificación. | — |
| J · Bien/Regular/Mal y nota | PASS UI/IndexedDB: las tres valoraciones y sus notas. | — |
| K · Siguiente automático | PASS UI: siguiente después de guardar; sin volver al árbol. | — |
| L · Crear/editar/mover/reordenar/eliminar | PASS UI: todas las operaciones y conservación de ID al editar/mover. | — |
| M · Todos los tipos de tarjeta | PASS UI: flashcard, vocabulario, test múltiple, escrita y ortografía. Parser/importación original conservado. | Adjuntos de una cuenta real. |
| N · Psicotécnicos | PASS UI: listado, ficha, nota, resultado e intento; lógica existente conservada. | PDFs/imagen y anotación sobre archivos privados reales. |
| O · Standalone instalada | PASS manifest, recursos y caché offline del frontend. | Instalación y reapertura física en Safari/Android. |

## Comprobación final en tu instalación

Usa el mismo dominio y proyecto ya configurados. No hace falta migrar datos.

1. Inicia sesión como A en PC e iPhone/PWA. Cierra y vuelve a abrir la PWA: conserva sesión y datos.
2. Desde Más → Organizar temario crea un elemento, planifica un estudio o repaso, y espera al estado Guardado. Comprueba su aparición en el otro dispositivo. Repite en sentido inverso.
3. Abre una sesión desde Hoy, registra Bien con nota y confirma historial y siguiente elemento. Repite Regular y Mal.
4. Desconecta la PWA, completa otro elemento, cierra/reabre y confirma su persistencia. Recupera red: aparece en el otro dispositivo sin botones de sincronización.
5. Con una cuenta de prueba B, comprueba que no aparecen los datos de A. Regresa a A sin perder su cola.
6. Exporta desde Más → Cuenta y datos, conserva el JSON e importa una copia compatible. Comprueba IDs, historial y adjuntos.
7. Abre un PDF y una imagen existentes, anota y comprueba que las anotaciones siguen sincronizadas.
8. En PWA standalone, ambas orientaciones: barra inferior por encima del home indicator, encabezado fuera de la zona superior, campos al abrir teclado y capa inferior inmóvil al cerrar paneles.

`npm run test:live` conserva el script de v10 para dos cuentas desechables confirmadas. Usa Auth y RPC reales, RLS y Realtime; no necesita clave privada. Sus resultados no se incluyen como PASS porque no se ejecutó aquí.

## Reproducir

```bash
npm ci
npm run check:preserved
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:ui
```

Con un Chromium disponible en otra ruta puede usarse `CHROMIUM_EXECUTABLE=/ruta/chromium npm run test:ui`. El servidor estático de pruebas solo sirve `out/` localmente; no cambia el alojamiento de producción. El informe resumido de la ejecución está en `docs/ui-results.json` y las pruebas en `tests/ui/responsive.spec.ts`.
