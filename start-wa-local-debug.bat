@echo off
setlocal EnableDelayedExpansion

echo ===================================================
echo    WA SERVER - DEBUG MODE (Tidak akan nutup)
echo ===================================================
echo.
echo Mode ini akan menampilkan semua error.
echo.
echo PENTING: Pastikan VITE_WA_BASE_URL di .env sudah diubah ke:
echo   http://localhost:3001
echo.
echo Jika belum, edit file .env dan ubah:
echo   VITE_WA_BASE_URL=http://localhost:3001
echo.

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

set "WA_DIR=%ROOT_DIR%wa-server"
set "PORT=3001"
set "SECRET=wa_3ons_2026_local_dev_secret"

echo [DEBUG] Working dir: %CD%
echo [DEBUG] WA_DIR: %WA_DIR%

echo.
echo [1] Mengecek folder wa-server...
if not exist "%WA_DIR%" (
    echo [ERROR] Folder wa-server tidak ditemukan di: %WA_DIR%
    goto :error_pause
)
cd /d "%WA_DIR%"
echo [OK] Folder ditemukan.

echo.
echo [2] Mengecek Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js tidak ditemukan! Install Node.js dulu.
    goto :error_pause
)
echo [OK] Node.js: 
node --version

echo.
echo [3] Setup WA Server environment...
set "ENV_FILE=.env"
if not exist "%ENV_FILE%" (
    echo [INFO] Membuat file .env untuk WA server...
    (
        echo PORT=3001
        echo NODE_ENV=development
        echo CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176,http://localhost:5179,http://localhost:5180
        echo WA_ADMIN_SECRET=%SECRET%
        echo TICKET_SIGNING_SECRET=ticket_sign_%SECRET%
        echo REQUEST_TIMEOUT_MS=30000
        echo RATE_LIMIT_WINDOW_MS=10000
        echo RATE_LIMIT_MAX=30
    ) > "%ENV_FILE%"
    echo [OK] File .env dibuat dengan secret: %SECRET%
) else (
    echo [OK] File .env sudah ada.
    echo [INFO] Pastikan WA_ADMIN_SECRET = %SECRET%
)

echo.
echo [4] Mengecek node_modules...
if not exist "node_modules" (
    echo [INFO] node_modules belum ada, installing...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] npm install gagal!
        goto :error_pause
    )
    echo [OK] Dependencies terinstall.
) else (
    echo [OK] node_modules sudah ada.
)

echo.
echo [5] Kill proses di port %PORT%...
echo   - Method 1: PowerShell...
powershell -Command "Get-NetTCPConnection -LocalPort %PORT% -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue; Write-Host ('  Killed PID: ' + $_.OwningProcess) }" 2>nul

echo   - Method 2: Taskkill...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING" 2^>nul') do (
    echo     Killing PID: %%a
    taskkill /F /PID %%a >nul 2>&1
)

echo   - Method 3: Kill all node.exe...
taskkill /F /IM node.exe >nul 2>&1

timeout /t 2 /nobreak >nul

echo.
echo [6] Starting WA Server...
echo ===================================================
echo    SERVER STARTING - Tekan CTRL+C untuk berhenti
echo ===================================================
echo.

node index.js

REM Kalau sampai sini, berarti server berhenti/exit
echo.
echo [INFO] Server stopped dengan exit code: %errorlevel%
if %errorlevel% neq 0 (
    echo [ERROR] Server exit dengan error!
    echo.
    echo Kemungkinan penyebab:
    echo   1. Port 3001 masih tertahan
    echo   2. File index.js corrupt
    echo   3. Dependency error
    echo.
    echo Solusi:
    echo   - Jalankan: taskkill /F /IM node.exe
    echo   - Hapus folder node_modules dan jalankan npm install ulang
    echo   - Cek file wa-server/index.js baris error
)
goto :end

:error_pause
echo.
echo ===================================================
echo    ERROR TERDETEKSI - Tekan tombol apa saja
echo ===================================================
pause >nul

:end
echo.
echo ===================================================
echo    SCRIPT SELESAI - Tekan tombol apa saja untuk tutup
echo ===================================================
pause >nul
exit /b
