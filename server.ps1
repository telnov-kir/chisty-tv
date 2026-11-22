# CHISTY TV - local server. ASCII-ONLY SOURCE.
# PS 5.1 reads BOM-less .ps1 as CP1251; Cyrillic literals become smart quotes and break parsing.
# All human-readable texts live in messages.json (read explicitly as UTF-8, auto-repaired).
#
# SAFETY: floor (never) > never-list > patterns > allowlist / user apps. Expert bypasses allowlist 30 min.
$ErrorActionPreference = 'Continue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
$Root = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$Web = Join-Path $Root 'web'
$Docs = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'CleanTV'

# Detects double-encoded UTF-8 (UTF-8 bytes once read as CP1251) and restores it.
function Repair-Text([string]$s) {
    if ([string]::IsNullOrEmpty($s)) { return $s }
    if ($s.IndexOf([char]0x00D0) -lt 0 -and $s.IndexOf([char]0x00D1) -lt 0 -and $s.IndexOf([char]0x00C2) -lt 0) { return $s }
    try {
        $bytes = [Text.Encoding]::GetEncoding(1251).GetBytes($s)
        $fixed = [Text.Encoding]::UTF8.GetString($bytes)
        if ($fixed -match '[\u0410-\u044F\u0401\u0451]') { return $fixed }
    }
    catch {}
    return $s
}

$Msg = $null
$MsgFixed = 0
$MsgPath = Join-Path $Root 'messages.json'
if (Test-Path $MsgPath) {
    try {
        $rawMsg = [IO.File]::ReadAllText($MsgPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
        $Msg = New-Object psobject
        foreach ($p in $rawMsg.PSObject.Properties) {
            $v = Repair-Text ([string]$p.Value)
            if ($v -ne [string]$p.Value) { $MsgFixed++ }
            Add-Member -InputObject $Msg -NotePropertyName $p.Name.Trim() -NotePropertyValue $v -Force
        }
    }
    catch {}
}
if (-not $Msg) {
    $Msg = [pscustomobject]@{
        banner1 = 'CHISTY TV running: http://localhost:8765/'; banner2 = 'Keep this window open.'; banner3 = 'Stop: Ctrl+C'
        portBusy = 'Port 8765 busy.'; pressEnter = 'Press Enter'; backup = 'Backup saved: '; journalRepair = 'Journal normalized: '
        E_WEB = 'Folder web not found.'; E_CODE6 = 'Need 6-digit code.'; E_PAIRADDR = 'Bad pair address.'
        E_CONNADDR = 'Bad connect address.'; E_IP = 'Bad TV IP.'; E_MULTIDEV = 'More than one device.'
        E_MULTIDEV_DETAIL = 'Multiple ADB devices: {0}.'; E_NODEVICE = 'TV not connected.'; E_BADNAME = 'Bad package name.'
        E_NOTINSTALLED = 'Not installed.'; E_PROTECTED = 'PROTECTED.'; E_SYSTEM = 'SYSTEM: not in allowlist.'
        E_FLOOR = 'ABSOLUTE FLOOR.'; E_EXPERT_PHRASE = 'Confirmation not accepted.'; E_EXPERT_EXPIRED = 'Expert mode expired.'
        E_PATH = 'Bad journal path.'; E_SESSION = 'Bad session id.'; E_PRIVKEY = 'Key not allowed.'; E_PRIVVAL = 'Only 0 or 1.'
        E_API = 'Unknown API.'; expertOn = 'EXPERT MODE ON'; expertOff = 'EXPERT MODE OFF'
        homeRefresh = 'Home screen refreshed.'; rebooting = 'Reboot sent.'; persistent = 'Persistent process, reboot required.'
        privacySet = 'Privacy key changed: '; encodingFixed = 'Server texts repaired from broken encoding.'
    }
}

$Floor = @('android', 'com.android.shell')

$AllowDisable = @(
    'com.google.android.tvrecommendations', 'com.google.android.katniss', 'com.google.android.apps.tv.dreamx',
    'com.google.android.feedback', 'com.google.android.backuptransport', 'com.google.android.partnersetup',
    'com.google.android.videos', 'com.google.android.play.games', 'com.google.android.tv.assistant',
    'com.google.android.youtube.tv', 'com.google.android.youtube.tvmusic',
    'android.autoinstalls.config.google.gtvpai', 'au.com.stan.and', 'com.android.settings.intelligence',
    'com.tcl.waterfall.overseas', 'com.tcl.tclchannel.overlay', 'com.tcl.channelplus', 'com.tcl.advertise',
    'com.tcl.assistant', 'com.tcl.smartalexa', 'com.tcl.browser', 'com.tcl.gallery', 'com.tcl.esticker',
    'com.tcl.messagebox', 'com.tcl.notereminder', 'com.tcl.useragreement', 'com.tcl.usercenter',
    'com.tcl.hotelmenu', 'com.tcl.dashboard', 'com.tcl.customize.overlay', 'com.tcl.partnercustomizer',
    'com.tcl.keyhelp', 'com.tcl.miracast', 'com.tcl.MultiScreenInteraction_TV',
    'com.yandex.android.advid', 'com.yandex.tv.recommendations', 'com.yandex.tv.analytics',
    'com.yandex.tv.acr', 'com.yandex.tv.updater',
    'com.miui.tv.analytics', 'com.xiaomi.mitv.advertise', 'com.xiaomi.mitv.upgrade', 'com.xiaomi.mitv.tvpushservice',
    'ru.sberdevices.ads', 'ru.sberdevices.analytics', 'com.cvte.tv.advertise',
    'ru.kinopoisk.tv', 'ru.start.androidmobile', 'gpm.tnt_premier', 'mobi.zona', 'com.vk.tv', 'ru.yandex.music',
    'tv.wuaki.apptv', 'com.tvos', 'com.netflix.ninja', 'com.amazon.amazonvideo.livingroom',
    'com.valvesoftware.steamlink', 'com.hiro.vpn', 'com.lagomproductsllc.lagomvpn', 'com.ogonconnect.app',
    'com.piplnetwork.piplvpn'
)

$Never = @(
    'com.android.externalstorage', 'com.android.permissioncontroller', 'com.google.android.permissioncontroller',
    'com.google.android.gsf', 'com.google.android.webview', 'com.tcl.android.webview', 'com.google.android.gms',
    'com.android.vending', 'com.android.location.fused', 'com.android.systemui', 'com.android.bluetooth',
    'com.android.providers.settings', 'com.android.providers.media', 'com.android.providers.media.module',
    'com.android.providers.tv', 'com.android.providers.downloads', 'com.android.tv.settings',
    'com.google.android.packageinstaller', 'com.google.android.inputmethod.latin',
    'com.tcl.system.server', 'com.tcl.tv', 'com.tcl.ttvs', 'com.tcl.tvinput', 'com.tcl.settings',
    'com.tcl.providers.config', 'com.tcl.guard', 'com.tcl.initsetup', 'com.tcl.autopair', 'com.tcl.micmanager',
    'com.tcl.suspension', 'com.tcl.tv.tclhome_passive', 'com.tcl.ui_mediaCenter', 'com.tcl.factory.view',
    'com.google.android.tv.remote.service', 'com.google.android.apps.mediashell',
    'com.yandex.tv.services.platform', 'com.yandex.tv.live', 'ru.yandex.androidkeyboard.tv',
    'ru.sberdevices.starlauncher', 'com.cvte.tv.hkcfac'
)

$Patterns = @('inputmethod', 'keyboard', 'launcher', 'tvhome', 'tclhome', 'systemui', 'installer', 'providers',
    '\.settings$', 'tv\.settings\.', 'wifi', 'bluetooth', 'hdmi', 'tvinput', 'factory', 'hkcfac', 'location\.fused',
    'services\.platform', 'yandex\.tv\.live', 'tcl\.suspension', 'starlauncher', 'gms$', 'gsf$', 'vending',
    '^android$', '^com\.android\.', 'webview', 'permissioncontroller', 'externalstorage', 'documentsui', '\.shell$',
    'networkstack', 'tethering', 'captiveportal', 'keychain', 'proxyhandler', 'pacprocessor', 'statementservice',
    'sharedstoragebackup', 'localtransport', 'backupconfirm', 'dynsystem', 'inputdevices', 'vpndialogs',
    'companiondevicemanager', 'ctsshim', 'setupwraith', 'authbridge', 'mediashell', 'smartconnect', 'ext\.services',
    'ext\.shared', 'modulemetadata', 'onetimeinitializer', 'overlay\.modules', 'syncadapters', '\.tts$', 'talkback',
    'remote\.service', 'frameworkpackagestubs', 'com\.tcl\.system', 'com\.tcl\.guard', 'com\.tcl\.initsetup',
    'com\.tcl\.autopair', 'com\.tcl\.micmanager', 'com\.tcl\.ttvs', '^com\.tcl\.tv$', 't_solo', 'ui_mediacenter')

$PrivacyKeys = @(
    'global.tcl_diagnostic_status', 'global.tcl_uxp_status', 'global.send_action_app_error',
    'secure.send_action_app_error', 'global.activity_starts_logging_enabled',
    'secure.backup_enabled', 'secure.screensaver_enabled'
)

$ExpertMs = 1800000
$S = @{ Adb = $null; Device = $null; Info = $null; Pkgs = @(); Enabled = @(); Disabled = @(); ThirdParty = @(); Running = @();
    Protected = (New-Object 'System.Collections.Generic.HashSet[string]'); Platform = 'generic';
    WorkDir = $null; Protocol = @(); Expert = $false; ExpertUntil = 0 
}

function ConvertTo-PackageNames($raw) {
    $out = New-Object 'System.Collections.Generic.List[string]'
    foreach ($item in @($raw)) {
        if ($null -eq $item) { continue }
        $s = ''
        if ($item -is [string]) { $s = $item }
        elseif (@($item.PSObject.Properties.Name) -contains 'name') { $s = [string]$item.name }
        else { $s = [string]$item }
        $s = $s.Trim()
        if ($s -and $s -match '^[A-Za-z0-9._]+$' -and -not $out.Contains($s)) { [void]$out.Add($s) }
    }
    return @($out)
}
function Write-Protocol([string]$cmd, [string]$out) {
    $script:S.Protocol += @{ ts = [DateTimeOffset]::Now.ToUnixTimeMilliseconds(); cmd = $cmd; out = $out }
    if ($script:S.Protocol.Count -gt 3000) { $script:S.Protocol = $script:S.Protocol[-2000..-1] }
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
function Get-ExpertLeft {
    if (-not $S.Expert) { return 0 }
    $left = $S.ExpertUntil - [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
    if ($left -le 0) { $S.Expert = $false; $S.ExpertUntil = 0; Write-Protocol 'expert' $Msg.E_EXPERT_EXPIRED; return 0 }
    return $left
}
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
function Get-RunningPackages {
    $raw = (Invoke-TvShell 'ps -A -o NAME') -join "`n"
    $set = New-Object 'System.Collections.Generic.HashSet[string]'
    foreach ($l in ($raw -split "`n")) {
        $t = $l.Trim()
        if ($t -and $t.Contains('.')) { [void]$set.Add(($t -split ':')[0]) }
    }
    return @($set)
}
function Update-TvStates {
    $S.Enabled = ConvertFrom-PackageLines ((Invoke-TvShell 'pm list packages -e') -join "`n")
    $S.Disabled = ConvertFrom-PackageLines ((Invoke-TvShell 'pm list packages -d') -join "`n")
    $S.ThirdParty = ConvertFrom-PackageLines ((Invoke-TvShell 'pm list packages -3') -join "`n")
    $S.Running = Get-RunningPackages
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
    foreach ($n in $Floor) { [void]$set.Add($n) }
    if (-not (Get-ExpertLeft)) {
        foreach ($n in $Never) { [void]$set.Add($n) }
        foreach ($p in $S.Pkgs) {
            if ($AllowDisable -contains $p) { continue }
            foreach ($pat in $Patterns) { if ($p -match $pat) { [void]$set.Add($p); break } }
            if ($S.ThirdParty -notcontains $p) { [void]$set.Add($p) }
        }
        if ($S.Info.launcher) { [void]$set.Add($S.Info.launcher) }
        if ($S.Info.ime) { [void]$set.Add($S.Info.ime) }
    }
    $S.Protected = $set
}
function Set-ExpertMode($b) {
    Test-Device
    if ($b.action -eq 'on') {
        if ($b.confirm -ne 'I-ACCEPT-RISK') { throw $Msg.E_EXPERT_PHRASE }
        $S.Expert = $true
        $S.ExpertUntil = [DateTimeOffset]::Now.ToUnixTimeMilliseconds() + $ExpertMs
        Write-Protocol 'expert-mode' $Msg.expertOn
    }
    else {
        $S.Expert = $false; $S.ExpertUntil = 0
        Write-Protocol 'expert-mode' $Msg.expertOff
    }
    New-ProtectedSet
    return @{ expert = $S.Expert; left = (Get-ExpertLeft); protected = @($S.Protected) }
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
        $tpl = $Msg.E_MULTIDEV_DETAIL; if (-not $tpl) { $tpl = $Msg.E_MULTIDEV }
        throw ($tpl -f $serials)
    }
    $S.Device = ($devs[0].Trim() -split '\s+')[0]
    $brand = ((Invoke-TvShell 'getprop ro.product.brand') -join '').Trim()
    $model = ((Invoke-TvShell 'getprop ro.product.model') -join '').Trim()
    $rel = ((Invoke-TvShell 'getprop ro.build.version.release') -join '').Trim()
    $sdk = ((Invoke-TvShell 'getprop ro.build.version.sdk') -join '').Trim()
    $fp = ((Invoke-TvShell 'getprop ro.build.fingerprint') -join '').Trim()
    $soc = ((Invoke-TvShell 'getprop ro.board.platform') -join '').Trim()
    $abi = ((Invoke-TvShell 'getprop ro.product.cpu.abi') -join '').Trim()
    $S.Pkgs = ConvertFrom-PackageLines ((Invoke-TvShell 'pm list packages') -join "`n")
    Update-TvStates
    $plat = Get-TvPlatform
    $launcher = Get-HomePackage
    $ime = ''
    $imeRaw = ((Invoke-TvShell 'settings get secure default_input_method') -join '')
    if ($imeRaw -match '^([\w\.]+)/') { $ime = $Matches[1] }
    $S.Platform = $plat
    $S.Expert = $false; $S.ExpertUntil = 0
    $S.Info = @{ serial = $S.Device; brand = $brand; model = $model; android = $rel; sdk = $sdk; fingerprint = $fp;
        ip = $S.Device.Split(':')[0]; packageCount = $S.Pkgs.Count; platform = $plat; launcher = $launcher; ime = $ime;
        soc = $soc; abi = $abi 
    }
    New-ProtectedSet
    $safe = ($brand + '_' + $model) -replace '[^\w\-]', '_'
    $S.WorkDir = Join-Path $Docs ($safe + '_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
    New-Item -ItemType Directory -Path $S.WorkDir -Force | Out-Null
    $S.Pkgs | Set-Content (Join-Path $S.WorkDir 'packages.txt') -Encoding UTF8
    $S.ThirdParty | Set-Content (Join-Path $S.WorkDir 'packages-user.txt') -Encoding UTF8
    (Invoke-TvShell 'getprop') | Set-Content (Join-Path $S.WorkDir 'getprop.txt') -Encoding UTF8
    foreach ($ns in 'system', 'secure', 'global') { (Invoke-TvShell "settings list $ns") | Set-Content (Join-Path $S.WorkDir "settings_$ns.txt") -Encoding UTF8 }
    Write-Protocol 'backup' ($Msg.backup + $S.WorkDir)
    return @{ ok = $true; device = $S.Info }
}
function Get-PrivacyFlags {
    $cmd = 'for k in tcl_diagnostic_status tcl_uxp_status send_action_app_error activity_starts_logging_enabled; do echo "global.$k=$(settings get global $k)"; done; for k in send_action_app_error backup_enabled screensaver_enabled screensaver_components screensaver_default_component; do echo "secure.$k=$(settings get secure $k)"; done'
    $raw = (Invoke-TvShell $cmd) -join "`n"
    $items = @()
    foreach ($l in ($raw -split "`n")) {
        $t = $l.Trim()
        if ($t -match '^(global|secure)\.([A-Za-z0-9_]+)=(.*)$') {
            $items += @{ id = ($Matches[1] + '.' + $Matches[2]); ns = $Matches[1]; key = $Matches[2]; value = $Matches[3].Trim() }
        }
    }
    return $items
}
function Set-PrivacyFlags($b) {
    Test-Device
    $results = @()
    foreach ($it in @($b.items)) {
        $id = [string]$it.id
        if ($PrivacyKeys -notcontains $id) { $results += @{ id = $id; ok = $false; output = $Msg.E_PRIVKEY }; continue }
        $v = [string]$it.value
        if ($v -notmatch '^[01]$') { $results += @{ id = $id; ok = $false; output = $Msg.E_PRIVVAL }; continue }
        $parts = $id.Split('.')
        Invoke-TvShell ("settings put " + $parts[0] + " " + $parts[1] + " " + $v) | Out-Null
        $check = ((Invoke-TvShell ("settings get " + $parts[0] + " " + $parts[1])) -join '').Trim()
        $results += @{ id = $id; ok = ($check -eq $v); output = $check }
        Write-Protocol 'privacy' ($Msg.privacySet + $id + ' = ' + $v)
    }
    return @{ results = $results; flags = (Get-PrivacyFlags) }
}
function Get-TvDiag {
    Test-Device
    $thermalCmd = 'for z in /sys/class/thermal/thermal_zone*/temp; do if [ -f "$z" ]; then echo "zone $z $(cat $z)"; fi; done; dumpsys thermalservice 2>/dev/null | grep -i temperature | head -12'
    @{
        meminfo = (Invoke-TvShell 'cat /proc/meminfo')
        loadavg = (Invoke-TvShell 'cat /proc/loadavg')
        uptime  = (Invoke-TvShell 'cat /proc/uptime')
        cores   = (Invoke-TvShell 'grep -c ^processor /proc/cpuinfo')
        top     = (Invoke-TvShell 'top -b -n 1 -m 14')
        df      = (Invoke-TvShell 'df -h /data')
        thermal = (Invoke-TvShell $thermalCmd)
        running = (Get-RunningPackages)
        privacy = (Get-PrivacyFlags)
    }
}
function Add-SessionNames($sid, $names, [string]$kind) {
    if ($sid -notmatch '^[A-Za-z0-9_-]{1,40}$') { throw $Msg.E_SESSION }
    $safe = ($S.Info.brand + '_' + $S.Info.model) -replace '[^\w\-]', '_'
    $dir = Join-Path $Docs ($safe + '\session_' + $sid)
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    $file = Join-Path $dir 'names.txt'
    $old = @()
    if (Test-Path $file) { $old = ConvertTo-PackageNames (Get-Content $file -Encoding UTF8) }
    $all = ConvertTo-PackageNames (@($old) + @(ConvertTo-PackageNames $names))
    $all | Set-Content $file -Encoding UTF8
    $metaPath = Join-Path $dir 'session.json'
    $ts = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
    if (Test-Path $metaPath) { try { $prev = Get-Content $metaPath -Raw -Encoding UTF8 | ConvertFrom-Json; if ($prev.ts) { $ts = $prev.ts } } catch {} }
    @{ ts = $ts; device = $S.Info.model; serial = $S.Device; names = $all; kind = $kind; expert = [bool]$S.Expert } |
    ConvertTo-Json -Depth 5 | Set-Content $metaPath -Encoding UTF8
    'ok' | Set-Content (Join-Path $dir 'normalized.flag') -Encoding UTF8
    return $dir
}
function Disable-TvPackages($b) {
    Test-Device
    Get-ExpertLeft | Out-Null
    $sid = [string]$b.session
    if (-not $sid) { $sid = 's' + (Get-Date -Format 'yyyyMMddHHmmssfff') }
    $forceStop = $true
    if ($b.PSObject.Properties.Name -contains 'forceStop') { $forceStop = [bool]$b.forceStop }
    $results = @(); $done = @()
    foreach ($n in @(ConvertTo-PackageNames $b.names)) {
        $cmd = "pm disable-user --user 0 $n"
        if ($S.Pkgs -notcontains $n) { $results += @{name = $n; ok = $false; command = $cmd; output = $Msg.E_NOTINSTALLED }; continue }
        if ($Floor -contains $n) { $results += @{name = $n; ok = $false; command = $cmd; output = $Msg.E_FLOOR }; continue }
        if (-not $S.Expert) {
            if ($S.Protected.Contains($n)) { $results += @{name = $n; ok = $false; command = $cmd; output = $Msg.E_PROTECTED }; continue }
            if (($S.ThirdParty -notcontains $n) -and ($AllowDisable -notcontains $n)) {
                $results += @{name = $n; ok = $false; command = $cmd; output = $Msg.E_SYSTEM }; continue
            }
        }
        $pidBefore = ((Invoke-TvShell "pidof $n") -join '').Trim()
        $wasRunning = ($pidBefore -match '^\d')
        $out = (Invoke-TvShell $cmd) -join ' '
        $ok = $out -match 'disabled'
        if ($ok -and $forceStop) { Invoke-TvShell "am force-stop $n" | Out-Null }
        $stateOut = ((Invoke-TvShell "pm list packages -d $n") -join '')
        $verified = ((ConvertFrom-PackageLines $stateOut) -contains $n)
        $pidAfter = ((Invoke-TvShell "pidof $n") -join '').Trim()
        $nowRunning = ($pidAfter -match '^\d')
        $persistent = ($ok -and $nowRunning)
        if ($persistent) { Write-Protocol 'persistent' ($n + ': ' + $Msg.persistent) }
        if ($ok) { $done += [string]$n }
        $results += @{ name = $n; ok = $ok; command = $cmd; output = $out; verified = $verified;
            wasRunning = $wasRunning; nowRunning = $nowRunning; persistent = $persistent 
        }
    }
    if ($done.Count) {
        Add-SessionNames $sid $done $(if ($S.Expert) { 'expert' } else { 'clean' }) | Out-Null
        $S.Disabled = ConvertFrom-PackageLines ((Invoke-TvShell 'pm list packages -d') -join "`n")
        $S.Enabled = ConvertFrom-PackageLines ((Invoke-TvShell 'pm list packages -e') -join "`n")
        $S.Running = Get-RunningPackages
    }
    return @{ results = $results; expert = [bool]$S.Expert; left = (Get-ExpertLeft) }
}
function Enable-TvPackages($b) {
    Test-Device
    $results = @()
    foreach ($n in @(ConvertTo-PackageNames $b.names)) {
        $cmd = "pm enable $n"
        $out = (Invoke-TvShell $cmd) -join ' '
        $stateOut = ((Invoke-TvShell "pm list packages -e $n") -join '')
        $verified = ((ConvertFrom-PackageLines $stateOut) -contains $n)
        $results += @{ name = $n; ok = ($out -match 'enabled'); command = $cmd; output = $out; verified = $verified }
    }
    Update-TvStates
    New-ProtectedSet
    return @{ results = $results }
}
function Invoke-HomeRefresh {
    Test-Device
    Invoke-TvShell 'input keyevent KEYCODE_HOME' | Out-Null
    Write-Protocol 'ui-refresh' $Msg.homeRefresh
    return @{ ok = $true }
}
function Invoke-TvReboot {
    Test-Device
    Write-Protocol 'reboot' $Msg.rebooting
    Invoke-Adb @('reboot') | Out-Null
    $S.Device = $null; $S.Info = $null; $S.Pkgs = @(); $S.Enabled = @(); $S.Disabled = @(); $S.ThirdParty = @(); $S.Running = @()
    $S.Expert = $false; $S.ExpertUntil = 0
    $S.Protected = New-Object 'System.Collections.Generic.HashSet[string]'
    return @{ ok = $true; message = $Msg.rebooting }
}
function Search-TvPackages($b) {
    Test-Device
    $known = ConvertTo-PackageNames $b.known
    $rx = 'advertis|\.ads?\.|adservice|analytic|telemetr|metric|tracker|recommend|pushservice|\.acr\.|upgrad|promo'
    @{ items = @($S.Pkgs | Sort-Object | Where-Object { $_ -match $rx -and $known -notcontains $_ }) }
}
function Get-Journals {
    $items = @()
    if (Test-Path $Docs) {
        Get-ChildItem $Docs -Recurse -Filter 'session.json' -ErrorAction SilentlyContinue | ForEach-Object {
            $path = $_.FullName; $dir = $_.DirectoryName
            try {
                $m = Get-Content $path -Raw -Encoding UTF8 | ConvertFrom-Json
                $names = ConvertTo-PackageNames $m.names
                $marker = Join-Path $dir 'normalized.flag'
                if (-not (Test-Path $marker)) {
                    @{ ts = $m.ts; device = $m.device; serial = $m.serial; names = $names; kind = $m.kind; expert = [bool]$m.expert } |
                    ConvertTo-Json -Depth 5 | Set-Content $path -Encoding UTF8
                    $names | Set-Content (Join-Path $dir 'names.txt') -Encoding UTF8
                    'ok' | Set-Content $marker -Encoding UTF8
                    Write-Protocol 'journal-normalize' ($Msg.journalRepair + $path)
                }
                $items += @{ path = $path; ts = $m.ts; device = $m.device; names = $names; kind = $m.kind; expert = [bool]$m.expert;
                    rolledBack = (Test-Path (Join-Path $dir 'rolledback.flag')) 
                }
            }
            catch {}
        }
    }
    @{ items = @($items | Sort-Object { $_.ts } -Descending) }
}
function Restore-Journal($b) {
    Test-Device
    $full = [IO.Path]::GetFullPath([string]$b.path)
    $base = [IO.Path]::GetFullPath($Docs)
    if (-not $full.StartsWith($base, [StringComparison]::OrdinalIgnoreCase) -or (Split-Path $full -Leaf) -ne 'session.json') { throw $Msg.E_PATH }
    $m = Get-Content $full -Raw -Encoding UTF8 | ConvertFrom-Json
    $results = @()
    foreach ($n in @(ConvertTo-PackageNames $m.names)) {
        $out = (Invoke-TvShell "pm enable $n") -join ' '
        $results += @{ name = $n; ok = ($out -match 'enabled'); command = "pm enable $n"; output = $out }
    }
    'rolled back' | Set-Content (Join-Path (Split-Path $full) 'rolledback.flag') -Encoding UTF8
    Update-TvStates
    New-ProtectedSet
    @{ results = $results }
}
function Disconnect-Tv {
    if ($S.Adb) { Invoke-Adb @('disconnect') | Out-Null }
    $S.Device = $null; $S.Info = $null; $S.Pkgs = @(); $S.Enabled = @(); $S.Disabled = @(); $S.ThirdParty = @(); $S.Running = @()
    $S.WorkDir = $null; $S.Expert = $false; $S.ExpertUntil = 0
    $S.Protected = New-Object 'System.Collections.Generic.HashSet[string]'
    @{ ok = $true }
}
function Get-State {
    @{ server = $true; adb = [bool]$S.Adb; adbPath = $S.Adb; connected = [bool]$S.Device; device = $S.Info;
        workdir = $S.WorkDir; expert = [bool]$S.Expert; expertLeft = (Get-ExpertLeft); floor = $Floor; msgFixed = $MsgFixed 
    }
}
function Get-Packages {
    Test-Device
    Get-ExpertLeft | Out-Null
    @{ items = $S.Pkgs; enabled = $S.Enabled; disabled = $S.Disabled; thirdParty = $S.ThirdParty; running = $S.Running;
        protected = @($S.Protected); platform = $S.Platform; device = $S.Info; expert = [bool]$S.Expert; expertLeft = (Get-ExpertLeft) 
    }
}
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

if (-not (Test-Path (Join-Path $Web 'index.html'))) { Write-Host $Msg.E_WEB -ForegroundColor Red; Read-Host $Msg.pressEnter; exit 1 }
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://localhost:8765/')
try { $listener.Start() } catch { Write-Host $Msg.portBusy -ForegroundColor Red; Read-Host $Msg.pressEnter; exit 1 }
Write-Host '==================================================' -ForegroundColor DarkCyan
Write-Host $Msg.banner1 -ForegroundColor Green
Write-Host $Msg.banner2 -ForegroundColor Yellow
Write-Host $Msg.banner3 -ForegroundColor DarkGray
if ($MsgFixed -gt 0) { Write-Host $Msg.encodingFixed -ForegroundColor Magenta }
Write-Host '==================================================' -ForegroundColor DarkCyan
Start-Process 'http://localhost:8765/'
try {
    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        $path = $ctx.Request.Url.AbsolutePath
        try {
            if ($path -eq '/favicon.ico') { $ctx.Response.StatusCode = 204; $ctx.Response.Close(); continue }
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
                    '/api/packages' { Get-Packages }
                    '/api/diag' { Get-TvDiag }
                    '/api/disable' { Disable-TvPackages $body }
                    '/api/enable' { Enable-TvPackages $body }
                    '/api/home' { Invoke-HomeRefresh }
                    '/api/reboot' { Invoke-TvReboot }
                    '/api/privacy' { Set-PrivacyFlags $body }
                    '/api/expert' { Set-ExpertMode $body }
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