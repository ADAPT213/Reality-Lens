param(
  [int]$Port = 3500
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Push-Location "$PSScriptRoot\..\frontend"
try {
  if (Test-Path package-lock.json) { npm ci } else { npm install }
  $env:PORT = "$Port"
  $frontendPath = (Get-Location).Path
  Start-Process powershell -NoNewWindow -ArgumentList @('-NoProfile','-Command', "Set-Location '$frontendPath'; npm run dev")
  Write-Host "Frontend dev server starting on port $Port" -ForegroundColor Green
} finally {
  Pop-Location
}