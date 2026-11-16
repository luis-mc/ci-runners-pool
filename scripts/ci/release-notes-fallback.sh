#!/usr/bin/env bash
# CRSP130: notes for a release whose generated notes have no change list.
#
#   scripts/ci/release-notes-fallback.sh <tag> <generated-notes-file>
#
# Prints nothing and exits 0 when the generated notes already have a
# "What's Changed" list. Otherwise prints notes made from the commit subjects
# between the previous stable tag and <tag> (`git log --format='- %s' prev..tag`);
# with no previous stable tag, from every commit of <tag>.
set -euo pipefail

[ "$#" -eq 2 ] || { echo "usage: $0 <tag> <generated-notes-file>" >&2; exit 2; }
tag="$1" notes="$2"

if grep -q "What's Changed" "$notes"; then
  exit 0
fi

# Previous stable tag: the next lower vX.Y.Z in version order.
prev="$(git tag --list 'v*' --sort=-v:refname |
  grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' |
  awk -v t="$tag" 'found { print; exit } $0 == t { found = 1 }' || true)"
if [ -z "$prev" ]; then
  # tag is a prerelease or the first one: fall back to the newest stable tag below it by ancestry
  prev="$(git tag --list 'v*' --sort=-v:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' |
    while read -r t; do
      [ "$t" != "$tag" ] && git merge-base --is-ancestor "$t" "$tag" && { echo "$t"; break; }
    done || true)"
fi

if [ -n "$prev" ]; then
  range="${prev}..${tag}"
  echo "## Changes since ${prev}"
else
  range="$tag"
  echo "## Changes"
fi
echo
log="$(git log --format='- %s' "$range")"
if [ -n "$log" ]; then echo "$log"; else echo "- No commits between ${prev:-the start} and ${tag}."; fi
