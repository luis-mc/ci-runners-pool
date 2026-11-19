---
change: minor
task: TRAY5
---
`crsp update-window` is a hidden command: the tray starts a copy of crsp with it for the native update window on Windows (tray R5.46). It is not listed in help and takes no part in scripts. `go generate ./cmd/crsp` also writes the console tab icon `apps/web/public/crsp-icon.png`.
