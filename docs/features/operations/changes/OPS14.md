---
change: minor
task: OPS14
---
The controller address is chosen in the console (Settings > Console > Network, and the Needs-you box of Access for CI), not with CRSP_LISTEN_ADDR on the service. The controller keeps the choice, restarts once through the drain path, listens on it over https with a certificate that covers it, and keeps 127.0.0.1 (R5.90).
