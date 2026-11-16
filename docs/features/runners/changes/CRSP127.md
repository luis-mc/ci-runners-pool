---
change: minor
task: CRSP127
---
Linux runners on a Windows machine (R5.47). The agent reports the OS its container engine runs (`container_os`) in the machine report; the machines service records it and the machine API shows it. Add runners offers System Linux on a Windows machine whose engine runs Linux containers, as an ephemeral container runner (labels self-hosted, linux, the architecture and the pool label) started through the Windows `docker` command with the same run-argument rules as on Linux. The container backend is registered in the Windows binary. `RUNS_ON_LINUX` is written when such a machine is online. A Windows machine with no engine, or with Windows containers, is still refused Linux.
