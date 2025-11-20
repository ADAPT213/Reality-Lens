#!/usr/bin/env pwsh
# Production startup script for SmartPick AI

Write-Host "🚀 Starting SmartPick AI Platform..." -ForegroundColor Cyan

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js not found. Install Node.js 22+ first." -ForegroundColor Red
    exit 1
}

$nodeVersion = node --version
Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green

# Kill existing processes on ports
Write-Host "Clearing ports 3500 and 4010..." -ForegroundColor Yellow
$port3500 = Get-NetTCPConnection -LocalPort 3500 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
$port4010 = Get-NetTCPConnection -LocalPort 4010 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique

if ($port3500) {
    Stop-Process -Id $port3500 -Force -ErrorAction SilentlyContinue
    Write-Host "✅ Cleared port 3500" -ForegroundColor Green
}

if ($port4010) {
    Stop-Process -Id $port4010 -Force -ErrorAction SilentlyContinue
    Write-Host "✅ Cleared port 4010" -ForegroundColor Green
}

Start-Sleep -Seconds 1

# Check environment files
if (-not (Test-Path "backend/.env")) {
    Write-Host "⚠️  Backend .env not found. Using defaults." -ForegroundColor Yellow
}

if (-not (Test-Path "frontend/.env.local")) {
    Write-Host "⚠️  Frontend .env.local not found. Using defaults." -ForegroundColor Yellow
}

# Start backend
Write-Host "Starting backend on port 4010..." -ForegroundColor Cyan
Push-Location backend
$backendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    $env:PORT = 4010
    $env:NODE_ENV = "production"
    node smartpick-server.js
} -ArgumentList (Get-Location).Path
Pop-Location

Start-Sleep -Seconds 3

# Check backend health
try {
    $health = Invoke-RestMethod -Uri "http://localhost:4010/api/health" -TimeoutSec 5
    Write-Host "✅ Backend healthy: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend health check failed" -ForegroundColor Red
    Stop-Job -Id $backendJob.Id
    Remove-Job -Id $backendJob.Id
    exit 1
}

# Start frontend
Write-Host "Starting frontend on port 3500..." -ForegroundColor Cyan
Push-Location frontend

# Check if build exists
if (-not (Test-Path ".next")) {
    Write-Host "Building frontend..." -ForegroundColor Yellow
    npm run build
}

$frontendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    npm start
} -ArgumentList (Get-Location).Path
Pop-Location

Start-Sleep -Seconds 5

# Check frontend health
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3500" -UseBasicParsing -TimeoutSec 5
    Write-Host "✅ Frontend healthy: HTTP $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "❌ Frontend health check failed" -ForegroundColor Red
    Stop-Job -Id $backendJob.Id, $frontendJob.Id
    Remove-Job -Id $backendJob.Id, $frontendJob.Id
    exit 1
}

Write-Host ""
Write-Host "🎉 SmartPick AI Platform is running!" -ForegroundColor Green
Write-Host "   Backend:  http://localhost:4010/api" -ForegroundColor Cyan
Write-Host "   Frontend: http://localhost:3500" -ForegroundColor Cyan
Write-Host "   Clarity:  http://localhost:3500/clarity" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop all services." -ForegroundColor Yellow

# Monitor jobs
while ($true) {
    if ((Get-Job -Id $backendJob.Id).State -eq 'Failed') {
        Write-Host "❌ Backend crashed!" -ForegroundColor Red
        break
    }
    if ((Get-Job -Id $frontendJob.Id).State -eq 'Failed') {
        Write-Host "❌ Frontend crashed!" -ForegroundColor Red
        break
    }
    Start-Sleep -Seconds 5
}

# Cleanup
Write-Host "Stopping services..." -ForegroundColor Yellow
Stop-Job -Id $backendJob.Id, $frontendJob.Id -ErrorAction SilentlyContinue
Remove-Job -Id $backendJob.Id, $frontendJob.Id -ErrorAction SilentlyContinue
