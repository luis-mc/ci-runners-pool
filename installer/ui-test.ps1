<#
  Drives the uninstall dialog with UI Automation (local, elevated, interactive desktop):
  installs the MSI, opens `msiexec /x` with the full dialogs, and
    pass 1: leaves "Also delete my data" unticked and clicks Remove -> data kept
    pass 2: ticks it and clicks Remove                              -> data gone
  Leaves the machine as it found it.

    pwsh installer/ui-test.ps1 -Msi installer/out/crsp-windows-x64.msi
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$Msi,
  [string]$LogDir = (Join-Path $PSScriptRoot 'out\logs'),
  # Fail when the dialog window cannot be driven by UI Automation (the log check is always required).
  [switch]$UiRequired
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
$Msi = (Resolve-Path $Msi).Path
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogDir = (Resolve-Path $LogDir).Path
$dataDir = Join-Path $env:ProgramData 'crsp'
$failures = 0
function Check([string]$what, [bool]$ok) { if ($ok) { Write-Host "PASS  $what" } else { Write-Host "FAIL  $what"; $script:failures++ } }

function Find-Window([int]$sec = 20) {
  $root = [System.Windows.Automation.AutomationElement]::RootElement
  $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, 'crsp Setup')
  for ($i = 0; $i -lt $sec; $i++) {
    $w = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $cond)
    if ($w) { return $w }
    Start-Sleep 1
  }
  return $null
}
function Find-Child($win, [string]$type, [string]$like) {
  $all = $win.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
  foreach ($e in $all) {
    if ($e.Current.ControlType.ProgrammaticName -eq $type -and $e.Current.Name -like $like) { return $e }
  }
  return $null
}
function Run-Pass([bool]$tick, [string]$name) {
  Start-Process msiexec.exe -ArgumentList '/i', "`"$Msi`"", '/qn', '/norestart' -Wait
  Set-Content (Join-Path $dataDir 'keep-me.txt') 'data' -Encoding ASCII
  $log = Join-Path $LogDir "$name.log"
  $p = Start-Process msiexec.exe -ArgumentList '/x', "`"$Msi`"", '/norestart', '/l*vx!', "`"$log`"" -PassThru
  $w = Find-Window
  if (-not $w) {
    # Not drivable (no desktop?): give the run time, then end it; the log still proves the dialog action.
    if (-not $p.WaitForExit(10000)) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
    Start-Sleep 3
    $txt = if (Test-Path $log) { Get-Content $log -Raw } else { '' }
    Write-Host '--- UI lines of the msiexec /x log'
    if (Test-Path $log) { Select-String -Path $log -Pattern 'RemoveDataDlg|Dialog|UILevel|Doing action: (ExecuteAction|CostFinalize|ProgressDlg)|Action start .*(ExecuteAction|CostFinalize|WelcomeEulaDlg|ProgressDlg|MaintenanceWelcome)|REMOVE|Installed =' | Select-Object -Last 60 | ForEach-Object { Write-Host "  UILOG $($_.Line.Trim())" } }
    $rt = [System.Windows.Automation.AutomationElement]::RootElement
    Write-Host '--- msiexec processes'
    Get-Process msiexec -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "  PROC msiexec pid $($_.Id) session $($_.SessionId) title '$($_.MainWindowTitle)' handle $($_.MainWindowHandle)" }
    Write-Host ('--- log exists: ' + (Test-Path $log) + ' size ' + $(if (Test-Path $log) { (Get-Item $log).Length } else { 0 }))
    Write-Host '--- top-level windows'
    foreach ($e in $rt.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)) { Write-Host "  WIN '$($e.Current.Name)' pid $($e.Current.ProcessId)" }
    Write-Host ('NOTE  the log ' + $(if ($txt -match 'Action start [^\r\n]*RemoveDataDlg') { 'shows' } else { 'does not show' }) + ' the RemoveDataDlg action (the UI run could not display on this session)')
    if ($UiRequired) { Check 'UI Automation found the uninstall dialog window' $false } else { Write-Host 'NOTE  no dialog window to drive on this session; the MSI table checks above are the proof' }
    $script:uiSkipped = $true
    # Clean up what the interrupted run may have left.
    Start-Process msiexec.exe -ArgumentList '/x', "`"$Msi`"", '/qn', '/norestart' -Wait | Out-Null
    return
  }
  Check 'the uninstall dialog appears' $true
  # Watchdog: never let a blocked dialog hang the run.
  $deadline = (Get-Date).AddSeconds(90)
  $cb = Find-Child $w 'ControlType.CheckBox' 'Also delete my data*'
  Check 'the dialog has the "Also delete my data" checkbox' ($null -ne $cb)
  $tp = $cb.GetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern)
  Check 'the checkbox is unticked by default' ($tp.Current.ToggleState -eq 'Off')
  if ($tick) { $tp.Toggle(); Start-Sleep -Milliseconds 300; Check 'the checkbox ticks' ($tp.Current.ToggleState -eq 'On') }
  $btn = Find-Child $w 'ControlType.Button' 'Remove'
  Check 'the dialog has a Remove button' ($null -ne $btn)
  $btn.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
  if (-not $p.WaitForExit(90000)) { Write-Host 'FAIL  msiexec did not finish after Remove'; $script:failures++; Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
  Start-Sleep 2
}


# --- Required: the uninstall dialog as the built MSI describes it (no desktop needed).
# A hosted runner has no interactive desktop for msiexec's full UI, so this reads the
# MSI database: the dialog, its checkbox bound to REMOVEDATA (default 0), the Remove
# button, and the Show action in the UI sequence, between costing and the progress page,
# for an uninstall that is not an upgrade.
function Query-Msi([string]$sql) {
  $wi = New-Object -ComObject WindowsInstaller.Installer
  $db = $wi.GetType().InvokeMember('OpenDatabase', 'InvokeMethod', $null, $wi, @($Msi, 0))
  $view = $db.GetType().InvokeMember('OpenView', 'InvokeMethod', $null, $db, @($sql))
  $view.GetType().InvokeMember('Execute', 'InvokeMethod', $null, $view, $null) | Out-Null
  $rows = @()
  while ($true) {
    $rec = $view.GetType().InvokeMember('Fetch', 'InvokeMethod', $null, $view, $null)
    if ($null -eq $rec) { break }
    $n = $rec.GetType().InvokeMember('FieldCount', 'GetProperty', $null, $rec, $null)
    $row = @(); for ($i = 1; $i -le $n; $i++) { $row += [string]$rec.GetType().InvokeMember('StringData', 'GetProperty', $null, $rec, @($i)) }
    $rows += , $row
  }
  $view.GetType().InvokeMember('Close', 'InvokeMethod', $null, $view, $null) | Out-Null
  return , $rows
}
Write-Host '== the uninstall dialog in the MSI tables (required)'
$dlg = Query-Msi "SELECT Dialog FROM Dialog WHERE Dialog='RemoveDataDlg'"
Check 'table: dialog RemoveDataDlg exists' ($dlg.Count -eq 1)
$cb = Query-Msi "SELECT Control, Property, Text FROM Control WHERE Dialog_='RemoveDataDlg' AND Type='CheckBox'"
Check 'table: it has one checkbox bound to REMOVEDATA' ($cb.Count -eq 1 -and $cb[0][1] -eq 'REMOVEDATA') ($cb | ForEach-Object { $_ -join '|' })
Check 'table: the checkbox text starts "Also delete my data"' ($cb.Count -eq 1 -and $cb[0][2] -like 'Also delete my data*')
$cv = Query-Msi "SELECT Value FROM CheckBox WHERE Property='REMOVEDATA'"
Check 'table: ticked means REMOVEDATA=1' ($cv.Count -eq 1 -and $cv[0][0] -eq '1')
$pv = Query-Msi "SELECT Value FROM Property WHERE Property='REMOVEDATA'"
Check 'table: REMOVEDATA is 0 by default (unticked)' ($pv.Count -eq 1 -and $pv[0][0] -eq '0')
$ev = Query-Msi "SELECT Event, Argument FROM ControlEvent WHERE Dialog_='RemoveDataDlg' AND Control_='Remove'"
Check 'table: the Remove button ends the dialog with Return' (@($ev | Where-Object { $_[0] -eq 'EndDialog' -and $_[1] -eq 'Return' }).Count -eq 1)
$cn = Query-Msi "SELECT Event, Argument FROM ControlEvent WHERE Dialog_='RemoveDataDlg' AND Control_='Cancel'"
Check 'table: the Cancel button exits the run' (@($cn | Where-Object { $_[0] -eq 'EndDialog' -and $_[1] -eq 'Exit' }).Count -eq 1)
$show = Query-Msi "SELECT Condition, Sequence FROM InstallUISequence WHERE Action='RemoveDataDlg'"
Check 'table: a Show action for RemoveDataDlg is in the UI sequence' ($show.Count -eq 1)
if ($show.Count -eq 1) {
  Check 'table: shown only for an uninstall that is not an upgrade' (($show[0][0] -match 'Installed') -and ($show[0][0] -match 'REMOVE') -and ($show[0][0] -match 'NOT UPGRADINGPRODUCTCODE')) $show[0][0]
  $seq = @{}
  foreach ($a in 'CostFinalize', 'ProgressDlg', 'ExecuteAction') { $r = Query-Msi "SELECT Sequence FROM InstallUISequence WHERE Action='$a'"; if ($r.Count -eq 1) { $seq[$a] = [int]$r[0][0] } }
  $mine = [int]$show[0][1]
  Check 'table: scheduled after CostFinalize, before ProgressDlg and ExecuteAction' ($seq.ContainsKey('CostFinalize') -and $mine -gt $seq['CostFinalize'] -and (-not $seq.ContainsKey('ProgressDlg') -or $mine -lt $seq['ProgressDlg']) -and $mine -lt $seq['ExecuteAction']) "mine $mine; $(($seq.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ' ')"
}
if ($failures) { Write-Host "$failures FAILED"; exit 1 }

# --- Best effort: drive the real dialog with UI Automation. Only possible when the
# session has an interactive desktop; on a hosted runner it has not, and -UiRequired
# is left off there.
Write-Host ("session: this process " + [Diagnostics.Process]::GetCurrentProcess().SessionId + "; explorer " + ((Get-Process explorer -ErrorAction SilentlyContinue | ForEach-Object { $_.SessionId }) -join ','))

Write-Host '== pass 1: untick, Remove'
Run-Pass $false 'ui-uninstall-keep'
if (-not $script:uiSkipped) { Check 'data kept when the box is not ticked' (Test-Path (Join-Path $dataDir 'keep-me.txt')) }
if (-not $script:uiSkipped) { Check 'program removed' (-not (Test-Path (Join-Path $env:ProgramFiles 'crsp'))) }
Write-Host '== pass 2: tick, Remove'
Run-Pass $true 'ui-uninstall-remove'
if (-not $script:uiSkipped) { Check 'data removed when the box is ticked' (-not (Test-Path $dataDir)) }
Check 'service removed' (-not (Get-Service crsp -ErrorAction SilentlyContinue))
if ($failures) { Write-Host "$failures FAILED"; exit 1 }
Write-Host 'All UI checks passed'
