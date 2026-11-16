# CRSP114 report: macOS VMs (runners R5.29, R5.66 macOS part; machines R5.14)

Branch CRSP114-macos-vms. Status: code done, awaiting CI.

## Plan
- `internal/backend/macvm`: pure Go logic (limit of two, per-job clone from base, delete after job, count, refusal on Intel or macOS older than 13) behind a `Framework` interface; fakes in tests.
- `framework_darwin.go`: the only darwin file. No cgo in this step (see "Not built").
- Agent: `MachineReport.macos_vms` (proto, regenerated) filled by `internal/agent`.
- Change notes: runners, machines. Spec text marked.

## Built
- `internal/backend/macvm`: `Limiter` (constant limit 2, foreign VMs counted, wait with reason, slot freed on stop or failed boot), `Booter` (vmclone.Booter), `Disks` (APFS clonefile per job, orphan list by clone suffix), `Check` (refuses Intel and macOS < 13 with reason), `Report`.
- Agent: proto `MacVmReport macos_vms = 10`, regenerated; `agent.Config.MacVMs`, `addMacVMs`; wired in `cmd/crsp/macvm_wiring.go` (Mac only). Unreadable count reports unknown, not zero.
- No cgo in this step. Tests with fakes; `GOOS=darwin CGO_ENABLED=0 go vet` and windows vet clean.
- Change notes: runners, machines. Spec text marked built in part.

## Not built / needs a real Mac
- The Virtualization.framework boot bridge (VZVirtualMachine create, start, stop; restore image install) is not written: it cannot be compiled or run in the Linux sandbox.
- Wiring macvm into the registry and `backend.Order` (Tart is still listed there).
- Boot also needs aux storage and machine identifier per clone; the bridge must create them next to the clone (the clone is the disk image only).
- Clone suffix reuses `vmclone.CloneSuffix` (`.qcow2`) so vmclone's sweep names match; cosmetic on macOS.
- `pgrep` counting of VMs needs verification on a real Mac; the controller-side refusal of a third VM (machines R5.14) is not built.
- `docs_check.py` / `docs_fold.py` not available in the sandbox: change notes written by hand in the existing format.
