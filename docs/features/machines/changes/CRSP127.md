---
change: minor
task: CRSP127
---
The agent link carries the container engine and the OS of its containers; the machines service records it (R5.18). The machine list says "Windows, runs Linux containers" for a Windows machine with Docker Desktop on WSL2. The `wsl2` backend is no longer reported "not ready" when Docker Desktop's WSL2 engine works (no OS setting is changed), and the reason a backend cannot be used is written once on the machine page.
