---
change: minor
task: CRSP108
---
Added `Service.DeleteOfflineRegistration` (`internal/runners/offline.go`): deletes the GitHub registration of an offline runner crsp made after a yes, then cleans the machine if it answers and drops the record (github-integration R5.33). `sweepOne` takes the audit action and detail so the sweep and this path share it.
