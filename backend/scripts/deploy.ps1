[CmdletBinding()]
param(
    [string]$Service,
    [string]$Region = 'asia-southeast1',
    [string]$Project = 'hackathon-myhack',
    [string]$Repo = 'carelink-images',
    [string]$Image = 'carelink-api',
    [string]$ServiceAccount = 'carelink-runtime@hackathon-myhack.iam.gserviceaccount.com',
    [string]$CloudSqlInstance = 'hackathon-myhack:asia-southeast1:postgres',
    [string]$DbName = 'carelink',
    [string]$DbUser = 'carelink-runtime@hackathon-myhack.iam',
    [ValidateSet('postgres','sqlite')]
    [string]$DbBackend = 'postgres',
    [switch]$SkipBuild,
    [string]$ExistingTag
)

$ErrorActionPreference = 'Stop'

$backendDir = Split-Path -Parent $PSScriptRoot

if (-not $Service) {
    Write-Host ""
    Write-Host "Select deploy target:" -ForegroundColor Cyan
    Write-Host "  [1] carelink-api-staging  (default)"
    Write-Host "  [2] carelink-api          (PRODUCTION)"
    Write-Host "  [3] custom"
    $choice = Read-Host "Choice [1]"
    switch ($choice) {
        '2'     { $Service = 'carelink-api' }
        '3'     { $Service = Read-Host "Service name" }
        default { $Service = 'carelink-api-staging' }
    }
}

if ($Service -eq 'carelink-api') {
    Write-Host ""
    Write-Host "!! You are about to deploy to PRODUCTION (carelink-api)." -ForegroundColor Yellow
    $confirm = Read-Host "Type 'deploy prod' to continue"
    if ($confirm -ne 'deploy prod') { Write-Host "Aborted." -ForegroundColor Red; exit 1 }
}

$registry = "$Region-docker.pkg.dev/$Project/$Repo/$Image"

if ($SkipBuild) {
    if (-not $ExistingTag) { throw "-SkipBuild requires -ExistingTag" }
    $tag = $ExistingTag
    Write-Host "Skipping build. Using existing tag: $tag" -ForegroundColor Yellow
} else {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $prefix = if ($Service -eq 'carelink-api') { 'prod' } else { 'staging' }
    $tag = "$prefix-$stamp"

    Write-Host ""
    Write-Host "Building $registry`:$tag from $backendDir" -ForegroundColor Cyan
    Push-Location $backendDir
    try {
        & gcloud builds submit --project $Project --tag "$registry`:$tag" .
        if ($LASTEXITCODE -ne 0) { throw "Build failed (exit $LASTEXITCODE)" }
    } finally {
        Pop-Location
    }
}

Write-Host ""
Write-Host "Deploying to Cloud Run service '$Service' ($Region), db=$DbBackend" -ForegroundColor Cyan

$deployArgs = @(
    'run','deploy',$Service,
    '--project',$Project,
    '--region',$Region,
    '--image',"$registry`:$tag",
    '--service-account',$ServiceAccount,
    '--max-instances','1',
    '--memory','512Mi',
    '--cpu','1',
    '--port','8080',
    '--timeout','300',
    '--concurrency','80',
    '--allow-unauthenticated'
)

if ($DbBackend -eq 'sqlite') {
    $deployArgs += @(
        '--set-env-vars','CARELINK_ENVIRONMENT=cloud,CARELINK_IAP_REQUIRED=false,CARELINK_SQLITE_PATH=/tmp/carelink.sqlite',
        '--clear-cloudsql-instances'
    )
} else {
    $envCsv = "CARELINK_ENVIRONMENT=cloud,CARELINK_IAP_REQUIRED=false,CARELINK_CLOUD_SQL_INSTANCE=$CloudSqlInstance,CARELINK_DB_NAME=$DbName,CARELINK_DB_USER=$DbUser,CARELINK_CLOUD_SQL_IP_TYPE=PUBLIC"
    $deployArgs += @(
        '--set-env-vars',$envCsv,
        '--set-cloudsql-instances',$CloudSqlInstance
    )
}

& gcloud @deployArgs

if ($LASTEXITCODE -ne 0) { throw "Deploy failed (exit $LASTEXITCODE)" }

$url = & gcloud run services describe $Service --project $Project --region $Region --format='value(status.url)'
Write-Host ""
Write-Host "Deployed: $url" -ForegroundColor Green
Write-Host "Smoke test:" -ForegroundColor Cyan
try {
    $resp = Invoke-WebRequest -Uri "$url/health" -UseBasicParsing -TimeoutSec 30
    Write-Host "  HTTP $($resp.StatusCode)  $($resp.Content)"
} catch {
    Write-Host "  health check failed: $($_.Exception.Message)" -ForegroundColor Yellow
}
