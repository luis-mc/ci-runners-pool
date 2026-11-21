---
change: minor
task: CRSP204
---
A persistent Linux container runner gets its image through the ensure-image path (local, registry, build), and every image reference is checked before any docker call; fixes 'invalid reference format' when adding the runner.
