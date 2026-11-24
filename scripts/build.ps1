$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    & pnpm --dir frontend install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency install failed.' }
    & pnpm --dir frontend test
    if ($LASTEXITCODE -ne 0) { throw 'Frontend tests failed.' }
    & pnpm --dir frontend build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
    $webRoot = Join-Path $projectRoot 'backend/web'
    New-Item -ItemType Directory -Path $webRoot -Force | Out-Null
    Copy-Item -Path (Join-Path $projectRoot 'frontend/dist/*') -Destination $webRoot -Recurse -Force
    & dotnet run --project tests/gateway/GatewayTests.csproj --configuration Release
    if ($LASTEXITCODE -ne 0) { throw 'Gateway tests failed.' }
    & dotnet publish backend/ApiDashboard.csproj --configuration Release --output artifacts/local
    if ($LASTEXITCODE -ne 0) { throw 'Gateway publish failed.' }
    Write-Host 'Built successfully. Run ./scripts/start.ps1 to open the Dashboard.'
} finally { Pop-Location }
