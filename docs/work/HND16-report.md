# HND16 report: extra packages on remote machines

Branch HND16-remote-packages, base 40f779d.

## Plan
1. Proto: `RunnerSpec.extra_packages` (repeated string) so the list reaches a remote agent.
2. `internal/runners/packages.go`: per-OS package manager id check (apt/dnf/brew/winget), set hash, cache of installed sets, install step through an injected runner (no host OS install).
3. Agent: SpecFromProto carries the list; failure reported to the doctor.
4. Spec R5.68 + change note.

## Status
- [x] proto
- [x] package install step + cache
- [x] agent wiring
- [x] doctor report
- [x] docs

## Notes
- golangci-lint here is built with go1.25 and cannot load the config (needs 1.27); gofmt, go vet, `GOOS=windows go vet ./...` and `go test -race` on touched packages are green.
- No docs_fold.py in this sandbox; change note written by hand in the existing format.
- Open: backend PackageExec for persistent prefix / VM disk; controller feeding package_failures to the doctor (spec open question 56).
