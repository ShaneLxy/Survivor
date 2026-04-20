$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$script:results = @()

function Add-Result {
    param(
        [string]$Name,
        [bool]$Ok,
        [string]$Value,
        [string]$Hint = ''
    )

    $script:results += [PSCustomObject]@{
        Name = $Name
        Status = if ($Ok) { 'OK' } else { 'MISSING' }
        Value = $Value
        Hint = $Hint
    }
}

function Test-Command {
    param([string]$CommandName)
    try {
        $command = Get-Command $CommandName -ErrorAction Stop
        return $command.Source
    } catch {
        return $null
    }
}

function Safe-Value {
    param($Value)
    if ($null -eq $Value) {
        return ''
    }
    return [string]$Value
}

$nodePath = Test-Command 'node'
Add-Result -Name 'Node.js' -Ok ([bool]$nodePath) -Value (Safe-Value $nodePath) -Hint 'Install Node.js 18+ recommended'

$npmPath = Test-Command 'npm'
Add-Result -Name 'npm' -Ok ([bool]$npmPath) -Value (Safe-Value $npmPath) -Hint 'Comes with Node.js'

$javaPath = Test-Command 'java'
Add-Result -Name 'Java' -Ok ([bool]$javaPath) -Value (Safe-Value $javaPath) -Hint 'Install JDK 17 and add it to PATH'

$androidHome = $env:ANDROID_HOME
$androidSdkRoot = $env:ANDROID_SDK_ROOT
$sdkValue = if ($androidHome) { $androidHome } elseif ($androidSdkRoot) { $androidSdkRoot } else { '' }
Add-Result -Name 'Android SDK' -Ok ([bool]$sdkValue) -Value $sdkValue -Hint 'Set ANDROID_HOME or ANDROID_SDK_ROOT'

$sdkManagerPath = Test-Command 'sdkmanager'
Add-Result -Name 'sdkmanager' -Ok ([bool]$sdkManagerPath) -Value (Safe-Value $sdkManagerPath) -Hint 'Install Android SDK command-line tools and add cmdline-tools/bin to PATH'

$gradleWrapper = Join-Path $projectRoot 'android\gradlew.bat'
Add-Result -Name 'Gradle wrapper' -Ok (Test-Path $gradleWrapper) -Value $gradleWrapper -Hint 'Run npx cap add android after npm install'

$capacitorConfig = Join-Path $projectRoot 'capacitor.config.json'
Add-Result -Name 'Capacitor config' -Ok (Test-Path $capacitorConfig) -Value $capacitorConfig -Hint ''

$webRoot = Join-Path $projectRoot 'mobile\web'
Add-Result -Name 'Prepared web assets' -Ok (Test-Path $webRoot) -Value $webRoot -Hint 'Run npm run cap:prepare'

$script:results | Format-Table -AutoSize

$missing = @($script:results | Where-Object { $_.Status -eq 'MISSING' })
if ($missing.Count -gt 0) {
    Write-Host ''
    Write-Host 'Missing prerequisites summary:' -ForegroundColor Yellow
    $missing | ForEach-Object {
        Write-Host "- $($_.Name): $($_.Hint)"
    }
    exit 1
}

Write-Host ''
Write-Host 'Android build environment looks ready.' -ForegroundColor Green
