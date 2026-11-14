---
change: minor
task: TRAY1
---
The tray's Open signs in with a one-time link: the controller builds the sign-in service on its database, the local channel makes a 60-second single-use link for the bound OS user (stored as a hash, loopback only, audited), an unbound OS user is sent to GitHub sign-in and bound after it, and a used or expired link shows the sign-in page with a link-expired message (R5.7, R5.9 sign-in and binding, R5.10, R6.1). The console list of bindings with Remove is not built yet.
