# HND18 report: `crsp vm doctor` and base-disk package manifest

Branch `HND18-vm-doctor` from origin/main (40f779d). Parity item: caches R5.46 `doctor`, R5.47.

## Plan
1. Doctor env: `VM VMSource` and the `VMState` types (`internal/doctor/env.go`).
2. Checks `vm.accel`, `vm.tools`, `vm.seedtool`, `vm.basedisk`, `vm.disk`, `vm.network`, `vm.packages` (`internal/doctor/checks/vm.go`), tests with fakes.
3. Base-disk manifest `bases/<distro>-<key>.packages` and `EnsureBasePackages` (`internal/vmcheck/manifest.go`).
4. Host probe (`internal/vmcheck/probe.go`) and the command `crsp vm doctor` (`internal/jobcmd/vmdoctor.go`) on the doctor engine.
5. Spec (caches R5.46, R5.51 next free ID if needed), change notes, docs check, draft PR.

## Status
- [x] 1 env types
- [x] 2 checks (tests with fakes in vm_test.go)
- [x] 3 manifest (manifest.go, EnsureBasePackages, prune keeps manifest with base)
- [x] 4 probe and command (internal/jobcmd/vmdoctor.go, VMHost fakes)
- [ ] 5 docs and PR

## Decisions
- Packages are not installed into the base disk (needs a guest boot on the base; stays open question 19). The manifest records the list the base was keyed with; a base with no manifest counts as an empty list. A build with packages and no installer is refused, so a manifest never claims what is not in the disk.
