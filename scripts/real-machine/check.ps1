<#
Real-machine test pass (OPS39): collect read-only facts about crsp on this
Windows PC into one text file the owner can attach to a report.
It changes nothing. Config: key names only, never values.
Run in PowerShell (as administrator for the service and the data folder):
  powershell -ExecutionPolicy Bypass -File check.ps1
#>
param([string]$Out = (Join-Path (Get-Location) ("crsp-check-{0}-{1}.txt" -f $env:COMPUTERNAME, (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ'))))

$ErrorActionPreference = 'Continue'
$DataDir = if ($env:CRSP_DATA_DIR) { $env:CRSP_DATA_DIR } else { Join-Path $env:ProgramData 'crsp' }
$Config = if ($env:CRSP_CONFIG) { $env:CRSP_CONFIG } else { Join-Path $DataDir 'config.toml' }
$lines = New-Object System.Collections.Generic.List[string]

function Add-Line([string]$Text) { $lines.Add($Text) }
function Add-Section([string]$Title) { Add-Line ''; Add-Line "== $Title ==" }
function Add-Output($Items) { foreach ($i in @($Items)) { if ($null -ne $i) { Add-Line ([string]$i) } } }
function Add-Json([string]$Path) {
  if (Test-Path -LiteralPath $Path) { Add-Output (Get-Content -LiteralPath $Path -Raw) } else { Add-Line "not found: $Path" }
}

# Console port: the port of listen_addr in the config, 8460 when not set.
function Get-ConsolePort {
  $port = $null
  if ($env:CRSP_LISTEN_ADDR) { $port = ($env:CRSP_LISTEN_ADDR -split ':')[-1] }
  elseif (Test-Path -LiteralPath $Config) {
    $m = Select-String -LiteralPath $Config -Pattern '^\s*listen_addr\s*=\s*"?[^"]*:(\d+)"?\s*$' | Select-Object -First 1
    if ($m) { $port = $m.Matches[0].Groups[1].Value }
  }
  if ($port) { return $port } else { return '8460' }
}

Add-Line 'crsp real-machine check (OPS39)'
Add-Line ('taken: {0} UTC' -f (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))
Add-Line "host: $env:COMPUTERNAME"
$os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
if ($os) { Add-Line ("os: {0} {1}  arch: {2}" -f $os.Caption, $os.Version, $os.OSArchitecture) }

Add-Section 'installed binary'
$cmd = Get-Command crsp -ErrorAction SilentlyContinue
if ($cmd) { Add-Line "path: $($cmd.Source)"; Add-Output (& crsp version 2>&1 | Select-Object -First 3) } else { Add-Line 'crsp is not on PATH' }
$product = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue |
  Where-Object { $_.DisplayName -like 'CI Runners Shared Pool*' } | Select-Object -First 1
if ($product) { Add-Line ("installed product: {0} {1}" -f $product.DisplayName, $product.DisplayVersion) } else { Add-Line 'installed product: none in Apps' }

$port = Get-ConsolePort
Add-Section "version from /healthz (port $port)"
# Local address only. The certificate is made by crsp's own CA, so it is not checked here.
try {
  if ($PSVersionTable.PSVersion.Major -ge 6) {
    $r = Invoke-WebRequest -Uri "https://127.0.0.1:$port/healthz" -SkipCertificateCheck -TimeoutSec 5 -UseBasicParsing
    Add-Output $r.Content
  } else {
    [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
    $r = Invoke-WebRequest -Uri "https://127.0.0.1:$port/healthz" -TimeoutSec 5 -UseBasicParsing
    Add-Output $r.Content
  }
} catch {
  Add-Line "https failed: $($_.Exception.Message)"
  try { Add-Output (Invoke-WebRequest -Uri "http://127.0.0.1:$port/healthz" -TimeoutSec 5 -UseBasicParsing).Content }
  catch { Add-Line "no answer: $($_.Exception.Message)" }
}

Add-Section 'service state'
$svc = Get-Service -Name crsp -ErrorAction SilentlyContinue
if ($svc) {
  $cim = Get-CimInstance Win32_Service -Filter "Name='crsp'" -ErrorAction SilentlyContinue
  Add-Line ("crsp: status={0} start={1}" -f $svc.Status, $(if ($cim) { $cim.StartMode } else { 'unknown' }))
} else { Add-Line 'crsp service: not installed' }

Add-Section 'runner services (actions.runner.*)'
$rs = Get-CimInstance Win32_Service -Filter "Name LIKE 'actions.runner.%'" -ErrorAction SilentlyContinue
if ($rs) { foreach ($s in $rs) { Add-Line ("{0} | {1} | {2}" -f $s.Name, $s.State, $s.StartMode) } } else { Add-Line 'none' }

Add-Section 'docker images crsp-pool:*'
if (Get-Command docker -ErrorAction SilentlyContinue) {
  Add-Output (docker image ls crsp-pool --format '{{.Repository}}:{{.Tag}}  {{.Size}}  created {{.CreatedSince}}' 2>&1)
  Add-Line 'containers named crsp-*:'
  Add-Output (docker ps -a --filter 'name=crsp-' --format '{{.Names}}  {{.Status}}' 2>&1)
} else { Add-Line 'docker not installed' }

Add-Section "disk use of the data folder ($DataDir)"
if (Test-Path -LiteralPath $DataDir) {
  foreach ($d in (Get-ChildItem -LiteralPath $DataDir -Force -ErrorAction SilentlyContinue)) {
    $bytes = if ($d.PSIsContainer) { (Get-ChildItem -LiteralPath $d.FullName -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum } else { $d.Length }
    Add-Line ("{0,10:N1} MiB  {1}" -f ([double]$bytes / 1MB), $d.Name)
  }
  $drive = Get-PSDrive -Name ($DataDir.Substring(0, 1)) -ErrorAction SilentlyContinue
  if ($drive) { Add-Line ("free on drive {0}: {1:N1} GiB" -f $drive.Name, ($drive.Free / 1GB)) }
} else { Add-Line 'no data folder (an uninstall that removed the data, or a read without rights)' }

Add-Section 'last update result.json'
Add-Json (Join-Path $DataDir 'updates\result.json')
Add-Section 'update stage.json'
Add-Json (Join-Path $DataDir 'updates\stage.json')

Add-Section "config key names only ($Config)"
if (Test-Path -LiteralPath $Config) {
  foreach ($l in (Get-Content -LiteralPath $Config)) { if ($l -match '^\s*([A-Za-z0-9_.-]+)\s*=') { Add-Line $Matches[1] } }
} else { Add-Line "config not found: $Config" }

Add-Section 'leftovers after an uninstall (look for anything listed here)'
foreach ($p in @((Join-Path $env:ProgramFiles 'crsp'), $DataDir)) { Add-Line ("{0}: {1}" -f $p, $(if (Test-Path -LiteralPath $p) { 'present' } else { 'absent' })) }
$fw = Get-NetFirewallRule -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like '*crsp*' }
Add-Line ("firewall rules named crsp: {0}" -f @($fw).Count)

Set-Content -LiteralPath $Out -Value $lines -Encoding UTF8
Write-Output "Wrote $Out"
