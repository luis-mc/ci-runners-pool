---
change: minor
task: CRSP114
---
macOS VMs on Apple's Virtualization.framework (R5.29) and the macOS part of Docker in a job (R5.66), built in part. `internal/backend/macvm` keeps at most two macOS VMs per Mac (counting VMs the agent did not start, no setting raises it), makes an APFS clone of the base disk per job through `vmclone`, removes it after the job, makes a third job wait and say why, and refuses an Intel Mac or a macOS older than 13 with the reason. Tested with fakes. Not built: the Virtualization.framework boot bridge (`framework_darwin.go` `Boot` refuses with "bridge not available") needs a real Mac; the backend is not yet in the registry or `backend.Order`.
