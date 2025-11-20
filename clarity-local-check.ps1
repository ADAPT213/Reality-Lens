param(
    [switch]$SkipDocker
)

$ErrorActionPreference = "Stop"

Write-Host "=== Clarity Node local check starting ===" -ForegroundColor Cyan

Set-Location "C:\Users\bnich\Projects\smartpick-ai"

if (-not $SkipDocker) {
    Write-Host "[1] Ensuring docker compose services are up" -ForegroundColor Yellow
    docker compose up -d
    docker compose ps
}

Write-Host "[2] Backend Prisma and build" -ForegroundColor Yellow
Set-Location ".\backend"

$env:DATABASE_URL = "postgres://postgres:postgres@localhost:5432/smartpick"

npm install --ignore-scripts

npx prisma generate
npx prisma db push

npm run lint --if-present
npm test --if-present
npm run build --if-present

Write-Host "[3] Frontend build" -ForegroundColor Yellow
Set-Location "..\frontend"

npm install --ignore-scripts
npm run lint --if-present
npm run build

Set-Location ".."

Write-Host "=== Clarity Node local check finished clean ===" -ForegroundColor Green
