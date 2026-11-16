---
change: minor
task: CRSP122
---
Add a machine can download an installer (R5.65, owner decision D70): a `.cmd`, `.sh` or `.command` file with the controller address, the certificate fingerprint and a one-time 15-minute join code built in. `createJoinFile` and `crsp machine join-file` make it; the audit never holds the code. The controller serves the release packages it was built from (`getPackage`), checked against SHA256SUMS. Not run on real Windows or macOS machines yet.
