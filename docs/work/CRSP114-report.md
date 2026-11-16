# CRSP114 report: macOS VMs (runners R5.29, R5.66 macOS part; machines R5.14)

Branch CRSP114-macos-vms. Status: started.

## Plan
- `internal/backend/macvm`: pure Go logic (limit of two, per-job clone from base, delete after job, count, refusal on Intel or macOS older than 13) behind a `Framework` interface; fakes in tests.
- `framework_darwin.go`: the only darwin file. No cgo in this step (see "Not built").
- Agent: `MachineReport.macos_vms` (proto, regenerated) filled by `internal/agent`.
- Change notes: runners, machines. Spec text marked.

## Built
(filled as steps land)

## Not built / needs a real Mac
- The Virtualization.framework boot bridge (VZVirtualMachine create, start, stop; restore image install) is not written: it cannot be compiled or run in the Linux sandbox.
- Wiring macvm into the registry and `backend.Order` (Tart is still listed there).
