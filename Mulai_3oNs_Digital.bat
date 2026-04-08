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

REM 1) Jalankan website (Vite) di jendela terpisah
start "WEB-3ONS" cmd /k "npm run dev"

REM 2) Tunggu sebentar lalu buka browser (coba beberapa port umum)
timeout /t 4 /nobreak
start "" "http://localhost:5174/"
start "" "http://localhost:5175/"
start "" "http://localhost:5176/"

REM 3) Jalankan WA server via Docker (lebih stabil di Windows karena ada dependency native: canvas/cairo)
echo.
echo ===================================================
echo Menjalankan WA Server (Docker)
echo ===================================================
echo.

docker --version
if errorlevel 1 (
  echo [GAGAL] Docker tidak ditemukan.
  echo Silakan install Docker Desktop terlebih dahulu, lalu jalankan file ini lagi.
  echo.
  echo Alternatif (lebih sulit): downgrade Node untuk wa-server dan install GTK/cairo di Windows.
  echo.
  pause
  exit /b 1
)

set "WA_IMAGE=3ons-wa-server"
set "WA_CONTAINER=3ons-wa-server-local"

echo Membersihkan container lama (jika ada)...
docker rm -f "%WA_CONTAINER%"

echo Build image backend (wa-server)...
docker build -f wa-server\Dockerfile -t "%WA_IMAGE%" .
if errorlevel 1 (
  echo.
  echo [GAGAL] Build Docker gagal. Pastikan Docker Desktop sedang running.
  echo.
  pause
  exit /b 1
)

echo.
echo Menjalankan backend di http://localhost:3001 ...
echo (Tekan CTRL+C pada window ini untuk menghentikan backend)
echo.
docker run --rm --name "%WA_CONTAINER%" -p 3001:3001 ^
  -e PORT=3001 ^
  -e WA_ADMIN_SECRET=local-dev-secret ^
  "%WA_IMAGE%"

echo.
echo Layanan dihentikan.
pause
