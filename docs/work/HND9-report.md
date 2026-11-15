# HND9 + HND10 report

Branch HND9-mounts-exit137, from main 40f779d. Source: handover lessons 14, 15, 16 (D12, C5, D13).

## Plan
- HND9: mount the folder of the crsp binary read-only at /opt/crsp, run it from there (CRSP_BIN). Other mounts checked: lanes are folders; compose.kvm.yaml mounts /lib/modules (folder); no other single-file mount.
- HND10: exit 137 -> "stopped by the memory cap (exit 137)" in job log, console data, doctor; OOM event logged with cap value.

## Status
- [x] HND9 code + tests
- [x] HND10 code + tests
- [x] Spec + change notes
- [x] Checks (go test -race touched packages, go vet linux+windows; golangci-lint and docs_check.py not runnable here: lint binary built for go1.25, no luismc-docs plugin), draft PR
