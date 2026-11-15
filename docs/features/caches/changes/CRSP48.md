---
change: minor
task: CRSP48
---
Rust cache cap built (R5.45): key in use kept, newest other key last, `incremental/` first, and a cap per cache key (`cache_rust_key_gib`, default 25). New R5.48 (pool-wide disk budget on a 10-minute agent timer, `cache_budget_gib`, default 150, never touches a runner with a job running) and R5.49 (size alert past `cache_alert_gib`, default 20), both built. Defaults decision D5 and open questions Q7 to Q10 recorded (CRSP48).
