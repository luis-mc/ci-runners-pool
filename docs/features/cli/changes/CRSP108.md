---
change: minor
task: CRSP108
---
Added `crsp runner delete-offline NAME [--yes]`: names the runner, asks, then deletes the registration of an offline runner whose machine cannot remove it (github-integration R5.33). The controller refuses an online or busy runner.
