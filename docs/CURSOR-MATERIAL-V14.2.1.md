# Cursor y teclado en Material — OpoGC v14.2.1

## Hallazgos y corrección

Se revisó el proyecto v14.2. Se reprodujeron dos problemas de integración:

1. MaterialDocument alterna saving y pasa dismissible={!saving} a BottomSheet. El efecto de foco del panel dependía de dismissible, por lo que cada transición ejecutaba limpieza/restauración y volvía a llamar el.focus(). La prueba confirmó que el editor perdía el foco tras el autoguardado. Ahora el efecto de foco y trapping se instala solo al abrir; Escape lee dismissibleRef.current para respetar las reglas actuales. La restauración del foco queda para el desmontaje real. No se añade autofocus a ningún input.
2. MaterialEditor construía extensiones y editorProps nuevos en cada render. Tiptap aplicaba setOptions/view.updateState en cada edición y cambio de selección. La prueba anterior contó cinco reconfiguraciones durante una edición corta; con el parche cuenta cero. Las opciones iniciales son estables; los handlers consultan la instancia mediante ref y setEditable solo se ejecuta si realmente cambia el modo.

Además, el HTML de una edición propia se enviaba de vuelta al mismo editor como prop de contenido. Se separan draft (guardado/estado) y editorContent (cargas externas): solo importación, recuperación de borrador, carga remota limpia o resolución explícita de conflicto actualizan editorContent. La escritura local continúa por las transacciones nativas del editor. Se mantiene la sanitización de entradas, cambios y contenido externo.

No se añaden atajos especiales para Backspace, ni readonly temporal, ni blur repetido, ni llamadas a focus para corregir el cursor. Se conservan Tab/Shift+Tab, listas, tablas, formato, historial de deshacer y pegado Markdown. Las cargas externas auténticas siguen pudiendo reemplazar el documento; la edición/autoguardado local no lo hace.

## Validación ejecutada

| Comprobación | Resultado final |
| --- | --- |
| npm run typecheck | Correcto |
| npm test | 91 aprobadas, 0 fallidas |
| npm run build | Correcto, exportación estática out |
| Suite Playwright completa | 100 aprobadas, 0 fallidas, 0 inestables, 0 omitidas; un intento por prueba en la ejecución final |
| Nuevas pruebas | 6 aprobadas en tests/ui/material-cursor.spec.ts |
| Integridad | 22 archivos críticos idénticos por bytes a v14.2; dependencias sin cambios |
| Entrega | Parche sobre v14.2, inventario y hashes/CRC comprobados; sin borrados |

Las seis pruebas nuevas comprueban: cero reconfiguraciones/reemplazos locales y foco conservado tras autoguardar; posición al borrar y escribir en mitad de párrafo en móvil 390×844 y escritorio 1366×768; Enter y Shift+Enter; negrita/lista/celda; deshacer/rehacer después del guardado y reapertura; y escritura durante un guardado retenido, sin robo de foco, con Escape bloqueado durante el guardado y habilitado después. La suite anterior conserva los siete tamaños de Material, el TXT íntegro adjunto, importaciones, recuperación, conflictos, offline, sesiones, rendimiento y PWA.

Durante el diagnóstico, la prueba de reconfiguración falló contra el código original. Después de estabilizar el editor, una prueba más estricta reveló la pérdida de foco del panel al guardar; se corrigió el efecto compartido y se repitió la suite completa. Estos fallos de diagnóstico no se presentan como pruebas aprobadas de la versión original.

Se intentó preparar WebKit, pero no se pudo iniciar por faltar bibliotecas del sistema. No se afirma haber probado Safari, un Mac real ni el teclado físico de iPhone/iPad. Tampoco se ha reproducido el salto visual exacto del usuario en Safari: sí la pérdida de foco y las reconfiguraciones que pueden contribuir a él. No se han probado cuentas reales de Supabase en esta iteración.

## Archivos y datos

Modificados: components/material/MaterialEditor.tsx; components/material/MaterialDocument.tsx; components/sheets/BottomSheet.tsx; components/navigation/MorePage.tsx (versión); tests/ui/main.tsx (retención de guardado solo para pruebas); package.json y package-lock.json (versión raíz), README, CHANGELOG e instrucciones.

Nuevos: tests/ui/material-cursor.spec.ts y documentación/resultados v14.2.1. Eliminados: ninguno.

No cambian los documentos guardados, IDs, formatos, esquema SQL, Supabase, Auth, RLS, Realtime, cola offline, transacciones locales, FSRS, sesiones múltiples ni las optimizaciones v14.2. No requiere reimportar documentos. El Service Worker y version.json se regeneran por el build habitual. Resultados por prueba: RESULTADOS-V14.2.1.json.
