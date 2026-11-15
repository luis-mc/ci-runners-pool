---
change: minor
task: OPS5
---
The tray icon is always the app icon, a round disc with the letters CRSP in it, in every state. Only the disc colour changes (green ok, amber waiting, red failed, slate stopped, blue starting); the tooltip and menu header still name the state in words. This replaces the shape-per-state rule of R5.4 (decision tray D8). `crsp.exe` now carries the same disc as its Windows icon, drawn by the tray's own code (`go generate ./cmd/crsp`).
