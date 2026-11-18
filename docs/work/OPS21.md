# OPS21 report

Cause: the console view showed the last agent report's cap state even when that report was about another percent than the chosen one (the setting reaches the agent after the PATCH), so the old error stayed one change behind.

Fix:
- `internal/machines/policy.go` `capFor`, used in `view`: report pct != wanted pct gives state `applying`, detail dropped. `not_supported` and no report are left alone.
- `internal/agent/policy.go`: the report carries the percent the result is about (read after `syncCap` applies).
- openapi `CpuCapState` gets `applying` (Go gen, TS schema).
- `MachinePolicy.tsx`: "Setting the CPU cap." while applying; reads again every 2 s until it settles.
- Docs: machines spec R5.64 and test table, change note `docs/features/machines/changes/OPS21.md` (written by hand: `docs_fold.py` is not in this sandbox), design-system next-version content + C87.

Tests: Go `TestCPUCapStateFollowsTheChosenPct`, agent over-the-link test extended; web test 100 failed -> 50 applying -> applied. Go machines/agent/api and the web test file pass.
Not run: `docs_check.py` and `docs_fold.py` (absent), full CI.
