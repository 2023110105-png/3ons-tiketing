@echo off
echo ==========================================
echo    WA SERVER - CLEAN START
echo ==========================================
echo.

REM Kill proses di port 3001
echo [1] Membersihkan port 3001...
powershell -Command "try { Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue; Write-Host ('  Killed PID: ' + $_.OwningProcess) } } catch {}"

REM Kill semua node.exe (backup)
taskkill /F /IM node.exe >nul 2>&1

echo [OK] Port dibersihkan.
echo.

REM Start server
echo [2] Starting WA Server...
echo.

npm start
