---
change: minor
task: CRSP138
---
The tray quits when it is asked to: SIGTERM, SIGINT or, on Windows, the window close message the MSI sends, so the process exits and releases `crsp.exe`. New `crsp tray --quit` asks every other tray of the same install folder to quit, waits 5 s and ends the ones left. The Windows upgrade uses it through the new operations R5.86.
