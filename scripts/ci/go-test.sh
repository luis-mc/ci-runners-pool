#!/usr/bin/env bash
# Runs `go test ./...` and fails when no test ran (STACKSPEC 11.3: a suite that
# finds zero tests must fail, not pass). Extra arguments go to `go test`.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
out=$(mktemp)
trap 'rm -f "$out"' EXIT
go test -v "$@" ./... 2>&1 | tee "$out"
passed=$(grep -cE '^[[:space:]]*--- PASS' "$out" || true)
if [ "$passed" -eq 0 ]; then
  echo "zero-test guard: go test ran no passing tests" >&2
  exit 1
fi
echo "zero-test guard: $passed passing tests"
