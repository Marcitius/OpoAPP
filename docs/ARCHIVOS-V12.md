# Archivos — OpoGC v12
Comparación con el ZIP v11 actual; no se ha usado una estructura inicial de demo.

## Creados
- `components/library/CardActionsSheet.tsx`
- `components/library/LibraryToStudySheet.tsx`
- `components/review/SessionStatus.tsx`
- `components/study/StudyPlanPage.tsx`
- `docs/MEMORIA-V12.md`
- `docs/capturas/biblioteca-temario-movil.png`
- `docs/capturas/organizar-movil.png`
- `docs/capturas/refuerzo-movil.png`
- `lib/memory/session.ts`
- `lib/study/hierarchy.ts`
- `lib/study/libraryBridge.ts`
- `lib/study/planning.ts`
- `tests/memory.test.ts`
- `tests/study.test.ts`
- `tests/ui/v12.spec.ts`
- `docs/ARCHIVOS-V12.md` (este inventario).

## Modificados
- `CHANGELOG.md`
- `COMIENZA-AQUI.txt`
- `README.md`
- `app/OpoApp.tsx`
- `app/OrthographyStudy.tsx`
- `app/RichTextEditor.tsx`
- `app/fsrs.ts`
- `app/memoryModel.ts`
- `app/mobile-ux.css`
- `components/library/LibraryActions.tsx`
- `components/library/LibraryEditors.tsx`
- `components/review/ReviewSession.tsx`
- `components/shared/OverlayPortal.tsx`
- `components/sheets/BottomSheet.tsx`
- `components/study/StudyManagement.tsx`
- `components/study/StudyStartPage.tsx`
- `components/study/TemarioBrowser.tsx`
- `docs/CAPTURAS.md`
- `docs/PRUEBAS.md`
- `docs/capturas/desktop.png`
- `docs/capturas/hoy-movil.png`
- `docs/capturas/ipad.png`
- `docs/capturas/temario-movil.png`
- `docs/ui-results.json`
- `lib/study/legacy.ts`
- `package-lock.json`
- `package.json`
- `public/sw.js`
- `public/version.json`
- `scripts/check-preserved.mjs`
- `scripts/prepare-pwa.mjs`
- `tests/ui/main.tsx`
- `tests/ui/responsive.spec.ts`

## Eliminados
Ningún archivo de v11.

## Responsabilidades nuevas
| Archivo / grupo | Responsabilidad |
|---|---|
| app/fsrs.ts | Adaptador del FSRS existente; estado, pasos, intentos y snapshots. |
| lib/memory/session.ts | Cola pura, tiempos, separación, respuestas, resumen y checkpoint. |
| lib/study/hierarchy.ts | Orden y movimiento compatible de nodos, ramas y tarjetas. |
| lib/study/planning.ts | Acciones rápidas y vínculos a contenido. |
| lib/study/libraryBridge.ts | Draft editable y conversión validada sin duplicar tarjetas. |
| StudyPlanPage | Hoy / Después / Repasos; la planificación sale de OpoApp. |
| LibraryToStudySheet | Selección, nombres, jerarquía, destino y preview. |
| CardActionsSheet | Alternativa táctil/teclado para mover y reordenar. |
| SessionStatus | Esperas reales y finalización honesta. |
| app/OpoApp.tsx | Integración con el motor existente; ya no decide el refuerzo con la cola continua antigua. |
| scripts/prepare-pwa.mjs | Solo versión visible leída de package.json; comportamiento y manifest conservados. |
| tests/memory.test.ts y tests/study.test.ts | 19 nuevas pruebas puras/transaccionales. |
| tests/ui/v12.spec.ts | 5 nuevos recorridos reales de UI. |

## Conservación
13 archivos críticos y 21 funciones de la base verificados por hash/huella AST. Los manifiestos originales v10 permanecen intactos; el checker declara las excepciones autorizadas (2 adaptadores, 8 funciones) de esta iteración. No se reescriben los hashes para simular conservación.
Auth, AccountApp, SyncContext, local/IDB, projection, data/files, engine, SQL/RLS/Storage, PwaManager y manifest sin cambios. No hay migraciones nuevas. public/sw.js y version.json se regeneran al compilar; los prefijos de caché y datos locales no se renombran.
La carpeta de tests y sus datos son herramientas de validación, no datos iniciales de la aplicación. Se excluyen del ZIP node_modules, .next, out, test-results, tsbuildinfo y credenciales. Se incluyen las fuentes, lockfile, scripts, documentos y capturas.

