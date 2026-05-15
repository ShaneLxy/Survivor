param(
    [ValidateSet('test', 'formal')]
    [string]$BuildChannel = 'test',

    [ValidateSet('apk', 'aab')]
    [string]$Artifact = 'apk',

    [string]$VersionName = '1.0',
    [int]$VersionCode = 1,
    [string]$ApplicationId = 'com.survivor.game',
    [string]$AppName = '',
    [string]$BuildVersion = '',
    [string]$OutputDir = '',
    [string]$WebViewDebugging = '',
    [string]$SigningStoreFile = '',
    [string]$SigningStorePassword = '',
    [string]$SigningKeyAlias = '',
    [string]$SigningKeyPassword = '',
    [string]$ServerUrl = '',
    [string]$GmNote = '',
    [switch]$Clean,
    [switch]$SkipDoctor
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$projectRoot = Split-Path -Parent $PSScriptRoot
$androidRoot = Join-Path $projectRoot 'android'
$mobileWebRoot = Join-Path $projectRoot 'mobile\web'
$capacitorConfigPath = Join-Path $projectRoot 'capacitor.config.json'
$androidStringsPath = Join-Path $androidRoot 'app\src\main\res\values\strings.xml'
$defaultAppName = [string]([char]0x4e91) + [string]([char]0x5883)

if ([string]::IsNullOrWhiteSpace($AppName)) {
    $AppName = $defaultAppName
}

if ([string]::IsNullOrWhiteSpace($BuildVersion)) {
    $BuildVersion = Get-Date -Format 'yyyy.MM.dd.HHmm'
}

if ([string]::IsNullOrWhiteSpace($OutputDir)) {
    $OutputDir = Join-Path $projectRoot 'dist\android'
}

if ($VersionCode -lt 1) {
    throw 'VersionCode must be greater than 0.'
}

if ($ApplicationId -notmatch '^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$') {
    throw "Invalid Android applicationId: $ApplicationId"
}

$signingValues = @($SigningStoreFile, $SigningStorePassword, $SigningKeyAlias, $SigningKeyPassword) |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
$hasSigningConfig = $signingValues.Count -gt 0
if ($hasSigningConfig -and $signingValues.Count -ne 4) {
    throw 'Signing config is incomplete. Store file, store password, key alias, and key password must be filled together.'
}
if ($hasSigningConfig) {
    if (-not [System.IO.Path]::IsPathRooted($SigningStoreFile)) {
        $SigningStoreFile = Join-Path $projectRoot $SigningStoreFile
    }
    if (-not (Test-Path $SigningStoreFile)) {
        throw "Signing store file not found: $SigningStoreFile"
    }
}

$effectiveWebViewDebugging = if ([string]::IsNullOrWhiteSpace($WebViewDebugging)) {
    $BuildChannel -eq 'test'
} else {
    [System.Convert]::ToBoolean($WebViewDebugging)
}

function Resolve-Tool {
    param([string[]]$Names)
    foreach ($name in $Names) {
        $command = Get-Command $name -ErrorAction SilentlyContinue
        if ($command) {
            return $command.Source
        }
    }
    throw "Required tool not found: $($Names -join ' / ')"
}

function Invoke-CheckedCommand {
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$WorkingDirectory
    )

    $displayArguments = foreach ($argument in $Arguments) {
        if ($argument -match 'Password=') {
            $argument -replace '=.*$', '=******'
        } else {
            $argument
        }
    }
    $display = "$FilePath $($displayArguments -join ' ')"
    Write-Host ">> $display"
    Push-Location $WorkingDirectory
    try {
        & $FilePath @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Command failed with exit code $LASTEXITCODE`: $display"
        }
    } finally {
        Pop-Location
    }
}

function Set-StagedBuildVersion {
    param([string]$Version)

    $indexPath = Join-Path $mobileWebRoot 'index.html'
    $versionManagerPath = Join-Path $mobileWebRoot 'js\config\VersionManager.js'

    if (Test-Path $indexPath) {
        $indexContent = Get-Content -LiteralPath $indexPath -Raw -Encoding UTF8
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
        Set-Content -LiteralPath $indexPath -Value $indexContent -Encoding UTF8 -NoNewline
    }

    if (Test-Path $versionManagerPath) {
        $versionManagerContent = Get-Content -LiteralPath $versionManagerPath -Raw -Encoding UTF8
        $versionManagerContent = [regex]::Replace(
            $versionManagerContent,
            'window\.__SURVIVOR_BUILD_VERSION__ \|\| ''[^'']+''',
            "window.__SURVIVOR_BUILD_VERSION__ || '$Version'"
        )
        Set-Content -LiteralPath $versionManagerPath -Value $versionManagerContent -Encoding UTF8 -NoNewline
    }
}

function Set-CapacitorPackageConfig {
    param(
        [string]$Path,
        [string]$NativeAppId,
        [string]$NativeAppName,
        [bool]$DebuggingEnabled
    )

    $config = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
    $config.appId = $NativeAppId
    $config.appName = $NativeAppName
    if (-not $config.PSObject.Properties['android']) {
        $config | Add-Member -MemberType NoteProperty -Name android -Value ([pscustomobject]@{})
    }
    $config.android | Add-Member -MemberType NoteProperty -Name webContentsDebuggingEnabled -Value $DebuggingEnabled -Force
    $config | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Set-AndroidAppName {
    param([string]$NativeAppName)

    if (-not (Test-Path $androidStringsPath)) {
        return
    }

    [xml]$stringsXml = Get-Content -LiteralPath $androidStringsPath -Encoding UTF8
    foreach ($key in @('app_name', 'title_activity_main')) {
        $node = $stringsXml.resources.string | Where-Object { $_.name -eq $key } | Select-Object -First 1
        if ($node) {
            $node.InnerText = $NativeAppName
        }
    }
    $stringsXml.Save($androidStringsPath)
}

function Get-BuiltArtifact {
    param(
        [string]$Variant,
        [string]$ArtifactKind
    )

    $artifactRoot = if ($ArtifactKind -eq 'apk') {
        Join-Path $androidRoot "app\build\outputs\apk\$Variant"
    } else {
        Join-Path $androidRoot "app\build\outputs\bundle\$Variant"
    }

    if (-not (Test-Path $artifactRoot)) {
        throw "Build output directory not found: $artifactRoot"
    }

    $file = Get-ChildItem -LiteralPath $artifactRoot -Recurse -Filter "*.$ArtifactKind" |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if (-not $file) {
        throw "No .$ArtifactKind file generated in $artifactRoot"
    }

    return $file
}

$capacitorConfigBackup = $null
if (Test-Path $capacitorConfigPath) {
    $capacitorConfigBackup = Get-Content -LiteralPath $capacitorConfigPath -Raw -Encoding UTF8
}

$androidStringsBackup = $null
if (Test-Path $androidStringsPath) {
    $androidStringsBackup = Get-Content -LiteralPath $androidStringsPath -Raw -Encoding UTF8
}

try {
    Write-Host "Android package started."
    Write-Host "Channel: $BuildChannel"
    Write-Host "Artifact: $Artifact"
    Write-Host "VersionName: $VersionName"
    Write-Host "VersionCode: $VersionCode"
    Write-Host "ApplicationId: $ApplicationId"
    Write-Host "BuildVersion: $BuildVersion"
    Write-Host "WebView debugging: $effectiveWebViewDebugging"
    if (-not [string]::IsNullOrWhiteSpace($ServerUrl)) {
        Write-Host "ServerUrl note: $ServerUrl"
    }
    if (-not [string]::IsNullOrWhiteSpace($GmNote)) {
        Write-Host "GM note: $GmNote"
    }
    if ($hasSigningConfig) {
        Write-Host "Release signing: enabled ($SigningStoreFile)"
    } elseif ($BuildChannel -eq 'formal') {
        Write-Host "Release signing: not configured. The release artifact may be unsigned."
    }

    $powershell = Resolve-Tool @('powershell.exe', 'pwsh.exe')
    $npx = Resolve-Tool @('npx.cmd', 'npx')
    $gradlew = Join-Path $androidRoot 'gradlew.bat'

    if (-not (Test-Path $gradlew)) {
        throw "Gradle wrapper not found: $gradlew"
    }

    if (-not $SkipDoctor) {
        Invoke-CheckedCommand -FilePath $powershell -Arguments @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $PSScriptRoot 'doctor-android.ps1')) -WorkingDirectory $projectRoot
    }

    if ($capacitorConfigBackup) {
        Set-CapacitorPackageConfig -Path $capacitorConfigPath -NativeAppId $ApplicationId -NativeAppName $AppName -DebuggingEnabled $effectiveWebViewDebugging
    }

    Invoke-CheckedCommand -FilePath $powershell -Arguments @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $PSScriptRoot 'prepare-capacitor-web.ps1')) -WorkingDirectory $projectRoot
    Set-StagedBuildVersion -Version $BuildVersion
    Invoke-CheckedCommand -FilePath $npx -Arguments @('cap', 'sync', 'android') -WorkingDirectory $projectRoot
    Invoke-CheckedCommand -FilePath $powershell -Arguments @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $PSScriptRoot 'configure-capacitor-android.ps1')) -WorkingDirectory $projectRoot
    Set-AndroidAppName -NativeAppName $AppName

    $variant = if ($BuildChannel -eq 'formal') { 'release' } else { 'debug' }
    $variantTaskName = $variant.Substring(0, 1).ToUpperInvariant() + $variant.Substring(1)
    $task = if ($Artifact -eq 'apk') { "assemble$variantTaskName" } else { "bundle$variantTaskName" }
    $gradleProperties = @(
        "-PsurvivorApplicationId=$ApplicationId",
        "-PsurvivorVersionCode=$VersionCode",
        "-PsurvivorVersionName=$VersionName"
    )
    if ($hasSigningConfig) {
        $gradleProperties += @(
            "-PsurvivorStoreFile=$SigningStoreFile",
            "-PsurvivorStorePassword=$SigningStorePassword",
            "-PsurvivorKeyAlias=$SigningKeyAlias",
            "-PsurvivorKeyPassword=$SigningKeyPassword"
        )
    }

    if ($Clean) {
        Invoke-CheckedCommand -FilePath $gradlew -Arguments @('clean') -WorkingDirectory $androidRoot
    }

    $gradleArgs = @($task) + $gradleProperties
    Invoke-CheckedCommand -FilePath $gradlew -Arguments $gradleArgs -WorkingDirectory $androidRoot

    $artifactFile = Get-BuiltArtifact -Variant $variant -ArtifactKind $Artifact
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    $versionSlug = ($VersionName -replace '[^\w\.-]+', '_').Trim('_')
    if ([string]::IsNullOrWhiteSpace($versionSlug)) {
        $versionSlug = '1.0'
    }
    $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $destinationPath = Join-Path $OutputDir "survivor-$BuildChannel-v$versionSlug-$timestamp.$Artifact"
    Copy-Item -LiteralPath $artifactFile.FullName -Destination $destinationPath -Force

    Write-Host "Android package succeeded."
    Write-Host "Output file: $destinationPath"
    $result = @{
        success = $true
        artifactPath = $destinationPath
        sourceArtifactPath = $artifactFile.FullName
        channel = $BuildChannel
        variant = $variant
        artifact = $Artifact
        versionName = $VersionName
        versionCode = $VersionCode
        buildVersion = $BuildVersion
    } | ConvertTo-Json -Compress
    Write-Host "PACKAGE_RESULT_JSON:$result"
} catch {
    [Console]::Error.WriteLine("Android package failed: $($_.Exception.Message)")
    exit 1
} finally {
    if ($capacitorConfigBackup) {
        Set-Content -LiteralPath $capacitorConfigPath -Value $capacitorConfigBackup -Encoding UTF8 -NoNewline
    }
    if ($androidStringsBackup) {
        Set-Content -LiteralPath $androidStringsPath -Value $androidStringsBackup -Encoding UTF8 -NoNewline
    }
}
