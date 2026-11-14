# CRSP runner hook: job completed (runners R5.17).
$ErrorActionPreference = 'Stop'
$crsp = Join-Path $env:ProgramFiles 'crsp\crsp.exe'
if (-not (Test-Path -LiteralPath $crsp)) {
    Write-Host "crsp hook: $crsp is not installed; the job goes on."
    exit 0
}
& $crsp hook job-completed
exit $LASTEXITCODE
