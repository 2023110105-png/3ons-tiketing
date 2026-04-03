@echo off
setlocal

echo ===================================================
echo         MENJALANKAN 3oNs DIGITAL PLATFORM
echo ===================================================
echo.
echo Menjalankan website kiosk dan server bot WhatsApp...
echo Mohon tunggu, browser akan terbuka otomatis.
echo.

REM Masuk ke folder tempat file BAT ini berada
cd /d "%~dp0"

REM 1) Jalankan website (Vite) di jendela latar belakang
start "WEB-3ONS" /B cmd /c "npm run dev"

REM 2) Tunggu sebentar lalu buka browser
timeout /t 4 /nobreak > NUL
start "" "http://localhost:5174/"

REM 3) Jalankan server WhatsApp pada jendela ini (agar QR/log terlihat)
cd /d "%~dp0wa-server"
npm start

echo.
echo Layanan dihentikan.
pause
