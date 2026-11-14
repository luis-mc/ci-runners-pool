# CRSP runner hook: job completed (runners R5.17, R5.40). Calls the crsp binary
# installed for all users, never a copy in a user profile. The runner refuses
# .cmd hooks, so this is PowerShell.
# A crsp that is missing or broken never fails the job, but it is never silent:
# the job gets a ::warning annotation and the runner folder gets a problem file
# that the doctor reads (scheduling R5.61).
$ErrorActionPreference = 'Stop'
$hook = 'job-completed'
$crsp = if ($env:CRSP_BIN) { $env:CRSP_BIN } else { Join-Path $env:ProgramFiles 'crsp\crsp.exe' }
function Stop-WithWarning([string]$text) {
    Write-Host "::warning title=crsp::$text"
    try { Set-Content -LiteralPath (Join-Path $PSScriptRoot 'crsp-hook-problem.txt') -Value "${hook}: $text" } catch { }
    exit 0
}
if (-not (Test-Path -LiteralPath $crsp)) {
    Stop-WithWarning "crsp is not installed at $crsp, so this job ran without the queue and the load gate. Reinstall crsp for all users on this machine, then run 'crsp doctor --check runner.hooks'. The job was not stopped."
}
$env:CRSP_HOOK_DIR = $PSScriptRoot
try {
    & $crsp hook $hook @args
} catch {
    Stop-WithWarning "crsp at $crsp could not run ($($_.Exception.Message)), so this job ran without the queue and the load gate. Reinstall crsp for all users on this machine, then run 'crsp doctor --check runner.hooks'. The job was not stopped."
}
exit $LASTEXITCODE
