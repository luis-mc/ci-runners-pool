# CRSP123 report: SSH join for Windows (branch only, never in the PR to main)

Status: code done 2026-11-16.

Plan
1. `crsp agent install --yes` (non-interactive).
2. machines: `PackageSource` interface (MSI url + sha256); release-asset source in cmd/crsp (SHA256SUMS of the controller's own version). CRSP122 can switch it by passing another source.
3. `JoinOverSSH` accepts `windows`: probe (shell cmd/PowerShell, `net session` admin check, arch, crsp.exe path), download+sha256+msiexec if absent, `agent install --yes`. Scripts travel as `powershell -EncodedCommand`, so cmd and PowerShell default shells behave the same.
4. Fake-SSH tests; docs R5.3a, web-console R5.17, content.md + CHANGES; change notes; web (packages/ui) enable Windows.

Notes
- The MSI installs the controller service too (installer/crsp.wxs); that is what the owner asked for (D70). A zip with only crsp.exe would be lighter if the owner wants it: switch inside the PackageSource.

Done
- `--yes` on `crsp agent install` (cmd/crsp/agent_cmd.go); SSH commands of all three systems carry it (Linux and macOS had no way to answer the prompt over SSH).
- internal/machines/sshwin.go, sshjoin.go; cmd/crsp/ssh_packages.go (release asset + SHA256SUMS source, `machines.Options.Packages`).
- openapi `SshJoinRequest.os` gets `windows`; codegen regenerated, drift none.
- Web: AddMachine.tsx enables Windows in the SSH option (no layout change); Vitest 8/8.
- Docs: machines R5.3a, web-console R5.17, test rows, change notes, content.md, CHANGES C31.

Checks: go test -race (machines, api, cmd/crsp) green; golangci-lint 0 issues; GOOS=windows vet ok; GOOS=darwin vet ok for internal/machines (cmd/crsp needs cgo systray, not vet-able off macOS); web typecheck, eslint, prettier, Vitest ok.
Not run: docs_fold.py / docs_check.py (luismc-docs plugin not installed in this sandbox; change notes written by hand in the same format, no version table touched).
Real Windows OpenSSH was not available: scripts are tested against a scripted fake and a real in-process SSH server only.
