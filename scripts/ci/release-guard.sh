#!/usr/bin/env bash
# CRSP130: refuse a stable release whose tagged commit is not on main.
#
#   scripts/ci/release-guard.sh <commit> [main-ref]
#
# <main-ref> defaults to origin/main; the caller fetches it first. Exit 0 when
# <commit> is reachable from <main-ref>; otherwise a clear error and exit 1.
# v0.1.1 was tagged on a branch that never merged, so the release had no
# "What's Changed" list.
set -euo pipefail

[ "$#" -ge 1 ] && [ "$#" -le 2 ] || { echo "usage: $0 <commit> [main-ref]" >&2; exit 2; }
commit="$1" main="${2:-origin/main}"

git rev-parse --verify --quiet "${main}^{commit}" >/dev/null ||
  { echo "::error::release guard: cannot find ${main}; fetch main first" >&2; exit 1; }
sha="$(git rev-parse --verify --quiet "${commit}^{commit}")" ||
  { echo "::error::release guard: unknown commit ${commit}" >&2; exit 1; }

if git merge-base --is-ancestor "$sha" "$main"; then
  echo "release guard: ${sha} is on ${main}"
else
  echo "::error::release guard: tagged commit ${sha} is not reachable from ${main}. Merge the branch to main, then tag the merge commit. Nothing was built or published." >&2
  exit 1
fi
