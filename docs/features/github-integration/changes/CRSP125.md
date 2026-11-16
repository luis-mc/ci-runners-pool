---
change: minor
task: CRSP125
---
Repositories that left an installation are marked (`left_at`, migration 00015) by the user's sync and the reconcile and hidden from listings, and a served one is turned off with the audit entry. The admin flag is yes, no or unknown (`user_admin_known`); unknown is resolved by asking GitHub fresh with `refresh=true`, which also forces a sync. The sync throttle is one minute and a change of the repository set drops it (R5.18, R5.22; CRSP125).
