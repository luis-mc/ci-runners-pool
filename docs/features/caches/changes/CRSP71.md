---
change: minor
task: CRSP71
---
`crsp vm prune` (old and unlisted images and base disks, newest per distro kept, nothing a running VM uses), a prepared base disk per image with the run overlay on it, the shared VM cache (flock lock, temporary name and rename, mode 2775, size cap trimmed between jobs, leases), and the memory warning before a boot (R5.46 in part, R5.47 in part; open questions 19, 20, 21).
