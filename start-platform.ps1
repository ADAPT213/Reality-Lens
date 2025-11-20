param(
    [ValidateSet("start","stop")]
    [string]$Action = "start"
)

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

switch ($Action) {
    "start" {
        Write-Host "Starting SmartPick AI platform..." -ForegroundColor Cyan
        docker compose up -d
        Write-Host "Platform started." -ForegroundColor Green
        Write-Host "Frontend: http://localhost:3500" -ForegroundColor Yellow
        Write-Host "Summary:  http://localhost:3500/summary" -ForegroundColor Yellow
    }
    "stop" {
        Write-Host "Stopping SmartPick AI platform..." -ForegroundColor Cyan
        docker compose down
        Write-Host "Platform stopped." -ForegroundColor Green
    }
}
