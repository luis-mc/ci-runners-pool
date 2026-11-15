---
change: minor
task: RES12
---
Tool artifacts for VM jobs: an OCI image pulled by digest, checked, unpacked on the host and attached read-only at VM boot as a disk or a virtiofs share; `backend.ToolBooter` is the VM backend hook, tested with fakes (R5.80). No VM backend implements it yet.
