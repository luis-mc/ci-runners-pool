---
change: minor
task: CRSP26
---
The persistent backends write CI_TOOLS_DIR, CARGO_TARGET_DIR, CI_TOOLS_QUOTA_GIB and CRSP_RUST_CACHE_CAP_GIB into each runner's .env (R5.39), so a rerun rewrites the .env of runners made before.
