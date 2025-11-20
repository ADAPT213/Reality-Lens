Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

Write-Host "==> Cleaning build artifacts" -ForegroundColor Cyan

if (Test-Path "backend\dist") { Remove-Item -Recurse -Force "backend\dist" }
if (Test-Path "frontend\.next") { Remove-Item -Recurse -Force "frontend\.next" }

Write-Host "✔ Clean completed" -ForegroundColor Green