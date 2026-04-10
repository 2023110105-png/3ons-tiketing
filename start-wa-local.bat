@echo off
setlocal EnableDelayedExpansion

echo ===================================================
echo         MENJALANKAN WA SERVER LOKAL
echo ===================================================
echo.

REM Set working directory
set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

set "WA_DIR=%ROOT_DIR%wa-server"
set "PORT=3001"
set "HEALTH_URL=http://127.0.0.1:%PORT%/health"

echo [1/5] Mengecek folder wa-server...
if not exist "%WA_DIR%" (
    echo [ERROR] Folder wa-server tidak ditemukan!
    pause
    exit /b 1
)

cd /d "%WA_DIR%"

echo.
echo [2/5] Setup environment file...
if not exist ".env" (
    echo Membuat file .env dari template...
    (
        echo PORT=3001
        echo NODE_ENV=development
        echo CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176,http://localhost:5179,http://localhost:5180
        echo WA_ADMIN_SECRET=local-dev-secret-3ons
        echo TICKET_SIGNING_SECRET=local-signing-secret-3ons
        echo REQUEST_TIMEOUT_MS=30000
        echo RATE_LIMIT_WINDOW_MS=10000
        echo RATE_LIMIT_MAX=30
        echo WA_PROTOCOL_TIMEOUT_MS=180000
        echo WA_LAUNCH_TIMEOUT_MS=180000
    ) > .env
    echo File .env berhasil dibuat.
) else (
    echo File .env sudah ada, menggunakan konfigurasi existing.
)

echo.
echo [3/5] Mengecek node_modules...
if not exist "node_modules" (
    echo Installing dependencies...
    echo Ini mungkin memerlukan waktu beberapa menit...
    echo.
    
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] npm install gagal!
        echo Pastikan Node.js terinstal dan koneksi internet stabil.
        pause
        exit /b 1
    )
    echo Dependencies berhasil diinstall.
) else (
    echo Dependencies sudah terinstall.
)

echo.
echo [4/5] Mengecek apakah WA server sudah berjalan...
powershell -Command "try { $resp = Invoke-WebRequest -Uri '%HEALTH_URL%' -UseBasicParsing -TimeoutSec 2; if ($resp.StatusCode -eq 200) { exit 0 } } catch { exit 1 }"
if %errorlevel% equ 0 (
    echo.
    echo [INFO] WA server sudah berjalan di port %PORT%.
    echo Tidak perlu menjalankan instance baru.
    echo.
    echo Buka browser untuk cek status:
    echo   - Health: http://localhost:%PORT%/health
    echo   - Status: http://localhost:%PORT%/api/wa/status
    echo.
    pause
    exit /b 0
)

echo WA server belum berjalan, akan dijalankan sekarang.

echo.
echo [5/5] Membersihkan port %PORT% jika masih tertahan...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
    echo Menutup proses di port %PORT% (PID: %%a)...
    taskkill /F /PID %%a >nul 2>&1
    timeout /t 1 /nobreak >nul
)

echo.
echo ===================================================
echo    WA SERVER SIAP DIJALANKAN
echo ===================================================
echo.
echo URL Akses:
echo   - Health Check: http://localhost:%PORT%/health
echo   - WA Status:    http://localhost:%PORT%/api/wa/status
echo   - Logout:       http://localhost:%PORT%/api/wa/logout ^(POST^)
echo.
echo Setelah server hidup, scan QR code dengan WhatsApp HP Anda.
echo.
echo Tekan CTRL+C untuk menghentikan server.
echo.
echo ===================================================
echo.

npm start

echo.
echo Server dihentikan.
pause
