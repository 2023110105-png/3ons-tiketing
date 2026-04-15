@echo off
setlocal EnableDelayedExpansion

echo ===================================================
echo    3oNs DIGITAL - AUTO START (Frontend + Bot)
echo ===================================================
echo.

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

echo Mode: Jalankan semua service secara otomatis
echo.

REM ====== START WA SERVER ======
echo [SERVICE 1/2] Menjalankan WA Server...
echo.

start "WA-SERVER-3ONS" cmd /c "start-wa-local.bat"

REM Tunggu WA server siap
set /a MAX_WAIT=30
echo Menunggu WA server siap (max %MAX_WAIT% detik)...
for /L %%i in (1,1,%MAX_WAIT%) do (
    powershell -Command "try { $resp = Invoke-WebRequest -Uri 'http://127.0.0.1:3001/health' -UseBasicParsing -TimeoutSec 2; if ($resp.StatusCode -eq 200) { exit 0 } } catch { exit 1 }"
    if !errorlevel! equ 0 (
        echo.
        echo [OK] WA Server siap! (%%i detik)
        goto :wa_ready
    )
    timeout /t 1 /nobreak >nul
    echo   Mencoba... (%%i/%MAX_WAIT%)
)

echo.
echo [WARNING] WA server belum merespon, tapi akan tetap melanjutkan...
:wa_ready

echo.

REM ====== START FRONTEND ======
echo [SERVICE 2/2] Menjalankan Frontend (Vite)...
echo.

start "FRONTEND-3ONS" cmd /k "npm run dev"

echo Tunggu 5 detik untuk Vite siap...
timeout /t 5 /nobreak >nul

echo.
echo ===================================================
echo    SEMUA SERVICE DIJALANKAN
echo ===================================================
echo.
echo Frontend akan terbuka di browser otomatis...
echo.

REM Coba buka beberapa port umum Vite
start "" "http://localhost:5173/"
start "" "http://localhost:5174/"
start "" "http://localhost:5175/"

echo.
echo Window yang sedang berjalan:
echo   - WA-SERVER-3ONS : Bot WhatsApp (port 3001)
echo   - FRONTEND-3ONS  : Website (Vite dev server)
echo.
echo URL Akses:
echo   - Frontend: http://localhost:5173 atau http://localhost:5174
echo   - WA API:   http://localhost:3001/api/wa/status
echo.
echo ===================================================
echo.

pause
