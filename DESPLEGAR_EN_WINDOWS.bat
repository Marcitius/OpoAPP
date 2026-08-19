@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo =============================================
echo   OpoGC - instalacion y despliegue Cloudflare
echo =============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js no esta instalado.
  pause
  exit /b 1
)

echo Instalando dependencias...
call npm install
if errorlevel 1 goto :error

echo.
echo Iniciando sesion en Cloudflare si es necesario...
call npx wrangler login
if errorlevel 1 goto :error

echo.
echo Desplegando OpoGC...
call npm run deploy
if errorlevel 1 goto :error

echo.
echo =============================================
echo   DESPLIEGUE COMPLETADO
echo =============================================
echo Wrangler mostrara la URL de la aplicacion.
echo.
pause
exit /b 0

:error
echo.
echo El despliegue no se ha completado. Revisa el error anterior.
pause
exit /b 1
