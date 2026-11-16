# CRSP141 report: parity writes a reachable address, final step tells the real cause

Branch `CRSP141-parity-address`. Status: started.

## Plan
1. Go: `repos.ParityAddress(publicHost, listenAddr)` picks `https://<public host>:<console port>` (the join file's console URL); loopback, wildcard-only or http is refused with the setting to fix.
2. API: `getParityAddress` (shows the address, calls it server side with the controller CA, reports if it does not answer); `setupRepositoryParity` ignores a browser address, writes the chosen one, answers `needs_address` when none.
3. Web: Access for CI shows the address and the check before the button; `needs_address` is a Needs you note.
4. `.github/workflows/parity.yml`: final step reports the real cause (script `scripts/ci/parity-final-step.sh`, tested).
5. Specs (operations R5.85, github-integration R5.84, web-console R5.91 and test rows) and change notes.

## Log
