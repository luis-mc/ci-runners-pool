# CRSP85 report: Windows jobs in Hyper-V isolated containers (runners R5.65)

Branch CRSP85-hyperv-containers. Status: coding.

Plan
- `internal/backend/container/isolation.go`: `Isolation` (process default, hyperv), `PoolSetup.Isolation` (the runner-definition field), `--isolation=hyperv` flag, `Backend.ProbeHyperV` (read-only probe, clear refusal).
- `RunArgs` adds the flag only for hyperv; limits (HND17) and mounts (HND9) code untouched.
- Spec R5.65 marked built (text only), change note CRSP85.md.

Notes
- Nothing changes host settings or enables a Windows feature; the probe only reads.

Status update: code done. Tests pass (go test -race ./internal/backend/...), gofmt clean, GOOS=windows and darwin vet of internal/backend clean.
Not run: golangci-lint (installed binary built with go1.25, repo targets 1.27.4), docs_check.py (luismc-docs plugin not on this machine), full-repo darwin vet (cgo dependency fails to compile on linux, unrelated).
Open: Start still refuses r.OS other than linux, so the field and probe are built and tested but no Windows image path starts a container yet.
