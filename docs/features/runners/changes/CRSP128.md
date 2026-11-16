---
change: minor
task: CRSP128
---
A repository keeps at most one light runner record per OS (R5.57): a failed one is tried again in place after a backoff of 1, 2, 4, 8 and 16 minutes, at most 5 tries, with its reason shown; before each try its registration, service and record are removed, and a name is never reused while a record or a service holds it. A runner shows the state it really has (R5.79): `idle` only when GitHub lists it online and not busy and its service runs; otherwise `not registered`, `stopped`, `offline` or `unknown`, each with a reason. The runner object carries `machine_name` and `reason`. Removing a failed runner cleans up what it left and needs no registration.
