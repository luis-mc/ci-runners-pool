<#
  Drives the uninstall dialog with UI Automation (local, elevated, interactive desktop):
  installs the MSI, opens `msiexec /x` with the full dialogs, and
    pass 1: leaves "Also delete my data" unticked and clicks Remove -> data kept
    pass 2: ticks it and clicks Remove                              -> data gone
  Leaves the machine as it found it.

    pwsh installer/ui-test.ps1 -Msi installer/out/crsp-windows-x64.msi
#>
[CmdletBinding()]
param([Parameter(Mandatory)][string]$Msi)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
$Msi = (Resolve-Path $Msi).Path
$dataDir = Join-Path $env:ProgramData 'crsp'
$failures = 0
function Check([string]$what, [bool]$ok) { if ($ok) { Write-Host "PASS  $what" } else { Write-Host "FAIL  $what"; $script:failures++ } }

function Find-Window([int]$sec = 60) {
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
function Run-Pass([bool]$tick) {
  Start-Process msiexec.exe -ArgumentList '/i', "`"$Msi`"", '/qn', '/norestart' -Wait
  Set-Content (Join-Path $dataDir 'keep-me.txt') 'data' -Encoding ASCII
  $p = Start-Process msiexec.exe -ArgumentList '/x', "`"$Msi`"" -PassThru
  $w = Find-Window
  Check 'the uninstall dialog appears' ($null -ne $w)
  if (-not $w) { return }
  $cb = Find-Child $w 'ControlType.CheckBox' 'Also delete my data*'
  Check 'the dialog has the "Also delete my data" checkbox' ($null -ne $cb)
  $tp = $cb.GetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern)
  Check 'the checkbox is unticked by default' ($tp.Current.ToggleState -eq 'Off')
  if ($tick) { $tp.Toggle(); Start-Sleep -Milliseconds 300; Check 'the checkbox ticks' ($tp.Current.ToggleState -eq 'On') }
  $btn = Find-Child $w 'ControlType.Button' 'Remove'
  Check 'the dialog has a Remove button' ($null -ne $btn)
  $btn.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
  $p.WaitForExit(120000) | Out-Null
  Start-Sleep 2
}

Write-Host '== pass 1: untick, Remove'
Run-Pass $false
Check 'data kept when the box is not ticked' (Test-Path (Join-Path $dataDir 'keep-me.txt'))
Check 'program removed' (-not (Test-Path (Join-Path $env:ProgramFiles 'crsp')))
Write-Host '== pass 2: tick, Remove'
Run-Pass $true
Check 'data removed when the box is ticked' (-not (Test-Path $dataDir))
Check 'service removed' (-not (Get-Service crsp -ErrorAction SilentlyContinue))
if ($failures) { Write-Host "$failures FAILED"; exit 1 }
Write-Host 'All UI checks passed'
