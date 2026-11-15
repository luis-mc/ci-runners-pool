# HND11 report: slots held by leases

Source: dev-standards-handover lesson 4, rule D3. Status: in progress.

Plan
1. Migration 00013: slots get holder_id and lease_expires_at (backfilled, no column dropped).
2. slots/scheduler: take sets a lease; Renew and RenewJobs extend it; sweep reclaims an expired lease; pid reconcile removed.
3. Wire: agent holder report renews leases of the machine's running jobs.
4. Tests, spec R5.69, change note.

Log
- started
- slots hold lease (holder_id, lease_expires_at), Renew/RenewJobs, pid Reconcile removed
- agent sends holder report every load tick; controller renews leases
- migration 00013, spec R5.69, change note HND11
