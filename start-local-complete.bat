@echo off
setlocal EnableDelayedExpansion

echo ===================================================
echo    3oNs DIGITAL - LOCAL MODE COMPLETE LAUNCHER
echo ===================================================
echo.
echo Mode: Setup + Jalankan WA Server + Frontend (Lokal)
echo.
echo Fitur:
echo   - Auto-kill port 3001
-echo   - Auto-setup .env WA Server
echo   - Kirim Tiket dengan Barcode ke WhatsApp
echo.

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

set "PORT=3001"
set "WA_SECRET=wa_3ons_2026_local_dev_secret"
set "FRONTEND_ENV=%ROOT_DIR%.env"
set "WA_ENV=%ROOT_DIR%wa-server\.env"

echo ===================================================
echo [STEP 1/5] Setup Environment
echo ===================================================
echo.

REM Setup WA Server .env
echo   - Membuat wa-server\.env...
(
    echo PORT=%PORT%
    echo NODE_ENV=development
    echo CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176,http://localhost:5179,http://localhost:5180,http://127.0.0.1:5173,http://127.0.0.1:5174
    echo WA_ADMIN_SECRET=%WA_SECRET%
    echo TICKET_SIGNING_SECRET=ticket_%WA_SECRET%
    echo REQUEST_TIMEOUT_MS=30000
    echo RATE_LIMIT_WINDOW_MS=10000
    echo RATE_LIMIT_MAX=30
    echo WA_PROTOCOL_TIMEOUT_MS=180000
    echo WA_LAUNCH_TIMEOUT_MS=180000
    echo.
    echo # FAST MODE untuk kecepatan maksimal
    echo WA_FAST_MODE=true
    echo WA_MESSAGE_TIMEOUT_MS=15000
    echo.
    echo # DELAY antar pesan untuk hindari rate limit
    echo WA_SEND_DELAY_MS=3000
) > "%WA_ENV%"
echo   [OK] WA Server .env dibuat (FAST MODE enabled).

REM Update frontend .env untuk mode lokal
echo   - Update frontend .env untuk mode lokal...
if exist "%FRONTEND_ENV%" (
    REM Backup dulu
    copy /Y "%FRONTEND_ENV%" "%ROOT_DIR%.env.backup.railway" >nul 2>&1
    
    REM Update VITE_WA_BASE_URL ke localhost
    powershell -Command "(Get-Content '%FRONTEND_ENV%') -replace 'VITE_WA_BASE_URL=.*', 'VITE_WA_BASE_URL=http://localhost:%PORT%' | Set-Content '%FRONTEND_ENV%'"
    
    REM Add secret kalau belum ada
    findstr /C:"VITE_WA_ADMIN_SECRET=%WA_SECRET%" "%FRONTEND_ENV%" >nul || (
        echo VITE_WA_ADMIN_SECRET=%WA_SECRET%>> "%FRONTEND_ENV%"
    )
    
    echo   [OK] Frontend .env diupdate.
) else (
    echo   [WARNING] Frontend .env tidak ditemukan!
    echo   Buat file .env dari .env.example terlebih dahulu.
    pause
    exit /b 1
)

echo.
echo ===================================================
echo [STEP 2/5] Kill Existing Processes
echo ===================================================
echo.
echo   - Kill proses di port %PORT%...
powershell -Command "Get-NetTCPConnection -LocalPort %PORT% -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING" 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo   [OK] Port %PORT% dibersihkan.

echo   - Kill node.exe lama yang mungkin wa-server...
taskkill /F /IM node.exe >nul 2>&1
echo   [OK] Proses lama dibersihkan.

timeout /t 2 /nobreak >nul

echo.
echo ===================================================
echo [STEP 3/5] Start WA Server
echo ===================================================
echo.

cd /d "%ROOT_DIR%wa-server"

REM Check node_modules
if not exist "node_modules" (
    echo   - Installing dependencies (butuh waktu 2-5 menit)...
    echo   - Mohon tunggu, jangan tutup window ini...
    call npm install
    if errorlevel 1 (
        echo   [ERROR] npm install gagal!
        pause
        exit /b 1
    )
    echo   [OK] Dependencies terinstall.
) else (
    REM Verify critical modules exist
    if not exist "node_modules\express" (
        echo   - express module hilang, reinstalling...
        call npm install
        if errorlevel 1 (
            echo   [ERROR] npm install gagal!
            pause
            exit /b 1
        )
    )
    echo   [OK] Dependencies terverifikasi.
)

echo   - Starting WA Server di port %PORT%...
echo   - URL: http://localhost:%PORT%/api/wa/status
echo.
echo   NOTE: Tunggu QR code muncul, lalu scan dengan WhatsApp HP Anda!
echo.

REM Start WA server di window baru yang tetap terbuka
start "WA-BOT-LOCAL" cmd /k "echo ===================================================
echo    WHATSAPP BOT SERVER - PORT %PORT%
echo ===================================================
echo.
echo URL Status: http://localhost:%PORT%/api/wa/status?tenant_id=tenant-default
echo.
echo Tunggu QR code muncul di bawah, lalu scan dengan WhatsApp HP Anda.
echo.
echo Commands:
echo   - node index.js       : Start server
echo   - Ctrl+C              : Stop server
echo   - http://localhost:%PORT%/api/wa/logout (POST) : Logout
echo.
echo ===================================================
cd /d %CD%
node index.js"

cd /d "%ROOT_DIR%"

echo   [OK] WA Server dijalankan di window terpisah.
echo.
echo ===================================================
echo [STEP 4/5] Tunggu WA Server Siap
echo ===================================================
echo.
echo   Menunggu WA Server ready (max 60 detik)...
set /a MAX_WAIT=60
for /L %%i in (1,1,%MAX_WAIT%) do (
    powershell -Command "try { Invoke-WebRequest -Uri 'http://127.0.0.1:%PORT%/health' -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }" 2>nul
    if !errorlevel! equ 0 (
        echo   [OK] WA Server siap! (%%i detik)
        goto :wa_ready
    )
    timeout /t 1 /nobreak >nul
    echo     Mencoba... (%%i/%MAX_WAIT%)
)
echo   [WARNING] WA Server belum merespon, lanjutkan saja...
:wa_ready

echo.
echo ===================================================
echo [STEP 5/5] Start Frontend (Vite)
echo ===================================================
echo.

start "FRONTEND-LOCAL" cmd /k "npm run dev"

echo   Tunggu 5 detik untuk Vite siap...
timeout /t 5 /nobreak >nul

echo   Buka browser...
start "" "http://localhost:5173/"
start "" "http://localhost:5174/"

echo.
echo ===================================================
echo    SEMUA SERVICE BERJALAN (MODE LOKAL)
echo ===================================================
echo.
echo [DAFTAR WINDOW YANG AKTIF]
echo   1. WA-BOT-LOCAL     : WhatsApp Bot (port %PORT%)
echo   2. FRONTEND-LOCAL   : Website Vite (port 5173/5174)
echo.
echo [URL AKSES]
echo   Frontend  : http://localhost:5173 atau http://localhost:5174
echo   WA Status : http://localhost:%PORT%/api/wa/status
echo   WA Health : http://localhost:%PORT%/health
echo.
echo [CARA KIRIM TIKET]
echo   1. Buka browser di URL Frontend
echo   2. Login ke Admin Panel
echo   3. Menu "Kirim Tiket" atau "WhatsApp Delivery"
echo   4. Pilih peserta, klik Kirim
echo   5. Tiket dengan Barcode akan terkirim via WhatsApp!
echo.
echo [CATATAN PENTING]
echo   - QR Code akan muncul di window WA-BOT-LOCAL
echo   - Scan QR dengan WhatsApp HP Anda (Menu: Perangkat Tertaut)
echo   - Setelah scan, bot siap kirim pesan otomatis
echo   - Pastikan VITE_WA_BASE_URL sudah diubah ke localhost:%PORT%
echo.
echo ===================================================
echo.
pause
