---
change: minor
task: OPS31
---
Symbolic link right (R5.42): one Windows CI step turns Developer Mode on and runs the real `ProbeSymlink` with a real link (`TestProbeSymlinkReal`, set `CRSP_REAL_SYMLINK=1`); it checks the link works, Developer Mode reads as on and the temporary folder is removed. The unit tests keep their fake link.
