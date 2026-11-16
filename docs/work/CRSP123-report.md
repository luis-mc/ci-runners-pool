# CRSP123 report: SSH join for Windows (branch only, never in the PR to main)

Status: started 2026-11-16.

Plan
1. `crsp agent install --yes` (non-interactive).
2. machines: `PackageSource` interface (MSI url + sha256); release-asset source in cmd/crsp (SHA256SUMS of the controller's own version). CRSP122 can switch it by passing another source.
3. `JoinOverSSH` accepts `windows`: probe (shell cmd/PowerShell, `net session` admin check, arch, crsp.exe path), download+sha256+msiexec if absent, `agent install --yes`. Scripts travel as `powershell -EncodedCommand`, so cmd and PowerShell default shells behave the same.
4. Fake-SSH tests; docs R5.3a, web-console R5.17, content.md + CHANGES; change notes; web (packages/ui) enable Windows.

Notes
- The MSI installs the controller service too (installer/crsp.wxs); that is what the owner asked for (D70). A zip with only crsp.exe would be lighter if the owner wants it: switch inside the PackageSource.
