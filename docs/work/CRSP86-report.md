# CRSP86 report: Docker inside a job through a cloned VM

Branch CRSP86-docker-in-vm. Spec: runners R5.66.

## Plan
1. `backend.RunnerSpec.NeedsDocker` (the runner-definition field).
2. `internal/backend/vmclone`: pick a VM backend (refuse if none), check the base disk manifest (HND18 `vmcheck.ReadManifest`), clone per job, boot with no socket share, remove clone after.
3. Tests with fakes.
4. Spec R5.66 text, change note.

## Status
- [x] code (internal/backend/vmclone, RunnerSpec.NeedsDocker)
- [x] tests (go test -race ok; golangci-lint not runnable here: Go version mismatch; docs_check not found)
- [x] spec + change note
- [ ] draft PR
