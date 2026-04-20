$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$androidRoot = Join-Path $projectRoot 'android'
$manifestPath = Join-Path $androidRoot 'app\src\main\AndroidManifest.xml'
$stringsPath = Join-Path $androidRoot 'app\src\main\res\values\strings.xml'
$appBuildGradlePath = Join-Path $androidRoot 'app\build.gradle'
$mainActivityJavaPath = Get-ChildItem -Path (Join-Path $androidRoot 'app\src\main') -Recurse -Filter MainActivity.java -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
$mainActivityKotlinPath = Get-ChildItem -Path (Join-Path $androidRoot 'app\src\main') -Recurse -Filter MainActivity.kt -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
$packageName = 'com.survivor.game'

if (-not (Test-Path $manifestPath)) {
    Write-Host 'Android project not found yet. Run "npx cap add android" first.'
    exit 0
}

[xml]$manifestXml = Get-Content -LiteralPath $manifestPath
$namespaceUri = 'http://schemas.android.com/apk/res/android'
$ns = New-Object System.Xml.XmlNamespaceManager($manifestXml.NameTable)
$ns.AddNamespace('android', $namespaceUri)

$applicationNode = $manifestXml.manifest.application
$activityNode = $applicationNode.activity | Where-Object { $_.'android:name' -eq '.MainActivity' -or $_.name -eq '.MainActivity' } | Select-Object -First 1
if (-not $activityNode) {
    $activityNode = $applicationNode.activity | Select-Object -First 1
}

if ($activityNode) {
    $orientationAttr = $activityNode.Attributes.GetNamedItem('android:screenOrientation')
    if (-not $orientationAttr) {
        $orientationAttr = $manifestXml.CreateAttribute('android', 'screenOrientation', $namespaceUri)
        $activityNode.Attributes.Append($orientationAttr) | Out-Null
    }
    $orientationAttr.Value = 'portrait'

    $exportedAttr = $activityNode.Attributes.GetNamedItem('android:exported')
    if (-not $exportedAttr) {
        $exportedAttr = $manifestXml.CreateAttribute('android', 'exported', $namespaceUri)
        $activityNode.Attributes.Append($exportedAttr) | Out-Null
    }
    $exportedAttr.Value = 'true'

    $resizeableAttr = $activityNode.Attributes.GetNamedItem('android:resizeableActivity')
    if (-not $resizeableAttr) {
        $resizeableAttr = $manifestXml.CreateAttribute('android', 'resizeableActivity', $namespaceUri)
        $activityNode.Attributes.Append($resizeableAttr) | Out-Null
    }
    $resizeableAttr.Value = 'false'
}

$usesPermissionNames = @(
    'android.permission.INTERNET'
)

foreach ($permissionName in $usesPermissionNames) {
    $exists = $false
    foreach ($node in $manifestXml.manifest.'uses-permission') {
        $nameNode = $node.Attributes.GetNamedItem('android:name')
        $nameValue = if ($nameNode) { $nameNode.Value } else { $null }
        if ($nameValue -eq $permissionName) {
            $exists = $true
            break
        }
    }

    if (-not $exists) {
        $permissionNode = $manifestXml.CreateElement('uses-permission')
        $nameAttr = $manifestXml.CreateAttribute('android', 'name', $namespaceUri)
        $nameAttr.Value = $permissionName
        $permissionNode.Attributes.Append($nameAttr) | Out-Null
        $manifestXml.manifest.PrependChild($permissionNode) | Out-Null
    }
}

$manifestXml.Save($manifestPath)
Write-Host "Android manifest configured: $manifestPath"

if (Test-Path $stringsPath) {
    [xml]$stringsXml = Get-Content -LiteralPath $stringsPath
    $appNameNode = $stringsXml.resources.string | Where-Object { $_.name -eq 'app_name' } | Select-Object -First 1
    if ($appNameNode) {
        $appNameNode.InnerText = '末日生存'
        $stringsXml.Save($stringsPath)
        Write-Host "Android app name configured: $stringsPath"
    }
}

function Set-MainActivityFullscreen {
    param(
        [string]$filePath,
        [string]$language
    )

    if (-not $filePath -or -not (Test-Path $filePath)) {
        return
    }

    $content = Get-Content -LiteralPath $filePath -Raw

    if ($language -eq 'java') {
        $content = $content -replace 'package\s+com\.getcapacitor\.myapp;', "package $packageName;"

        if ($content -notmatch 'WindowCompat') {
            $content = $content -replace 'import com.getcapacitor.BridgeActivity;', "import com.getcapacitor.BridgeActivity;`r`nimport android.os.Bundle;`r`nimport androidx.core.view.WindowCompat;`r`nimport androidx.core.view.WindowInsetsCompat;`r`nimport androidx.core.view.WindowInsetsControllerCompat;"
        }

        if ($content -notmatch 'setDecorFitsSystemWindows') {
            $content = $content -replace 'public class MainActivity extends BridgeActivity \{', "public class MainActivity extends BridgeActivity {`r`n    @Override`r`n    public void onCreate(Bundle savedInstanceState) {`r`n        super.onCreate(savedInstanceState);`r`n        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);`r`n        WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());`r`n        controller.hide(WindowInsetsCompat.Type.systemBars());`r`n        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);`r`n    }"
        }
    } elseif ($language -eq 'kotlin') {
        $content = $content -replace 'package\s+com\.getcapacitor\.myapp', "package $packageName"

        if ($content -notmatch 'WindowCompat') {
            $content = $content -replace 'import com.getcapacitor.BridgeActivity', "import com.getcapacitor.BridgeActivity`r`nimport android.os.Bundle`r`nimport androidx.core.view.WindowCompat`r`nimport androidx.core.view.WindowInsetsCompat`r`nimport androidx.core.view.WindowInsetsControllerCompat"
        }

        if ($content -notmatch 'setDecorFitsSystemWindows') {
            $content = $content -replace 'class MainActivity : BridgeActivity\(\)', "class MainActivity : BridgeActivity() {`r`n    override fun onCreate(savedInstanceState: Bundle?) {`r`n        super.onCreate(savedInstanceState)`r`n        WindowCompat.setDecorFitsSystemWindows(window, false)`r`n        val controller = WindowInsetsControllerCompat(window, window.decorView)`r`n        controller.hide(WindowInsetsCompat.Type.systemBars())`r`n        controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE`r`n    }`r`n}"
        }
    }

    Set-Content -LiteralPath $filePath -Value $content -NoNewline
    Write-Host "Android fullscreen activity configured: $filePath"
}

Set-MainActivityFullscreen -filePath $mainActivityJavaPath -language 'java'
Set-MainActivityFullscreen -filePath $mainActivityKotlinPath -language 'kotlin'

if (Test-Path $appBuildGradlePath) {
    $gradleContent = Get-Content -LiteralPath $appBuildGradlePath -Raw
    $gradleContent = $gradleContent -replace 'namespace\s+"com\.getcapacitor\.myapp"', "namespace `"$packageName`""
    $gradleContent = $gradleContent -replace 'applicationId\s+"com\.getcapacitor\.app"', "applicationId `"$packageName`""
    Set-Content -LiteralPath $appBuildGradlePath -Value $gradleContent -NoNewline
    Write-Host "Android app package configured: $appBuildGradlePath"
}
