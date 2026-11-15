---
change: minor
task: RES10
---
The runner version, its SHA-256 per OS and architecture, and the base image digest now live in one embedded file, `internal/runners/pins.json`; the file is refused whole when a hash or an image reference is not valid, and a tag is never a pin (R5.68). The download check and the runner file swap are unchanged.
