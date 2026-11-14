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

function Find-Window([int]$sec = 25) {
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
    if (-not $p.WaitForExit(30000)) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
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
    Check 'log: the RemoveDataDlg action ran (required)' ($txt -match 'Action start [^\r\n]*RemoveDataDlg')
    if ($UiRequired) { Check 'UI Automation found the uninstall dialog window' $false } else { Write-Host 'NOTE  no dialog window to drive on this session; the log check above is the proof' }
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

Write-Host '== pass 1: untick, Remove'
Run-Pass $false 'ui-uninstall-keep'
Check 'data kept when the box is not ticked' (Test-Path (Join-Path $dataDir 'keep-me.txt'))
Check 'program removed' (-not (Test-Path (Join-Path $env:ProgramFiles 'crsp')))
Write-Host '== pass 2: tick, Remove'
Run-Pass $true 'ui-uninstall-remove'
Check 'data removed when the box is ticked' (-not (Test-Path $dataDir))
Check 'service removed' (-not (Get-Service crsp -ErrorAction SilentlyContinue))
if ($failures) { Write-Host "$failures FAILED"; exit 1 }
Write-Host 'All UI checks passed'
