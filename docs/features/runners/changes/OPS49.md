---
change: minor
task: OPS49
---
Light runners removed (owner decision D110, 19 Nov 2026): R5.57 is removed, no light runner is made, the label crsp-light is refused on a new runner and the route queue light is gone. On upgrade the reconcile drains and removes every old light runner (registration, service, account, folder, record), one INFO line each, at most 5 tries, a failure shows in the doctor.
