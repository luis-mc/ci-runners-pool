---
change: minor
task: OPS23
---
Long-lived runners serve every repository that uses the pool (R5.88): `POST /runner-plans` without scope adds pool runners (machine, system, labels); the reconcile keeps one hidden registration for each pool runner and pool-on repository, drained and removed on pool off; a slot lock keeps one repository's job on a slot; repository runners migrate with their registration kept. The runner list returns `serving` and `registrations`.
