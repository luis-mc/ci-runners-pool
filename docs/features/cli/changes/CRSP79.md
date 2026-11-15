---
change: minor
task: CRSP79
---
The controller wiring in `cmd/crsp` reads two new `config.toml` keys: `scaleset_demand` (off by default, scale-set demand with a polling fallback, CRSP79) and `runner_sweep_days` (default 7, 0 turns the sweep off, CRSP80). Specified in github-integration R5.33, R5.35 and R5.40.
