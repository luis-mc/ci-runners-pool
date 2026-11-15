# HND16 report: extra packages on remote machines

Branch HND16-remote-packages, base 40f779d.

## Plan
1. Proto: `RunnerSpec.extra_packages` (repeated string) so the list reaches a remote agent.
2. `internal/runners/packages.go`: per-OS package manager id check (apt/dnf/brew/winget), set hash, cache of installed sets, install step through an injected runner (no host OS install).
3. Agent: SpecFromProto carries the list; failure reported to the doctor.
4. Spec R5.68 + change note.

## Status
- [ ] proto
- [ ] package install step + cache
- [ ] agent wiring
- [ ] doctor report
- [ ] docs
