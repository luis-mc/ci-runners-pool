---
change: minor
task: CRSP26
---
Takes over from the dev-standards pool (D302) the Rust build-cache cap, the per-runner tool-cache quotas and vm_check (R5.39, R5.40). Each persistent runner exports its own CI_TOOLS_DIR, CARGO_TARGET_DIR and the quotas. internal/vmcheck ports the logic of vm_check.py and the data of vm-images.json; VM boot waits for the KVM backend.
