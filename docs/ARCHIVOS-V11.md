# Archivos — OpoGC v11 - Mobile UX

Comparación con el ZIP completo v10 de origen. No se incluyen dependencias instaladas, salida compilada ni cachés de pruebas.

## Creados (41)

- `CHANGELOG.md`
- `app/mobile-ux.css`
- `components/account/AccountScreen.tsx`
- `components/account/StudyPreferences.tsx`
- `components/library/LibraryActions.tsx`
- `components/library/LibraryEditors.tsx`
- `components/navigation/AppNavigation.tsx`
- `components/navigation/MorePage.tsx`
- `components/progress/LegacyCharts.tsx`
- `components/progress/OrthographyProgress.tsx`
- `components/progress/ProgressPage.tsx`
- `components/psych/PsychEditors.tsx`
- `components/review/ReviewSession.tsx`
- `components/review/ReviewStartPage.tsx`
- `components/shared/Icon.tsx`
- `components/shared/LegacyWidgets.tsx`
- `components/shared/OverlayPortal.tsx`
- `components/shared/useAppViewport.ts`
- `components/sheets/BottomSheet.tsx`
- `components/sheets/ModalShell.tsx`
- `components/study/StudyManagement.tsx`
- `components/study/StudySession.tsx`
- `components/study/StudyStartPage.tsx`
- `components/study/TemarioBrowser.tsx`
- `components/today/TodayPage.tsx`
- `docs/ARCHIVOS-V11.md`
- `docs/CAPTURAS.md`
- `docs/INSTALACION-V10.md`
- `docs/capturas/desktop.png`
- `docs/capturas/estudio-movil.png`
- `docs/capturas/hoy-movil.png`
- `docs/capturas/ipad.png`
- `docs/capturas/progreso-movil.png`
- `docs/capturas/repaso-movil.png`
- `docs/capturas/temario-movil.png`
- `docs/ui-results.json`
- `docs/v10-behavior-fingerprints.json`
- `docs/v10-protected-files.json`
- `lib/study/legacy.ts`
- `scripts/check-preserved.mjs`
- `scripts/serve-tests.mjs`

## Modificados (20)

- `COMIENZA-AQUI.txt`
- `README.md`
- `app/CardImage.tsx`
- `app/CardImportModal.tsx`
- `app/LocalDataManager.tsx`
- `app/OpoApp.tsx`
- `app/PdfAnnotator.tsx`
- `app/layout.tsx`
- `docs/ANALISIS-Y-CAMBIOS.md`
- `docs/ARQUITECTURA.md`
- `docs/PRUEBAS.md`
- `package-lock.json`
- `package.json`
- `playwright.config.ts`
- `public/sw.js`
- `public/version.json`
- `scripts/prepare-pwa.mjs`
- `tests/ui/main.tsx`
- `tests/ui/responsive.spec.ts`
- `vite.test.config.ts`

## Eliminados (0)

Ningún archivo de v10 se elimina.

## Separación de componentes

Los editores de tareas/temario, carpetas/tarjetas y psicotécnicos, gráficos y widgets antes incluidos en OpoApp se trasladan a sus carpetas de componentes. Los destinos Hoy, Estudiar, Repasar, Progreso y Más usan componentes propios. NavButton y el dashboard inicial se sustituyen por AppNavigation y TodayPage. OpoApp sigue coordinando el estado existente y los callbacks; no se ha reescrito el backend.

La lógica recuperada está en lib/study/legacy.ts. Los 15 archivos críticos y las 29 funciones verificadas figuran en los dos JSON de integridad. El CSS original se conserva para los controles existentes; mobile-ux.css define el sistema visual y las adaptaciones v11. El generador PWA cambia solo el número de versión y regenera sus recursos con el mecanismo anterior.
