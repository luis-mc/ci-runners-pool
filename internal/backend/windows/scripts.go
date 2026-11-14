package windows

// Every script is passed to powershell.exe on stdin (`-Command -`). Values
// come from environment variables (CRSP_*), never from a quoted command line
// (runners R5.18). The password is only ever CRSP_PASSWORD, set on the one
// process that needs it (runners R5.15).
const (
	scriptHeader = "$ErrorActionPreference = 'Stop'\n"

	// scriptAccount makes the group and the local account, sets its password
	// and its rights (runners R5.13, R5.14). The account is never an
	// administrator. Needs CRSP_ACCOUNT, CRSP_GROUP, CRSP_PASSWORD, CRSP_SYMLINK.
	scriptAccount = scriptHeader + `
if (-not (Get-LocalGroup -Name $env:CRSP_GROUP -ErrorAction SilentlyContinue)) {
    New-LocalGroup -Name $env:CRSP_GROUP -Description 'CRSP runner accounts' | Out-Null
}
$secure = ConvertTo-SecureString $env:CRSP_PASSWORD -AsPlainText -Force
if (Get-LocalUser -Name $env:CRSP_ACCOUNT -ErrorAction SilentlyContinue) {
    Set-LocalUser -Name $env:CRSP_ACCOUNT -Password $secure -PasswordNeverExpires $true
} else {
    New-LocalUser -Name $env:CRSP_ACCOUNT -Password $secure -PasswordNeverExpires -UserMayNotChangePassword -AccountNeverExpires -Description 'CRSP runner account' | Out-Null
}
if (-not (Get-LocalGroupMember -Group $env:CRSP_GROUP -Member $env:CRSP_ACCOUNT -ErrorAction SilentlyContinue)) {
    Add-LocalGroupMember -Group $env:CRSP_GROUP -Member $env:CRSP_ACCOUNT
}
` + scriptRightsBody

	// scriptRights changes only the rights, for a rerun where the symlink
	// setting changed (runners R5.14, R5.20). Needs CRSP_ACCOUNT, CRSP_SYMLINK.
	scriptRights = scriptHeader + scriptRightsBody

	scriptRightsBody = `
$sid = (New-Object System.Security.Principal.NTAccount($env:CRSP_ACCOUNT)).Translate([System.Security.Principal.SecurityIdentifier]).Value
$inf = Join-Path ([System.IO.Path]::GetTempPath()) ('crsp-rights-' + [guid]::NewGuid().ToString('N') + '.inf')
$db = Join-Path ([System.IO.Path]::GetTempPath()) ('crsp-rights-' + [guid]::NewGuid().ToString('N') + '.sdb')
try {
    secedit.exe /export /cfg $inf /areas USER_RIGHTS | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "secedit export failed with exit code $LASTEXITCODE" }
    $lines = Get-Content -LiteralPath $inf
    function Set-Right([string[]]$Lines, [string]$Right, [bool]$Want) {
        $found = $false
        $out = foreach ($l in $Lines) {
            if ($l -match ('^' + $Right + '\s*=')) {
                $found = $true
                $ids = @(($l -split '=', 2)[1].Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ -and $_ -ne ('*' + $sid) })
                if ($Want) { $ids += ('*' + $sid) }
                $Right + ' = ' + ($ids -join ',')
            } else { $l }
        }
        if (-not $found -and $Want) {
            $out = @($out) + ($Right + ' = *' + $sid)
        }
        $out
    }
    $lines = Set-Right $lines 'SeServiceLogonRight' $true
    $lines = Set-Right $lines 'SeDenyInteractiveLogonRight' $true
    $lines = Set-Right $lines 'SeDenyRemoteInteractiveLogonRight' $true
    $lines = Set-Right $lines 'SeCreateSymbolicLinkPrivilege' ($env:CRSP_SYMLINK -eq '1')
    if ($lines -notmatch '^\[Unicode\]') { $lines = @('[Unicode]', 'Unicode=yes') + $lines }
    Set-Content -LiteralPath $inf -Value $lines -Encoding Unicode
    secedit.exe /configure /db $db /cfg $inf /areas USER_RIGHTS | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "secedit configure failed with exit code $LASTEXITCODE" }
} finally {
    Remove-Item -LiteralPath $inf, $db -Force -ErrorAction SilentlyContinue
}
`

	// scriptExtract unpacks the verified archive. CRSP_ARCHIVE, CRSP_FOLDER.
	scriptExtract = scriptHeader + `
New-Item -ItemType Directory -Force -Path $env:CRSP_FOLDER | Out-Null
Expand-Archive -LiteralPath $env:CRSP_ARCHIVE -DestinationPath $env:CRSP_FOLDER -Force
Remove-Item -LiteralPath $env:CRSP_ARCHIVE -Force
`

	// scriptRunner runs the runner's own configure or remove step. The
	// arguments come as one JSON array (CRSP_ARGS), each argument alone. The
	// token is ACTIONS_RUNNER_INPUT_TOKEN. The exit code is the result.
	scriptRunner = scriptHeader + `
$listener = Join-Path $env:CRSP_FOLDER 'bin\Runner.Listener.exe'
$runnerArgs = @(ConvertFrom-Json -InputObject $env:CRSP_ARGS)
Push-Location -LiteralPath $env:CRSP_FOLDER
try {
    & $listener @runnerArgs
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
`

	// scriptLock grants Full control to the account, Administrators and SYSTEM
	// only, with inheritance off (runners R5.16). CRSP_FOLDER, CRSP_ACCOUNT.
	scriptLock = scriptHeader + `
$acl = New-Object System.Security.AccessControl.DirectorySecurity
$acl.SetAccessRuleProtection($true, $false)
$inherit = [System.Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit'
$none = [System.Security.AccessControl.PropagationFlags]::None
$allow = [System.Security.AccessControl.AccessControlType]::Allow
$full = [System.Security.AccessControl.FileSystemRights]::FullControl
foreach ($who in @($env:CRSP_ACCOUNT, 'BUILTIN\Administrators', 'NT AUTHORITY\SYSTEM')) {
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($who, $full, $inherit, $none, $allow)
    $acl.AddAccessRule($rule)
}
Set-Acl -LiteralPath $env:CRSP_FOLDER -AclObject $acl
`

	// scriptRegisterService creates the service as the account and starts it
	// (runners R5.15, R5.18). CRSP_SERVICE, CRSP_FOLDER, CRSP_ACCOUNT,
	// CRSP_PASSWORD.
	scriptRegisterService = scriptHeader + `
$secure = ConvertTo-SecureString $env:CRSP_PASSWORD -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential(('.\' + $env:CRSP_ACCOUNT), $secure)
$exe = '"' + (Join-Path $env:CRSP_FOLDER 'bin\RunnerService.exe') + '"'
New-Service -Name $env:CRSP_SERVICE -BinaryPathName $exe -DisplayName ('CRSP runner ' + $env:CRSP_RUNNER) -Description 'GitHub Actions runner made by CI Runners Shared Pool' -StartupType Automatic -Credential $cred | Out-Null
Start-Service -Name $env:CRSP_SERVICE
`

	// scriptListeners prints the process id of every Runner.Listener that runs
	// from CRSP_FOLDER, one per line. The service wrapper is not counted: the
	// listener holds the runner's session with GitHub (runners R5.46).
	scriptListeners = scriptHeader + `
$want = (Join-Path (Join-Path $env:CRSP_FOLDER 'bin') 'Runner.Listener') + '.exe'
Get-Process -Name 'Runner.Listener' -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -and ($_.Path -ieq $want) } |
    ForEach-Object { $_.Id }
`

	scriptStartService = scriptHeader + `
Start-Service -Name $env:CRSP_SERVICE
`

	scriptStopService = scriptHeader + `
$svc = Get-Service -Name $env:CRSP_SERVICE -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -ne 'Stopped') { Stop-Service -Name $env:CRSP_SERVICE -Force }
`

	// scriptDeleteService removes the service entry; safe when it is gone.
	scriptDeleteService = scriptHeader + `
$svc = Get-CimInstance -ClassName Win32_Service -Filter ("Name='" + $env:CRSP_SERVICE.Replace("'", "''") + "'") -ErrorAction SilentlyContinue
if ($svc) {
    if ($svc.State -ne 'Stopped') { Stop-Service -Name $env:CRSP_SERVICE -Force }
    $r = Invoke-CimMethod -InputObject $svc -MethodName Delete
    if ($r.ReturnValue -ne 0) { throw "deleting the service failed with code $($r.ReturnValue)" }
}
`

	// scriptRemoveAccount deletes the account; safe when it is gone.
	scriptRemoveAccount = scriptHeader + `
if (Get-LocalUser -Name $env:CRSP_ACCOUNT -ErrorAction SilentlyContinue) {
    Remove-LocalUser -Name $env:CRSP_ACCOUNT
}
`

	// scriptFind lists runner services as JSON (runners R5.5): the name, the
	// state, the path (which gives the folder) and StartName (the account).
	scriptFind = scriptHeader + `
$rows = @(Get-CimInstance -ClassName Win32_Service -Filter "Name LIKE 'actions.runner.%'" -ErrorAction SilentlyContinue |
    ForEach-Object { [pscustomobject]@{ Name = $_.Name; State = $_.State; PathName = $_.PathName; StartName = $_.StartName } })
ConvertTo-Json -InputObject $rows -Compress
`

	scriptDetect = scriptHeader + `
$id = [Security.Principal.WindowsIdentity]::GetCurrent()
$admin = ([Security.Principal.WindowsPrincipal]$id).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
Write-Output ('admin=' + $admin + ';ps=' + $PSVersionTable.PSVersion.ToString())
`

	// scriptTail reads the newest runner log lines for StreamLogs.
	scriptTail = scriptHeader + `
$log = Get-ChildItem -LiteralPath (Join-Path $env:CRSP_FOLDER '_diag') -Filter 'Runner_*.log' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime | Select-Object -Last 1
if ($log) { Get-Content -LiteralPath $log.FullName -Tail 200 }
`

	// scriptUsage reads the service process' CPU and memory.
	scriptUsage = scriptHeader + `
$svc = Get-CimInstance -ClassName Win32_Service -Filter ("Name='" + $env:CRSP_SERVICE.Replace("'", "''") + "'") -ErrorAction SilentlyContinue
$cpu = 0; $mem = 0
if ($svc -and $svc.ProcessId) {
    $p = Get-Process -Id $svc.ProcessId -ErrorAction SilentlyContinue
    if ($p) { $cpu = [int64]$p.TotalProcessorTime.TotalMilliseconds; $mem = [int64]$p.PeakWorkingSet64 }
}
Write-Output ('cpu_ms=' + $cpu + ';mem=' + $mem)
`
)
