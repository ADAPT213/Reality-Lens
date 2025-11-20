param(
  [switch]$NoServices,
  [switch]$NoBuild
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Write-Host "==> SmartPick AI: starting services + backend + frontend" -ForegroundColor Cyan

if (-not $NoServices) {
  & "$PSScriptRoot\scripts\start-services.ps1"
}

& "$PSScriptRoot\scripts\start-backend.ps1" -Port 4010 -NoBuild:$NoBuild
& "$PSScriptRoot\scripts\start-frontend.ps1" -Port 3500

Write-Host "Startup initiated." -ForegroundColor Green
Write-Host "- Backend: http://localhost:4010"
Write-Host "- Frontend: http://localhost:3500"