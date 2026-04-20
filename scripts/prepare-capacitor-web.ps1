$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$mobileRoot = Join-Path $projectRoot 'mobile'
$webRoot = Join-Path $mobileRoot 'web'

$sources = @(
    'index.html',
    'css',
    'js',
    'assets',
    'data'
)

if (-not (Test-Path $mobileRoot)) {
    New-Item -ItemType Directory -Path $mobileRoot | Out-Null
}

if (-not (Test-Path $webRoot)) {
    New-Item -ItemType Directory -Path $webRoot | Out-Null
}

foreach ($source in $sources) {
    $sourcePath = Join-Path $projectRoot $source
    $destinationPath = Join-Path $webRoot $source
    if (-not (Test-Path $sourcePath)) {
        throw "Missing source path: $sourcePath"
    }

    if (Test-Path $destinationPath) {
        Remove-Item -LiteralPath $destinationPath -Recurse -Force -ErrorAction SilentlyContinue
    }

    Copy-Item -LiteralPath $sourcePath -Destination $webRoot -Recurse -Force
}

Write-Host "Capacitor web assets prepared in $webRoot"
