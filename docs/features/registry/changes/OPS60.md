---
change: minor
task: OPS60
---
R5.82: the Linux image build copies a Linux crsp of the image's architecture (own binary on a same-arch Linux host, else the checksum-checked release asset of the same version kept in the data folder) and refuses a Windows, macOS or wrong-arch file before docker starts.
