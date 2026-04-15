# 3oNs WA Server Launcher - PowerShell
# Mode Debug: Window tidak akan nutup meskipun error

$ErrorActionPreference = "Continue"

function Write-Header {
    param([string]$Title)
    Write-Host "`n===================================================" -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host "===================================================" -ForegroundColor Cyan
}

function Write-Step {
    param([int]$Number, [string]$Message)
    Write-Host "`n[$Number] $Message" -ForegroundColor Yellow
}

function Write-OK {
    param([string]$Message)
    Write-Host "  [OK] $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "  [ERROR] $Message" -ForegroundColor Red
}

function Pause-AnyKey {
    Write-Host "`nTekan tombol apa saja untuk melanjutkan..." -ForegroundColor Magenta
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

try {
    Write-Header "3oNs WA Server - PowerShell Launcher"

    $RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $WaDir = Join-Path $RootDir "wa-server"
    $Port = 3001

    Write-Host "Working Directory: $RootDir"
    Write-Host "WA Server Directory: $WaDir"

    # Step 1: Check folder
    Write-Step 1 "Mengecek folder wa-server..."
    if (-not (Test-Path $WaDir)) {
        Write-Error "Folder wa-server tidak ditemukan: $WaDir"
        Pause-AnyKey
        exit 1
    }
    Write-OK "Folder ditemukan"
    Set-Location $WaDir

    # Step 2: Check Node.js
    Write-Step 2 "Mengecek Node.js..."
    try {
        $nodeVersion = node --version 2>$null
        Write-OK "Node.js: $nodeVersion"
    } catch {
        Write-Error "Node.js tidak ditemukan! Install Node.js dari https://nodejs.org"
        Pause-AnyKey
        exit 1
    }

    # Step 3: Check .env
    Write-Step 3 "Mengecek file .env..."
    $envFile = Join-Path $WaDir ".env"
    if (-not (Test-Path $envFile)) {
        Write-Host "  [INFO] Membuat file .env otomatis..."
        @"
PORT=3001
NODE_ENV=development
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176,http://localhost:5179,http://localhost:5180
WA_ADMIN_SECRET=local-dev-secret-3ons
TICKET_SIGNING_SECRET=local-signing-secret-3ons
"@ | Out-File -FilePath $envFile -Encoding UTF8
        Write-OK "File .env dibuat"
    } else {
        Write-OK "File .env sudah ada"
    }

    # Step 4: Check node_modules
    Write-Step 4 "Mengecek dependencies..."
    $nodeModules = Join-Path $WaDir "node_modules"
    if (-not (Test-Path $nodeModules)) {
        Write-Host "  [INFO] Installing dependencies (bisa memakan waktu beberapa menit)..."
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Error "npm install gagal!"
            Pause-AnyKey
            exit 1
        }
        Write-OK "Dependencies terinstall"
    } else {
        Write-OK "Dependencies sudah ada"
    }

    # Step 5: Kill existing processes
    Write-Step 5 "Membersihkan port $Port..."
    try {
        $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        foreach ($conn in $connections) {
            try {
                Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
                Write-OK "Matikan PID: $($conn.OwningProcess)"
            } catch {
                Write-Host "  Gagal matikan PID: $($conn.OwningProcess)" -ForegroundColor Yellow
            }
        }
    } catch {
        Write-Host "  Tidak ada proses di port $Port"
    }

    # Also kill any node processes that might be wa-server
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
        $_.Path -like "*wa-server*"
    } | ForEach-Object {
        Stop-Process -Id $_.Id -Force
        Write-OK "Matikan node.exe (PID: $($_.Id))"
    }

    Start-Sleep -Seconds 2

    # Final check
    $stillActive = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($stillActive) {
        Write-Error "Port $Port masih tertahan! Coba restart komputer."
        Pause-AnyKey
        exit 1
    }

    Write-OK "Port $Port bersih"

    # Step 6: Start server
    Write-Header "MEMULAI WA SERVER"
    Write-Host "URL Akses:"
    Write-Host "  - Health: http://localhost:$Port/health"
    Write-Host "  - Status: http://localhost:$Port/api/wa/status"
    Write-Host ""
    Write-Host "Tekan CTRL+C untuk menghentikan server"
    Write-Host "==================================================="
    Write-Host ""

    # Start the server
    node index.js

    # If we get here, server stopped
    Write-Host "`n[INFO] Server berhenti dengan exit code: $LASTEXITCODE" -ForegroundColor Yellow
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Server exit dengan error!"
        Write-Host "`nSolusi yang bisa dicoba:"
        Write-Host "  1. Hapus folder wa-server/node_modules dan install ulang"
        Write-Host "  2. Cek file wa-server/index.js untuk syntax error"
        Write-Host "  3. Restart komputer"
    }

} catch {
    Write-Host "`n[CRITICAL ERROR]" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor DarkGray
}

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host "  SCRIPT SELESAI - Tekan tombol apa saja untuk tutup" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Pause-AnyKey
