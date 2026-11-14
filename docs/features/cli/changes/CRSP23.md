---
change: patch
task: CRSP23
---
crsp doctor is wired into cmd/crsp as a thin command over internal/doctor/cli. It reads CRSP_URL (default http://127.0.0.1:8460) and CRSP_TOKEN until the CLI sign-in lands. The controller command now mounts the live view.
