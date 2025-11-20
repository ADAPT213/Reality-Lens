# RealityLensOS Unified Launcher
# AR Primary Engine + SmartPick AI Secondary Engine

$ErrorActionPreference = "Stop"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   RealityLensOS - AR Primary System" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js not found. Install from https://nodejs.org" -ForegroundColor Red
    exit 1
}

Write-Host "Node.js detected: $(node --version)" -ForegroundColor Green

# Navigate to workspace
$ROOT = $PSScriptRoot
Set-Location $ROOT

# Start Backend (SmartPick AI Secondary Engine)
Write-Host ""
Write-Host "Starting SmartPick AI Backend..." -ForegroundColor Yellow

if (!(Test-Path "backend\dist\main.js")) {
    Write-Host "  Building backend..." -ForegroundColor Gray
    Push-Location backend
    npm run build | Out-Null
    Pop-Location
}

Push-Location backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:PORT=4010; `$env:NODE_ENV='development'; node dist/main.js" -WindowStyle Normal
Pop-Location

Write-Host "Backend started on http://localhost:4010/api" -ForegroundColor Green

# Start AR Web App (RealityLens Primary Engine)
Write-Host ""
Write-Host "Starting AR Web App..." -ForegroundColor Yellow

if (!(Test-Path "app\index.html")) {
    Write-Host "AR app not found in /app directory" -ForegroundColor Red
    exit 1
}

Push-Location app
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:PORT=8088; node ../scripts/serve-pages.js" -WindowStyle Normal
Pop-Location

Start-Sleep -Seconds 2
Start-Process "http://localhost:8088"

Write-Host "AR App started at http://localhost:8088" -ForegroundColor Green

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   RealityLensOS Running" -ForegroundColor Cyan
Write-Host "   Backend:  http://localhost:4010/api" -ForegroundColor White
Write-Host "   Swagger:  http://localhost:4010/api/docs" -ForegroundColor White
Write-Host "   AR App:   http://localhost:8088" -ForegroundColor White
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Gray

