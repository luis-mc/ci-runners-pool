---
change: minor
task: CRSP138
---
The Windows upgrade closes the tray before InstallValidate (new R5.86), so it no longer waits on a held `crsp.exe`. A new immediate action `CloseTray` asks each tray to quit and ends the ones that stay; the tray handles the quit request and `crsp tray --quit` does it from a shell. The service stop is bounded at 20 s, and each step has a line in the install window. A CI job upgrades a running tray's install from the previous release and fails over 60 s or on a Files in Use entry.
