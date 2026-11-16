# CRSP133 report

Branch CRSP133-joinfile-tls. Status: started.

## Plan
1. Owner-only save of the join file on every OS (Windows protected DACL: current user + SYSTEM). Test reads DACL back.
2. File and console say: one-time code, valid 15 minutes, delete after use.
3. Pin the controller certificate (CA fingerprint, as the copied command's `--fingerprint`) for the MSI/package downloads: PowerShell callback (5.1 safe) in sshwin.go and the `.cmd` template; openssl chain check + curl `--pinnedpubkey` in the `.sh` and `.command` templates. GitHub fallback keeps normal TLS.
4. Spec R5.3a, R5.65 text and test rows; change note.

## Notes
- The pin is the CA fingerprint (tlsca.VerifyPin): a certificate in the presented chain has it and the server certificate chains to it.
- In the SSH path SHA256SUMS never travels to the machine: the controller reads it and puts the MSI hash in the script. Only the MSI download needs the pin.

## Done
- Owner-only save: `internal/cli/ownerfile_{unix,windows}.go`; Windows creates the file empty, sets a protected DACL (current user + SYSTEM), then writes. Tests: POSIX mode check; `ownerfile_windows_test.go` reads the DACL back (protected, no Everyone/Users/Authenticated Users). Windows test only compiled and vetted here (GOOS=windows), not run.
- Pin: `.sh`/`.command` read the chain with openssl, match the CA fingerprint, verify the server cert is signed by it, then `curl -k --pinnedpubkey`; `.cmd` and the SSH script use a static C# callback (`CrspPin`, PowerShell 5.1). wget fallback removed. GitHub fallback keeps normal TLS.
- Tests: pin in all templates; real `sh` run against a TLS fake with the right cert (accepted), another CA (refused), and a server cert not signed by the pin (refused); curl -k does not beat the key pin; SSH script pin test.
- Console and file words: first lines of every file, saved-file line and review line (content.md, CHANGES C35).
- Spec R5.3a, R5.65 (machines), R5.66 (web-console), change notes.

## Not done / checks
- PowerShell pin and DACL not run on a real Windows machine; pwsh is not in the sandbox.
- Web test (AddMachine.test.tsx) edited but not run: node_modules is missing here; CI runs it.
- `docs_check.py` and `docs_fold.py` (luismc-docs plugin) are not in this sandbox; change notes written by hand in the CRSP122 format.
- darwin vet of cmd/crsp fails on the systray cgo dependency (not related to this change); other packages vet clean for windows and darwin.
