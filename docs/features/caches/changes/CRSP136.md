---
change: minor
task: CRSP136
---
The Docker disk (WSL2 `.vhdx`) of Windows machines compacts by itself. A built-in `docker-compact` host helper trims, stops Docker Desktop, shuts WSL down, compacts with Optimize-VHD or diskpart, starts Docker Desktop and waits for `docker info`, and always starts Docker again after a failure; on Linux and macOS it prunes only unused build cache and dangling images. A per-machine policy (threshold 30 GiB, idle 30 minutes, quiet hours 01:00 to 06:00, once a day) decides; it runs through the maintain path (hold, drain, compact, release) so queued jobs wait and never fail; the projects get a notice before and after with sizes; audit entries are written (R5.51 to R5.54).
