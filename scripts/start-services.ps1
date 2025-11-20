Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host "==> Starting infrastructure services (docker compose up -d)" -ForegroundColor Cyan

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Warning "Docker not installed or not in PATH. Skipping service start."
  exit 0
}

Push-Location (Split-Path -Parent $PSCommandPath)
try {
  $root = Resolve-Path ".." | Select-Object -ExpandProperty Path
  Push-Location $root
  if (Test-Path "docker-compose.yml") {
    docker compose up -d
  } else {
    Write-Host "No docker-compose.yml found; skipping services." -ForegroundColor Yellow
  }
} finally {
  Pop-Location; Pop-Location
}

Write-Host "✔ Services started (if available)" -ForegroundColor Green