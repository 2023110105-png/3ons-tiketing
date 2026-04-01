@echo off
echo ===================================================
echo     MEMULAI YAMAHA EVENT GATE SYSTEM DAN WA BOT
echo ===================================================
echo.
echo Menjalankan Website Kiosk dan Server Bot WhatsApp...
echo Mohon tunggu sebentar, browser akan terbuka otomatis.
echo.

:: Pindah ke folder script berjalan (yamaha-event-gate)
cd /d "%~dp0"

:: 1. Mulai Web Frontend di Background
start /B cmd /c "npm run dev"

:: 2. Buka Browser (Tunggu 3 detik agar Frontend siap)
timeout /t 3 /nobreak > NUL
start http://localhost:5174/

:: 3. Mulai Server WA Bot di jendela yang sama (biarkan tetap menyala untuk menampilkan QR / Log)
cd wa-server
npm start

pause
