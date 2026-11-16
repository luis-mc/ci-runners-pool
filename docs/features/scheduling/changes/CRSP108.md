---
change: minor
task: CRSP108
---
The job-started hook refuses a forked pull request job on a public repository before the load gate runs, unless `CRSP_ALLOW_FORK_PRS=1` (`internal/hooks/forkpr.go`; github-integration R5.26). The job gets exit 1 and an `::error` line that names the policy; no slot is taken.
