---
change: minor
task: CRSP130
---
New R5.46: a stable tag (`v*`) is released only when its commit is on main. `release.yml` has a `guard` job that every other job needs, so a tag on an unmerged branch (as v0.1.1, PR #77) is refused before any build or upload. After the release is created, if the generated notes have no "What's Changed" list, the notes are rewritten from the commit subjects between the previous stable tag and this one.
