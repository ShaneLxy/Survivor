# -*- coding: utf-8 -*-
# ============================================================
# Claude-3p (Cowork) 数据迁移到 D 盘
# 把缓存 + 虚拟机镜像从 C 盘搬到 D:\ClaudeData,
# 用 NTFS 目录联结(mklink /J)在原位置留下指向 D 盘的链接,
# 对 Claude 应用完全透明,无需改任何配置。
#
# 用法:双击 migrate-claude-3p.bat
# 必须先完全退出 Claude 桌面应用(否则 vm_bundles 的文件被锁)
# ============================================================

try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
    chcp 65001 > $null
} catch {}

$TargetBase = "D:\ClaudeData"

# ---------- 1. 找到源根目录 ----------
$candidateRoots = @()
$pkgParent = "$env:LOCALAPPDATA\Packages"
if (Test-Path $pkgParent) {
    Get-ChildItem $pkgParent -Directory -Filter 'Claude_*' -ErrorAction SilentlyContinue | ForEach-Object {
        $p = Join-Path $_.FullName 'LocalCache\Local\Claude-3p'
        if (Test-Path $p) { $candidateRoots += $p }
    }
}
$plainRoot = "$env:LOCALAPPDATA\Claude-3p"
if (Test-Path $plainRoot) { $candidateRoots += $plainRoot }

function Get-FolderSize($path) {
    if (-not (Test-Path $path)) { return 0 }
    $s = (Get-ChildItem -LiteralPath $path -Recurse -Force -File -ErrorAction SilentlyContinue |
          Measure-Object -Property Length -Sum).Sum
    if ($null -eq $s) { return 0 }
    return $s
}
function Format-Size($b) {
    if ($b -ge 1GB) { return ('{0:N2} GB' -f ($b/1GB)) }
    if ($b -ge 1MB) { return ('{0:N1} MB' -f ($b/1MB)) }
    if ($b -ge 1KB) { return ('{0:N0} KB' -f ($b/1KB)) }
    return "$b B"
}

$Root = $null; $bestSize = -1
foreach ($r in $candidateRoots) {
    $s = Get-FolderSize $r
    if ($s -gt $bestSize) { $bestSize = $s; $Root = $r }
}
if (-not $Root) {
    Write-Host "[!] 没找到 Claude-3p 数据目录" -ForegroundColor Red
    Read-Host "按回车退出"; exit
}

Write-Host "源目录: $Root" -ForegroundColor Cyan
Write-Host "目标:   $TargetBase" -ForegroundColor Cyan
Write-Host ""

# ---------- 2. 检查 D 盘 ----------
$dRoot = "D:\"
if (-not (Test-Path $dRoot)) {
    Write-Host "[!] D 盘不可用,退出" -ForegroundColor Red
    Read-Host "按回车退出"; exit
}
# 检查 D 盘剩余空间
$dDrive = Get-PSDrive D -ErrorAction SilentlyContinue
if ($dDrive) {
    $freeGB = [math]::Round($dDrive.Free / 1GB, 1)
    Write-Host ("D 盘剩余空间: {0} GB" -f $freeGB) -ForegroundColor DarkGray
    if ($dDrive.Free -lt 15GB) {
        Write-Host "[!] D 盘剩余 < 15 GB,可能装不下虚拟机镜像,确认继续?" -ForegroundColor Yellow
    }
}

# ---------- 3. 检查 Claude 是否还在跑 ----------
$claudeProc = Get-Process -Name 'Claude*' -ErrorAction SilentlyContinue
if ($claudeProc) {
    Write-Host "`n[!] 检测到 Claude 进程还在运行:" -ForegroundColor Red
    $claudeProc | Format-Table Id, ProcessName -AutoSize
    Write-Host "vm_bundles 里的文件会被锁住搬不动。请先完全退出 Claude(托盘图标右键退出)。" -ForegroundColor Red
    $ans = Read-Host "已退出了吗?继续 [y/N]"
    if ($ans -ne 'y' -and $ans -ne 'Y') { exit }
}

# ---------- 4. 要迁移的文件夹列表 ----------
# 相对于 $Root 的路径
$migrateList = @(
    'vm_bundles',
    'Cache',
    'Code Cache',
    'GPUCache',
    'DawnWebGPUCache',
    'DawnGraphiteCache',
    'Shared Dictionary',
    'Partitions\cowork-file-preview'
)

Write-Host "`n=== 待迁移项 ===" -ForegroundColor Cyan
$totalToMove = 0
$plan = @()
foreach ($rel in $migrateList) {
    $src = Join-Path $Root $rel
    if (-not (Test-Path $src)) { continue }

    # 跳过已是联结的(说明已经迁过)
    $item = Get-Item -LiteralPath $src -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        Write-Host ("  [跳过-已联结] {0}" -f $rel) -ForegroundColor DarkGray
        continue
    }

    $size = Get-FolderSize $src
    $totalToMove += $size
    $plan += [pscustomobject]@{ Rel=$rel; Src=$src; Size=$size }
    Write-Host ("  {0,-40} {1}" -f $rel, (Format-Size $size))
}
Write-Host ("  --- 合计要搬: {0} ---" -f (Format-Size $totalToMove)) -ForegroundColor Yellow

if ($plan.Count -eq 0) {
    Write-Host "`n没有要迁移的项(可能已经全部迁过了)。" -ForegroundColor Green
    Read-Host "按回车退出"; exit
}

# ---------- 5. 最后确认 ----------
Write-Host "`n=== 即将执行 ===" -ForegroundColor Cyan
Write-Host "  1) 在 D:\ClaudeData 下创建对应目录"
Write-Host "  2) 把上述文件夹整个 move 到 D:\ClaudeData\..."
Write-Host "  3) 在 C 盘原位置创建 NTFS 联结 (mklink /J) 指向 D 盘"
Write-Host "  Claude 应用看起来文件还在原位,实际数据在 D 盘。" -ForegroundColor DarkGray
$ans = Read-Host "`n确认开始?[y/N]"
if ($ans -ne 'y' -and $ans -ne 'Y') {
    Write-Host "已取消" -ForegroundColor Yellow
    Read-Host "按回车退出"; exit
}

# ---------- 6. 执行 ----------
# 计算目标根目录:在 TargetBase 下镜像 Root 的"标识性"路径
# 简单做法:直接用 TargetBase 当镜像根,相对路径原样拼上
if (-not (Test-Path $TargetBase)) {
    New-Item -ItemType Directory -Path $TargetBase -Force | Out-Null
}

$ok = 0; $fail = 0
foreach ($p in $plan) {
    $rel = $p.Rel
    $src = $p.Src
    $dst = Join-Path $TargetBase $rel
    $dstParent = Split-Path $dst -Parent

    Write-Host ""
    Write-Host ("[{0}]" -f $rel) -ForegroundColor Cyan
    Write-Host "  src: $src"
    Write-Host "  dst: $dst"

    try {
        if (-not (Test-Path $dstParent)) {
            New-Item -ItemType Directory -Path $dstParent -Force | Out-Null
        }
        if (Test-Path $dst) {
            Write-Host "  [!] 目标已存在,跳过" -ForegroundColor Yellow
            $fail++; continue
        }

        Write-Host "  正在 move..."
        Move-Item -LiteralPath $src -Destination $dst -Force -ErrorAction Stop

        # 创建联结
        $cmd = 'mklink /J "{0}" "{1}"' -f $src, $dst
        $r = & cmd.exe /c $cmd 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "mklink 失败: $r"
        }
        Write-Host "  [OK] 联结已建立" -ForegroundColor Green
        $ok++
    } catch {
        Write-Host ("  [FAIL] {0}" -f $_.Exception.Message) -ForegroundColor Red
        # 尝试还原:如果 dst 存在而 src 不存在,把它搬回去
        if ((Test-Path $dst) -and -not (Test-Path $src)) {
            Write-Host "  尝试还原..." -ForegroundColor Yellow
            try {
                Move-Item -LiteralPath $dst -Destination $src -Force -ErrorAction Stop
                Write-Host "  已还原" -ForegroundColor Green
            } catch {
                Write-Host ("  还原也失败了!请手动检查 src/dst") -ForegroundColor Red
            }
        }
        $fail++
    }
}

# ---------- 7. 汇总 ----------
Write-Host "`n=== 完成 ===" -ForegroundColor Cyan
Write-Host ("成功: {0} 项 / 失败: {1} 项" -f $ok, $fail)
Write-Host ""
Write-Host "验证联结(右侧应显示 D:\ClaudeData\... 路径):"
foreach ($p in $plan) {
    if (Test-Path $p.Src) {
        $item = Get-Item -LiteralPath $p.Src -Force
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            $target = (cmd.exe /c "dir /A:L `"$($item.Parent.FullName)`"" 2>&1 |
                       Select-String -Pattern ([regex]::Escape($item.Name)) | Select-Object -First 1)
            Write-Host ("  [JUNCTION] {0}" -f $p.Src) -ForegroundColor Green
        } else {
            Write-Host ("  [普通目录] {0}" -f $p.Src) -ForegroundColor Yellow
        }
    }
}

Write-Host "`n现在重启 Claude 桌面应用即可。" -ForegroundColor Cyan
Write-Host ""
Read-Host "按回车关闭窗口"
