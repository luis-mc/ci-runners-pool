---
change: patch
task: OPS10
---
An App made without a webhook now completes on Windows: the empty webhook secret is not stored. A failure after GitHub made the App redirects with the App's address and is audited, so the half-made App can be deleted.
