---
change: minor
task: OPS52
---
A failed add rolls back its GitHub registration, including a failure to write the local record after registering (R5.94). A session GitHub still holds after a restart is a wait with the reason 'Waiting for GitHub to release the old session', a 6 minute window and a backoff of 5 seconds to a minute (R5.95; was 3 minutes). The Windows runner password is letters and digits only (R5.96).
