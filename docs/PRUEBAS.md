# Pruebas ejecutadas — OpoGC v12

Fecha: 2 de octubre de 2026. Proyecto base: ZIP v11 actual. Los fallos iniciales (selectors de navegación/capas en tests nuevos, tipo de fixture y error detectado en sacar un nivel) se corrigieron; resultados finales abajo.

| Comprobación ejecutada                             | Resultado                                            |
| -------------------------------------------------- | ---------------------------------------------------- |
| npm run typecheck                                  | Correcto, sin errores                                |
| npm test: PostgreSQL/PGLite + SQL/RLS/Storage      | 7/7                                                  |
| npm test: datos, IDB/outbox, importación y cuentas | 9/9                                                  |
| npm test: scheduler y sesiones deterministas       | 12/12                                                |
| npm test: jerarquía, planificación y conversión    | 7/7                                                  |
| check:preserved                                    | 13 archivos críticos y 21 funciones conservados      |
| npm run build                                      | Compilación Next.js y exportación estática correctas |
| Playwright Chromium                                | 30/30; sin saltados ni fallos                        |

## Qué se comprobó

- Creación real de tarjeta en el editor, todos los tipos existentes, test simple/múltiple, vocabulario, escrita y ortografía.
- Aprender tarjetas nuevas: Again repetido, espera, otras tarjetas, reaparición automática, Good progresivo y graduación real. Reloj del navegador controlado, sin esperar minutos de pared.
- FSRS determinista: Again nuevo → Learning; metadatos conservados; cada refuerzo cuenta en fsrsReps; Hard antes que Good/Easy; intervalos crecen con recuerdo; lapso tras 90 días extra entra Relearning sin borrar historial/reps; adopción compatible de tarjetas antiguas.
- Reapertura: se recarga el navegador con checkpoint pendiente; mantiene intento, cooldown y ratings. Se comprueba estado final de FSRS tras otra recarga.
- Seis fallos no generan un bucle infinito ni éxito falso; saltar no genera ratings.
- Transacción real IndexedDB: tarjeta + rating + checkpoint en outbox; aislamiento por cuenta; mismas proyecciones al recibir datos remotos.
- 50 tarjetas seguidas, 50 IDs de registros únicos. Valoraciones manuales Bien/Regular/Mal con notas y siguiente automático.
- Árbol: crear, editar, mover, subir/bajar, eliminar. Ciclos y destinos inválidos rechazados. Rama conserva hijos/IDs.
- Biblioteca: tarjetas ordenadas, movimiento entre carpetas y sacar rama; conservación de progreso tras recarga.
- Organización: Hoy → Después → Hoy conserva tarea/ID; nota sin fecha; prioridades y acciones rápidas.
- Biblioteca → temario: nombres editados, reparentado, destino, preview, confirmación, sin copia de tarjetas; reimportación conserva IDs; apartado enlazado inicia tarjetas.
- Campos sin foco al abrir; clic explícito sí enfoca. Sheets anidados: Escape solo cierra el superior. Trapping, arrastre, fondo estable y capas de imagen/PDF.
- PWA de producción sin configuración: manifest standalone, iconos, Service Worker, recarga offline de la pantalla de configuración.
- Backup portable local: importación/exportación de estructura, IDs, historial y comentarios mediante funciones existentes.

## Tamaños recorridos realmente

390×844; 430×932; 360×800; 412×915; iPad 768×1024 y 1024×768; desktop 1366×768 y 1920×1080. También orientación 844×390, árbol de doce niveles, contenido largo, scroll interior y viewport reducido de teclado.
Son viewports Chromium, no ocho dispositivos físicos. No se simula un teclado del sistema abriéndose: se comprueba foco DOM y reducción de visualViewport. Las capturas son de la aplicación implementada con fixtures aisladas; no datos privados.

## Límites importantes: NO ejecutado contra tu cuenta

- Login real en Supabase, cerrar/abrir PWA manteniendo sesión autenticada.
- Cambios PC ↔ iPhone a través de Realtime del proyecto real.
- Reconexion offline con envío/acuse real de Supabase HTTP.
- Pruebas A/B con dos cuentas reales de tu proyecto; la RLS sí se ejecutó contra los SQL conservados dentro de PostgreSQL/PGLite.
- Storage HTTP real ni descargas de adjuntos privados.
- PWA instalada en Safari/iOS o Android físico, home indicator/teclado nativo.

No se disponía de URL/claves/sesiones o dispositivos de tu proyecto. No se modificó tu cuenta ni se introdujeron credenciales nuevas. Los tests locales y hashes no sustituyen estas pruebas de integración. El script test:live existente permite ejecutar las comprobaciones autorizadas con dos cuentas de pruebas, no con usuarios privados.

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

Se usó Chromium 153 externo al repo por disponibilidad del entorno; la suite admite CHROMIUM_EXECUTABLE. No se añade esa dependencia a la app. El build de las pruebas PWA se realizó sin variables Supabase. En un build configurado debe adaptarse la expectativa de “Configura OpoGC”, no sustituir Auth por una fixture.
Resultados máquina de navegador: ui-results.json. Las pruebas vuelven a generar test-results/ui-report.json, excluido del ZIP.
