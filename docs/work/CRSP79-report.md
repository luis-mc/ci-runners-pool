# CRSP79 + CRSP80 report (branch CRSP79-scaleset-sweep)

Status: started 2026-11-15. Updated after each step.

## Plan
1. Container backend: JIT config over stdin only (no file, no argv, no container env). R5.40, R5.34.
2. Scale-set client (own code, from the public protocol docs) as a `github.Demand` behind a setting, with polling fallback + back-off. R5.35, R5.40.
3. Safe runner removal: idle check, deregister, then stop; 422 = busy; unknown = gone. runners R5.62.
4. Automatic sweep of crsp-owned offline registrations older than a grace. R5.33.
5. Specs, change notes, docs check.

## Done
- Step 1 done: container backend takes the JIT config on stdin (internal/backend/container, jitstdin_test.go). The tmpfs /run/crsp and the config file are gone.

## Notes
- The runner binary accepts the JIT config only as `--jitconfig` or as the env of its own process. crsp uses the second, set inside the one process by the start script after reading stdin. It is never a container env, a file, or an argument.
