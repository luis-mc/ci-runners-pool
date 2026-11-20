#!/usr/bin/env bash
# Runs `go test ./...` and fails when no test ran (STACKSPEC 11.3: a suite that
# finds zero tests must fail, not pass). Extra arguments go to `go test`.
#
# CRSP201: runs `go test -json`, not `-v` (about 122k log lines). The JSON goes
# to $GO_TEST_JSON (default test-results/go-test.json; CI uploads it as the
# artifact ci-go-test-times-<os>). The log gets one line per package, the output
# of failed tests, the package times and the 20 slowest tests. The exit code is
# go test's own; a run with no passing test exits 1.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
json="${GO_TEST_JSON:-test-results/go-test.json}"
set +e
go test -json "$@" ./... | node scripts/ci/go-test-summary.mjs "$json"
rcs=("${PIPESTATUS[@]}")
set -e
go_rc=${rcs[0]}
sum_rc=${rcs[1]}
if [ "$go_rc" -ne 0 ]; then
  echo "go test failed with exit code $go_rc" >&2
  exit "$go_rc"
fi
exit "$sum_rc" # 0 passed, 3 zero-test guard, 4 or other: the summary itself broke
