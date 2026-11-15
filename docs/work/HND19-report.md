# HND19 and HND20 report

Branch: HND19-llvm-arm64-symlinks (from origin/main).

## Done
- HND19: `images/layers/llvm/Dockerfile` pins arm64 (hash = tools.json); CI `image` job is a matrix amd64 + arm64 (arm64 builds base + llvm only); tests `TestLayerSelfChecks` (pins equal tools.json), `TestImageBuildMatrixListsArm64`.
- HND20: `RightsGranter` (`internal/backend/windows/rights.go`) with fake in `rights_test.go`; account script no longer sets rights; rights granted after account step; `SymlinkStatus` reads right + Developer Mode (read only); doctor check `runner.symlink` (R5.42), probe fields in `doctor.Runner`.
- Specs: runners R5.43 updated, new R5.68, open question 28 closed; doctor R5.42 + catalogue row; change notes HND19, HND20 (runners), HND20 (doctor).

## Not done / notes
- The agent filling `Runner.Symlink` / `SymlinkWanted` for the doctor is not built (same state as R5.14, R5.35 data); stated in doctor R5.42.
- `docs_fold.py note` and `docs_check.py` (luismc-docs plugin) are not in this sandbox: change notes written by hand in the CRSP49 format; docs_check not run.
- golangci-lint here is built with Go 1.25, repo needs 1.27.4: lint not run. `gofmt`, `go vet`, `GOOS=windows go vet ./...`, `go test -race` on touched packages run.
- actionlint and shellcheck not installed; ci.yml checked as YAML only. No shell file changed.
- arm64 CI job on `ubuntu-24.04-arm` is unproven until CI runs.
