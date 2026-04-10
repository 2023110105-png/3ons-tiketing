@echo off
setlocal EnableDelayedExpansion

echo ===================================================
echo    INSTALL WA SERVER - WINDOWS (NO CANVAS)
echo ===================================================
echo.
echo Mode ini menggunakan package.json tanpa 'canvas'
echo (canvas butuh Python ^& Visual Studio Build Tools)
echo.

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

set "WA_DIR=%ROOT_DIR%wa-server"

echo [1] Mengecek folder wa-server...
if not exist "%WA_DIR%" (
    echo [ERROR] Folder wa-server tidak ditemukan!
    pause
    exit /b 1
)
cd /d "%WA_DIR%"

echo.
echo [2] Backup package.json original...
if exist "package.json" (
    copy /Y package.json package.json.backup.original >nul 2>&1
    echo [OK] Backup dibuat: package.json.backup.original
)

echo.
echo [3] Menggunakan package.json tanpa canvas...
if exist "package.json.nocanvas" (
    copy /Y package.json.nocanvas package.json >nul 2>&1
    echo [OK] package.json diupdate (tanpa canvas)
) else (
    echo [WARNING] package.json.nocanvas tidak ditemukan!
    echoakan pakai package.json original (mungkin gagal di Windows)
)

echo.
echo [4] Hapus node_modules lama (kalau ada)...
if exist "node_modules" (
    rmdir /S /Q node_modules >nul 2>&1
    echo [OK] node_modules lama dihapus.
)
if exist "package-lock.json" (
    del /F package-lock.json >nul 2>&1
    echo [OK] package-lock.json lama dihapus.
)

echo.
echo [5] Installing dependencies...
echo [INFO] Ini akan membutuhkan waktu 2-5 menit...
echo [INFO] Jangan tutup window ini!
echo.

call npm install
if errorlevel 1 (
    echo.
    echo [ERROR] npm install gagal!
    echo.
    echo Kemungkinan penyebab:
    echo   - Koneksi internet bermasalah
    echo   - Antivirus memblokir npm
    echo.
    echo Solusi alternatif: Gunakan Docker Desktop
    echo   Double-click: Mulai_3oNs_Digital.bat
    pause
    exit /b 1
)

echo.
echo [OK] Dependencies berhasil diinstall!
echo.

echo ===================================================
echo    INSTALL SELESAI!
echo ===================================================
echo.
echo Sekarang bisa jalankan WA server dengan:
echo   start-wa-fixed.bat
echo.
echo Atau manual:
echo   cd wa-server
echo   npm start
echo.

pause
