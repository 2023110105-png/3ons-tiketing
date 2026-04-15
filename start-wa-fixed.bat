@echo off
setlocal EnableDelayedExpansion

echo ===================================================
echo    WA SERVER - AUTO INSTALL + DEBUG MODE
echo ===================================================
echo.

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

set "WA_DIR=%ROOT_DIR%wa-server"
set "PORT=3001"
set "SECRET=wa_3ons_2026_local_dev_secret"

echo [DEBUG] Working dir: %CD%
echo [DEBUG] WA_DIR: %WA_DIR%

REM Check folder
if not exist "%WA_DIR%" (
    echo [ERROR] Folder wa-server tidak ditemukan: %WA_DIR%
    goto :error_pause
)
cd /d "%WA_DIR%"

REM Check Node.js
echo.
echo [1] Mengecek Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js tidak ditemukan! Install dari https://nodejs.org
    goto :error_pause
)
echo [OK] Node.js: 
node --version

REM Setup .env
echo.
echo [2] Setup environment...
if not exist ".env" (
    echo [INFO] Membuat file .env...
    (
        echo PORT=3001
        echo NODE_ENV=development
        echo CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176,http://localhost:5179,http://localhost:5180
        echo WA_ADMIN_SECRET=%SECRET%
        echo TICKET_SIGNING_SECRET=ticket_%SECRET%
        echo REQUEST_TIMEOUT_MS=30000
        echo.
        echo # FAST MODE: Skip nomor validation untuk kecepatan
        echo WA_FAST_MODE=true
        echo WA_MESSAGE_TIMEOUT_MS=15000
        echo.
        echo # DELAY antar pesan untuk hindari rate limit WhatsApp
        echo WA_SEND_DELAY_MS=3000
        echo.
        echo # Supabase untuk baca data peserta langsung
        echo SUPABASE_URL=https://your-project.supabase.co
        echo SUPABASE_ANON_KEY=your-anon-key
    ) > .env
    echo [INFO] Jangan lupa update SUPABASE_URL dan SUPABASE_ANON_KEY di .env
    echo [OK] File .env dibuat.
) else (
    echo [OK] File .env sudah ada.
    echo [INFO] Pastikan WA_ADMIN_SECRET = %SECRET%
    echo [INFO] Tambahkan WA_FAST_MODE=true untuk kecepatan maksimal
    echo [INFO] Tambahkan SUPABASE_URL dan SUPABASE_ANON_KEY untuk baca database langsung
)

REM Check & Install node_modules
echo.
echo [3] Mengecek dependencies...
if not exist "node_modules" (
    echo [INFO] node_modules BELUM ADA - Installing dependencies...
    echo [INFO] Ini akan membutuhkan waktu 2-5 menit...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] npm install GAGAL!
        echo Coba jalankan manual: cd wa-server ^&^& npm install
        goto :error_pause
    )
    echo.
    echo [OK] Dependencies berhasil diinstall!
) else (
    echo [OK] node_modules sudah ada.
    REM Coba cek apakah express ada
    if not exist "node_modules\express" (
        echo [WARNING] express module tidak ditemukan - Reinstalling...
        call npm install
        if errorlevel 1 (
            echo [ERROR] npm install gagal!
            goto :error_pause
        )
    )
)

REM Kill port
echo.
echo [4] Membersihkan port %PORT%...
powershell -Command "Get-NetTCPConnection -LocalPort %PORT% -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" 2>nul
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo [OK] Port dibersihkan.

REM Start server
echo.
echo ===================================================
echo    MENJALANKAN WA SERVER
echo ===================================================
echo.
echo URL: http://localhost:%PORT%/api/wa/status
echo Tunggu QR code muncul, lalu scan dengan WhatsApp HP.
echo.
echo Tekan CTRL+C untuk berhenti.
echo.

node index.js

REM Kalau crash, tampilkan pesan
echo.
echo [INFO] Server berhenti dengan exit code: %errorlevel%
if %errorlevel% neq 0 (
    echo [ERROR] Server crash atau error!
    echo.
    echo Solusi:
    echo 1. Hapus folder node_modules dan jalankan npm install ulang
    echo 2. Cek apakah port 3001 dipakai aplikasi lain
    echo 3. Restart komputer
)
goto :end

:error_pause
echo.
echo ===================================================
echo    ERROR - Tekan sembarang tombol
echo ===================================================
pause >nul

:end
echo.
echo ===================================================
echo    SELESAI - Tekan sembarang tombol untuk tutup
echo ===================================================
pause >nul
