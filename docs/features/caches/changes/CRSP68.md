---
change: minor
task: CRSP68
---
The pool start takes lane 1 of the repository when it makes the pool container, mounts it and sets `CI_TOOLS_DIR`, `CARGO_TARGET_DIR` and `RUNNER_TOOL_CACHE`; it sets `PLAYWRIGHT_BROWSERS_PATH` for a pool with the `browsers` layer (R5.41, R5.43).
