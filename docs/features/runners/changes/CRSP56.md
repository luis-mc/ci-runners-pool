---
change: minor
task: CRSP56
---
Image layers `windows-packaging`, `linux-packaging`, `llvm` and `kvm` as Dockerfiles built in CI (R5.50, R5.43, R5.41); layer table, extra package names and image key (R5.51); Wine prefix per runner, made once, `TMPDIR` unset, `POOL_WINE_PREFIX` (R5.42, R5.52); KVM as a device only, label needs a usable device, bounded wait and the compose loader (R5.41). Open questions 14 to 17.
