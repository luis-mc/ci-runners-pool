---
change: minor
task: CRSP22
---
Persistent runner backends for Windows, Linux and macOS, runner rules (labels, pinned SHA-256 versions, account names, states, drain), plan and apply for add and replace, remove with a remove token, and the runner API operations are built. Spec sections 5, 9, 11 and 12 updated.

The .ps1 and .sh hook scripts also print a ::warning annotation and write crsp-hook-problem.txt when crsp is missing or cannot start, still exiting 0 (R5.39).
