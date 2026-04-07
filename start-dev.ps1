$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverFile = Join-Path $projectRoot 'server.js'

if (-not (Test-Path $serverFile)) {
    Write-Error "server.js not found in $projectRoot"
}

# Prefer the pinned Python 3.11 env used for OCR dependencies.
$venv311Scripts = Join-Path $projectRoot '.venv311\Scripts'
$venvScripts = Join-Path $projectRoot '.venv\Scripts'

if (Test-Path (Join-Path $venv311Scripts 'python.exe')) {
    $env:Path = "$venv311Scripts;$env:Path"
    Write-Host "Using Python from .venv311"
} elseif (Test-Path (Join-Path $venvScripts 'python.exe')) {
    $env:Path = "$venvScripts;$env:Path"
    Write-Host "Using Python from .venv"
} else {
    Write-Warning 'No local virtual environment found. Falling back to system Python from PATH.'
}

# OCR worker requires this key at import time; default keeps startup stable.
if (-not $env:OLLAMA_API_KEY) {
    $env:OLLAMA_API_KEY = 'dummy'
}

# Avoid model source check failures on some Windows setups.
$env:PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK = 'True'

Set-Location $projectRoot

$existing = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    Write-Warning 'Port 3000 is already in use. Backend may already be running.'
    try {
        $health = Invoke-WebRequest -UseBasicParsing 'http://localhost:3000/health' -TimeoutSec 3
        Write-Host "Health check response: $($health.Content)"
    } catch {
        Write-Warning 'Port 3000 is occupied but health endpoint did not respond.'
    }
    exit 0
}

node server.js
