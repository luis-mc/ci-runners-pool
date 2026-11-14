---
change: minor
task: CRSP24
---
Every refusal exits non-zero; R5.12 now has a table that maps each refusal to its code (5 not confirmed, 3 not allowed or not signed in, 7 precondition, 4 not found, 2 usage or not built, 1 other, 6 unreachable). logout with no token now exits 3. Per CRSP23, machine drain, machine remove and runner remove lose --stop-jobs and --drain-timeout: they wait past the machine drain timeout, warn "Still draining" every 5 minutes, and never stop a job (R5.16). Tests: internal/cli/exitcodes_test.go.
