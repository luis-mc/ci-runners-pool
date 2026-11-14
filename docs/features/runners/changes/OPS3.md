---
change: minor
task: OPS3
---
A Windows runner whose account changes now gets its folder handed to the new account (`takeown /R`, `icacls /setowner`, `icacls /reset /T`) before the folder is locked, so files in the old tool cache no longer fail with "Access is denied". A failed step stops the change with its reason (R5.57).
