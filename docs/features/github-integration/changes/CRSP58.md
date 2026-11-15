---
change: minor
task: CRSP58
---
REST polling is wired into the controller (R5.37): every 15 seconds with a back-off, If-None-Match on the runs list, the rate-limit rules kept. A demand loop matches the `runs-on` labels of each queued job to a machine and starts one ephemeral JIT runner, within the machine's job slots. Two open questions added.
