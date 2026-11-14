---
change: minor
task: OPS1
---
R5.7 is built for macOS and Linux: release assets `crsp-darwin-<arch>.pkg`, `crsp-linux-<arch>.deb` and `crsp-linux-<arch>.rpm`, unsigned for now. The controller service runs as root on both (systemd unit `crsp`, LaunchDaemon `crsp`). Upgrade keeps the data and restarts the service; remove keeps the data, deb purge and `crsp-uninstall --delete-data` delete it. An install marker file tells the updater the package kind.
