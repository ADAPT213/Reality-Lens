param(
  [switch]$SkipBackend,
  [switch]$SkipFrontend
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Invoke-Npm {
  param([string]$Path, [string[]]$Commands)
  Push-Location $Path
  try {
    if (Test-Path package-lock.json) { npm ci } else { npm install }
    foreach ($cmd in $Commands) { npm run $cmd }
  } finally {
    Pop-Location
  }
}

Write-Host "==> Building SmartPick AI (backend + frontend)" -ForegroundColor Cyan

if (-not $SkipBackend) {
  Write-Host "-- Backend: npm ci + npm run build" -ForegroundColor Yellow
  Invoke-Npm -Path "backend" -Commands @("build")
}

if (-not $SkipFrontend) {
  Write-Host "-- Frontend: npm ci + npm run build" -ForegroundColor Yellow
  Invoke-Npm -Path "frontend" -Commands @("build")
}

Write-Host "✔ Build completed" -ForegroundColor Green