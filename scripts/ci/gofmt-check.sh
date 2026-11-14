#!/usr/bin/env bash
# Fails when gofmt would change any Go file (generated files included).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
unformatted=$(gofmt -l . || true)
if [ -n "$unformatted" ]; then
  echo "gofmt: these files are not formatted:" >&2
  echo "$unformatted" >&2
  exit 1
fi
