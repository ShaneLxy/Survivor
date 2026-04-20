param(
    [Parameter(Mandatory = $true)]
    [string]$Version
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$indexPath = Join-Path $root 'index.html'
$versionManagerPath = Join-Path $root 'js\config\VersionManager.js'

if (-not (Test-Path $indexPath)) {
    throw "找不到 index.html：$indexPath"
}

if (-not (Test-Path $versionManagerPath)) {
    throw "找不到 VersionManager.js：$versionManagerPath"
}

$indexContent = Get-Content $indexPath -Raw -Encoding UTF8
$indexContent = [regex]::Replace(
    $indexContent,
    'window\.__SURVIVOR_BUILD_VERSION__\s*=\s*''[^'']+''',
    "window.__SURVIVOR_BUILD_VERSION__ = '$Version'"
)
$indexContent = [regex]::Replace(
    $indexContent,
    '\?v=[0-9]{4}\.[0-9]{2}\.[0-9]{2}\.[0-9]+',
    "?v=$Version"
)
Set-Content -Path $indexPath -Value $indexContent -Encoding UTF8

$versionManagerContent = Get-Content $versionManagerPath -Raw -Encoding UTF8
$versionManagerContent = [regex]::Replace(
    $versionManagerContent,
    'window\.__SURVIVOR_BUILD_VERSION__ \|\| ''[^'']+''',
    "window.__SURVIVOR_BUILD_VERSION__ || '$Version'"
)
Set-Content -Path $versionManagerPath -Value $versionManagerContent -Encoding UTF8

Write-Host "已更新发布版本到 $Version"
