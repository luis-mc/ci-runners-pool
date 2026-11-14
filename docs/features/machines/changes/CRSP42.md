---
change: minor
task: CRSP42
---
R5.44 and R5.45 changed (D41): the agent runs as LocalSystem on Windows and as root on Linux and macOS; the install plan no longer makes an agent account, and runner jobs keep their own non-admin per-runner accounts.
