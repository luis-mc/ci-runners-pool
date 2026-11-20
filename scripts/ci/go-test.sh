#!/usr/bin/env bash
# Runs `go test ./...` and fails when no test ran (STACKSPEC 11.3: a suite that
# finds zero tests must fail, not pass). Extra arguments go to `go test`.
#
# CRSP201: runs `go test -json`, not `-v` (about 122k log lines). The JSON goes
# to $GO_TEST_JSON (default test-results/go-test.json; CI uploads it as the
# artifact ci-go-test-times-<os>). The log gets one line per package, the output
# of failed tests, the package times and the 20 slowest tests. The exit code is
# go test's own; a run with no passing test exits 1.
#
# CRSP209 (G1): `go test -timeout` limits one package binary, not one test, so the
# packages run in three tiers (scripts/ci/go-tiers.json, measured times in
# docs/work/CRSP209-report.md): unit 10 s (every package not listed), integration
# 60 s, and a slow run with the smallest safe limit for the packages that do not
# fit 60 s yet. The three runs share one JSON file and one summary.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
json="${GO_TEST_JSON:-test-results/go-test.json}"
tiers() { go list ./... | node scripts/ci/go-tiers.mjs "$1"; }
unit_pkgs=$(tiers unit)
integration_pkgs=$(tiers integration)
slow_pkgs=$(tiers slow)
rc_file=$(mktemp)
trap 'rm -f "$rc_file"' EXIT
set +e
{
  if [ -n "$unit_pkgs" ]; then
    # shellcheck disable=SC2086
    go test -json -timeout 10s "$@" $unit_pkgs || echo "$?" >> "$rc_file"
  fi
  if [ -n "$integration_pkgs" ]; then
    # shellcheck disable=SC2086
    go test -json -timeout 60s "$@" $integration_pkgs || echo "$?" >> "$rc_file"
  fi
  if [ -n "$slow_pkgs" ]; then
    # Remaining G1 breaks: over 60 s under -race today. Do not raise this to hide a slow package.
    # shellcheck disable=SC2086
    go test -json -timeout 150s "$@" $slow_pkgs || echo "$?" >> "$rc_file"
  fi
} | node scripts/ci/go-test-summary.mjs "$json"
sum_rc=${PIPESTATUS[1]}
set -e
go_rc=0
while read -r r; do
  [ "$r" -eq 0 ] || go_rc=$r
done < "$rc_file"
if [ "$go_rc" -ne 0 ]; then
  echo "go test failed with exit code $go_rc" >&2
  exit "$go_rc"
fi
exit "$sum_rc" # 0 passed, 3 zero-test guard, 4 or other: the summary itself broke
