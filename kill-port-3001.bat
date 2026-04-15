@echo off
echo ==========================================
echo      KILL PORT 3001 - EMERGENCY TOOL
echo ==========================================
echo.
echo Mencari dan mematikan semua proses di port 3001...
echo.

REM Method 1: PowerShell (paling reliable)
echo [1] Menggunakan PowerShell...
powershell -Command "Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host ('  Kill PID: ' + $_.OwningProcess); Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

REM Method 2: Taskkill fallback
echo.
echo [2] Taskkill fallback...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING" 2^>nul') do (
    echo   Kill PID: %%a
    taskkill /F /PID %%a >nul 2>&1
)

REM Method 3: Kill Node.js processes specifically
echo.
echo [3] Kill semua Node.js (hati-hati!)...
taskkill /F /IM node.exe >nul 2>&1

echo.
echo [4] Verifikasi port 3001...
netstat -ano ^| findstr ":3001" ^| findstr "LISTENING" >nul
if %errorlevel% equ 0 (
    echo.
    echo [WARNING] Port 3001 masih aktif!
    echo Jalankan script ini lagi atau restart komputer.
) else (
    echo [OK] Port 3001 sudah bersih!
)

echo.
echo ==========================================
pause
