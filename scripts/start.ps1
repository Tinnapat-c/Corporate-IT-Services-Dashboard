$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $projectRoot 'artifacts/local'
$application = Join-Path $runtimeRoot 'ApiDashboard.exe'
if (-not (Test-Path -LiteralPath $application)) { throw 'Build first: ./scripts/build.ps1' }
$alreadyRunning = $false
try { $alreadyRunning = (Invoke-RestMethod 'http://127.0.0.1:8766/health' -TimeoutSec 2).status -eq 'ready' } catch {}
if (-not $alreadyRunning) { Start-Process -FilePath $application -WorkingDirectory $runtimeRoot -WindowStyle Hidden }
Start-Process 'http://127.0.0.1:8766/#LIVE'
