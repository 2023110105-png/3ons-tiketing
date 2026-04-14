# ============================================
# Project Reorganization Script
# Run: ./scripts/reorganize-structure.ps1
# ============================================

$projectRoot = "$PSScriptRoot\.."
$srcPath = "$projectRoot\src"

Write-Host "🚀 Starting project reorganization..." -ForegroundColor Green

# 1. Create new folder structure
Write-Host "📁 Creating folder structure..." -ForegroundColor Cyan

$folders = @(
    "$srcPath\api",
    "$srcPath\hooks", 
    "$srcPath\services",
    "$srcPath\stores",
    "$srcPath\styles",
    "$srcPath\types",
    "$srcPath\components\ui",
    "$srcPath\components\Layout",
    "$srcPath\pages\auth",
    "$srcPath\pages\admin-panel\tabs",
    "$srcPath\supabase\migrations",
    "$srcPath\supabase\functions",
    "$projectRoot\docs"
)

foreach ($folder in $folders) {
    if (!(Test-Path $folder)) {
        New-Item -ItemType Directory -Path $folder -Force | Out-Null
        Write-Host "  ✓ Created: $folder" -ForegroundColor Gray
    }
}

# 2. Move files (if they exist in old locations)
Write-Host "📦 Moving files to new locations..." -ForegroundColor Cyan

# Move supabase setup files
if (Test-Path "$projectRoot\supabase_setup_*.sql") {
    Move-Item "$projectRoot\supabase_setup_*.sql" "$projectRoot\supabase\migrations\" -ErrorAction SilentlyContinue
    Write-Host "  ✓ Moved SQL files to supabase/migrations/" -ForegroundColor Gray
}

# 3. Create index files for clean imports
Write-Host "📝 Creating barrel exports..." -ForegroundColor Cyan

# contexts/index.js
@'
// Barrel exports for contexts
export { AuthContextSaaS, AuthProviderSaaS, useAuth } from './AuthContextSaaS'
export { ToastProvider, useToast } from './ToastContext'
'@ | Set-Content "$srcPath\contexts\index.js" -Force

# hooks/index.js  
@'
// Barrel exports for hooks
// export { useAuth } from './useAuth'
// export { useTenant } from './useTenant'
'@ | Set-Content "$srcPath\hooks\index.js" -Force

# components/index.js
@'
// Barrel exports for components
export { Layout } from './Layout/Layout'
export { ErrorBoundary } from './ErrorBoundary'
export { OfflineIndicator } from './OfflineIndicator'
'@ | Set-Content "$srcPath\components\index.js" -Force

Write-Host "✅ Reorganization complete!" -ForegroundColor Green
Write-Host "" -ForegroundColor White
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Review PROJECT_STRUCTURE.md for architecture details" -ForegroundColor White
Write-Host "2. Update imports in your files to use new paths" -ForegroundColor White
Write-Host "3. Move any additional files as needed" -ForegroundColor White
