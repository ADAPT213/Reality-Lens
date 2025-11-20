param(
  [int]$Port = 4010,
  [switch]$NoBuild
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Test-PortOpen {
  param([int]$Port)
  try { (Get-NetTCPConnection -LocalPort $Port -ErrorAction Stop) | Out-Null; return $true } catch { return $false }
}

Push-Location "$PSScriptRoot\..\backend"
try {
  if (-not $NoBuild) {
    if (Test-Path package-lock.json) { npm ci } else { npm install }
    npm run build
  }

  $env:PORT = "$Port"
  Write-Host "==> Starting NestJS (dist/main.js) on port $Port" -ForegroundColor Cyan
  $backendPath = (Get-Location).Path
  $nest = Start-Process powershell -PassThru -WindowStyle Minimized -ArgumentList @('-NoProfile','-Command', "Set-Location '$backendPath'; `$env:PORT='$Port'; node dist/main.js")

  Start-Sleep -Seconds 3
  if (-not (Test-PortOpen -Port $Port)) {
    Write-Warning "NestJS not listening on port $Port. Falling back to Express server (smartpick-server.js)."
    if ($nest -and !$nest.HasExited) { try { Stop-Process -Id $nest.Id -Force -ErrorAction SilentlyContinue } catch {} }
    $env:PORT = "$Port"
    Start-Process powershell -NoNewWindow -ArgumentList @('-NoProfile','-Command', "Set-Location '$backendPath'; `$env:PORT='$Port'; node smartpick-server.js")
  } else {
    Write-Host "Backend is up on port $Port" -ForegroundColor Green
  }
} finally {
  Pop-Location
}