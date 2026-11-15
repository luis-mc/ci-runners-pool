# RES10 + RES12 report (branch RES10-pinned-runner-bits)

Source: docs/architecture/landscape-2026-11.md (note: it holds no RES10/RES12 text; scope taken from the task brief).

## Plan
- RES10: one pins file `internal/runners/pins.json` (embedded): runner version + sha256 per OS/arch, base image by digest. `PinFor` reads it. Test: every ref has a digest, Dockerfile FROM equals the pin, bad pins file refused. Download refusal already in `persistent.Download` (swap protocol untouched); tests added.
- RES12: new package `internal/toolimage`: digest-only refs, `Puller` seam, layer digest check, safe unpack, `Packer` seam (read-only disk or virtiofs share), `backend.ToolAttacher` hook for a VM backend. Fakes only.

## Status
- [ ] RES10 pins file
- [ ] RES12 toolimage
- [ ] docs (spec R5.68, R5.69 + change notes)
- [ ] lint/vet/test
- [ ] draft PR

## Open
- `images/layers/compose.kvm.yaml` loader image `alpine:3.20` is still a tag: registry digest could not be fetched from this sandbox. Not invented.
