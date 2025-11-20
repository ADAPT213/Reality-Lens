$ErrorActionPreference = 'Stop'

function Write-Info($m) { Write-Host "[docker] $m" -ForegroundColor Cyan }
function Write-Warn($m) { Write-Host "[docker] $m" -ForegroundColor Yellow }

try {
    $ok = $false
    try { docker info | Out-Null; $ok = $true } catch { $ok = $false }
    if ($ok) { Write-Info "Docker is already running."; exit 0 }

    $dockerExe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    if (-not (Test-Path $dockerExe)) {
        Write-Warn "Docker Desktop not found at $dockerExe. Please start Docker manually."
        exit 1
    }

    Write-Info "Starting Docker Desktop..."
    Start-Process -FilePath $dockerExe | Out-Null

    Write-Info "Waiting for Docker engine to be ready..."
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt 120) {
        try { docker info | Out-Null; Write-Info "Docker is ready."; exit 0 } catch { Start-Sleep -Seconds 2 }
    }
    Write-Warn "Timed out waiting for Docker. Open Docker Desktop and try again."
    exit 1
}
catch {
    Write-Error $_
    exit 1
}
