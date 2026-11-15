# RES10 + RES12 report (branch RES10-pinned-runner-bits)

Source: docs/architecture/landscape-2026-11.md (note: it holds no RES10/RES12 text; scope taken from the task brief).

## Plan
- RES10: one pins file `internal/runners/pins.json` (embedded): runner version + sha256 per OS/arch, base image by digest. `PinFor` reads it. Test: every ref has a digest, Dockerfile FROM equals the pin, bad pins file refused. Download refusal already in `persistent.Download` (swap protocol untouched); tests added.
- RES12: new package `internal/toolimage`: digest-only refs, `Puller` seam, layer digest check, safe unpack, `Packer` seam (read-only disk or virtiofs share), `backend.ToolAttacher` hook for a VM backend. Fakes only.

## Status
- [x] RES10 pins file (`internal/runners/pins.json`, `loadPins`, `ValidDigestRef`, `ImagePin`); tests in `pins_test.go`, real-hash download test in persistent
- [x] RES12 `internal/toolimage` (ref, pull checks, unpack, packer, Prepare, Start) + `backend.ToolBooter`; fake tests
- [x] docs: runners spec R5.68, R5.69, open questions 56, 57, code map, notes RES10.md, RES12.md
- [x] go test -race on touched packages green; GOOS=windows go vet on touched packages clean; gofmt clean
- [ ] golangci-lint: not run, the installed binary is built with Go 1.25 and refuses this module (go 1.27)
- [ ] docs_check.py: luismc-docs plugin scripts not present in this sandbox, not run
- [x] draft PR

## Open
- `images/layers/compose.kvm.yaml` loader image `alpine:3.20` is still a tag: the registry digest could not be read from this sandbox, and none was invented (spec open question 56).
- No registry client (`Puller`) and no VM backend implements `ToolBooter` yet (open question 57).
- The landscape doc has no RES10/RES12 text; scope came from the task brief.
