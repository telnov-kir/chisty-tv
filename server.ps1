# CHISTY TV - local server. ASCII-ONLY SOURCE.
# PS 5.1 reads BOM-less .ps1 as CP1251; Cyrillic literals become smart quotes and break parsing.
# All human-readable texts live in messages.json (read explicitly as UTF-8).
$ErrorActionPreference = 'Continue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
$Root = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$Web = Join-Path $Root 'web'
$Docs = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'CleanTV'

$Msg = $null
$MsgPath = Join-Path $Root 'messages.json'
if (Test-Path $MsgPath) { try { $Msg = [IO.File]::ReadAllText($MsgPath, [Text.Encoding]::UTF8) | ConvertFrom-Json } catch {} }
if (-not $Msg) {
    $Msg = [pscustomobject]@{
        banner1 = 'CHISTY TV running: http://localhost:8765/'; banner2 = 'Keep this window open.'; banner3 = 'Stop: Ctrl+C'
        portBusy = 'Port 8765 busy. Close another copy.'; pressEnter = 'Press Enter'; backup = 'Backup saved: '
        E_WEB = 'Folder "web" not found next to server.ps1.'
        E_CODE6 = 'Need 6-digit pairing code.'; E_PAIRADDR = 'Bad pair address.'; E_CONNADDR = 'Bad connect address.'
        E_IP = 'Bad TV IP.'; E_MULTIDEV = 'More than one device.'
        E_MULTIDEV_DETAIL = 'Multiple ADB devices: {0}. Run adb disconnect for extra ones.'
        E_NODEVICE = 'TV not connected.'; E_BADNAME = 'Bad package name.'; E_NOTINSTALLED = 'Not installed.'
        E_PROTECTED = 'PROTECTED: disable blocked.'; E_PATH = 'Bad journal path.'; E_API = 'Unknown API.'
    }
}

# Independent server-side guard: these packages are NEVER disabled.
$Never = @(
    'com.yandex.tv.services.platform', 'com.yandex.tv.live', 'ru.yandex.androidkeyboard.tv',
    'ru.sberdevices.starlauncher', 'com.tcl.suspension', 'com.cvte.tv.hkcfac',
    'com.android.location.fused', 'com.google.android.gms', 'com.android.vending'
)
$Patterns = @('inputmethod', 'keyboard', 'launcher', 'tvhome', 'systemui', 'installer', 'providers',
    '\.settings', 'wifi', 'bluetooth', 'hdmi', 'tvinput', 'factory', 'hkcfac', 'location\.fused',
    'services\.platform', 'yandex\.tv\.live', 'tcl\.suspension', 'starlauncher', 'gms$', 'vending')

$S = @{ Adb = $null; Device = $null; Info = $null; Pkgs = @(); Enabled = @(); Disabled = @();
    Protected = (New-Object 'System.Collections.Generic.HashSet[string]');
    Platform = 'generic'; WorkDir = $null; Protocol = @() 
}

function Write-Protocol([string]$cmd, [string]$out) {
    $script:S.Protocol += @{ ts = [DateTimeOffset]::Now.ToUnixTimeMilliseconds(); cmd = $cmd; out = $out }
    if ($script:S.WorkDir) {
        Add-Content (Join-Path $script:S.WorkDir 'protocol.txt') ("[{0}] {1}`r`n{2}`r`n" -f (Get-Date -Format 'HH:mm:ss'), $cmd, $out) -Encoding UTF8
    }
}
function Invoke-Adb {
    param([string[]]$a)
    $cmd = 'adb ' + ($a -join ' ')
    $out = (& $script:S.Adb @a 2>&1 | ForEach-Object { "$_" }) -join "`n"
    Write-Protocol $cmd $out
    return $out
}
function Invoke-TvShell { param([string]$cmd) Invoke-Adb @('-s', $script:S.Device, 'shell', $cmd) }
function Test-Device { if (-not $script:S.Device) { throw $Msg.E_NODEVICE } }
function ConvertFrom-PackageLines($raw) { @($raw -split "`n" | ForEach-Object { ($_ -replace '^package:', '').Trim() } | Where-Object { $_ }) }

function Initialize-Adb {
    if ($S.Adb) { return }
    $cmd = Get-Command adb -ErrorAction SilentlyContinue
    if ($cmd) { $S.Adb = $cmd.Source; return }
    $local = Join-Path $Root 'platform-tools\adb.exe'
    if (-not (Test-Path $local)) {
        $zip = Join-Path $env:TEMP 'platform-tools.zip'
        Invoke-WebRequest 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip' -OutFile $zip -UseBasicParsing
        Expand-Archive $zip -DestinationPath $Root -Force
    }
    $S.Adb = $local
}
function Update-TvStates {
    $S.Enabled = ConvertFrom-PackageLines ((Invoke-TvShell 'pm list packages -e') -join "`n")
    $S.Disabled = ConvertFrom-PackageLines ((Invoke-TvShell 'pm list packages -d') -join "`n")
}
function Get-TvPlatform {
    $marks = [ordered]@{
        yandex   = 'com.yandex.tv.services.platform', 'com.yandex.android.advid'
        sber     = 'ru.sberdevices.starlauncher'
        xiaomi   = 'com.miui.tv.analytics', 'com.xiaomi.mitv.advertise', 'com.mitv.tvhome'
        googletv = 'com.google.android.tvrecommendations', 'com.google.android.apps.tv.launcherx'
        tcl      = 'com.tcl.suspension'
        haier    = 'com.cvte.tv.hkcfac'
    }
    foreach ($k in $marks.Keys) { foreach ($m in $marks[$k]) { if ($S.Pkgs -contains $m) { return $k } } }
    return 'generic'
}
# Resolve current HOME package. Candidate must look like a package name (contain a dot)
# AND be present in the installed package list - otherwise dumpsys noise gets captured.
function Get-HomePackage {
    $cmds = @(
        'cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME',
        'pm resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME',
        'cmd package query-activities --brief -a android.intent.action.MAIN -c android.intent.category.HOME',
        'dumpsys window | grep mCurrentFocus',
        'dumpsys activity activities | grep mResumedActivity'
    )
    foreach ($c in $cmds) {
        $out = Invoke-TvShell $c
        foreach ($line in ($out -split "`n")) {
            foreach ($m in [regex]::Matches($line, '([\w]+(?:\.[\w]+)+)/')) {
                $cand = $m.Groups[1].Value
                if ($script:S.Pkgs -contains $cand) { return $cand }
            }
        }
    }
    return ''
}
function New-ProtectedSet {
    $set = New-Object 'System.Collections.Generic.HashSet[string]'
    foreach ($n in $Never) { [void]$set.Add($n) }
    foreach ($p in $S.Pkgs) { foreach ($pat in $Patterns) { if ($p -match $pat) { [void]$set.Add($p); break } } }
    if ($S.Info.launcher) { [void]$set.Add($S.Info.launcher) }
    if ($S.Info.ime) { [void]$set.Add($S.Info.ime) }
    $S.Protected = $set
}

function Connect-Tv($b) {
    Initialize-Adb
    if ($b.pairAddr) {
        if ($b.code -notmatch '^\d{6}$') { throw $Msg.E_CODE6 }
        if ($b.pairAddr -notmatch '^[\d\.]+:\d+$') { throw $Msg.E_PAIRADDR }
        Invoke-Adb @('pair', $b.pairAddr, $b.code) | Out-Null
        if ($b.connectAddr -notmatch '^[\d\.]+:\d+$') { throw $Msg.E_CONNADDR }
        Invoke-Adb @('connect', $b.connectAddr) | Out-Null
    }
    else {
        if ($b.ip -notmatch '^[\d\.]+$') { throw $Msg.E_IP }
        Invoke-Adb @('connect', "$($b.ip):5555") | Out-Null
    }
    $raw = Invoke-Adb @('devices')
    if ($raw -match 'unauthorized') { return @{ ok = $false; unauthorized = $true } }
    $devs = @($raw -split "`n" | Where-Object { $_ -match '\s+device$' })
    if (-not $devs.Count) { return @{ ok = $false } }
    if ($devs.Count -gt 1) {
        $serials = ($devs | ForEach-Object { ($_.Trim() -split '\s+')[0] }) -join ', '
        $tpl = $Msg.E_MULTIDEV_DETAIL
        if (-not $tpl) { $tpl = $Msg.E_MULTIDEV }
        throw ($tpl -f $serials)
    }
    $S.Device = ($devs[0].Trim() -split '\s+')[0]
    $brand = ((Invoke-TvShell 'getprop ro.product.brand') -join '').Trim()
    $model = ((Invoke-TvShell 'getprop ro.product.model') -join '').Trim()
    $rel = ((Invoke-TvShell 'getprop ro.build.version.release') -join '').Trim()
    $sdk = ((Invoke-TvShell 'getprop ro.build.version.sdk') -join '').Trim()
    $fp = ((Invoke-TvShell 'getprop ro.build.fingerprint') -join '').Trim()
    $S.Pkgs = ConvertFrom-PackageLines ((Invoke-TvShell 'pm list packages') -join "`n")
    Update-TvStates
    $plat = Get-TvPlatform
    $launcher = Get-HomePackage
    $ime = ''
    $imeRaw = ((Invoke-TvShell 'settings get secure default_input_method') -join '')
    if ($imeRaw -match '^([\w\.]+)/') { $ime = $Matches[1] }
    $S.Platform = $plat
    $S.Info = @{ serial = $S.Device; brand = $brand; model = $model; android = $rel; sdk = $sdk; fingerprint = $fp;
        ip = $S.Device.Split(':')[0]; packageCount = $S.Pkgs.Count; platform = $plat; launcher = $launcher; ime = $ime 
    }
    New-ProtectedSet
    $safe = ($brand + '_' + $model) -replace '[^\w\-]', '_'
    $S.WorkDir = Join-Path $Docs ($safe + '_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
    New-Item -ItemType Directory -Path $S.WorkDir -Force | Out-Null
    $S.Pkgs | Set-Content (Join-Path $S.WorkDir 'packages.txt') -Encoding UTF8
    (Invoke-TvShell 'getprop') | Set-Content (Join-Path $S.WorkDir 'getprop.txt') -Encoding UTF8
    foreach ($ns in 'system', 'secure', 'global') { (Invoke-TvShell "settings list $ns") | Set-Content (Join-Path $S.WorkDir "settings_$ns.txt") -Encoding UTF8 }
    Write-Protocol 'backup' ($Msg.backup + $S.WorkDir)
    return @{ ok = $true; device = $S.Info }
}

function Get-TvDiag {
    Test-Device
    @{
        meminfo = (Invoke-TvShell 'cat /proc/meminfo')
        loadavg = (Invoke-TvShell 'cat /proc/loadavg')
        uptime  = (Invoke-TvShell 'cat /proc/uptime')
        cores   = (Invoke-TvShell 'grep -c ^processor /proc/cpuinfo')
        top     = (Invoke-TvShell 'top -b -n 1 -m 12')
        df      = (Invoke-TvShell 'df -h /data')
        thermal = (Invoke-TvShell 'for z in /sys/class/thermal/thermal_zone*/temp; do echo "$z $(cat $z)"; done')
    }
}

function Write-Journal($names, [string]$kind) {
    $safe = ($S.Info.brand + '_' + $S.Info.model) -replace '[^\w\-]', '_'
    $dir = Join-Path $Docs ($safe + '\session_' + (Get-Date -Format 'yyyyMMdd_HHmmss_fff'))
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    @{ ts = [DateTimeOffset]::Now.ToUnixTimeMilliseconds(); device = $S.Info.model; serial = $S.Device; names = @($names); kind = $kind } |
    ConvertTo-Json -Depth 5 | Set-Content (Join-Path $dir 'session.json') -Encoding UTF8
    $names | Set-Content (Join-Path $dir 'names.txt') -Encoding UTF8
    return $dir
}
function Disable-TvPackages($b) {
    Test-Device
    $results = @(); $done = @()
    foreach ($n in @($b.names)) {
        $cmd = "pm disable-user --user 0 $n"
        if ($n -notmatch '^[A-Za-z0-9._]+$') { $results += @{name = $n; ok = $false; command = $cmd; output = $Msg.E_BADNAME }; continue }
        if ($S.Pkgs -notcontains $n) { $results += @{name = $n; ok = $false; command = $cmd; output = $Msg.E_NOTINSTALLED }; continue }
        if ($S.Protected.Contains($n)) { $results += @{name = $n; ok = $false; command = $cmd; output = $Msg.E_PROTECTED }; continue }
        $out = (Invoke-TvShell $cmd) -join ' '
        $ok = $out -match 'disabled'
        if ($ok) { $done += $n }
        $results += @{ name = $n; ok = $ok; command = $cmd; output = $out }
    }
    if ($done.Count) { Write-Journal $done 'clean' | Out-Null }
    Update-TvStates
    return @{ results = $results }
}
function Enable-TvPackages($b) {
    Test-Device
    $results = @()
    foreach ($n in @($b.names)) {
        $cmd = "pm enable $n"
        if ($n -notmatch '^[A-Za-z0-9._]+$') { $results += @{name = $n; ok = $false; command = $cmd; output = $Msg.E_BADNAME }; continue }
        $out = (Invoke-TvShell $cmd) -join ' '
        $results += @{ name = $n; ok = ($out -match 'enabled'); command = $cmd; output = $out }
    }
    Update-TvStates
    return @{ results = $results }
}
function Search-TvPackages($b) {
    Test-Device
    $known = @($b.known)
    $rx = 'advertis|\.ads?\.|adservice|analytic|telemetr|metric|tracker|recommend|pushservice|\.acr\.|upgrad|promo'
    @{ items = @($S.Pkgs | Sort-Object | Where-Object { $_ -match $rx -and $known -notcontains $_ -and -not $S.Protected.Contains($_) }) }
}
function Get-Journals {
    $items = @()
    if (Test-Path $Docs) {
        Get-ChildItem $Docs -Recurse -Filter 'session.json' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | ForEach-Object {
            try {
                $m = Get-Content $_.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
                $items += @{ path = $_.FullName; ts = $m.ts; device = $m.device; names = @($m.names); kind = $m.kind;
                    rolledBack = (Test-Path (Join-Path $_.DirectoryName 'rolledback.flag')) 
                }
            }
            catch {}
        }
    }
    @{ items = $items }
}
function Restore-Journal($b) {
    Test-Device
    $full = [IO.Path]::GetFullPath([string]$b.path)
    $base = [IO.Path]::GetFullPath($Docs)
    if (-not $full.StartsWith($base, [StringComparison]::OrdinalIgnoreCase) -or (Split-Path $full -Leaf) -ne 'session.json') { throw $Msg.E_PATH }
    $m = Get-Content $full -Raw -Encoding UTF8 | ConvertFrom-Json
    $results = @()
    foreach ($n in @($m.names)) {
        if ($n -match '^[A-Za-z0-9._]+$') {
            $out = (Invoke-TvShell "pm enable $n") -join ' '
            $results += @{ name = $n; ok = ($out -match 'enabled'); command = "pm enable $n"; output = $out }
        }
    }
    'rolled back' | Set-Content (Join-Path (Split-Path $full) 'rolledback.flag') -Encoding UTF8
    Update-TvStates
    @{ results = $results }
}
function Disconnect-Tv {
    if ($S.Adb) { Invoke-Adb @('disconnect') | Out-Null }
    $S.Device = $null; $S.Info = $null; $S.Pkgs = @(); $S.Enabled = @(); $S.Disabled = @(); $S.WorkDir = $null
    $S.Protected = New-Object 'System.Collections.Generic.HashSet[string]'
    @{ ok = $true }
}
function Get-State { @{ server = $true; adb = [bool]$S.Adb; adbPath = $S.Adb; connected = [bool]$S.Device; device = $S.Info; workdir = $S.WorkDir } }

function Send-Json($ctx, $obj, [int]$code = 200) {
    $bytes = [Text.Encoding]::UTF8.GetBytes((ConvertTo-Json $obj -Depth 8))
    $ctx.Response.StatusCode = $code; $ctx.Response.ContentType = 'application/json; charset=utf-8'
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length); $ctx.Response.Close()
}
function Send-File($ctx, [string]$path) {
    $mime = @{'.html' = 'text/html'; '.css' = 'text/css'; '.js' = 'application/javascript'; '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'; '.json' = 'application/json' }
    $ext = [IO.Path]::GetExtension($path).ToLower()
    $type = if ($mime[$ext]) { $mime[$ext] }else { 'application/octet-stream' }
    $bytes = [IO.File]::ReadAllBytes($path)
    $ctx.Response.ContentType = "$type; charset=utf-8"
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length); $ctx.Response.Close()
}

if (-not (Test-Path (Join-Path $Web 'index.html'))) {
    Write-Host $Msg.E_WEB -ForegroundColor Red
    Read-Host $Msg.pressEnter; exit 1
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://localhost:8765/')
try { $listener.Start() } catch { Write-Host $Msg.portBusy -ForegroundColor Red; Read-Host $Msg.pressEnter; exit 1 }
Write-Host '==================================================' -ForegroundColor Cyan
Write-Host $Msg.banner1 -ForegroundColor Green
Write-Host $Msg.banner2 -ForegroundColor Yellow
Write-Host $Msg.banner3 -ForegroundColor DarkGray
Write-Host '==================================================' -ForegroundColor Cyan
Start-Process 'http://localhost:8765/'
try {
    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        $path = $ctx.Request.Url.AbsolutePath
        try {
            if ($path.StartsWith('/api/')) {
                $body = $null
                if ($ctx.Request.HasEntityBody) {
                    $txt = (New-Object IO.StreamReader($ctx.Request.InputStream, [Text.Encoding]::UTF8)).ReadToEnd()
                    if ($txt) { $body = $txt | ConvertFrom-Json }
                }
                $res = switch ($path) {
                    '/api/state' { Get-State }
                    '/api/adb' { Initialize-Adb; @{ ok = $true; path = $S.Adb; version = (Invoke-Adb @('version')) } }
                    '/api/connect' { Connect-Tv $body }
                    '/api/packages' { Test-Device; @{ items = $S.Pkgs; enabled = $S.Enabled; disabled = $S.Disabled; protected = @($S.Protected); platform = $S.Platform; device = $S.Info } }
                    '/api/diag' { Get-TvDiag }
                    '/api/disable' { Disable-TvPackages $body }
                    '/api/enable' { Enable-TvPackages $body }
                    '/api/scan' { Search-TvPackages $body }
                    '/api/journals' { Get-Journals }
                    '/api/rollback' { Restore-Journal $body }
                    '/api/protocol' { @{ items = $S.Protocol } }
                    '/api/disconnect' { Disconnect-Tv }
                    default { throw $Msg.E_API }
                }
                Send-Json $ctx $res
            }
            else {
                $rel = if ($path -eq '/') { 'index.html' } else { $path.TrimStart('/') }
                $full = [IO.Path]::GetFullPath((Join-Path $Web $rel))
                if (-not $full.StartsWith([IO.Path]::GetFullPath($Web), [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path $full -PathType Leaf)) {
                    $ctx.Response.StatusCode = 404; $ctx.Response.Close()
                }
                else { Send-File $ctx $full }
            }
        }
        catch { try { Send-Json $ctx @{ error = "$_" } 500 } catch {} }
    }
}
finally { $listener.Stop() }