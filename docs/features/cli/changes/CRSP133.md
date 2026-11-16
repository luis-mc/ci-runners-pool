---
change: minor
task: CRSP133
---
`crsp machine join-file` saves the file owner-only on every system: mode 0600 (0700 for a shell file) on Linux and macOS, a protected access list for the current user and SYSTEM on Windows. Its message tells you to delete the file after use (machines R5.65).
