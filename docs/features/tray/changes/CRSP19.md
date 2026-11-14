---
change: minor
task: CRSP19
---
Tray menu rebuilt: version line, service line, Open, Look for updates, Update to version, Restart the service, Open log folder, Open on GitHub, Start at login, Quit tray. Restart and Update moved into this milestone: Review step in the console, drain, Automatic updates on by default (R5.1, R5.2, R5.15 to R5.18, R5.28 to R5.30). Service side of the local channel built (`status` with update fields, `check`, `link` with a target) on a Unix socket and a named pipe, with the caller read from the OS (R5.8, R6.8). The menu has no bold default entry: the owner accepted a plain Open item and the unused flag is gone.
