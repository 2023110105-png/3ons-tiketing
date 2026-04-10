@echo off
setlocal EnableDelayedExpansion

echo ===================================================
echo    SETUP LOCAL MODE - WA Server + Frontend
echo ===================================================
echo.
echo Script ini akan mengkonfigurasi project untuk mode lokal.
echo.

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

set "PORT=3001"
set "WA_SECRET=wa_3ons_2026_local_dev_secret"
set "FRONTEND_ENV=%ROOT_DIR%.env"
set "WA_ENV=%ROOT_DIR%wa-server\.env"

echo [1/4] Mengecek file .env frontend...
if not exist "%FRONTEND_ENV%" (
    echo [ERROR] File .env tidak ditemukan di root!
    echo Buat dulu file .env dari .env.example
    pause
    exit /b 1
)
echo [OK] File .env ditemukan.

echo.
echo [2/4] Backup dan update .env frontend...
echo   - Backup ke .env.backup.railway
copy /Y "%FRONTEND_ENV%" "%ROOT_DIR%.env.backup.railway" >nul 2>&1

echo   - Update VITE_WA_BASE_URL ke localhost:%PORT%
powershell -Command "(Get-Content '%FRONTEND_ENV%') -replace 'VITE_WA_BASE_URL=.*', 'VITE_WA_BASE_URL=http://localhost:%PORT%' | Set-Content '%FRONTEND_ENV%'"

echo   - Update VITE_WA_ADMIN_SECRET
echo VITE_WA_ADMIN_SECRET=%WA_SECRET%>> "%FRONTEND_ENV%"

echo [OK] .env frontend diupdate.

echo.
echo [3/4] Setup .env WA Server...
cd /d "%ROOT_DIR%wa-server"
(
    echo PORT=%PORT%
    echo NODE_ENV=development
    echo CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176,http://localhost:5179,http://localhost:5180
    echo WA_ADMIN_SECRET=%WA_SECRET%
    echo TICKET_SIGNING_SECRET=ticket_%WA_SECRET%
    echo REQUEST_TIMEOUT_MS=30000
    echo RATE_LIMIT_WINDOW_MS=10000
    echo RATE_LIMIT_MAX=30
) > .env
echo [OK] .env WA Server dibuat.

echo.
echo [4/4] Verifikasi konfigurasi...
echo.
echo Frontend .env (VITE_WA_BASE_URL):
findstr "VITE_WA_BASE_URL" "%FRONTEND_ENV%"
echo.
echo WA Server .env (PORT):
findstr "PORT" "%WA_ENV%"
echo.
echo WA Server .env (WA_ADMIN_SECRET):
findstr "WA_ADMIN_SECRET" "%WA_ENV%"

echo.
echo ===================================================
echo    SETUP SELESAI!
echo ===================================================
echo.
echo Sekarang jalankan:
echo   1. npm run dev  (di window terpisah)
echo   2. start-wa-local-debug.bat  (di window terpisah)
echo.
echo Atau jalankan bersamaan:
echo   start-all-local.bat
echo.
echo ===================================================
pause
