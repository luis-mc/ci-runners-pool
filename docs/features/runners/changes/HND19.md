---
change: minor
task: HND19
---
The `llvm` layer builds for arm64 as well as amd64, with the pinned LLVM 20.1.8 hash of each architecture equal to `scripts/delivery/tools.json`; the CI image job is a matrix of both architectures (R5.43; open question 28, arm64 part).
