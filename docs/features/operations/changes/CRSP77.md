---
change: minor
task: CRSP77
---
R5.1: the install scripts check build provenance after the SHA-256: with `gh`, `gh attestation verify <file> --repo luis-mc/ci-runners-shared-pool` and stop on failure; without `gh`, say that only the checksum was checked and how to verify by hand, then go on. `scripts/install/install.sh` and `install.ps1` are written (CRSP77, owner decision D51).
