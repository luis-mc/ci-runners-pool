# CRSP runner hook: job started (runners R5.17). Calls the crsp binary
# installed for all users, never a copy in a user profile. The runner refuses
# .cmd hooks, so this is PowerShell.
$ErrorActionPreference = 'Stop'
$crsp = Join-Path $env:ProgramFiles 'crsp\crsp.exe'
if (-not (Test-Path -LiteralPath $crsp)) {
    Write-Host "crsp hook: $crsp is not installed; the job goes on."
    exit 0
}
& $crsp hook job-started
exit $LASTEXITCODE
