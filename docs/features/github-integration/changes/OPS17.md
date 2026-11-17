---
change: minor
task: OPS17
---
Every sign-in failure has its own code and a plain message and is logged at WARN with the code and cause, never a token; sign-in on the local address works while TLS is on for the LAN address (R5.8); browser certificate refusals log at DEBUG.
